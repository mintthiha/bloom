import { randomUUID } from "crypto";
import { AppError } from "../middleware/errorHandler";
import prisma from "../lib/prisma";
import { logActivity } from "./activityService";
import {
  ActivityFieldChange,
  describeActivityFieldChanges,
  pushActivityFieldChange,
} from "./activityChanges";

type SavingsGoalRow = {
  id: string;
  userId: string;
  accountId: string;
  name: string;
  targetAmount: string;
  targetDate: Date | null;
  icon: string | null;
  color: string | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  accountBalance: string;
  accountNickname: string | null;
  accountOwnerName: string;
  accountType: string;
};

/** Renders a date-only column as YYYY-MM-DD, matching how the rest of the API exposes such dates. */
function toDateOnly(value: Date | null): string | null {
  return value ? (value.toISOString().split("T")[0] as string) : null;
}

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
    targetDate: toDateOnly(row.targetDate),
    icon: row.icon,
    color: row.color,
    note: row.note,
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
      g."id", g."userId", g."accountId", g."name", g."targetAmount",
      g."targetDate", g."icon", g."color", g."note",
      g."createdAt", g."updatedAt",
      a."balance" AS "accountBalance",
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
    WHERE "id" = ${goalId} AND "userId" = ${userId} AND "deletedAt" IS NULL
    LIMIT 1
  `;
  if (!rows[0]) throw new AppError(404, `Savings goal ${goalId} not found`);
  return rows[0];
}

/** Returns all savings goals for the user with live account balances. */
export async function listSavingsGoals(userId: string) {
  const rows = await prisma.$queryRaw<SavingsGoalRow[]>`
    SELECT
      g."id", g."userId", g."accountId", g."name", g."targetAmount",
      g."targetDate", g."icon", g."color", g."note",
      g."createdAt", g."updatedAt",
      a."balance" AS "accountBalance",
      a."nickname"        AS "accountNickname",
      a."ownerName"       AS "accountOwnerName",
      a."accountType"::text AS "accountType"
    FROM "SavingsGoal" g
    JOIN "Account" a ON a."id" = g."accountId"
    WHERE g."userId" = ${userId} AND g."deletedAt" IS NULL AND a."deletedAt" IS NULL
    ORDER BY g."createdAt" ASC
  `;
  return rows.map(normalizeSavingsGoalRow);
}

/** The user-editable fields of a savings goal, shared by create and update. */
export type SavingsGoalInput = {
  accountId: string;
  name: string;
  targetAmount: number;
  /** Date the user wants to hit the target by, or null when the goal has no deadline. */
  targetDate: Date | null;
  icon: string | null;
  color: string | null;
  /** The user's short "why this matters" reminder, or null when they left it blank. */
  note: string | null;
};

/** Creates a new savings goal linked to the specified account. */
export async function createSavingsGoal(userId: string, input: SavingsGoalInput) {
  const accountRows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Account"
    WHERE "id" = ${input.accountId} AND "userId" = ${userId} AND "deletedAt" IS NULL
    LIMIT 1
  `;
  if (!accountRows[0]) throw new AppError(404, "Account not found");

  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "SavingsGoal" (
      "id", "userId", "accountId", "name", "targetAmount",
      "targetDate", "icon", "color", "note", "createdAt", "updatedAt"
    )
    VALUES (
      ${id}, ${userId}, ${input.accountId}, ${input.name}, ${input.targetAmount},
      ${input.targetDate}::date, ${input.icon}, ${input.color}, ${input.note},
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `;

  const goal = await fetchSavingsGoalWithAccount(id);
  if (!goal) throw new AppError(500, "Failed to create savings goal");
  logActivity(userId, "GOAL_CREATED", `Created savings goal "${goal.name}"`, {
    goalId: id,
    targetAmount: input.targetAmount,
    targetDate: goal.targetDate,
  });
  return goal;
}

/** Updates every user-editable field of an existing savings goal. */
export async function updateSavingsGoal(userId: string, goalId: string, input: SavingsGoalInput) {
  await getSavingsGoalOrThrow(userId, goalId);
  const existingGoal = await fetchSavingsGoalWithAccount(goalId);

  const accountRows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Account"
    WHERE "id" = ${input.accountId} AND "userId" = ${userId} AND "deletedAt" IS NULL
    LIMIT 1
  `;
  if (!accountRows[0]) throw new AppError(404, "Account not found");

  await prisma.$executeRaw`
    UPDATE "SavingsGoal"
    SET
      "accountId"    = ${input.accountId},
      "name"         = ${input.name},
      "targetAmount" = ${input.targetAmount},
      "targetDate"   = ${input.targetDate}::date,
      "icon"         = ${input.icon},
      "color"        = ${input.color},
      "note"         = ${input.note},
      "updatedAt"    = CURRENT_TIMESTAMP
    WHERE "id" = ${goalId} AND "userId" = ${userId}
  `;

  const goal = await fetchSavingsGoalWithAccount(goalId);
  if (!goal) throw new AppError(500, "Failed to update savings goal");

  const changes: ActivityFieldChange[] = [];
  pushActivityFieldChange(changes, "name", "Name", "text", existingGoal?.name ?? null, goal.name);
  pushActivityFieldChange(
    changes,
    "targetAmount",
    "Target amount",
    "currency",
    existingGoal?.targetAmount ?? null,
    goal.targetAmount
  );
  pushActivityFieldChange(
    changes,
    "accountId",
    "Account",
    "text",
    existingGoal?.accountName ?? null,
    goal.accountName
  );
  pushActivityFieldChange(
    changes,
    "targetDate",
    "Target date",
    "date",
    existingGoal?.targetDate ?? null,
    goal.targetDate
  );
  pushActivityFieldChange(changes, "icon", "Icon", "text", existingGoal?.icon ?? null, goal.icon);
  pushActivityFieldChange(
    changes,
    "color",
    "Colour",
    "text",
    existingGoal?.color ?? null,
    goal.color
  );
  pushActivityFieldChange(changes, "note", "Note", "text", existingGoal?.note ?? null, goal.note);

  logActivity(
    userId,
    "GOAL_UPDATED",
    `Updated savings goal "${goal.name}": ${describeActivityFieldChanges(changes, "no changes")}`,
    { goalId, changes }
  );
  return goal;
}

/** Soft-deletes a savings goal (recoverable via restoreSavingsGoal). Throws 404 if not found or already deleted. */
export async function deleteSavingsGoal(userId: string, goalId: string) {
  const goalBeforeDelete = await fetchSavingsGoalWithAccount(goalId);
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "SavingsGoal"
    SET "deletedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${goalId} AND "userId" = ${userId} AND "deletedAt" IS NULL
    RETURNING "id"
  `;
  if (!rows[0]) throw new AppError(404, `Savings goal ${goalId} not found`);
  logActivity(
    userId,
    "GOAL_DELETED",
    `Deleted savings goal "${goalBeforeDelete?.name ?? goalId}"`,
    { goalId }
  );
}

/** Restores a soft-deleted savings goal (the "Undo" action after a delete). Throws 404 if not found or not deleted. */
export async function restoreSavingsGoal(userId: string, goalId: string) {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "SavingsGoal"
    SET "deletedAt" = NULL
    WHERE "id" = ${goalId} AND "userId" = ${userId} AND "deletedAt" IS NOT NULL
    RETURNING "id"
  `;
  if (!rows[0]) throw new AppError(404, `Savings goal ${goalId} not found`);
  const restored = await fetchSavingsGoalWithAccount(goalId);
  logActivity(userId, "GOAL_RESTORED", `Restored savings goal "${restored?.name ?? goalId}"`, {
    goalId,
  });
  return restored;
}
