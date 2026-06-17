import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { AppError } from "../middleware/errorHandler";

const prisma = new PrismaClient();

type SavingsGoalRow = {
  id: string;
  userId: string;
  accountId: string;
  name: string;
  targetAmount: number;
  createdAt: Date;
  updatedAt: Date;
  accountBalance: number;
  accountNickname: string | null;
  accountOwnerName: string;
  accountType: string;
};

/** Converts a raw DB row into a clean API response object with derived progress fields. */
function normalizeSavingsGoalRow(row: SavingsGoalRow) {
  const targetAmount = Number(row.targetAmount);
  const currentBalance = Number(row.accountBalance);
  const percentageReached =
    targetAmount > 0 ? Math.min(Math.max((currentBalance / targetAmount) * 100, 0), 100) : 0;

  return {
    id: row.id,
    userId: row.userId,
    accountId: row.accountId,
    name: row.name,
    targetAmount,
    currentBalance,
    accountName: row.accountNickname ?? row.accountOwnerName,
    accountNickname: row.accountNickname,
    accountOwnerName: row.accountOwnerName,
    accountType: row.accountType,
    percentageReached,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Fetches a single savings goal joined with its linked account data. */
async function fetchSavingsGoalWithAccount(goalId: string) {
  const rows = await prisma.$queryRaw<SavingsGoalRow[]>`
    SELECT
      g."id", g."userId", g."accountId", g."name", g."targetAmount"::float8 AS "targetAmount",
      g."createdAt", g."updatedAt",
      a."balance"::float8 AS "accountBalance",
      a."nickname"        AS "accountNickname",
      a."ownerName"       AS "accountOwnerName",
      a."accountType"::text AS "accountType"
    FROM "SavingsGoal" g
    JOIN "Account" a ON a."id" = g."accountId"
    WHERE g."id" = ${goalId}
    LIMIT 1
  `;
  return rows[0] ? normalizeSavingsGoalRow(rows[0]) : null;
}

/** Confirms the savings goal exists and belongs to the user, or throws 404. */
async function getSavingsGoalOrThrow(userId: string, goalId: string) {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "SavingsGoal"
    WHERE "id" = ${goalId} AND "userId" = ${userId}
    LIMIT 1
  `;
  if (!rows[0]) throw new AppError(404, `Savings goal ${goalId} not found`);
  return rows[0];
}

/** Returns all savings goals for the user with live account balances. */
export async function listSavingsGoals(userId: string) {
  const rows = await prisma.$queryRaw<SavingsGoalRow[]>`
    SELECT
      g."id", g."userId", g."accountId", g."name", g."targetAmount"::float8 AS "targetAmount",
      g."createdAt", g."updatedAt",
      a."balance"::float8 AS "accountBalance",
      a."nickname"        AS "accountNickname",
      a."ownerName"       AS "accountOwnerName",
      a."accountType"::text AS "accountType"
    FROM "SavingsGoal" g
    JOIN "Account" a ON a."id" = g."accountId"
    WHERE g."userId" = ${userId}
    ORDER BY g."createdAt" ASC
  `;
  return rows.map(normalizeSavingsGoalRow);
}

/** Creates a new savings goal linked to the specified account. */
export async function createSavingsGoal(
  userId: string,
  input: { accountId: string; name: string; targetAmount: number }
) {
  const accountRows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Account"
    WHERE "id" = ${input.accountId} AND "userId" = ${userId}
    LIMIT 1
  `;
  if (!accountRows[0]) throw new AppError(404, "Account not found");

  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "SavingsGoal" ("id", "userId", "accountId", "name", "targetAmount", "createdAt", "updatedAt")
    VALUES (${id}, ${userId}, ${input.accountId}, ${input.name}, ${input.targetAmount}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `;

  const goal = await fetchSavingsGoalWithAccount(id);
  if (!goal) throw new AppError(500, "Failed to create savings goal");
  return goal;
}

/** Updates the name, linked account, and target amount of an existing savings goal. */
export async function updateSavingsGoal(
  userId: string,
  goalId: string,
  input: { accountId: string; name: string; targetAmount: number }
) {
  await getSavingsGoalOrThrow(userId, goalId);

  const accountRows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Account"
    WHERE "id" = ${input.accountId} AND "userId" = ${userId}
    LIMIT 1
  `;
  if (!accountRows[0]) throw new AppError(404, "Account not found");

  await prisma.$executeRaw`
    UPDATE "SavingsGoal"
    SET
      "accountId"    = ${input.accountId},
      "name"         = ${input.name},
      "targetAmount" = ${input.targetAmount},
      "updatedAt"    = CURRENT_TIMESTAMP
    WHERE "id" = ${goalId} AND "userId" = ${userId}
  `;

  const goal = await fetchSavingsGoalWithAccount(goalId);
  if (!goal) throw new AppError(500, "Failed to update savings goal");
  return goal;
}

/** Deletes a savings goal. Throws 404 when the goal does not belong to the user. */
export async function deleteSavingsGoal(userId: string, goalId: string) {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    DELETE FROM "SavingsGoal"
    WHERE "id" = ${goalId} AND "userId" = ${userId}
    RETURNING "id"
  `;
  if (!rows[0]) throw new AppError(404, `Savings goal ${goalId} not found`);
}
