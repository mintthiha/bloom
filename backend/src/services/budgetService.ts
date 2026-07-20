import { randomUUID } from "crypto";
import { AppError } from "../middleware/errorHandler";
import { resolveDateRange } from "../lib/date-range";
import {
  computeRolloverForMonth,
  monthKey,
  type MonthOverride,
  type RolloverMonth,
} from "../lib/budget-rollover";
import prisma from "../lib/prisma";

type BudgetRecord = {
  id: string;
  userId: string;
  category: string;
  monthlyLimit: string;
  rolloverEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type MonthlySpendingRow = {
  budgetId: string;
  month: string;
  total: number | string;
};

type PeriodRow = {
  budgetId: string;
  month: string;
  limitOverride: number | string | null;
  adjustment: number | string;
};

type BudgetInput = {
  category?: string;
  monthlyLimit?: number;
};

/** Groups per-month spending rows into a lookup of budgetId -> (month -> amount). */
function groupSpendingByBudget(rows: MonthlySpendingRow[]) {
  const byBudget = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const months = byBudget.get(row.budgetId) ?? new Map<string, number>();
    months.set(row.month, Number(row.total ?? 0));
    byBudget.set(row.budgetId, months);
  }
  return byBudget;
}

/** Groups stored per-month overrides into a lookup of budgetId -> (month -> override). */
function groupOverridesByBudget(rows: PeriodRow[]) {
  const byBudget = new Map<string, Map<string, MonthOverride>>();
  for (const row of rows) {
    const months = byBudget.get(row.budgetId) ?? new Map<string, MonthOverride>();
    months.set(row.month, {
      limitOverride: row.limitOverride === null ? null : Number(row.limitOverride),
      adjustment: Number(row.adjustment ?? 0),
    });
    byBudget.set(row.budgetId, months);
  }
  return byBudget;
}

/** First day of the month after `month` (`YYYY-MM`), as a UTC Date, for `< end` history bounds. */
function nextMonthStart(month: string): Date {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year!, monthNumber!, 1));
}

/** Shapes a budget record plus its computed envelope figures into the API response object. */
function toBudgetResponse(budget: BudgetRecord, rollover: RolloverMonth) {
  const { limit, carryIn, adjustment, available, spent, carryOut } = rollover;
  return {
    id: budget.id,
    userId: budget.userId,
    category: budget.category,
    monthlyLimit: Number(budget.monthlyLimit),
    rolloverEnabled: budget.rolloverEnabled,
    month: rollover.month,
    limit,
    carryIn,
    adjustment,
    available,
    currentSpending: spent,
    remaining: carryOut,
    carryOut,
    percentageUsed: available > 0 ? (spent / available) * 100 : 0,
    isOverBudget: carryOut < 0,
    createdAt: budget.createdAt,
    updatedAt: budget.updatedAt,
  };
}

type BudgetActivityRecord = {
  id: string;
  amount: number | string;
  category: string | null;
  description: string | null;
  effectiveAt: Date;
  createdAt: Date;
  accountId: string;
  accountNickname: string | null;
  accountOwnerName: string;
};

type DailySpendingRow = {
  day: Date;
  total: number | string;
};

type AccountSpendingRow = {
  accountId: string;
  accountNickname: string | null;
  accountOwnerName: string;
  total: number | string;
};

function normalizeCategory(value?: string) {
  return value
    ?.trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

async function getBudgetRecord(userId: string, budgetId: string) {
  const rows = await prisma.$queryRaw<BudgetRecord[]>`
    SELECT "id", "userId", "category", "monthlyLimit", "rolloverEnabled", "createdAt", "updatedAt"
    FROM "CategoryBudget"
    WHERE "id" = ${budgetId} AND "userId" = ${userId}
    LIMIT 1
  `;

  const budget = rows[0];
  if (!budget) {
    throw new AppError(404, `Budget ${budgetId} not found`);
  }

  return budget;
}

/**
 * Loads the per-month spending history and stored overrides for a single budget,
 * up to (but excluding) `endBoundary`, so the rollover chain can be walked.
 */
async function loadBudgetRolloverInputs(
  userId: string,
  budgetId: string,
  category: string,
  endBoundary: Date
) {
  const spendingRows = await prisma.$queryRaw<MonthlySpendingRow[]>`
    SELECT
      ${budgetId} AS "budgetId",
      TO_CHAR(DATE_TRUNC('month', t."effectiveAt" AT TIME ZONE 'UTC'), 'YYYY-MM') AS "month",
      COALESCE(SUM(t."amount"), 0) AS "total"
    FROM "Transaction" t
    JOIN "Account" a ON (
      (t."fromAccountId" = a."id" AND t."type" = 'WITHDRAWAL'::"TransactionType" AND a."accountType" != 'CREDIT'::"AccountType")
      OR
      (t."toAccountId" = a."id" AND t."type" = 'DEPOSIT'::"TransactionType" AND a."accountType" = 'CREDIT'::"AccountType")
    )
    WHERE a."userId" = ${userId}
      AND COALESCE(t."category", 'Uncategorized') = ${category}
      AND t."effectiveAt" < ${endBoundary}
    GROUP BY DATE_TRUNC('month', t."effectiveAt" AT TIME ZONE 'UTC')
  `;
  const periodRows = await prisma.$queryRaw<PeriodRow[]>`
    SELECT "budgetId", TO_CHAR("month", 'YYYY-MM') AS "month", "limitOverride", "adjustment"
    FROM "BudgetPeriod"
    WHERE "budgetId" = ${budgetId} AND "month" < ${endBoundary}
  `;

  return {
    spendingByMonth: groupSpendingByBudget(spendingRows).get(budgetId) ?? new Map<string, number>(),
    overridesByMonth:
      groupOverridesByBudget(periodRows).get(budgetId) ?? new Map<string, MonthOverride>(),
  };
}

/**
 * Returns all saved budgets for the current user with this month's spending progress.
 */
export async function listBudgets(
  userId: string,
  input?: { start?: Date; end?: Date; now?: Date }
) {
  const { start } = resolveDateRange(input);
  const targetMonth = monthKey(start);
  const endBoundary = nextMonthStart(targetMonth);

  const budgets = await prisma.$queryRaw<BudgetRecord[]>`
    SELECT "id", "userId", "category", "monthlyLimit", "rolloverEnabled", "createdAt", "updatedAt"
    FROM "CategoryBudget"
    WHERE "userId" = ${userId}
    ORDER BY "category" ASC
  `;
  const spendingRows = await prisma.$queryRaw<MonthlySpendingRow[]>`
    SELECT
      b."id" AS "budgetId",
      TO_CHAR(DATE_TRUNC('month', t."effectiveAt" AT TIME ZONE 'UTC'), 'YYYY-MM') AS "month",
      COALESCE(SUM(t."amount"), 0) AS "total"
    FROM "CategoryBudget" b
    JOIN "Account" a ON a."userId" = b."userId"
    JOIN "Transaction" t
      ON (
        (t."fromAccountId" = a."id" AND t."type" = 'WITHDRAWAL'::"TransactionType" AND a."accountType" != 'CREDIT'::"AccountType")
        OR
        (t."toAccountId" = a."id" AND t."type" = 'DEPOSIT'::"TransactionType" AND a."accountType" = 'CREDIT'::"AccountType")
      )
      AND COALESCE(t."category", 'Uncategorized') = b."category"
      AND t."effectiveAt" < ${endBoundary}
    WHERE b."userId" = ${userId}
    GROUP BY b."id", DATE_TRUNC('month', t."effectiveAt" AT TIME ZONE 'UTC')
  `;
  const periodRows = await prisma.$queryRaw<PeriodRow[]>`
    SELECT "budgetId", TO_CHAR("month", 'YYYY-MM') AS "month", "limitOverride", "adjustment"
    FROM "BudgetPeriod"
    WHERE "userId" = ${userId} AND "month" < ${endBoundary}
  `;

  const spendingByBudget = groupSpendingByBudget(spendingRows);
  const overridesByBudget = groupOverridesByBudget(periodRows);

  return budgets.map((budget) => {
    const rollover = computeRolloverForMonth({
      targetMonth,
      rolloverEnabled: budget.rolloverEnabled,
      templateLimit: Number(budget.monthlyLimit),
      spendingByMonth: spendingByBudget.get(budget.id) ?? new Map(),
      overridesByMonth: overridesByBudget.get(budget.id) ?? new Map(),
    });
    return toBudgetResponse(budget, rollover);
  });
}

/**
 * Returns a single budget plus the current month's matching withdrawals,
 * daily totals, and account totals for drill-down views.
 */
export async function getBudgetActivity(
  userId: string,
  budgetId: string,
  input?: { start?: Date; end?: Date; now?: Date }
) {
  const budget = await getBudgetRecord(userId, budgetId);
  const { start, end } = resolveDateRange(input);
  const transactions = await prisma.$queryRaw<BudgetActivityRecord[]>`
    SELECT
      t."id",
      t."amount",
      t."category",
      t."description",
      t."effectiveAt",
      t."createdAt",
      a."id" AS "accountId",
      a."nickname" AS "accountNickname",
      a."ownerName" AS "accountOwnerName"
    FROM "Transaction" t
    JOIN "Account" a ON (
      (t."fromAccountId" = a."id" AND t."type" = 'WITHDRAWAL'::"TransactionType" AND a."accountType" != 'CREDIT'::"AccountType")
      OR
      (t."toAccountId" = a."id" AND t."type" = 'DEPOSIT'::"TransactionType" AND a."accountType" = 'CREDIT'::"AccountType")
    )
    WHERE a."userId" = ${userId}
      AND COALESCE(t."category", 'Uncategorized') = ${budget.category}
      AND t."effectiveAt" >= ${start}
      AND t."effectiveAt" < ${end}
    ORDER BY t."effectiveAt" DESC, t."createdAt" DESC
  `;
  const dailySpending = await prisma.$queryRaw<DailySpendingRow[]>`
    SELECT DATE_TRUNC('day', t."effectiveAt") AS "day", COALESCE(SUM(t."amount"), 0) AS "total"
    FROM "Transaction" t
    JOIN "Account" a ON (
      (t."fromAccountId" = a."id" AND t."type" = 'WITHDRAWAL'::"TransactionType" AND a."accountType" != 'CREDIT'::"AccountType")
      OR
      (t."toAccountId" = a."id" AND t."type" = 'DEPOSIT'::"TransactionType" AND a."accountType" = 'CREDIT'::"AccountType")
    )
    WHERE a."userId" = ${userId}
      AND COALESCE(t."category", 'Uncategorized') = ${budget.category}
      AND t."effectiveAt" >= ${start}
      AND t."effectiveAt" < ${end}
    GROUP BY DATE_TRUNC('day', t."effectiveAt")
    ORDER BY "day" ASC
  `;
  const accountTotals = await prisma.$queryRaw<AccountSpendingRow[]>`
    SELECT
      a."id" AS "accountId",
      a."nickname" AS "accountNickname",
      a."ownerName" AS "accountOwnerName",
      COALESCE(SUM(t."amount"), 0) AS "total"
    FROM "Transaction" t
    JOIN "Account" a ON (
      (t."fromAccountId" = a."id" AND t."type" = 'WITHDRAWAL'::"TransactionType" AND a."accountType" != 'CREDIT'::"AccountType")
      OR
      (t."toAccountId" = a."id" AND t."type" = 'DEPOSIT'::"TransactionType" AND a."accountType" = 'CREDIT'::"AccountType")
    )
    WHERE a."userId" = ${userId}
      AND COALESCE(t."category", 'Uncategorized') = ${budget.category}
      AND t."effectiveAt" >= ${start}
      AND t."effectiveAt" < ${end}
    GROUP BY a."id", a."nickname", a."ownerName"
    ORDER BY "total" DESC, a."ownerName" ASC
  `;

  const normalizedTransactions = transactions.map((transaction) => ({
    id: transaction.id,
    amount: Number(transaction.amount),
    category: transaction.category,
    description: transaction.description,
    effectiveAt: transaction.effectiveAt,
    createdAt: transaction.createdAt,
    accountId: transaction.accountId,
    accountName: transaction.accountNickname ?? transaction.accountOwnerName,
    accountNickname: transaction.accountNickname,
    accountOwnerName: transaction.accountOwnerName,
  }));
  const currentSpending = normalizedTransactions.reduce(
    (sum, transaction) => sum + transaction.amount,
    0
  );

  const targetMonth = monthKey(start);
  const { spendingByMonth, overridesByMonth } = await loadBudgetRolloverInputs(
    userId,
    budget.id,
    budget.category,
    nextMonthStart(targetMonth)
  );
  // Keep the headline spent in step with the transactions actually listed above.
  spendingByMonth.set(targetMonth, currentSpending);
  const rollover = computeRolloverForMonth({
    targetMonth,
    rolloverEnabled: budget.rolloverEnabled,
    templateLimit: Number(budget.monthlyLimit),
    spendingByMonth,
    overridesByMonth,
  });

  return {
    ...toBudgetResponse(budget, rollover),
    activity: normalizedTransactions,
    dailySpending: dailySpending.map((row) => ({
      day: row.day,
      total: Number(row.total),
    })),
    accountTotals: accountTotals.map((row) => ({
      accountId: row.accountId,
      accountName: row.accountNickname ?? row.accountOwnerName,
      accountNickname: row.accountNickname,
      accountOwnerName: row.accountOwnerName,
      total: Number(row.total),
    })),
  };
}

/**
 * Creates or updates a monthly budget for a category.
 * Budgets are unique per user and category.
 */
export async function upsertBudget(userId: string, input: BudgetInput) {
  const category = normalizeCategory(input.category);
  const monthlyLimit = Number(input.monthlyLimit);

  if (!category) {
    throw new AppError(400, "Category is required");
  }
  if (category.length > 50) {
    throw new AppError(400, "Category must be at most 50 characters");
  }
  if (!Number.isFinite(monthlyLimit) || monthlyLimit <= 0) {
    throw new AppError(400, "Monthly limit must be a positive number");
  }

  const id = randomUUID();
  const rows = await prisma.$queryRaw<BudgetRecord[]>`
    INSERT INTO "CategoryBudget" ("id", "userId", "category", "monthlyLimit", "createdAt", "updatedAt")
    VALUES (${id}, ${userId}, ${category}, ${monthlyLimit}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("userId", "category")
    DO UPDATE SET
      "monthlyLimit" = EXCLUDED."monthlyLimit",
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "id", "userId", "category", "monthlyLimit", "rolloverEnabled", "createdAt", "updatedAt"
  `;

  const row = rows[0]!;
  return { ...row, monthlyLimit: Number(row.monthlyLimit) };
}

/**
 * Turns carry-forward on or off for a single budget. Enabling makes unspent
 * money roll into the next month; disabling reverts to a plain monthly cap.
 */
export async function setRolloverEnabled(userId: string, budgetId: string, enabled: boolean) {
  const rows = await prisma.$queryRaw<BudgetRecord[]>`
    UPDATE "CategoryBudget"
    SET "rolloverEnabled" = ${enabled}, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${budgetId} AND "userId" = ${userId}
    RETURNING "id", "userId", "category", "monthlyLimit", "rolloverEnabled", "createdAt", "updatedAt"
  `;

  const row = rows[0];
  if (!row) {
    throw new AppError(404, `Budget ${budgetId} not found`);
  }
  return { ...row, monthlyLimit: Number(row.monthlyLimit) };
}

/**
 * Moves money between two envelopes for a given month by recording offsetting
 * per-month adjustments. Rejects a move larger than the source's available
 * balance so an envelope can't be pushed negative by hand.
 */
export async function moveBudgetMoney(
  userId: string,
  input: { fromBudgetId: string; toBudgetId: string; month?: string; amount: number }
) {
  const { fromBudgetId, toBudgetId, amount } = input;

  if (fromBudgetId === toBudgetId) {
    throw new AppError(400, "Choose two different envelopes");
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError(400, "Amount must be a positive number");
  }

  const targetMonth = input.month ?? monthKey(new Date());
  if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
    throw new AppError(400, "month must be in YYYY-MM format");
  }
  const endBoundary = nextMonthStart(targetMonth);

  const source = await getBudgetRecord(userId, fromBudgetId);
  const destination = await getBudgetRecord(userId, toBudgetId);

  const sourceInputs = await loadBudgetRolloverInputs(
    userId,
    source.id,
    source.category,
    endBoundary
  );
  const sourceRollover = computeRolloverForMonth({
    targetMonth,
    rolloverEnabled: source.rolloverEnabled,
    templateLimit: Number(source.monthlyLimit),
    ...sourceInputs,
  });
  if (amount > sourceRollover.available) {
    throw new AppError(400, `Only ${sourceRollover.available} is available in ${source.category}`);
  }

  const monthStart = `${targetMonth}-01`;
  await applyBudgetAdjustment(userId, source.id, monthStart, -amount);
  await applyBudgetAdjustment(userId, destination.id, monthStart, amount);

  return { fromBudgetId: source.id, toBudgetId: destination.id, month: targetMonth, amount };
}

/** Adds `delta` to a budget's adjustment for a month, creating the period row on first move. */
async function applyBudgetAdjustment(
  userId: string,
  budgetId: string,
  monthStart: string,
  delta: number
) {
  await prisma.$queryRaw`
    INSERT INTO "BudgetPeriod" ("id", "budgetId", "userId", "month", "adjustment", "createdAt", "updatedAt")
    VALUES (${randomUUID()}, ${budgetId}, ${userId}, ${monthStart}::date, ${delta}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("budgetId", "month")
    DO UPDATE SET
      "adjustment" = "BudgetPeriod"."adjustment" + EXCLUDED."adjustment",
      "updatedAt" = CURRENT_TIMESTAMP
  `;
}

/**
 * Deletes a saved budget for the current user.
 * Throws 404 when the budget does not exist or does not belong to the user.
 */
export async function deleteBudget(userId: string, budgetId: string) {
  const rows = await prisma.$queryRaw<Pick<BudgetRecord, "id">[]>`
    DELETE FROM "CategoryBudget"
    WHERE "id" = ${budgetId} AND "userId" = ${userId}
    RETURNING "id"
  `;

  if (!rows[0]) {
    throw new AppError(404, `Budget ${budgetId} not found`);
  }
}
