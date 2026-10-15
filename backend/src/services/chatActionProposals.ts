import type { OllamaChatMessage, OllamaToolDefinition } from "../lib/ollama-client";
import { requireString } from "../lib/validation";
import { parseOptionalDateOnly } from "./profileOptions";

export type ProposedChatActionStatus = "PENDING" | "CONFIRMED" | "DISMISSED";

export type ProposedBudgetAction = {
  kind: "BUDGET";
  category: string;
  monthlyLimit: number;
  /** The limit this draft would replace, or null when the category has no budget yet. */
  currentMonthlyLimit: number | null;
};

export type ProposedSavingsGoalAction = {
  kind: "SAVINGS_GOAL";
  name: string;
  targetAmount: number;
  /** `YYYY-MM-DD` deadline, or null when the goal is open-ended. */
  targetDate: string | null;
  accountId: string;
  /** The account as it was described to the user, e.g. "Rainy day (Savings)". */
  accountLabel: string;
};

/**
 * Changes to one of the user's existing savings goals. Each changeable field holds its new value,
 * or null when the draft leaves it as it is; the matching `current…` field is what it replaces.
 */
export type ProposedSavingsGoalChangeAction = {
  kind: "SAVINGS_GOAL_CHANGE";
  goalId: string;
  /** The goal's name when the draft was made, which is how the user recognizes it. */
  currentName: string;
  name: string | null;
  targetAmount: number | null;
  currentTargetAmount: number;
  /** New `YYYY-MM-DD` deadline, or null to keep the current one. */
  targetDate: string | null;
  /** The deadline it replaces, or null when the goal is open-ended. */
  currentTargetDate: string | null;
  accountId: string | null;
  /** The account the goal would move to, e.g. "Rainy day (Savings)". */
  accountLabel: string | null;
  currentAccountLabel: string;
};

export type ProposedCategorizationRuleAction = {
  kind: "CATEGORIZATION_RULE";
  merchant: string;
  category: string;
  /** The category this merchant's existing rule points at, or null when it has no rule yet. */
  currentCategory: string | null;
};

/** A write the model drafted for the user. Nothing is saved until the user confirms it. */
export type ProposedChatAction =
  | ProposedBudgetAction
  | ProposedSavingsGoalAction
  | ProposedSavingsGoalChangeAction
  | ProposedCategorizationRuleAction;

/** What the user already has in Bloom: the values a draft must use, and what it would replace. */
export type ChatActionReferenceData = {
  expenseCategoryNames: string[];
  incomeCategoryNames: string[];
  accounts: { id: string; name: string; accountType: string }[];
  budgets: { category: string; monthlyLimit: number }[];
  rules: { merchant: string; category: string }[];
  savingsGoals: {
    id: string;
    name: string;
    targetAmount: number;
    /** `YYYY-MM-DD` deadline, or null when the goal is open-ended. */
    targetDate: string | null;
    accountId: string;
  }[];
};

/** Everything one tool call from the model is checked against. */
export type ToolCallContext = {
  referenceData: ChatActionReferenceData;
  /** The day the question was asked, which a deadline must not fall before. */
  today: Date;
  /** The question the model is answering. */
  question: string;
  /**
   * The user's earlier messages that belong to the same request, oldest first — see
   * `selectUserMessagesSinceLastDraft`.
   */
  earlierUserMessages: string[];
};

/**
 * The outcome of one tool call: a validated draft with the line that introduces its card, or no
 * draft and a line telling the user what is missing or wrong.
 */
export type ToolCallInterpretation = { proposedAction: ProposedChatAction | null; reply: string };

/** A stored conversation turn, as far as replaying it to the model is concerned. */
export type ReplayableChatMessage = {
  role: "user" | "assistant";
  content: string;
  proposedAction: ProposedChatAction | null;
  proposedActionStatus: ProposedChatActionStatus | null;
};

const PROPOSE_BUDGET_TOOL_NAME = "propose_budget";
const PROPOSE_SAVINGS_GOAL_TOOL_NAME = "propose_savings_goal";
const PROPOSE_SAVINGS_GOAL_CHANGE_TOOL_NAME = "propose_savings_goal_change";
const PROPOSE_CATEGORIZATION_RULE_TOOL_NAME = "propose_categorization_rule";

// The same length limits the budget, savings goal, and categorization rule routes enforce.
const MAX_CATEGORY_LENGTH = 50;
const MAX_GOAL_NAME_LENGTH = 100;
const MAX_MERCHANT_LENGTH = 100;
const MAX_ACCOUNT_REFERENCE_LENGTH = 200;

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CHEQUING: "Chequing",
  SAVINGS: "Savings",
  TFSA: "TFSA",
  RRSP: "RRSP",
  FHSA: "FHSA",
  CREDIT: "Credit",
};

/** What the model is told became of a draft it made earlier in the conversation. */
const PROPOSAL_OUTCOME_BY_STATUS: Record<ProposedChatActionStatus, string> = {
  PENDING:
    "Shown to the user as a card. They have not confirmed or dismissed it yet, so nothing is saved.",
  CONFIRMED: "The user confirmed this draft and it was saved.",
  DISMISSED: "The user dismissed this draft. Nothing was saved.",
};

/** Closes every line that introduces a draft, so the user knows the card still needs them. */
const REVIEW_REMINDER = "Review it below — nothing is saved until you confirm.";

// A number the way a user types an amount: optional thousands separators and decimals, and an
// optional "k" for thousands ("3k", "1.5k").
const STATED_AMOUNT_PATTERN = /(\d[\d,]*(?:\.\d+)?)\s?(k(?![a-z]))?/gi;

const UNKNOWN_TOOL_REPLY =
  "I couldn't turn that into something I can save. I can draft a budget, a savings goal, or a " +
  "categorization rule for you to confirm.";

/** Renders a date as the `YYYY-MM-DD` day it falls on in UTC. */
function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Lowercases and collapses spacing so a name the model typed can be compared with a stored one. */
function toComparableText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Names an account the way the model and the user see it, e.g. "Rainy day (Savings)". */
function describeAccount(account: ChatActionReferenceData["accounts"][number]): string {
  return `${account.name} (${ACCOUNT_TYPE_LABELS[account.accountType] ?? account.accountType})`;
}

/**
 * Reads a text argument with the same cleanup the HTTP routes apply to typed input. Returns null
 * when the model left it out, sent something that is not text, or sent more than `maxLength`.
 */
function readTextArgument(value: unknown, maxLength: number): string | null {
  try {
    return requireString(value, "argument", { max: maxLength });
  } catch {
    return null;
  }
}

/** Rounds a dollar amount to whole cents. */
function roundToCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** Collects every number the user typed, so an amount from the model can be checked against them. */
function extractStatedAmounts(userMessages: string[]): number[] {
  return userMessages.flatMap((userMessage) =>
    [...userMessage.matchAll(STATED_AMOUNT_PATTERN)].map(([, digits, thousandsSuffix]) =>
      roundToCents(Number(digits!.replace(/,/g, "")) * (thousandsSuffix ? 1000 : 1))
    )
  );
}

/**
 * Reads a dollar amount, rounded to cents. Small models often send numbers as text ("400",
 * "$1,200"), so those are accepted too. Returns null for anything that is not a positive amount —
 * and for an amount the user never typed: asked for a budget or goal without one, the model
 * tends to fill it in with a guess (such as a balance from the user's snapshot) rather than ask.
 */
function readAmountArgument(value: unknown, statedAmounts: number[]): number | null {
  const amount = typeof value === "string" ? Number(value.replace(/[$,\s]/g, "")) : value;
  if (typeof amount !== "number" || !Number.isFinite(amount)) return null;
  const amountRoundedToCents = roundToCents(amount);
  if (amountRoundedToCents <= 0 || !statedAmounts.includes(amountRoundedToCents)) return null;
  return amountRoundedToCents;
}

/** Whether a text mentions a phrase as whole words, ignoring case and spacing. */
function mentionsPhrase(text: string, phrase: string): boolean {
  const comparablePhrase = toComparableText(phrase);
  if (!comparablePhrase) return false;
  const escapedPhrase = comparablePhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![a-z0-9])${escapedPhrase}(?![a-z0-9])`).test(toComparableText(text));
}

/** Finds the stored name that matches what the model typed, ignoring case and spacing. */
function findMatchingName(names: string[], requestedName: string): string | null {
  const comparableRequestedName = toComparableText(requestedName);
  return names.find((name) => toComparableText(name) === comparableRequestedName) ?? null;
}

/** Wraps a line for the user that explains why no draft was made. */
function withoutProposal(reply: string): ToolCallInterpretation {
  return { proposedAction: null, reply };
}

/** Validates a drafted budget against the user's expense categories and existing budgets. */
function interpretBudgetProposal(
  toolArguments: Record<string, unknown>,
  { referenceData, question, earlierUserMessages }: ToolCallContext
): ToolCallInterpretation {
  const categoryList = referenceData.expenseCategoryNames.join(", ");
  const requestedCategory = readTextArgument(toolArguments.category, MAX_CATEGORY_LENGTH);
  if (!requestedCategory) {
    return withoutProposal(
      `Which category should the budget be for? Your expense categories are: ${categoryList}.`
    );
  }
  const category = findMatchingName(referenceData.expenseCategoryNames, requestedCategory);
  if (!category) {
    return withoutProposal(
      `I can only set a budget for one of your expense categories, and "${requestedCategory}" ` +
        `isn't one of them. Yours are: ${categoryList}.`
    );
  }
  const monthlyLimit = readAmountArgument(
    toolArguments.monthlyLimit,
    extractStatedAmounts([question, ...earlierUserMessages])
  );
  if (monthlyLimit === null) {
    return withoutProposal(`How much should the monthly limit for ${category} be?`);
  }

  const existingBudget = referenceData.budgets.find(
    (budget) => toComparableText(budget.category) === toComparableText(category)
  );
  if (existingBudget?.monthlyLimit === monthlyLimit) {
    return withoutProposal(
      `Your ${category} budget is already set to that limit, so there is nothing to change.`
    );
  }
  return {
    proposedAction: {
      kind: "BUDGET",
      category,
      monthlyLimit,
      currentMonthlyLimit: existingBudget?.monthlyLimit ?? null,
    },
    reply: existingBudget
      ? `I've drafted a new limit for your ${category} budget. ${REVIEW_REMINDER}`
      : `I've drafted a monthly budget for ${category}. ${REVIEW_REMINDER}`,
  };
}

/**
 * Works out which account a savings goal should track. A user with one account needs no choice.
 * Otherwise the model's wording must point at exactly one of them — and when it doesn't, the
 * user's own messages are searched for an account name, newest first, because the model often
 * leaves out an account the user did name.
 */
function resolveGoalAccount(
  requestedAccount: string | null,
  accounts: ChatActionReferenceData["accounts"],
  userMessagesNewestFirst: string[]
): ChatActionReferenceData["accounts"][number] | null {
  if (accounts.length === 1) return accounts[0]!;

  const comparableRequestedAccount = requestedAccount ? toComparableText(requestedAccount) : null;
  const accountsNamedByModel = accounts.filter((account) =>
    [describeAccount(account), account.name].some(
      (accountReference) => toComparableText(accountReference) === comparableRequestedAccount
    )
  );
  if (accountsNamedByModel.length === 1) return accountsNamedByModel[0]!;

  for (const userMessage of userMessagesNewestFirst) {
    const accountsNamedByUser = accounts.filter((account) =>
      mentionsPhrase(userMessage, account.name)
    );
    if (accountsNamedByUser.length === 1) return accountsNamedByUser[0]!;
    if (accountsNamedByUser.length > 1) return null;
  }
  return null;
}

/**
 * Validates a drafted savings goal: its name, amount, deadline, and the account it tracks. A goal
 * named after one the user already has is treated as a change to that goal: asked to change a
 * goal, the model often reaches for this tool, and a second goal by the same name is never what
 * the user meant.
 */
function interpretSavingsGoalProposal(
  toolArguments: Record<string, unknown>,
  context: ToolCallContext
): ToolCallInterpretation {
  const { referenceData, today, question, earlierUserMessages } = context;
  if (referenceData.accounts.length === 0) {
    return withoutProposal(
      "A savings goal tracks the balance of one of your accounts, and you don't have an account " +
        "in Bloom yet. Add one first, then ask me again."
    );
  }
  // Both are asked for in one go: every extra round-trip costs the user a slow model reply.
  const name = readTextArgument(toolArguments.goalName, MAX_GOAL_NAME_LENGTH);
  if (
    name &&
    findMatchingName(
      referenceData.savingsGoals.map((goal) => goal.name),
      name
    )
  ) {
    return interpretSavingsGoalChangeProposal(
      {
        goal: name,
        targetAmount: toolArguments.targetAmount,
        targetDate: toolArguments.targetDate,
        account: toolArguments.account,
      },
      context
    );
  }
  const targetAmount = readAmountArgument(
    toolArguments.targetAmount,
    extractStatedAmounts([question, ...earlierUserMessages])
  );
  if (!name || targetAmount === null) {
    const missingDetails = [
      ...(name ? [] : ["what to call it"]),
      ...(targetAmount === null ? ["how much you want to save"] : []),
    ];
    return withoutProposal(`To draft that goal, tell me ${missingDetails.join(" and ")}.`);
  }

  let targetDate: string | null;
  try {
    const parsedTargetDate = parseOptionalDateOnly(toolArguments.targetDate, "targetDate");
    targetDate = parsedTargetDate ? toDateOnly(parsedTargetDate) : null;
  } catch {
    return withoutProposal(
      `I couldn't work out the deadline for "${name}". Tell me the date you're aiming for, like ` +
        `2027-06-30, or say it has no deadline.`
    );
  }
  if (targetDate !== null && targetDate < toDateOnly(today)) {
    return withoutProposal(
      `The deadline I worked out for "${name}" (${targetDate}) has already passed. What date ` +
        `are you aiming for?`
    );
  }

  const requestedAccount = readTextArgument(toolArguments.account, MAX_ACCOUNT_REFERENCE_LENGTH);
  const account = resolveGoalAccount(requestedAccount, referenceData.accounts, [
    question,
    ...[...earlierUserMessages].reverse(),
  ]);
  if (!account) {
    const accountList = referenceData.accounts.map(describeAccount).join(", ");
    return withoutProposal(
      requestedAccount
        ? `I couldn't tell which account you mean by "${requestedAccount}". Your accounts are: ` +
            `${accountList}.`
        : `Which account should "${name}" track? Your accounts are: ${accountList}.`
    );
  }
  return {
    proposedAction: {
      kind: "SAVINGS_GOAL",
      name,
      targetAmount,
      targetDate,
      accountId: account.id,
      accountLabel: describeAccount(account),
    },
    reply: `I've drafted a savings goal called "${name}". ${REVIEW_REMINDER}`,
  };
}

/**
 * Validates drafted changes to an existing savings goal, keeping only what actually differs from
 * the goal. A new amount must be one the user typed; one that isn't is dropped rather than asked
 * about, because the model tends to restate a goal's target (or make one up) when the user only
 * asked to move its deadline or account.
 */
function interpretSavingsGoalChangeProposal(
  toolArguments: Record<string, unknown>,
  { referenceData, today, question, earlierUserMessages }: ToolCallContext
): ToolCallInterpretation {
  if (referenceData.savingsGoals.length === 0) {
    return withoutProposal("You don't have any savings goals yet, so there is nothing to change.");
  }
  const goalList = referenceData.savingsGoals.map((goal) => `"${goal.name}"`).join(", ");
  const requestedGoal = readTextArgument(toolArguments.goal, MAX_GOAL_NAME_LENGTH);
  const matchingGoals = requestedGoal
    ? referenceData.savingsGoals.filter(
        (goal) => toComparableText(goal.name) === toComparableText(requestedGoal)
      )
    : [];
  if (matchingGoals.length === 0) {
    return withoutProposal(
      requestedGoal
        ? `I couldn't find a goal called "${requestedGoal}". Your goals are: ${goalList}.`
        : `Which goal should I change? Your goals are: ${goalList}.`
    );
  }
  if (matchingGoals.length > 1) {
    return withoutProposal(
      `You have more than one goal called "${matchingGoals[0]!.name}", so I can't tell which ` +
        `one to change. You can edit it on the Goals page.`
    );
  }
  const goal = matchingGoals[0]!;

  const requestedName = readTextArgument(toolArguments.newGoalName, MAX_GOAL_NAME_LENGTH);
  const name = requestedName !== null && requestedName !== goal.name ? requestedName : null;

  const requestedAmount = readAmountArgument(
    toolArguments.targetAmount,
    extractStatedAmounts([question, ...earlierUserMessages])
  );
  const targetAmount =
    requestedAmount !== null && requestedAmount !== goal.targetAmount ? requestedAmount : null;

  let requestedTargetDate: string | null;
  try {
    const parsedTargetDate = parseOptionalDateOnly(toolArguments.targetDate, "targetDate");
    requestedTargetDate = parsedTargetDate ? toDateOnly(parsedTargetDate) : null;
  } catch {
    return withoutProposal(
      `I couldn't work out the new deadline for "${goal.name}". Tell me the date you're aiming ` +
        `for, like 2027-06-30.`
    );
  }
  const targetDate = requestedTargetDate !== goal.targetDate ? requestedTargetDate : null;
  if (targetDate !== null && targetDate < toDateOnly(today)) {
    return withoutProposal(
      `The deadline I worked out for "${goal.name}" (${targetDate}) has already passed. What ` +
        `date are you aiming for?`
    );
  }

  const requestedAccount = readTextArgument(toolArguments.account, MAX_ACCOUNT_REFERENCE_LENGTH);
  let account: ChatActionReferenceData["accounts"][number] | null = null;
  if (requestedAccount) {
    const resolvedAccount = resolveGoalAccount(requestedAccount, referenceData.accounts, [
      question,
      ...[...earlierUserMessages].reverse(),
    ]);
    if (!resolvedAccount) {
      const accountList = referenceData.accounts.map(describeAccount).join(", ");
      return withoutProposal(
        `I couldn't tell which account you mean by "${requestedAccount}". Your accounts are: ` +
          `${accountList}.`
      );
    }
    if (resolvedAccount.id !== goal.accountId) account = resolvedAccount;
  }

  if (name === null && targetAmount === null && targetDate === null && account === null) {
    const wasGivenUnstatedAmount =
      toolArguments.targetAmount !== undefined && requestedAmount === null;
    return withoutProposal(
      wasGivenUnstatedAmount
        ? `How much should the new target for "${goal.name}" be?`
        : `What would you like to change about "${goal.name}"? I can change its name, target, ` +
            `deadline, or account.`
    );
  }

  const currentAccount = referenceData.accounts.find(
    (candidate) => candidate.id === goal.accountId
  );
  return {
    proposedAction: {
      kind: "SAVINGS_GOAL_CHANGE",
      goalId: goal.id,
      currentName: goal.name,
      name,
      targetAmount,
      currentTargetAmount: goal.targetAmount,
      targetDate,
      currentTargetDate: goal.targetDate,
      accountId: account?.id ?? null,
      accountLabel: account ? describeAccount(account) : null,
      currentAccountLabel: currentAccount ? describeAccount(currentAccount) : "Unknown account",
    },
    reply: `I've drafted changes to your "${goal.name}" goal. ${REVIEW_REMINDER}`,
  };
}

/** Validates a drafted categorization rule against the user's categories and existing rules. */
function interpretCategorizationRuleProposal(
  toolArguments: Record<string, unknown>,
  { referenceData }: ToolCallContext
): ToolCallInterpretation {
  const merchant = readTextArgument(toolArguments.merchant, MAX_MERCHANT_LENGTH);
  if (!merchant) return withoutProposal("Which merchant should the rule apply to?");

  const categoryNames = [
    ...referenceData.expenseCategoryNames,
    ...referenceData.incomeCategoryNames,
  ];
  const requestedCategory = readTextArgument(toolArguments.category, MAX_CATEGORY_LENGTH);
  if (!requestedCategory) {
    return withoutProposal(`Which category should ${merchant} transactions go in?`);
  }
  const category = findMatchingName(categoryNames, requestedCategory);
  if (!category) {
    return withoutProposal(
      `"${requestedCategory}" isn't one of your categories. Yours are: ${categoryNames.join(", ")}.`
    );
  }

  // Rules are keyed on the merchant exactly as typed, so the lookup is exact as well.
  const existingRule = referenceData.rules.find((rule) => rule.merchant === merchant);
  if (existingRule && toComparableText(existingRule.category) === toComparableText(category)) {
    return withoutProposal(`You already have a rule that puts ${merchant} in ${category}.`);
  }
  return {
    proposedAction: {
      kind: "CATEGORIZATION_RULE",
      merchant,
      category,
      currentCategory: existingRule?.category ?? null,
    },
    reply: `I've drafted a rule for ${merchant}. ${REVIEW_REMINDER}`,
  };
}

/**
 * Turns one tool call from the model into a draft the user can confirm. The model's arguments are
 * never trusted: every value is checked against the user's own categories and accounts, an
 * amount must be one the user typed, and a call that doesn't hold up becomes a question for the
 * user instead of a draft.
 */
export function interpretToolCall(
  toolName: string,
  toolArguments: Record<string, unknown>,
  context: ToolCallContext
): ToolCallInterpretation {
  switch (toolName) {
    case PROPOSE_BUDGET_TOOL_NAME:
      return interpretBudgetProposal(toolArguments, context);
    case PROPOSE_SAVINGS_GOAL_TOOL_NAME:
      return interpretSavingsGoalProposal(toolArguments, context);
    case PROPOSE_SAVINGS_GOAL_CHANGE_TOOL_NAME:
      return interpretSavingsGoalChangeProposal(toolArguments, context);
    case PROPOSE_CATEGORIZATION_RULE_TOOL_NAME:
      return interpretCategorizationRuleProposal(toolArguments, context);
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
 * Describes the write actions to the model. Categories and accounts are offered as fixed choices
 * so the model picks from what the user really has. The savings goal tool is left out for a user
 * with no account to attach a goal to, and the goal change tool for a user with no goals.
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
    `ACTIONS (today is ${toDateOnly(today)}). When the user clearly asks you to set or change a ` +
      `budget, create or change a savings goal, or make a categorization rule, call the matching tool ` +
      `instead of explaining how to do it. A tool call only shows the user a draft to confirm: ` +
      `nothing is saved until they confirm it, so never say that something was saved. Use only the ` +
      `amounts, dates, categories, and accounts the user gave, and ask for a missing one instead ` +
      `of guessing. Name a savings goal after what it is for. Draft one thing per reply. For ` +
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
function toToolCall(proposedAction: ProposedChatAction): {
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
