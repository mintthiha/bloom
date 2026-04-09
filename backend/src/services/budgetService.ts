import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { AppError } from "../middleware/errorHandler";

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

function normalizeCategory(value?: string) {
  return value
    ?.trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Returns all saved budgets for the current user with this month's spending progress.
 */
export async function listBudgets(userId: string, now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
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
      ON t."fromAccountId" = a."id"
      AND t."type" = 'WITHDRAWAL'::"TransactionType"
      AND COALESCE(t."category", 'Uncategorized') = b."category"
      AND t."createdAt" >= ${start}
      AND t."createdAt" < ${end}
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
 * Creates or updates a monthly budget for a category.
 * Budgets are unique per user and category.
 */
export async function upsertBudget(userId: string, input: BudgetInput) {
  const category = normalizeCategory(input.category);
  const monthlyLimit = Number(input.monthlyLimit);

  if (!category) {
    throw new AppError(400, "Category is required");
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
