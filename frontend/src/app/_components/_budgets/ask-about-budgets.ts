import { Budget } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

/** Budgets listed by name in the question, most-used first; the rest are summarised. */
export const MAX_BUDGETS_IN_PROMPT = 10;

/** Describes one budget as spent of available, with its percentage and what's over or left. */
function describeBudget(budget: Budget): string {
  const spentOfAvailable = `${formatCurrency(budget.currentSpending)} of ${formatCurrency(budget.available)} (${budget.percentageUsed}%)`;
  const standing = budget.isOverBudget
    ? `over by ${formatCurrency(Math.abs(budget.remaining))}`
    : `${formatCurrency(budget.remaining)} left`;
  return `- ${budget.category}: ${spentOfAvailable}, ${standing}`;
}

/**
 * Builds the chat question for the budgets card. Includes how far through the month it is so the
 * model can judge pace — 90% spent means something different on day 5 than on day 28.
 */
export function buildBudgetsPrompt(budgets: Budget[], referenceDate: Date = new Date()): string {
  const dayOfMonth = referenceDate.getDate();
  const daysInMonth = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth() + 1,
    0
  ).getDate();

  const budgetsByUsage = [...budgets].sort(
    (first, second) => second.percentageUsed - first.percentageUsed
  );
  const listedBudgets = budgetsByUsage.slice(0, MAX_BUDGETS_IN_PROMPT);
  const unlistedBudgetCount = budgets.length - listedBudgets.length;

  const budgetLines = listedBudgets.map(describeBudget);
  if (unlistedBudgetCount > 0) {
    budgetLines.push(
      `- plus ${unlistedBudgetCount} more budget${unlistedBudgetCount !== 1 ? "s" : ""}`
    );
  }

  const overBudgetCount = budgets.filter((budget) => budget.isOverBudget).length;
  const budgetCountLabel = `${budgets.length} budget${budgets.length !== 1 ? "s" : ""}`;
  let standingSummary: string;
  if (overBudgetCount > 0) {
    standingSummary = `${overBudgetCount} of ${budgetCountLabel} ${overBudgetCount === 1 ? "is" : "are"} over the limit.`;
  } else if (budgets.length === 1) {
    standingSummary = "My one budget is within its limit.";
  } else {
    standingSummary = `All ${budgetCountLabel} are within their limit.`;
  }

  return [
    "Which of my budgets need the most attention this month, and what should I do about them?",
    [
      `It's day ${dayOfMonth} of ${daysInMonth} this month. My budgets (spent of available):`,
      ...budgetLines,
    ].join("\n"),
    standingSummary,
  ].join("\n\n");
}
