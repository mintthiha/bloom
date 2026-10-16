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

/** Deleting one of the user's budgets; the limit is shown so they know which one goes. */
export type ProposedBudgetDeletionAction = {
  kind: "BUDGET_DELETION";
  budgetId: string;
  category: string;
  monthlyLimit: number;
};

/** Deleting one of the user's savings goals, with the details that identify it. */
export type ProposedSavingsGoalDeletionAction = {
  kind: "SAVINGS_GOAL_DELETION";
  goalId: string;
  name: string;
  targetAmount: number;
  /** `YYYY-MM-DD` deadline, or null when the goal is open-ended. */
  targetDate: string | null;
  /** The account the goal tracks, e.g. "Rainy day (Savings)". */
  accountLabel: string;
};

/** Deleting one of the user's categorization rules. */
export type ProposedCategorizationRuleDeletionAction = {
  kind: "CATEGORIZATION_RULE_DELETION";
  ruleId: string;
  merchant: string;
  category: string;
};

/** A write the model drafted for the user. Nothing is saved until the user confirms it. */
export type ProposedChatAction =
  | ProposedBudgetAction
  | ProposedSavingsGoalAction
  | ProposedSavingsGoalChangeAction
  | ProposedCategorizationRuleAction
  | ProposedBudgetDeletionAction
  | ProposedSavingsGoalDeletionAction
  | ProposedCategorizationRuleDeletionAction;

/** What the user already has in Bloom: the values a draft must use, and what it would replace. */
export type ChatActionReferenceData = {
  expenseCategoryNames: string[];
  incomeCategoryNames: string[];
  accounts: { id: string; name: string; accountType: string }[];
  budgets: { id: string; category: string; monthlyLimit: number }[];
  rules: { id: string; merchant: string; category: string }[];
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
  /**
   * The tool behind the draft in the reply just before this question, when there is one — see
   * `selectToolNameOfDraftJustShown`. Absent or null when the last reply carried no draft.
   */
  toolNameOfDraftJustShown?: string | null;
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
const PROPOSE_DELETION_TOOL_NAME = "propose_deletion";
const EXPLAIN_UNSUPPORTED_REQUEST_TOOL_NAME = "explain_unsupported_request";

/** How the deletion tool names each kind of thing it can delete, for the model and the user. */
const DELETABLE_ITEM_TYPES = {
  budget: "budget",
  savingsGoal: "savings goal",
  categorizationRule: "categorization rule",
} as const;

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
  CONFIRMED: "The user confirmed this draft and it was carried out.",
  DISMISSED: "The user dismissed this draft. Nothing was changed.",
};

/** Closes every line that introduces a draft, so the user knows the card still needs them. */
const REVIEW_REMINDER = "Review it below — nothing is saved until you confirm.";

/** Closes every line that introduces a drafted deletion. */
const DELETION_REVIEW_REMINDER = "Review it below — nothing is deleted until you confirm.";

// A number the way a user types an amount: optional thousands separators and decimals, and an
// optional "k" for thousands ("3k", "1.5k").
const STATED_AMOUNT_PATTERN = /(\d[\d,]*(?:\.\d+)?)\s?(k(?![a-z]))?/gi;

const UNKNOWN_TOOL_REPLY =
  "I couldn't turn that into something I can save. I can draft a budget, a savings goal, or a " +
  "categorization rule for you to confirm.";

const DELETION_LIMITS_REPLY =
  "I can delete a budget, a savings goal, or a categorization rule. Transactions, accounts, and " +
  "anything else have to be deleted from their own page in Bloom.";

/** Closes every refusal by saying what the chat can do instead. */
const CHAT_CAPABILITIES =
  "From the chat I can draft budgets, savings goals, and categorization rules, change them, or " +
  "delete them.";

/**
 * What the chat says when asked for a change it can't make, keyed by the kind of request the
 * model reports. Fixed wording, so the reply always names the page that really does it.
 */
const UNSUPPORTED_REQUEST_REPLIES = {
  account:
    "I can't open or delete accounts from the chat. You can open a new account from the " +
    "Overview page, or delete one from that account's own page.",
  transaction:
    "I can't add, import, edit, or delete transactions from the chat. You can do that on the " +
    "account's own page — open it from Accounts.",
  transfer:
    "I can't record a transfer from the chat. You can record it on the account's own page — " +
    "open it from Accounts.",
  category:
    "I can't add or change categories from the chat. You can do that on the Categories page.",
  subscription:
    "I can't change subscriptions from the chat. The Subscriptions page shows the recurring " +
    "payments Bloom has detected; to cancel one, contact the company that bills you.",
  setting: "I can't change settings from the chat. You can change them on the Settings page.",
  other: "I can't do that from the chat.",
} as const;

type UnsupportedRequestKind = keyof typeof UNSUPPORTED_REQUEST_REPLIES;

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

/** One thing the deletion tool could point at, already shaped as the draft that deletes it. */
type DeletionCandidate = {
  itemType: (typeof DELETABLE_ITEM_TYPES)[keyof typeof DELETABLE_ITEM_TYPES];
  /** What the user calls it: a budget's category, a goal's name, or a rule's merchant. */
  name: string;
  /** How a reply refers to it, e.g. "your Groceries budget". */
  description: string;
  draft: ProposedChatAction;
};

/** Lists every budget, savings goal, and categorization rule the user could ask to delete. */
function listDeletionCandidates(referenceData: ChatActionReferenceData): DeletionCandidate[] {
  return [
    ...referenceData.budgets.map((budget) => ({
      itemType: DELETABLE_ITEM_TYPES.budget,
      name: budget.category,
      description: `your ${budget.category} budget`,
      draft: {
        kind: "BUDGET_DELETION" as const,
        budgetId: budget.id,
        category: budget.category,
        monthlyLimit: budget.monthlyLimit,
      },
    })),
    ...referenceData.savingsGoals.map((goal) => {
      const account = referenceData.accounts.find((candidate) => candidate.id === goal.accountId);
      return {
        itemType: DELETABLE_ITEM_TYPES.savingsGoal,
        name: goal.name,
        description: `your "${goal.name}" goal`,
        draft: {
          kind: "SAVINGS_GOAL_DELETION" as const,
          goalId: goal.id,
          name: goal.name,
          targetAmount: goal.targetAmount,
          targetDate: goal.targetDate,
          accountLabel: account ? describeAccount(account) : "Unknown account",
        },
      };
    }),
    ...referenceData.rules.map((rule) => ({
      itemType: DELETABLE_ITEM_TYPES.categorizationRule,
      name: rule.merchant,
      description: `your rule for ${rule.merchant}`,
      draft: {
        kind: "CATEGORIZATION_RULE_DELETION" as const,
        ruleId: rule.id,
        merchant: rule.merchant,
        category: rule.category,
      },
    })),
  ];
}

/**
 * Works out which one budget, savings goal, or rule the model means to delete. The name decides;
 * the type the model gave only breaks a tie, because small models mislabel things (calling the
 * Tim Hortons rule a budget, say). Anything that doesn't point at exactly one item becomes a
 * question instead of a draft.
 */
function interpretDeletionProposal(
  toolArguments: Record<string, unknown>,
  { referenceData }: ToolCallContext
): ToolCallInterpretation {
  const requestedName = readTextArgument(toolArguments.name, MAX_GOAL_NAME_LENGTH);
  if (!requestedName) {
    return withoutProposal("Which budget, savings goal, or categorization rule should I delete?");
  }
  const requestedItemType = readTextArgument(toolArguments.itemType, MAX_CATEGORY_LENGTH);
  const isOfRequestedType = (candidate: DeletionCandidate) =>
    requestedItemType !== null &&
    toComparableText(candidate.itemType) === toComparableText(requestedItemType);

  const allCandidates = listDeletionCandidates(referenceData);
  const candidatesWithName = allCandidates.filter(
    (candidate) => toComparableText(candidate.name) === toComparableText(requestedName)
  );
  const candidatesOfRequestedType = candidatesWithName.filter(isOfRequestedType);
  const candidates =
    candidatesOfRequestedType.length > 0 ? candidatesOfRequestedType : candidatesWithName;

  if (candidates.length === 0) {
    const namesOfRequestedType = allCandidates
      .filter(isOfRequestedType)
      .map((candidate) => candidate.name);
    return withoutProposal(
      namesOfRequestedType.length > 0
        ? `You don't have a ${requestedItemType} called "${requestedName}". Yours are: ` +
            `${namesOfRequestedType.join(", ")}.`
        : `I couldn't find a budget, savings goal, or categorization rule called ` +
            `"${requestedName}". ${DELETION_LIMITS_REPLY}`
    );
  }
  if (candidates.length > 1) {
    const isSameType = candidates.every(
      (candidate) => candidate.itemType === candidates[0]!.itemType
    );
    return withoutProposal(
      isSameType
        ? `You have more than one ${candidates[0]!.itemType} called "${candidates[0]!.name}", so ` +
            `I can't tell which one to delete. You can delete it from its page in Bloom.`
        : `"${requestedName}" could be ` +
            `${candidates.map((candidate) => candidate.description).join(" or ")}. ` +
            `Which one should I delete?`
    );
  }
  const candidate = candidates[0]!;
  return {
    proposedAction: candidate.draft,
    reply: `I've drafted the deletion of ${candidate.description}. ${DELETION_REVIEW_REMINDER}`,
  };
}

/**
 * Answers a request the chat can't carry out — opening an account, adding a transaction, and so
 * on — with fixed wording that names the right page. The model gets this tool so it has something
 * to reach for besides the draft tools: without it, asked to add a transaction, it drafted a
 * categorization rule for the merchant instead.
 */
function interpretUnsupportedRequest(
  toolArguments: Record<string, unknown>,
  { question }: ToolCallContext
): ToolCallInterpretation {
  const requestKind = readTextArgument(toolArguments.request, MAX_CATEGORY_LENGTH);
  const knownRequestKind =
    (Object.keys(UNSUPPORTED_REQUEST_REPLIES) as UnsupportedRequestKind[]).find(
      (candidate) => candidate === requestKind && candidate !== "other"
    ) ??
    detectUnsupportedRequestKind(question) ??
    "other";
  return withoutProposal(`${UNSUPPORTED_REQUEST_REPLIES[knownRequestKind]} ${CHAT_CAPABILITIES}`);
}

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

// The kinds of change the chat can't make, as the user tends to word them, checked in order:
// "add a transaction to my Everyday account" is about a transaction, not the account.
const UNSUPPORTED_REQUEST_PATTERNS: [UnsupportedRequestKind, RegExp][] = [
  ["transfer", /\btransfer/i],
  ["subscription", /\bsubscriptions?\b/i],
  ["transaction", /\b(transactions?|purchases?|expenses?|charges?)\b/i],
  ["category", /\bcategor(y|ies)\b/i],
  ["account", /\baccounts?\b|\b(tfsa|rrsp|fhsa|chequing|credit card)\b/i],
  ["setting", /\b(settings?|profile|password|currency|theme|dark mode)\b/i],
];

/** Treats creating and changing a savings goal as one kind of change, since either can follow the other. */
function toToolFamily(toolName: string): string {
  return toolName === PROPOSE_SAVINGS_GOAL_CHANGE_TOOL_NAME
    ? PROPOSE_SAVINGS_GOAL_TOOL_NAME
    : toolName;
}

/** Names the kind of change the chat can't make that a request is about, if it is one. */
function detectUnsupportedRequestKind(question: string): UnsupportedRequestKind | null {
  return UNSUPPORTED_REQUEST_PATTERNS.find(([, pattern]) => pattern.test(question))?.[0] ?? null;
}

// A request worded as a command ("open a TFSA for me", "can you transfer $200") rather than a
// question ("should I open a TFSA?"), which the model should still answer.
const COMMAND_PATTERN =
  /^\s*(please\s+)?((can|could|would|will) you\s+)?(please\s+)?(create|open|add|make|delete|remove|close|transfer|move|record|log|import|cancel|change|edit|update|rename|set up|enter)\b/i;

// Words that put a request within what the drafts cover, so the model gets to handle it.
const DRAFTABLE_SUBJECT_PATTERN =
  /\b(budgets?|goals?|rules?|always|limit|save|saving|savings|auto-?categori[sz]\w*|categori[sz]e\w*)\b/i;

/**
 * Answers a command the chat can't carry out — "open a TFSA for me", "transfer $200 to savings" —
 * with its fixed reply, before the model is asked at all. Left to the model, these sometimes came
 * back as a made-up plan ("I'll draft the transfer for you") without any tool being called, so
 * nothing could check them. Anything that mentions a budget, goal, or rule, or one of the user's
 * own budgets, goals, or rules by name, still goes to the model. Returns null for those, and for
 * anything that isn't a command.
 */
export function answerUnsupportedCommand(
  question: string,
  referenceData: ChatActionReferenceData
): string | null {
  if (!COMMAND_PATTERN.test(question) || DRAFTABLE_SUBJECT_PATTERN.test(question)) return null;
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
