import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { AppError } from "../middleware/errorHandler";
import { resolveDateRange } from "../lib/date-range";

const prisma = new PrismaClient();

type BudgetRecord = {
  id: string;
  userId: string;
  category: string;
  monthlyLimit: number;
  createdAt: Date;
  updatedAt: Date;
};

type BudgetProgressRow = BudgetRecord & {
  currentSpending: number | string | null;
};

type BudgetInput = {
  category?: string;
  monthlyLimit?: number;
};

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
    SELECT "id", "userId", "category", "monthlyLimit", "createdAt", "updatedAt"
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
 * Returns all saved budgets for the current user with this month's spending progress.
 */
export async function listBudgets(userId: string, input?: { start?: Date; end?: Date; now?: Date }) {
  const { start, end } = resolveDateRange(input);
  const rows = await prisma.$queryRaw<BudgetProgressRow[]>`
    SELECT
      b."id",
      b."userId",
      b."category",
      b."monthlyLimit",
      b."createdAt",
      b."updatedAt",
      COALESCE(SUM(t."amount"), 0) AS "currentSpending"
    FROM "CategoryBudget" b
    LEFT JOIN "Account" a ON a."userId" = b."userId"
    LEFT JOIN "Transaction" t
      ON (
        (t."fromAccountId" = a."id" AND t."type" = 'WITHDRAWAL'::"TransactionType" AND a."accountType" != 'CREDIT'::"AccountType")
        OR
        (t."toAccountId" = a."id" AND t."type" = 'DEPOSIT'::"TransactionType" AND a."accountType" = 'CREDIT'::"AccountType")
      )
      AND COALESCE(t."category", 'Uncategorized') = b."category"
      AND t."effectiveAt" >= ${start}
      AND t."effectiveAt" < ${end}
    WHERE b."userId" = ${userId}
    GROUP BY b."id", b."userId", b."category", b."monthlyLimit", b."createdAt", b."updatedAt"
    ORDER BY b."category" ASC
  `;

  return rows.map((row) => {
    const monthlyLimit = Number(row.monthlyLimit);
    const currentSpending = Number(row.currentSpending ?? 0);
    const remaining = monthlyLimit - currentSpending;
    const percentageUsed = monthlyLimit > 0 ? (currentSpending / monthlyLimit) * 100 : 0;

    return {
      id: row.id,
      userId: row.userId,
      category: row.category,
      monthlyLimit,
      currentSpending,
      remaining,
      percentageUsed,
      isOverBudget: remaining < 0,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  });
}

/**
 * Returns a single budget plus the current month's matching withdrawals,
 * daily totals, and account totals for drill-down views.
 */
export async function getBudgetActivity(userId: string, budgetId: string, input?: { start?: Date; end?: Date; now?: Date }) {
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
  const currentSpending = normalizedTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  const monthlyLimit = Number(budget.monthlyLimit);
  const remaining = monthlyLimit - currentSpending;

  return {
    id: budget.id,
    userId: budget.userId,
    category: budget.category,
    month: start.toISOString().slice(0, 7),
    monthlyLimit,
    currentSpending,
    remaining,
    percentageUsed: monthlyLimit > 0 ? (currentSpending / monthlyLimit) * 100 : 0,
    isOverBudget: remaining < 0,
    createdAt: budget.createdAt,
    updatedAt: budget.updatedAt,
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
    RETURNING "id", "userId", "category", "monthlyLimit", "createdAt", "updatedAt"
  `;

  return rows[0];
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
