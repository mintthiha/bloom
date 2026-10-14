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
} from "./chatActionProposals";
import { getProposedActionStatus, moveProposedActionStatus } from "./chatHistoryService";
import { createSavingsGoal } from "./savingsGoalService";

/** Where a draft stands after the user acted on its card. */
export type ProposedActionOutcome = {
  id: string;
  proposedActionStatus: ProposedChatActionStatus;
};

/**
 * Loads what the model's drafts are validated against: the user's categories and accounts (the
 * only values a draft may use) and their budgets and rules (what a draft would replace).
 */
export async function loadChatActionReferenceData(
  userId: string
): Promise<ChatActionReferenceData> {
  const [categories, accounts, budgets, rules] = await Promise.all([
    listCategories(userId),
    listAccounts(userId),
    listBudgetLimits(userId),
    listRules(userId),
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
  };
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
        targetDate: proposedAction.targetDate
          ? new Date(`${proposedAction.targetDate}T00:00:00.000Z`)
          : null,
        icon: null,
        color: null,
        note: null,
      });
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
