// Pure wording for the monthly review: turns the numbers into the short, plain-language sentences
// a beginner reads, so every branch (no income, first month, overspent) is unit-testable.
import type { MonthlyReview, ReviewBudget, ReviewGoal } from "@/lib/api";

/** A change smaller than this either way reads as "about the same". */
const NEGLIGIBLE_CHANGE = 0.05;

/** Formats a ratio as a whole percent, e.g. 0.2 -> "20%". */
export function formatPercent(ratio: number): string {
  return `${Math.round(Math.abs(ratio) * 100)}%`;
}

/** Compares this month's spending with last month's, or null when there's nothing to compare. */
export function describeSpendingChange(
  changePercent: number | null,
  previousMonthName: string
): string | null {
  if (changePercent === null) return null;
  if (Math.abs(changePercent) < NEGLIGIBLE_CHANGE) return `About the same as ${previousMonthName}`;
  return changePercent > 0
    ? `${formatPercent(changePercent)} more than ${previousMonthName}`
    : `${formatPercent(changePercent)} less than ${previousMonthName}`;
}

/** Explains the savings rate in words. */
export function describeSavingsRate(savingsRate: number | null): string {
  if (savingsRate === null) return "No income was recorded this month.";
  if (savingsRate >= 0) return `You kept ${formatPercent(savingsRate)} of what came in.`;
  return `You spent ${formatPercent(savingsRate)} more than came in.`;
}

/** Summarises how the envelopes did, or null when the user has no budgets. */
export function describeBudgetResults(results: MonthlyReview["budgetResults"]): string | null {
  if (results.total === 0) return null;
  if (results.overCount === 0) {
    return results.total === 1
      ? "You stayed within your budget."
      : `You stayed within all ${results.total} budgets.`;
  }
  if (results.keptCount === 0) {
    return results.total === 1 ? "Your budget went over." : "Every budget went over this month.";
  }
  return `You stayed within ${results.keptCount} of ${results.total} budgets.`;
}

/**
 * Says what happens to an envelope's leftover (or overspend) next month, which depends on whether
 * rollover is on — the decision the review asks the user to confirm.
 */
export function describeCarryOut(
  budget: Pick<ReviewBudget, "rolloverEnabled" | "carryOut" | "remaining">,
  nextMonthName: string,
  formatMoney: (amount: number) => string
): string {
  if (budget.rolloverEnabled) {
    if (budget.carryOut > 0) return `${formatMoney(budget.carryOut)} rolls into ${nextMonthName}`;
    if (budget.carryOut < 0) {
      return `${formatMoney(Math.abs(budget.carryOut))} overspend comes out of ${nextMonthName}`;
    }
    return `Nothing carries into ${nextMonthName}`;
  }
  if (budget.remaining > 0) {
    return `${formatMoney(budget.remaining)} unspent — turn on rollover to keep it`;
  }
  if (budget.remaining < 0) {
    return `Over by ${formatMoney(Math.abs(budget.remaining))} — starts fresh in ${nextMonthName}`;
  }
  return `Starts fresh in ${nextMonthName}`;
}

/** One line on how a goal moved during the month. */
export function describeGoalProgress(
  goal: Pick<ReviewGoal, "contributed" | "isReached" | "wasReachedThisMonth">,
  formatMoney: (amount: number) => string
): string {
  if (goal.wasReachedThisMonth) return "Reached this month!";
  if (goal.contributed > 0) {
    return goal.isReached
      ? `Added ${formatMoney(goal.contributed)} (already reached)`
      : `Added ${formatMoney(goal.contributed)}`;
  }
  if (goal.contributed < 0) return `Down ${formatMoney(Math.abs(goal.contributed))}`;
  return goal.isReached ? "Reached" : "No change this month";
}

/** The streak line, or null before the first completed review. */
export function describeStreak(reviewStreak: number): string | null {
  if (reviewStreak <= 0) return null;
  return reviewStreak === 1 ? "1-month review streak" : `${reviewStreak}-month review streak`;
}
