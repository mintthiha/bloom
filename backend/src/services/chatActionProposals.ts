// Turns the AI chat's tool calls into drafts the user confirms: types, validation, request detection, and the tool definitions sent to the model.
// The implementation lives in ./chatAction/; this file keeps the original import path stable
// for routes, other services, and test mocks.
export type {
  ProposedChatActionStatus,
  ProposedBudgetAction,
  ProposedSavingsGoalAction,
  ProposedSavingsGoalChangeAction,
  ProposedCategorizationRuleAction,
  ProposedBudgetDeletionAction,
  ProposedSavingsGoalDeletionAction,
  ProposedCategorizationRuleDeletionAction,
  ProposedChatAction,
  ChatActionReferenceData,
  ToolCallContext,
  ToolCallInterpretation,
  ReplayableChatMessage,
} from "./chatAction/chatActionTypes";
export { readTextArgument, mentionsPhrase, findMatchingName } from "./chatAction/chatActionShared";
export {
  answerUnsupportedCommand,
  interpretToolCall,
  selectUserMessagesSinceLastDraft,
  selectToolNameOfDraftJustShown,
} from "./chatAction/chatActionRouting";
export {
  buildChatActionTools,
  buildChatActionInstructions,
  toModelMessages,
} from "./chatAction/chatActionTools";
