import { api, type ProposedChatAction } from "@/lib/api";

/**
 * Brings back the budget, savings goal, or rule a confirmed chat deletion removed — the "Undo" in
 * its toast. Deletes are soft, so this is the same restore the item's own page uses.
 */
export function restoreDeletedItem(proposedAction: ProposedChatAction): Promise<unknown> {
  switch (proposedAction.kind) {
    case "BUDGET_DELETION":
      return api.restoreBudget(proposedAction.budgetId);
    case "SAVINGS_GOAL_DELETION":
      return api.restoreSavingsGoal(proposedAction.goalId);
    case "CATEGORIZATION_RULE_DELETION":
      return api.restoreCategorizationRule(proposedAction.ruleId);
    default:
      return Promise.reject(new Error("Only a deletion can be undone"));
  }
}
