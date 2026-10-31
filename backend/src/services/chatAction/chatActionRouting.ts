// Decides whether the user actually asked for a change, dispatches tool calls, and tracks which draft is in play.
// Split out of chatActionProposals.ts, which re-exports its public API.
import type {
  ChatActionReferenceData,
  ToolCallContext,
  ToolCallInterpretation,
  ReplayableChatMessage,
} from "./chatActionTypes";
import {
  PROPOSE_BUDGET_TOOL_NAME,
  PROPOSE_SAVINGS_GOAL_TOOL_NAME,
  PROPOSE_SAVINGS_GOAL_CHANGE_TOOL_NAME,
  PROPOSE_CATEGORIZATION_RULE_TOOL_NAME,
  PROPOSE_DELETION_TOOL_NAME,
  EXPLAIN_UNSUPPORTED_REQUEST_TOOL_NAME,
  UNKNOWN_TOOL_REPLY,
  CHAT_CAPABILITIES,
  UNSUPPORTED_REQUEST_REPLIES,
  mentionsPhrase,
  withoutProposal,
  detectUnsupportedRequestKind,
} from "./chatActionShared";
import {
  interpretBudgetProposal,
  interpretSavingsGoalProposal,
  interpretSavingsGoalChangeProposal,
  interpretCategorizationRuleProposal,
  interpretDeletionProposal,
  interpretUnsupportedRequest,
} from "./chatActionInterpreters";
import { toToolCall } from "./chatActionTools";

// What the user's own words must touch on before each draft tool may act. A small model reaches
// for the nearest tool when asked for something none of them do — it drafted a rule for "add a
// $50 Costco transaction" and a goal for "transfer $200" — so a draft is made only when the user
// actually asked for that kind of change.
const GOAL_REQUEST_PATTERN =
  /\b(goals?|save|saves|saving|savings|put (away|aside)|target|deadline|rename)\b/i;
const REQUEST_PATTERN_BY_TOOL_NAME: Record<string, RegExp> = {
  [PROPOSE_BUDGET_TOOL_NAME]: /\b(budgets?|limit|cap|spend|spending)\b/i,
  [PROPOSE_SAVINGS_GOAL_TOOL_NAME]: GOAL_REQUEST_PATTERN,
  [PROPOSE_SAVINGS_GOAL_CHANGE_TOOL_NAME]: GOAL_REQUEST_PATTERN,
  [PROPOSE_CATEGORIZATION_RULE_TOOL_NAME]:
    /\b(rules?|always|auto-?categori[sz]\w*|categori[sz]e\w*)\b|\b(go|goes|put|file|filed)\b[^.?!]*\b(under|into|in)\b/i,
  [PROPOSE_DELETION_TOOL_NAME]: /\b(delete|remove|get rid of|drop|erase|cancel)\b/i,
};

/** Treats creating and changing a savings goal as one kind of change, since either can follow the other. */
function toToolFamily(toolName: string): string {
  return toolName === PROPOSE_SAVINGS_GOAL_CHANGE_TOOL_NAME
    ? PROPOSE_SAVINGS_GOAL_TOOL_NAME
    : toolName;
}

// A request worded as a command ("open a TFSA for me", "can you transfer $200") rather than a
// question ("should I open a TFSA?"), which the model should still answer.
const COMMAND_PATTERN =
  /^\s*(please\s+)?((can|could|would|will) you\s+)?(please\s+)?(create|open|add|make|delete|remove|close|transfer|move|record|log|import|cancel|change|edit|update|rename|set up|enter)\b/i;

// Words that put a request within what the chat's tools cover — a draft, or a spending lookup
// ("add up my Costco purchases") — so the model gets to handle it.
const HANDLED_SUBJECT_PATTERN =
  /\b(budgets?|goals?|rules?|always|limit|save|saving|savings|auto-?categori[sz]\w*|categori[sz]e\w*|spend|spent|spending|add up|total|how much)\b/i;

/**
 * Answers a command the chat can't carry out — "open a TFSA for me", "transfer $200 to savings" —
 * with its fixed reply, before the model is asked at all. Left to the model, these sometimes came
 * back as a made-up plan ("I'll draft the transfer for you") without any tool being called, so
 * nothing could check them. Anything that mentions a budget, goal, rule, or spending, or one of
 * the user's own budgets, goals, or rules by name, still goes to the model. Returns null for those,
 * and for anything that isn't a command.
 */
export function answerUnsupportedCommand(
  question: string,
  referenceData: ChatActionReferenceData
): string | null {
  if (!COMMAND_PATTERN.test(question) || HANDLED_SUBJECT_PATTERN.test(question)) return null;
  const draftableNames = [
    ...referenceData.budgets.map((budget) => budget.category),
    ...referenceData.savingsGoals.map((goal) => goal.name),
    ...referenceData.rules.map((rule) => rule.merchant),
  ];
  if (draftableNames.some((name) => mentionsPhrase(question, name))) return null;
  const unsupportedRequestKind = detectUnsupportedRequestKind(question);
  return unsupportedRequestKind
    ? `${UNSUPPORTED_REQUEST_REPLIES[unsupportedRequestKind]} ${CHAT_CAPABILITIES}`
    : null;
}

/**
 * Whether the user's own words ask for the kind of change a draft tool makes. Naming one of their
 * goals counts for the goal tools, so "bump Japan trip to 4500" still reaches the goal, and so
 * does answering the card just shown.
 */
function isRequestedByUser(
  toolName: string,
  { referenceData, question, earlierUserMessages, toolNameOfDraftJustShown }: ToolCallContext
): boolean {
  const requestPattern = REQUEST_PATTERN_BY_TOOL_NAME[toolName];
  if (!requestPattern) return true;
  // A reply to the card just shown ("actually, make it $450") is a request for the same change.
  if (
    toolNameOfDraftJustShown &&
    toToolFamily(toolNameOfDraftJustShown) === toToolFamily(toolName)
  ) {
    return true;
  }
  const userMessages = [question, ...earlierUserMessages];
  if (userMessages.some((userMessage) => requestPattern.test(userMessage))) return true;
  const isGoalTool =
    toolName === PROPOSE_SAVINGS_GOAL_TOOL_NAME ||
    toolName === PROPOSE_SAVINGS_GOAL_CHANGE_TOOL_NAME;
  return (
    isGoalTool &&
    referenceData.savingsGoals.some((goal) =>
      userMessages.some((userMessage) => mentionsPhrase(userMessage, goal.name))
    )
  );
}

/**
 * Answers a draft tool call the user never asked for. When the request is one the chat can't
 * carry out, the fixed reply for it names the right page; otherwise the user is told what the
 * chat can do so they can rephrase.
 */
function describeUnrequestedDraft(question: string): ToolCallInterpretation {
  const unsupportedRequestKind = detectUnsupportedRequestKind(question);
  return withoutProposal(
    unsupportedRequestKind
      ? `${UNSUPPORTED_REQUEST_REPLIES[unsupportedRequestKind]} ${CHAT_CAPABILITIES}`
      : `I'm not sure what you'd like me to change. ${CHAT_CAPABILITIES}`
  );
}

/**
 * Turns one tool call from the model into a draft the user can confirm. The model's arguments are
 * never trusted: the user's own words must ask for that kind of change, every value is checked
 * against the user's own categories and accounts, an amount must be one the user typed, and a
 * call that doesn't hold up becomes a question for the user instead of a draft.
 */
export function interpretToolCall(
  toolName: string,
  toolArguments: Record<string, unknown>,
  context: ToolCallContext
): ToolCallInterpretation {
  if (!isRequestedByUser(toolName, context)) return describeUnrequestedDraft(context.question);
  switch (toolName) {
    case PROPOSE_BUDGET_TOOL_NAME:
      return interpretBudgetProposal(toolArguments, context);
    case PROPOSE_SAVINGS_GOAL_TOOL_NAME:
      return interpretSavingsGoalProposal(toolArguments, context);
    case PROPOSE_SAVINGS_GOAL_CHANGE_TOOL_NAME:
      return interpretSavingsGoalChangeProposal(toolArguments, context);
    case PROPOSE_CATEGORIZATION_RULE_TOOL_NAME:
      return interpretCategorizationRuleProposal(toolArguments, context);
    case PROPOSE_DELETION_TOOL_NAME:
      return interpretDeletionProposal(toolArguments, context);
    case EXPLAIN_UNSUPPORTED_REQUEST_TOOL_NAME:
      return interpretUnsupportedRequest(toolArguments, context);
    default:
      return withoutProposal(UNKNOWN_TOOL_REPLY);
  }
}

/**
 * Picks out the user's messages that belong to the request still being worked out: everything
 * they sent since the last reply that carried a draft. What they typed before that draft belongs
 * to a request that is already settled, and must not make an amount the model made up for a new
 * request look like one the user gave.
 */
export function selectUserMessagesSinceLastDraft(messages: ReplayableChatMessage[]): string[] {
  const lastDraftIndex = messages
    .map((message) => message.proposedAction !== null)
    .lastIndexOf(true);
  return messages
    .slice(lastDraftIndex + 1)
    .filter((message) => message.role === "user")
    .map((message) => message.content);
}

/**
 * Names the tool behind the draft in the conversation's last reply, so a reply to that card counts
 * as asking for the same kind of change. Null when the last message carried no draft.
 */
export function selectToolNameOfDraftJustShown(messages: ReplayableChatMessage[]): string | null {
  const lastMessage = messages.at(-1);
  return lastMessage?.proposedAction ? toToolCall(lastMessage.proposedAction).name : null;
}
