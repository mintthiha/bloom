import { AppError } from "../middleware/errorHandler";
import logger from "../lib/logger";
import { listAccounts } from "./accountService";
import { listBudgetLimits, upsertBudget } from "./budgetService";
import { listRules, upsertRule } from "./categorizationRuleService";
import { listCategories } from "./categoryService";
import type {
  ChatActionReferenceData,
  ProposedChatAction,
  ProposedChatActionStatus,
  ProposedSavingsGoalChangeAction,
} from "./chatActionProposals";
import { getProposedActionStatus, moveProposedActionStatus } from "./chatHistoryService";
import { createSavingsGoal, listSavingsGoals, updateSavingsGoal } from "./savingsGoalService";

/** Where a draft stands after the user acted on its card. */
export type ProposedActionOutcome = {
  id: string;
  proposedActionStatus: ProposedChatActionStatus;
};

/**
 * Loads what the model's drafts are validated against: the user's categories and accounts (the
 * only values a draft may use) and their budgets, rules, and savings goals (what a draft would
 * replace or change).
 */
export async function loadChatActionReferenceData(
  userId: string
): Promise<ChatActionReferenceData> {
  const [categories, accounts, budgets, rules, savingsGoals] = await Promise.all([
    listCategories(userId),
    listAccounts(userId),
    listBudgetLimits(userId),
    listRules(userId),
    listSavingsGoals(userId),
  ]);
  return {
    expenseCategoryNames: categories
      .filter((category) => category.type === "EXPENSE")
      .map((category) => category.name),
    incomeCategoryNames: categories
      .filter((category) => category.type === "INCOME")
      .map((category) => category.name),
    accounts: accounts.map((account) => ({
      id: account.id,
      name: account.nickname ?? account.ownerName,
      accountType: account.accountType,
    })),
    budgets,
    rules: rules.map((rule) => ({ merchant: rule.merchant, category: rule.category })),
    savingsGoals: savingsGoals.map((goal) => ({
      id: goal.id,
      name: goal.name,
      targetAmount: goal.targetAmount,
      targetDate: goal.targetDate,
      accountId: goal.accountId,
    })),
  };
}

/** Turns a `YYYY-MM-DD` deadline into the UTC midnight the savings goal service stores. */
function toUtcDate(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

/**
 * Applies a drafted goal change. Only the drafted fields change: everything else — including the
 * icon, colour, and note the chat never touches — is taken from the goal as it stands now, since
 * the user may have edited it on the Goals page after the draft was made.
 */
async function saveSavingsGoalChange(
  userId: string,
  goalChange: ProposedSavingsGoalChangeAction
): Promise<void> {
  const goal = (await listSavingsGoals(userId)).find(
    (candidate) => candidate.id === goalChange.goalId
  );
  if (!goal) throw new AppError(404, "That savings goal no longer exists");

  const targetDate = goalChange.targetDate ?? goal.targetDate;
  await updateSavingsGoal(userId, goal.id, {
    accountId: goalChange.accountId ?? goal.accountId,
    name: goalChange.name ?? goal.name,
    targetAmount: goalChange.targetAmount ?? goal.targetAmount,
    targetDate: targetDate ? toUtcDate(targetDate) : null,
    icon: goal.icon,
    color: goal.color,
    note: goal.note,
  });
}

/**
 * Takes a still-pending draft out of the pending state so nothing else can act on it. Throws 404
 * when the user has no such draft and 409 when it was already confirmed or dismissed.
 */
async function claimPendingProposedAction(
  userId: string,
  messageId: string,
  nextStatus: ProposedChatActionStatus
): Promise<ProposedChatAction> {
  const proposedAction = await moveProposedActionStatus(userId, messageId, "PENDING", nextStatus);
  if (proposedAction) return proposedAction;

  const currentStatus = await getProposedActionStatus(userId, messageId);
  if (currentStatus === null) throw new AppError(404, "Suggestion not found");
  throw new AppError(
    409,
    currentStatus === "CONFIRMED"
      ? "This suggestion has already been saved"
      : "This suggestion was dismissed"
  );
}

/** Performs the drafted write through the same service the matching page in the app uses. */
async function saveProposedAction(
  userId: string,
  proposedAction: ProposedChatAction
): Promise<void> {
  switch (proposedAction.kind) {
    case "BUDGET":
      await upsertBudget(userId, {
        category: proposedAction.category,
        monthlyLimit: proposedAction.monthlyLimit,
      });
      return;
    case "SAVINGS_GOAL":
      await createSavingsGoal(userId, {
        accountId: proposedAction.accountId,
        name: proposedAction.name,
        targetAmount: proposedAction.targetAmount,
        targetDate: proposedAction.targetDate ? toUtcDate(proposedAction.targetDate) : null,
        icon: null,
        color: null,
        note: null,
      });
      return;
    case "SAVINGS_GOAL_CHANGE":
      await saveSavingsGoalChange(userId, proposedAction);
      return;
    case "CATEGORIZATION_RULE":
      await upsertRule(userId, proposedAction.merchant, proposedAction.category, "ai");
      return;
  }
}

/**
 * Saves the draft a chat reply carried, now that the user has confirmed it. The draft is claimed
 * before the write so a double click cannot save it twice, and handed back to pending if the
 * write fails so the user can try again.
 */
export async function confirmProposedAction(
  userId: string,
  messageId: string
): Promise<ProposedActionOutcome> {
  const proposedAction = await claimPendingProposedAction(userId, messageId, "CONFIRMED");
  try {
    await saveProposedAction(userId, proposedAction);
  } catch (error) {
    try {
      await moveProposedActionStatus(userId, messageId, "CONFIRMED", "PENDING");
    } catch (restoreError) {
      // The original failure is the one worth reporting; this draft just stays marked confirmed.
      logger.error({ err: restoreError, messageId }, "Failed to restore a pending chat draft");
    }
    throw error;
  }
  return { id: messageId, proposedActionStatus: "CONFIRMED" };
}

/** Marks a draft as dismissed, so its card stops offering to save it. Nothing else changes. */
export async function dismissProposedAction(
  userId: string,
  messageId: string
): Promise<ProposedActionOutcome> {
  await claimPendingProposedAction(userId, messageId, "DISMISSED");
  return { id: messageId, proposedActionStatus: "DISMISSED" };
}
