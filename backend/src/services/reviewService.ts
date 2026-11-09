// The monthly review ritual and the year-in-review recap. Everything is derived from data Bloom
// already stores — no AI — so it stays fast on the CPU-only server. Month and year boundaries are
// resolved in the user's own time zone so "October" means their October, not UTC's.
import { randomUUID } from "crypto";
import { AppError } from "../middleware/errorHandler";
import prisma from "../lib/prisma";
import { getMonthlySummary } from "./accountService";
import { listBudgets } from "./budgetService";
import { listSavingsGoals } from "./savingsGoalService";
import { logActivity } from "./activityService";
import {
  compareCategorySpending,
  computeGoalMonthProgress,
  computePercentChange,
  computeReviewStreak,
  computeSavingsRate,
  fillYearMonths,
  isValidMonthKey,
  pickYearHighlights,
  shiftMonthKey,
  summarizeBudgetResults,
  utcMonthStart,
  type YearMonthTotals,
} from "./reviewCalculations";

type Boundary = { start: Date; end: Date };

/** How many past reviews are loaded to compute the streak (two years is plenty). */
const STREAK_LOOKBACK_MONTHS = 24;

/** Validates a `YYYY-MM` key, throwing 400 otherwise. */
function requireMonthKey(month: string) {
  if (!isValidMonthKey(month)) throw new AppError(400, "month must be in YYYY-MM format");
}

/**
 * Resolves local-midnight boundaries for a `[startMonth, startMonth + monthSpan)` window in the
 * given IANA time zone. Postgres does the zone math so DST transitions are handled correctly.
 * The month count is cast to int because Prisma binds JS numbers as bigint, and
 * `make_interval` has no bigint overload.
 */
async function resolveLocalBoundary(
  startMonth: string,
  monthSpan: number,
  timeZone: string
): Promise<Boundary> {
  const rows = await prisma.$queryRaw<Boundary[]>`
    SELECT
      (${`${startMonth}-01`}::timestamp AT TIME ZONE ${timeZone}) AS "start",
      ((${`${startMonth}-01`}::timestamp + make_interval(months => ${monthSpan}::int)) AT TIME ZONE ${timeZone}) AS "end"
  `;
  return rows[0]!;
}

/** A purchase row: a withdrawal from a cash account or a charge on a credit card. */
type SpendingTransactionRow = {
  amount: string;
  merchant: string | null;
  description: string | null;
  category: string | null;
  effectiveAt: Date;
};

/** Finds the single largest purchase in the window, across all of the user's accounts. */
async function selectBiggestExpense(userId: string, boundary: Boundary) {
  const rows = await prisma.$queryRaw<SpendingTransactionRow[]>`
    SELECT t."amount", t."merchant", t."description", t."category", t."effectiveAt"
    FROM "Transaction" t
    JOIN "Account" a ON (
      (t."fromAccountId" = a."id" AND t."type" = 'WITHDRAWAL'::"TransactionType" AND a."accountType" != 'CREDIT'::"AccountType")
      OR
      (t."toAccountId" = a."id" AND t."type" = 'DEPOSIT'::"TransactionType" AND a."accountType" = 'CREDIT'::"AccountType")
    )
    WHERE a."userId" = ${userId}
      AND a."deletedAt" IS NULL
      AND t."deletedAt" IS NULL
      AND t."effectiveAt" >= ${boundary.start}
      AND t."effectiveAt" < ${boundary.end}
    ORDER BY t."amount" DESC, t."effectiveAt" ASC
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    label: row.merchant?.trim() || row.description?.trim() || "Unlabelled purchase",
    amount: Number(row.amount),
    category: row.category,
    effectiveAt: row.effectiveAt,
  };
}

/** Counts the deposits and withdrawals (not transfers) recorded in the window. */
async function countTransactions(userId: string, boundary: Boundary): Promise<number> {
  const rows = await prisma.$queryRaw<{ transactionCount: number }[]>`
    SELECT COUNT(DISTINCT t."id")::int AS "transactionCount"
    FROM "Transaction" t
    JOIN "Account" a ON t."toAccountId" = a."id" OR t."fromAccountId" = a."id"
    WHERE a."userId" = ${userId}
      AND a."deletedAt" IS NULL
      AND t."deletedAt" IS NULL
      AND t."type" IN ('DEPOSIT'::"TransactionType", 'WITHDRAWAL'::"TransactionType")
      AND t."effectiveAt" >= ${boundary.start}
      AND t."effectiveAt" < ${boundary.end}
  `;
  return rows[0]?.transactionCount ?? 0;
}

/**
 * Reads each live savings goal's linked-account balance at the start and end of the window, using
 * the running balance of the last transaction before each boundary (the same order balance replay
 * uses). A goal created after the window ended is left out.
 */
async function selectGoalBalancesAcross(userId: string, boundary: Boundary) {
  type GoalBalanceRow = {
    id: string;
    name: string;
    targetAmount: string;
    balanceAtStart: string;
    balanceAtEnd: string;
  };
  const rows = await prisma.$queryRaw<GoalBalanceRow[]>`
    SELECT
      g."id",
      g."name",
      g."targetAmount",
      COALESCE((
        SELECT t."balanceAfter" FROM "Transaction" t
        WHERE t."deletedAt" IS NULL
          AND t."effectiveAt" < ${boundary.start}
          AND (
            (t."toAccountId" = g."accountId" AND t."type" IN ('DEPOSIT'::"TransactionType", 'TRANSFER_IN'::"TransactionType"))
            OR (t."fromAccountId" = g."accountId" AND t."type" IN ('WITHDRAWAL'::"TransactionType", 'TRANSFER_OUT'::"TransactionType"))
          )
        ORDER BY t."effectiveAt" DESC, t."createdAt" DESC, t."id" DESC
        LIMIT 1
      ), 0) AS "balanceAtStart",
      COALESCE((
        SELECT t."balanceAfter" FROM "Transaction" t
        WHERE t."deletedAt" IS NULL
          AND t."effectiveAt" < ${boundary.end}
          AND (
            (t."toAccountId" = g."accountId" AND t."type" IN ('DEPOSIT'::"TransactionType", 'TRANSFER_IN'::"TransactionType"))
            OR (t."fromAccountId" = g."accountId" AND t."type" IN ('WITHDRAWAL'::"TransactionType", 'TRANSFER_OUT'::"TransactionType"))
          )
        ORDER BY t."effectiveAt" DESC, t."createdAt" DESC, t."id" DESC
        LIMIT 1
      ), 0) AS "balanceAtEnd"
    FROM "SavingsGoal" g
    JOIN "Account" a ON a."id" = g."accountId"
    WHERE g."userId" = ${userId}
      AND g."deletedAt" IS NULL
      AND a."deletedAt" IS NULL
      AND g."createdAt" < ${boundary.end}
    ORDER BY g."createdAt" ASC
  `;
  return rows.map((row) => {
    const targetAmount = Number(row.targetAmount);
    const balanceAtStart = Number(row.balanceAtStart);
    const balanceAtEnd = Number(row.balanceAtEnd);
    return {
      id: row.id,
      name: row.name,
      targetAmount,
      balanceAtStart,
      balanceAtEnd,
      ...computeGoalMonthProgress(targetAmount, balanceAtStart, balanceAtEnd),
    };
  });
}

/** Loads the months this user has finished reviewing, newest first. */
async function selectCompletedReviews(userId: string) {
  return prisma.$queryRaw<{ month: string; completedAt: Date }[]>`
    SELECT "month", "completedAt" FROM "MonthlyReview"
    WHERE "userId" = ${userId}
    ORDER BY "month" DESC
    LIMIT ${STREAK_LOOKBACK_MONTHS}
  `;
}

/**
 * Builds the guided review of one month: cash flow against the month before, where the money went,
 * how each budget envelope did and what it carries into next month, goal progress, and whether the
 * user has already finished this review. Throws 400 for a malformed month.
 */
export async function getMonthlyReview(userId: string, month: string, timeZone: string) {
  requireMonthKey(month);
  const previousMonth = shiftMonthKey(month, -1);
  const nextMonth = shiftMonthKey(month, 1);

  const [boundary, previousBoundary] = await Promise.all([
    resolveLocalBoundary(month, 1, timeZone),
    resolveLocalBoundary(previousMonth, 1, timeZone),
  ]);

  const [
    summary,
    previousSummary,
    transactionCount,
    biggestExpense,
    budgets,
    nextMonthBudgets,
    goals,
    completedReviews,
  ] = await Promise.all([
    getMonthlySummary(userId, boundary),
    getMonthlySummary(userId, previousBoundary),
    countTransactions(userId, boundary),
    selectBiggestExpense(userId, boundary),
    // Budgets bucket spending by UTC month, so they are asked for by their own month key.
    listBudgets(userId, { start: utcMonthStart(month), end: utcMonthStart(nextMonth) }),
    listBudgets(userId, {
      start: utcMonthStart(nextMonth),
      end: utcMonthStart(shiftMonthKey(month, 2)),
    }),
    selectGoalBalancesAcross(userId, boundary),
    selectCompletedReviews(userId),
  ]);

  const nextMonthLimitByBudget = new Map(nextMonthBudgets.map((budget) => [budget.id, budget]));
  const completion = completedReviews.find((review) => review.month === month) ?? null;

  return {
    month,
    previousMonth,
    nextMonth,
    hasActivity: transactionCount > 0,
    completedAt: completion?.completedAt ?? null,
    reviewStreak: computeReviewStreak(
      completedReviews.map((review) => review.month),
      month
    ),
    cashFlow: {
      income: summary.income,
      spending: summary.spending,
      netCashFlow: summary.netCashFlow,
      savingsRate: computeSavingsRate(summary.income, summary.spending),
      transactionCount,
      previousIncome: previousSummary.income,
      previousSpending: previousSummary.spending,
      spendingChangePercent: computePercentChange(summary.spending, previousSummary.spending),
    },
    topCategories: compareCategorySpending(summary.categories, previousSummary.categories),
    biggestExpense,
    budgetResults: summarizeBudgetResults(budgets),
    budgets: budgets.map((budget) => {
      const nextMonthBudget = nextMonthLimitByBudget.get(budget.id);
      return {
        id: budget.id,
        category: budget.category,
        limit: budget.limit,
        available: budget.available,
        spent: budget.currentSpending,
        remaining: budget.remaining,
        isOverBudget: budget.isOverBudget,
        rolloverEnabled: budget.rolloverEnabled,
        carryOut: budget.carryOut,
        nextMonthLimit: nextMonthBudget?.limit ?? budget.monthlyLimit,
        templateLimit: budget.monthlyLimit,
      };
    }),
    goals,
  };
}

/**
 * Marks a month's review as finished. Completing it again is harmless and keeps the first
 * completion time. Throws 400 for a malformed month or one that hasn't started yet.
 */
export async function completeMonthlyReview(userId: string, month: string, now = new Date()) {
  requireMonthKey(month);
  const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  if (month > currentMonth)
    throw new AppError(400, "You can't review a month that hasn't happened yet");

  const rows = await prisma.$queryRaw<{ month: string; completedAt: Date }[]>`
    INSERT INTO "MonthlyReview" ("id", "userId", "month", "completedAt")
    VALUES (${randomUUID()}, ${userId}, ${month}, CURRENT_TIMESTAMP)
    ON CONFLICT ("userId", "month") DO UPDATE SET "month" = EXCLUDED."month"
    RETURNING "month", "completedAt"
  `;
  // The "review is ready" reminder has done its job; clear it from the bell. Its dedupe key
  // stays, so it is never re-created for this month.
  await prisma.$queryRaw`
    UPDATE "Notification"
    SET "status" = 'DISMISSED'
    WHERE "userId" = ${userId} AND "dedupeKey" = ${`MONTHLY_REVIEW:${month}`}
  `;
  const completedReviews = await selectCompletedReviews(userId);
  logActivity(userId, "PROFILE_REVIEW_COMPLETED", `Completed the ${month} monthly review`, {
    month,
  });
  return {
    month,
    completedAt: rows[0]!.completedAt,
    reviewStreak: computeReviewStreak(
      completedReviews.map((review) => review.month),
      month
    ),
  };
}

/** True once the user has finished reviewing `month` (used to stop the reminder). */
export async function hasCompletedMonthlyReview(userId: string, month: string) {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "MonthlyReview" WHERE "userId" = ${userId} AND "month" = ${month} LIMIT 1
  `;
  return rows.length > 0;
}

/** True when the user recorded any deposit or withdrawal during the UTC month `month`. */
export async function hasActivityInMonth(userId: string, month: string) {
  const boundary = { start: utcMonthStart(month), end: utcMonthStart(shiftMonthKey(month, 1)) };
  return (await countTransactions(userId, boundary)) > 0;
}

/** Income and spending per local month across the year, using the same rules as the monthly summary. */
async function selectYearMonthTotals(userId: string, boundary: Boundary, timeZone: string) {
  const rows = await prisma.$queryRaw<{ month: string; income: string; spending: string }[]>`
    SELECT
      TO_CHAR(t."effectiveAt" AT TIME ZONE ${timeZone}, 'YYYY-MM') AS "month",
      COALESCE(SUM(CASE WHEN t."type" = 'DEPOSIT'::"TransactionType" AND a."accountType" != 'CREDIT'::"AccountType" THEN t."amount" ELSE 0 END), 0) AS "income",
      COALESCE(SUM(CASE
        WHEN t."type" = 'WITHDRAWAL'::"TransactionType" AND a."accountType" != 'CREDIT'::"AccountType" THEN t."amount"
        WHEN t."type" = 'DEPOSIT'::"TransactionType" AND a."accountType" = 'CREDIT'::"AccountType" THEN t."amount"
        ELSE 0
      END), 0) AS "spending"
    FROM "Transaction" t
    JOIN "Account" a ON t."toAccountId" = a."id" OR t."fromAccountId" = a."id"
    WHERE a."userId" = ${userId}
      AND a."deletedAt" IS NULL
      AND t."deletedAt" IS NULL
      AND t."type" IN ('DEPOSIT'::"TransactionType", 'WITHDRAWAL'::"TransactionType")
      AND t."effectiveAt" >= ${boundary.start}
      AND t."effectiveAt" < ${boundary.end}
    GROUP BY 1
  `;
  return rows.map(
    (row): YearMonthTotals => ({
      month: row.month,
      income: Number(row.income),
      spending: Number(row.spending),
    })
  );
}

/** The merchant the user bought from most often in the window, with what they spent there. */
async function selectTopMerchant(userId: string, boundary: Boundary) {
  const rows = await prisma.$queryRaw<{ label: string; visitCount: number; spending: string }[]>`
    SELECT
      COALESCE(NULLIF(TRIM(t."merchant"), ''), NULLIF(TRIM(t."description"), '')) AS "label",
      COUNT(*)::int AS "visitCount",
      SUM(t."amount") AS "spending"
    FROM "Transaction" t
    JOIN "Account" a ON (
      (t."fromAccountId" = a."id" AND t."type" = 'WITHDRAWAL'::"TransactionType" AND a."accountType" != 'CREDIT'::"AccountType")
      OR
      (t."toAccountId" = a."id" AND t."type" = 'DEPOSIT'::"TransactionType" AND a."accountType" = 'CREDIT'::"AccountType")
    )
    WHERE a."userId" = ${userId}
      AND a."deletedAt" IS NULL
      AND t."deletedAt" IS NULL
      AND t."effectiveAt" >= ${boundary.start}
      AND t."effectiveAt" < ${boundary.end}
      AND COALESCE(NULLIF(TRIM(t."merchant"), ''), NULLIF(TRIM(t."description"), '')) IS NOT NULL
    GROUP BY 1
    ORDER BY "visitCount" DESC, SUM(t."amount") DESC
    LIMIT 1
  `;
  const row = rows[0];
  return row
    ? { label: row.label, visitCount: row.visitCount, spending: Number(row.spending) }
    : null;
}

/** Counts the monthly reviews the user finished for months in the year. */
async function countYearReviews(userId: string, year: number) {
  const rows = await prisma.$queryRaw<{ reviewCount: number }[]>`
    SELECT COUNT(*)::int AS "reviewCount" FROM "MonthlyReview"
    WHERE "userId" = ${userId} AND "month" LIKE ${`${year}-%`}
  `;
  return rows[0]?.reviewCount ?? 0;
}

/**
 * Builds the "<year> in Bloom" recap: totals, the month-by-month picture, standout months, top
 * categories and merchant, goals reached, and reviews completed. A year still in progress is
 * reported as year-to-date (`isYearComplete: false`). Throws 400 for an implausible year.
 *
 * Net-worth change is deliberately left out: past months' snapshots are backfilled from current
 * balances and the current month's only refreshes on a dashboard visit, so the figure can be badly
 * wrong — and a shareable recap must not show a wrong number.
 */
export async function getYearInReview(
  userId: string,
  year: number,
  timeZone: string,
  now = new Date()
) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new AppError(400, "year must be a four-digit year");
  }
  const boundary = await resolveLocalBoundary(`${year}-01`, 12, timeZone);

  const [summary, monthRows, transactionCount, biggestExpense, topMerchant, reviewCount, goals] =
    await Promise.all([
      getMonthlySummary(userId, boundary),
      selectYearMonthTotals(userId, boundary, timeZone),
      countTransactions(userId, boundary),
      selectBiggestExpense(userId, boundary),
      selectTopMerchant(userId, boundary),
      countYearReviews(userId, year),
      listSavingsGoals(userId),
    ]);

  const months = fillYearMonths(year, monthRows);
  return {
    year,
    isYearComplete: now >= boundary.end,
    hasActivity: transactionCount > 0,
    totals: {
      income: summary.income,
      spending: summary.spending,
      netSaved: summary.netCashFlow,
      savingsRate: computeSavingsRate(summary.income, summary.spending),
      transactionCount,
    },
    months,
    ...pickYearHighlights(months),
    topCategories: compareCategorySpending(summary.categories, []).map(
      ({ category, spending, shareOfSpending }) => ({ category, spending, shareOfSpending })
    ),
    biggestExpense,
    topMerchant,
    reviewsCompleted: reviewCount,
    goalsReached: goals
      .filter((goal) => goal.targetAmount > 0 && goal.currentBalance >= goal.targetAmount)
      .map((goal) => goal.name),
  };
}
