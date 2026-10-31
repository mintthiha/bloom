// The tool definitions and instructions sent to the model, and how stored drafts are replayed as tool calls.
// Split out of chatActionProposals.ts, which re-exports its public API.
import type { OllamaChatMessage, OllamaToolDefinition } from "../../lib/ollama-client";
import type {
  ProposedChatAction,
  ChatActionReferenceData,
  ReplayableChatMessage,
} from "./chatActionTypes";
import {
  PROPOSE_BUDGET_TOOL_NAME,
  PROPOSE_SAVINGS_GOAL_TOOL_NAME,
  PROPOSE_SAVINGS_GOAL_CHANGE_TOOL_NAME,
  PROPOSE_CATEGORIZATION_RULE_TOOL_NAME,
  PROPOSE_DELETION_TOOL_NAME,
  EXPLAIN_UNSUPPORTED_REQUEST_TOOL_NAME,
  DELETABLE_ITEM_TYPES,
  PROPOSAL_OUTCOME_BY_STATUS,
  UNSUPPORTED_REQUEST_REPLIES,
  toDateOnly,
  describeAccount,
} from "./chatActionShared";
import { listDeletionCandidates } from "./chatActionInterpreters";

/**
 * Describes the write actions to the model. Categories and accounts are offered as fixed choices
 * so the model picks from what the user really has. The savings goal tool is left out for a user
 * with no account to attach a goal to, the goal change tool for a user with no goals, and the
 * deletion tool for a user with nothing it could delete.
 */
export function buildChatActionTools(
  referenceData: ChatActionReferenceData
): OllamaToolDefinition[] {
  const tools: OllamaToolDefinition[] = [
    {
      type: "function",
      function: {
        name: PROPOSE_BUDGET_TOOL_NAME,
        description:
          "Draft a monthly spending budget for one expense category, or a new limit for a " +
          "category that already has a budget.",
        parameters: {
          type: "object",
          properties: {
            category: { type: "string", enum: referenceData.expenseCategoryNames },
            monthlyLimit: {
              type: "number",
              description: "Monthly limit in dollars, as the user gave it.",
            },
          },
          required: ["category", "monthlyLimit"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: PROPOSE_CATEGORIZATION_RULE_TOOL_NAME,
        description:
          "Draft a rule that always files one merchant's transactions under one category.",
        parameters: {
          type: "object",
          properties: {
            merchant: { type: "string", description: "Merchant name, e.g. Tim Hortons." },
            category: {
              type: "string",
              enum: [...referenceData.expenseCategoryNames, ...referenceData.incomeCategoryNames],
            },
          },
          required: ["merchant", "category"],
        },
      },
    },
  ];
  if (referenceData.accounts.length > 0) {
    tools.push({
      type: "function",
      function: {
        name: PROPOSE_SAVINGS_GOAL_TOOL_NAME,
        description:
          "Draft a new savings goal that tracks the balance of one of the user's accounts.",
        parameters: {
          type: "object",
          properties: {
            // Not called "name": under that key (also the key of the tool call's own name) the
            // model left the argument out even when the user had said what the goal was for.
            goalName: {
              type: "string",
              description: "Short name saying what the goal is for.",
            },
            targetAmount: {
              type: "number",
              description: "Dollar amount the user said they want to save.",
            },
            targetDate: {
              type: "string",
              description: "Deadline as YYYY-MM-DD. Leave out when the user gave none.",
            },
            account: {
              type: "string",
              enum: [...new Set(referenceData.accounts.map(describeAccount))],
              description: "Account the user named. Leave out when they named none.",
            },
          },
          required: ["goalName", "targetAmount"],
        },
      },
    });
  }
  if (referenceData.savingsGoals.length > 0) {
    tools.push({
      type: "function",
      function: {
        name: PROPOSE_SAVINGS_GOAL_CHANGE_TOOL_NAME,
        description:
          "Draft changes to one of the user's existing savings goals: its name, target amount, " +
          "deadline, or account. Include only what the user asked to change.",
        parameters: {
          type: "object",
          properties: {
            goal: {
              type: "string",
              enum: [...new Set(referenceData.savingsGoals.map((goal) => goal.name))],
              description: "The existing goal to change.",
            },
            newGoalName: {
              type: "string",
              description: "New name for the goal. Leave out unless the user asked to rename it.",
            },
            targetAmount: {
              type: "number",
              description: "New target in dollars. Leave out unless the user gave a new one.",
            },
            targetDate: {
              type: "string",
              description: "New deadline as YYYY-MM-DD. Leave out unless the user gave a new one.",
            },
            account: {
              type: "string",
              enum: [...new Set(referenceData.accounts.map(describeAccount))],
              description: "Account to move the goal to. Leave out unless the user named one.",
            },
          },
          required: ["goal"],
        },
      },
    });
  }
  tools.push({
    type: "function",
    function: {
      name: EXPLAIN_UNSUPPORTED_REQUEST_TOOL_NAME,
      description:
        "Use when the user asks you to change something in Bloom that no other tool does: open " +
        "or delete an account, add, import, edit, or delete a transaction, make a transfer, add " +
        "a category, change a subscription, or change a setting. Never use another tool for these.",
      parameters: {
        type: "object",
        properties: {
          request: {
            type: "string",
            enum: Object.keys(UNSUPPORTED_REQUEST_REPLIES),
            description: "What the user asked to change.",
          },
        },
        required: ["request"],
      },
    },
  });
  const deletionCandidates = listDeletionCandidates(referenceData);
  if (deletionCandidates.length > 0) {
    tools.push({
      type: "function",
      function: {
        name: PROPOSE_DELETION_TOOL_NAME,
        description:
          "Draft deleting one of the user's budgets, savings goals, or categorization rules. " +
          "Nothing else can be deleted here.",
        parameters: {
          type: "object",
          properties: {
            itemType: {
              type: "string",
              enum: [...new Set(deletionCandidates.map((candidate) => candidate.itemType))],
            },
            name: {
              type: "string",
              enum: [...new Set(deletionCandidates.map((candidate) => candidate.name))],
              description: "The budget's category, the goal's name, or the rule's merchant.",
            },
          },
          required: ["itemType", "name"],
        },
      },
    });
  }
  return tools;
}

/**
 * The system-prompt section that tells the model when to use the tools. It carries today's date
 * because a request like "a trip in June" can only become a deadline relative to it.
 */
export function buildChatActionInstructions(
  referenceData: ChatActionReferenceData,
  today: Date
): string {
  const lines = [
    `ACTIONS (today is ${toDateOnly(today)}). Your tools are the only way you can change ` +
      `anything in Bloom. When the user clearly asks to set or change a budget, create or change ` +
      `a savings goal, create or change a categorization rule, or delete one of those, call the ` +
      `matching tool instead of explaining how to do it. A tool call only shows the user a ` +
      `draft card: nothing is saved or deleted until they confirm the card, so never say that ` +
      `something was saved or deleted, and never write a draft out yourself. Use only the ` +
      `amounts, dates, categories, and accounts the user gave, and ask for a missing one instead ` +
      `of guessing. Name a savings goal after what it is for. Draft one thing per reply.`,
    `For any other change to their data — an account, a transaction, a transfer, a category, a ` +
      `subscription, or a setting — call explain_unsupported_request and no other tool. For ` +
      `every other question, answer in text and call no tool.`,
  ];
  if (referenceData.accounts.length === 0) {
    lines.push(
      "The user has no accounts in Bloom yet, so a savings goal cannot be drafted until they add one."
    );
  }
  return lines.join("\n");
}

/** Rebuilds the tool call that produced a stored draft, so it can be replayed to the model. */
export function toToolCall(proposedAction: ProposedChatAction): {
  name: string;
  arguments: Record<string, unknown>;
} {
  switch (proposedAction.kind) {
    case "BUDGET":
      return {
        name: PROPOSE_BUDGET_TOOL_NAME,
        arguments: {
          category: proposedAction.category,
          monthlyLimit: proposedAction.monthlyLimit,
        },
      };
    case "SAVINGS_GOAL":
      return {
        name: PROPOSE_SAVINGS_GOAL_TOOL_NAME,
        arguments: {
          goalName: proposedAction.name,
          targetAmount: proposedAction.targetAmount,
          ...(proposedAction.targetDate ? { targetDate: proposedAction.targetDate } : {}),
          account: proposedAction.accountLabel,
        },
      };
    case "SAVINGS_GOAL_CHANGE":
      return {
        name: PROPOSE_SAVINGS_GOAL_CHANGE_TOOL_NAME,
        arguments: {
          goal: proposedAction.currentName,
          ...(proposedAction.name !== null ? { newGoalName: proposedAction.name } : {}),
          ...(proposedAction.targetAmount !== null
            ? { targetAmount: proposedAction.targetAmount }
            : {}),
          ...(proposedAction.targetDate !== null ? { targetDate: proposedAction.targetDate } : {}),
          ...(proposedAction.accountLabel !== null ? { account: proposedAction.accountLabel } : {}),
        },
      };
    case "CATEGORIZATION_RULE":
      return {
        name: PROPOSE_CATEGORIZATION_RULE_TOOL_NAME,
        arguments: { merchant: proposedAction.merchant, category: proposedAction.category },
      };
    case "BUDGET_DELETION":
      return {
        name: PROPOSE_DELETION_TOOL_NAME,
        arguments: { itemType: DELETABLE_ITEM_TYPES.budget, name: proposedAction.category },
      };
    case "SAVINGS_GOAL_DELETION":
      return {
        name: PROPOSE_DELETION_TOOL_NAME,
        arguments: { itemType: DELETABLE_ITEM_TYPES.savingsGoal, name: proposedAction.name },
      };
    case "CATEGORIZATION_RULE_DELETION":
      return {
        name: PROPOSE_DELETION_TOOL_NAME,
        arguments: {
          itemType: DELETABLE_ITEM_TYPES.categorizationRule,
          name: proposedAction.merchant,
        },
      };
  }
}

/**
 * Converts one stored turn into the messages the model sees for it. A reply that carried a draft
 * is replayed as the tool call it really was, followed by what the user did with the draft —
 * replayed as plain text, it would teach the model to describe a draft instead of calling the
 * tool, and would hide whether the draft was ever saved.
 */
export function toModelMessages(message: ReplayableChatMessage): OllamaChatMessage[] {
  if (!message.proposedAction || !message.proposedActionStatus) {
    return [{ role: message.role, content: message.content }];
  }
  return [
    {
      role: "assistant",
      content: "",
      tool_calls: [{ function: toToolCall(message.proposedAction) }],
    },
    { role: "tool", content: PROPOSAL_OUTCOME_BY_STATUS[message.proposedActionStatus] },
    { role: "assistant", content: message.content },
  ];
}
