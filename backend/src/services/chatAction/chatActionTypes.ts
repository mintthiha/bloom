// Shapes of the drafts the chat can propose, the reference data they are checked against, and replayed messages.
// Split out of chatActionProposals.ts, which re-exports its public API.

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
