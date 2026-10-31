// One interpreter per draft tool: validates the model's arguments against the user's own data and words.
// Split out of chatActionProposals.ts, which re-exports its public API.
import { parseOptionalDateOnly } from "../profileOptions";
import type {
  ProposedChatAction,
  ChatActionReferenceData,
  ToolCallContext,
  ToolCallInterpretation,
} from "./chatActionTypes";
import {
  DELETABLE_ITEM_TYPES,
  MAX_CATEGORY_LENGTH,
  MAX_GOAL_NAME_LENGTH,
  MAX_MERCHANT_LENGTH,
  MAX_ACCOUNT_REFERENCE_LENGTH,
  REVIEW_REMINDER,
  DELETION_REVIEW_REMINDER,
  DELETION_LIMITS_REPLY,
  CHAT_CAPABILITIES,
  UNSUPPORTED_REQUEST_REPLIES,
  toDateOnly,
  toComparableText,
  describeAccount,
  readTextArgument,
  extractStatedAmounts,
  readAmountArgument,
  mentionsPhrase,
  findMatchingName,
  withoutProposal,
  detectUnsupportedRequestKind,
} from "./chatActionShared";
import type { UnsupportedRequestKind } from "./chatActionShared";

/** Validates a drafted budget against the user's expense categories and existing budgets. */
export function interpretBudgetProposal(
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
export function interpretSavingsGoalProposal(
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
export function interpretSavingsGoalChangeProposal(
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
export function interpretCategorizationRuleProposal(
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
export function listDeletionCandidates(
  referenceData: ChatActionReferenceData
): DeletionCandidate[] {
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
export function interpretDeletionProposal(
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
export function interpretUnsupportedRequest(
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
