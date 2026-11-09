// Pure derivations behind the monthly review and the year-in-review recap. Kept free of Prisma so
// every branch (empty months, first months, streak gaps) is unit-testable in isolation.

const MONTH_KEY_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** How many categories the review lists as "where your money went". */
export const TOP_CATEGORY_LIMIT = 5;

/** The monthly-review reminder shows during the first days of the month that follows. */
export const REVIEW_REMINDER_WINDOW_DAYS = 7;

/** True for a well-formed `YYYY-MM` month key. */
export function isValidMonthKey(value: string): boolean {
  return MONTH_KEY_PATTERN.test(value);
}

/** Shifts a `YYYY-MM` key by a whole number of months (negative goes back). */
export function shiftMonthKey(monthKey: string, monthCount: number): string {
  const [year, month] = monthKey.split("-").map(Number) as [number, number];
  const zeroBasedTotal = year * 12 + (month - 1) + monthCount;
  const shiftedYear = Math.floor(zeroBasedTotal / 12);
  const shiftedMonth = (zeroBasedTotal % 12) + 1;
  return `${shiftedYear}-${String(shiftedMonth).padStart(2, "0")}`;
}

/** The `YYYY-MM` key of the calendar month containing `date`, read in UTC. */
export function monthKeyOfDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** First instant of a month in UTC — the bucket key budgets use for their envelopes. */
export function utcMonthStart(monthKey: string): Date {
  const [year, month] = monthKey.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(year, month - 1, 1));
}

/**
 * Counts consecutive reviewed months ending at `throughMonth`. If that month isn't reviewed yet,
 * the streak is counted from the month before, so an open review doesn't read as a broken streak.
 */
export function computeReviewStreak(completedMonths: string[], throughMonth: string): number {
  const completed = new Set(completedMonths);
  let cursor = completed.has(throughMonth) ? throughMonth : shiftMonthKey(throughMonth, -1);
  let streak = 0;
  while (completed.has(cursor)) {
    streak += 1;
    cursor = shiftMonthKey(cursor, -1);
  }
  return streak;
}

/** Share of income kept after spending, or null when there was no income to compare against. */
export function computeSavingsRate(income: number, spending: number): number | null {
  if (income <= 0) return null;
  return (income - spending) / income;
}

/** Percentage change from `previous` to `current`, or null when there's no previous amount. */
export function computePercentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return (current - previous) / previous;
}

/** One spending category for the month, with last month's amount for comparison. */
export type CategoryComparison = {
  category: string;
  spending: number;
  previousSpending: number;
  changePercent: number | null;
  shareOfSpending: number;
};

/**
 * Ranks the month's spending categories (largest first) and pairs each with the previous month's
 * spending in the same category. Categories with no spending this month are left out.
 */
export function compareCategorySpending(
  current: { category: string; spending: number }[],
  previous: { category: string; spending: number }[],
  limit = TOP_CATEGORY_LIMIT
): CategoryComparison[] {
  const previousByCategory = new Map(previous.map((row) => [row.category, row.spending]));
  const totalSpending = current.reduce((sum, row) => sum + Math.max(row.spending, 0), 0);
  return current
    .filter((row) => row.spending > 0)
    .sort((a, b) => b.spending - a.spending)
    .slice(0, limit)
    .map((row) => {
      const previousSpending = previousByCategory.get(row.category) ?? 0;
      return {
        category: row.category,
        spending: row.spending,
        previousSpending,
        changePercent: computePercentChange(row.spending, previousSpending),
        shareOfSpending: totalSpending > 0 ? row.spending / totalSpending : 0,
      };
    });
}

/** How many envelopes stayed within their money for the month. */
export function summarizeBudgetResults(budgets: { isOverBudget: boolean }[]) {
  const overCount = budgets.filter((budget) => budget.isOverBudget).length;
  return { total: budgets.length, keptCount: budgets.length - overCount, overCount };
}

/** A savings goal's movement across the reviewed month. */
export type GoalMonthProgress = {
  contributed: number;
  percentAtEnd: number;
  isReached: boolean;
  wasReachedThisMonth: boolean;
};

/** Derives how much a goal's account grew during the month and where it ended against the target. */
export function computeGoalMonthProgress(
  targetAmount: number,
  balanceAtStart: number,
  balanceAtEnd: number
): GoalMonthProgress {
  const percentOf = (balance: number) =>
    targetAmount > 0 ? Math.min(Math.max(balance / targetAmount, 0), 1) : 0;
  const isReached = targetAmount > 0 && balanceAtEnd >= targetAmount;
  return {
    contributed: balanceAtEnd - balanceAtStart,
    percentAtEnd: percentOf(balanceAtEnd),
    isReached,
    wasReachedThisMonth: isReached && balanceAtStart < targetAmount,
  };
}

/** True during the first days of a month, when last month's review is offered. */
export function isReviewReminderWindow(now: Date): boolean {
  return now.getUTCDate() <= REVIEW_REMINDER_WINDOW_DAYS;
}

/** One month of the year-in-review series. */
export type YearMonthTotals = { month: string; income: number; spending: number };

/**
 * Fills in every month of the year (zero for months with no activity) so the recap's chart
 * always shows January through December in order.
 */
export function fillYearMonths(year: number, rows: YearMonthTotals[]): YearMonthTotals[] {
  const byMonth = new Map(rows.map((row) => [row.month, row]));
  return Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, "0")}`;
    return byMonth.get(month) ?? { month, income: 0, spending: 0 };
  });
}

/**
 * Picks the recap's standout months: the one with the most left over and the one with the most
 * spending. Months with no activity are ignored; null when the year has no activity at all.
 */
export function pickYearHighlights(months: YearMonthTotals[]) {
  const activeMonths = months.filter((month) => month.income > 0 || month.spending > 0);
  if (activeMonths.length === 0) {
    return { bestSavingMonth: null, highestSpendingMonth: null, activeMonthCount: 0 };
  }
  const net = (month: YearMonthTotals) => month.income - month.spending;
  const bestSavingMonth = activeMonths.reduce((best, month) =>
    net(month) > net(best) ? month : best
  );
  const highestSpendingMonth = activeMonths.reduce((highest, month) =>
    month.spending > highest.spending ? month : highest
  );
  return {
    bestSavingMonth: { month: bestSavingMonth.month, netSaved: net(bestSavingMonth) },
    highestSpendingMonth: {
      month: highestSpendingMonth.month,
      spending: highestSpendingMonth.spending,
    },
    activeMonthCount: activeMonths.length,
  };
}
