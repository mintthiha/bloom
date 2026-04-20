import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { AppError } from "../middleware/errorHandler";
import { deposit, getAccount, withdraw } from "./accountService";

const prisma = new PrismaClient();

export type RecurringTransactionType = "DEPOSIT" | "WITHDRAWAL";
export type RecurringFrequency = "WEEKLY" | "BIWEEKLY" | "MONTHLY";

type RecurringTransactionRecord = {
  id: string;
  userId: string;
  accountId: string;
  name: string;
  type: RecurringTransactionType;
  amount: number;
  category: string | null;
  description: string | null;
  frequency: RecurringFrequency;
  startDate: Date;
  endDate: Date | null;
  nextRunAt: Date;
  lastRunAt: Date | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  accountOwnerName: string;
  accountNickname: string | null;
  accountType: string;
};

type CreateRecurringTransactionInput = {
  accountId: string;
  name: string;
  type: RecurringTransactionType;
  amount: number;
  category?: string;
  description?: string;
  frequency: RecurringFrequency;
  startDate: Date;
  endDate?: Date;
};

type UpdateRecurringTransactionInput = CreateRecurringTransactionInput;

type ApplyDueResult = {
  appliedCount: number;
  failedCount: number;
  applied: Array<{
    recurringTransactionId: string;
    occurrenceAt: Date;
    type: RecurringTransactionType;
    amount: number;
    accountId: string;
  }>;
  failures: Array<{
    recurringTransactionId: string;
    accountId: string;
    occurrenceAt: Date;
    message: string;
  }>;
};

function normalizeOptionalString(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function advanceRunDate(date: Date, frequency: RecurringFrequency) {
  const next = new Date(date);

  if (frequency === "WEEKLY") {
    next.setUTCDate(next.getUTCDate() + 7);
    return next;
  }

  if (frequency === "BIWEEKLY") {
    next.setUTCDate(next.getUTCDate() + 14);
    return next;
  }

  next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

function calculateNextRunAt(input: {
  startDate: Date;
  frequency: RecurringFrequency;
  lastRunAt?: Date | null;
}) {
  if (!input.lastRunAt || input.lastRunAt < input.startDate) {
    return new Date(input.startDate);
  }

  return advanceRunDate(input.lastRunAt, input.frequency);
}

async function selectRecurringTransactionById(userId: string, id: string) {
  const rows = await prisma.$queryRaw<RecurringTransactionRecord[]>`
    SELECT
      r."id",
      r."userId",
      r."accountId",
      r."name",
      r."type",
      r."amount",
      r."category",
      r."description",
      r."frequency",
      r."startDate",
      r."endDate",
      r."nextRunAt",
      r."lastRunAt",
      r."active",
      r."createdAt",
      r."updatedAt",
      a."ownerName" AS "accountOwnerName",
      a."nickname" AS "accountNickname",
      a."accountType" AS "accountType"
    FROM "RecurringTransaction" r
    JOIN "Account" a ON a."id" = r."accountId"
    WHERE r."userId" = ${userId} AND r."id" = ${id}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

/**
 * Lists recurring transaction rules for the current user.
 */
export async function listRecurringTransactions(userId: string) {
  return prisma.$queryRaw<RecurringTransactionRecord[]>`
    SELECT
      r."id",
      r."userId",
      r."accountId",
      r."name",
      r."type",
      r."amount",
      r."category",
      r."description",
      r."frequency",
      r."startDate",
      r."endDate",
      r."nextRunAt",
      r."lastRunAt",
      r."active",
      r."createdAt",
      r."updatedAt",
      a."ownerName" AS "accountOwnerName",
      a."nickname" AS "accountNickname",
      a."accountType" AS "accountType"
    FROM "RecurringTransaction" r
    JOIN "Account" a ON a."id" = r."accountId"
    WHERE r."userId" = ${userId}
    ORDER BY r."active" DESC, r."nextRunAt" ASC, r."createdAt" DESC
  `;
}

/**
 * Creates a new recurring deposit or withdrawal rule.
 */
export async function createRecurringTransaction(userId: string, input: CreateRecurringTransactionInput) {
  if (input.amount <= 0) {
    throw new AppError(400, "amount must be positive");
  }
  if (!input.name.trim()) {
    throw new AppError(400, "name is required");
  }
  if (input.endDate && input.endDate < input.startDate) {
    throw new AppError(400, "endDate must be on or after startDate");
  }

  const account = await getAccount(userId, input.accountId);
  if (!account) {
    throw new AppError(404, `Account ${input.accountId} not found`);
  }

  const id = randomUUID();
  const name = input.name.trim();
  const category = normalizeOptionalString(input.category);
  const description = normalizeOptionalString(input.description);
  const rows = await prisma.$queryRaw<RecurringTransactionRecord[]>`
    INSERT INTO "RecurringTransaction" (
      "id",
      "userId",
      "accountId",
      "name",
      "type",
      "amount",
      "category",
      "description",
      "frequency",
      "startDate",
      "endDate",
      "nextRunAt",
      "lastRunAt",
      "active",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${id},
      ${userId},
      ${input.accountId},
      ${name},
      ${input.type}::"RecurringTransactionType",
      ${input.amount},
      ${category},
      ${description},
      ${input.frequency}::"RecurringFrequency",
      ${input.startDate},
      ${input.endDate ?? null},
      ${input.startDate},
      ${null},
      true,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    RETURNING
      "id",
      "userId",
      "accountId",
      "name",
      "type",
      "amount",
      "category",
      "description",
      "frequency",
      "startDate",
      "endDate",
      "nextRunAt",
      "lastRunAt",
      "active",
      "createdAt",
      "updatedAt",
      ${account.ownerName} AS "accountOwnerName",
      ${account.nickname} AS "accountNickname",
      ${account.accountType} AS "accountType"
  `;

  return rows[0];
}

/**
 * Updates a recurring rule. Previous generated transactions remain unchanged.
 */
export async function updateRecurringTransaction(userId: string, id: string, input: UpdateRecurringTransactionInput) {
  if (input.amount <= 0) {
    throw new AppError(400, "amount must be positive");
  }
  if (!input.name.trim()) {
    throw new AppError(400, "name is required");
  }
  if (input.endDate && input.endDate < input.startDate) {
    throw new AppError(400, "endDate must be on or after startDate");
  }

  const existing = await selectRecurringTransactionById(userId, id);
  if (!existing) {
    throw new AppError(404, `Recurring transaction ${id} not found`);
  }

  const account = await getAccount(userId, input.accountId);
  if (!account) {
    throw new AppError(404, `Account ${input.accountId} not found`);
  }

  const name = input.name.trim();
  const category = normalizeOptionalString(input.category);
  const description = normalizeOptionalString(input.description);
  const nextRunAt = calculateNextRunAt({
    startDate: input.startDate,
    frequency: input.frequency,
    lastRunAt: existing.lastRunAt,
  });

  const rows = await prisma.$queryRaw<RecurringTransactionRecord[]>`
    UPDATE "RecurringTransaction"
    SET "accountId" = ${input.accountId},
        "name" = ${name},
        "type" = ${input.type}::"RecurringTransactionType",
        "amount" = ${input.amount},
        "category" = ${category},
        "description" = ${description},
        "frequency" = ${input.frequency}::"RecurringFrequency",
        "startDate" = ${input.startDate},
        "endDate" = ${input.endDate ?? null},
        "nextRunAt" = ${nextRunAt},
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id} AND "userId" = ${userId}
    RETURNING
      "id",
      "userId",
      "accountId",
      "name",
      "type",
      "amount",
      "category",
      "description",
      "frequency",
      "startDate",
      "endDate",
      "nextRunAt",
      "lastRunAt",
      "active",
      "createdAt",
      "updatedAt",
      ${account.ownerName} AS "accountOwnerName",
      ${account.nickname} AS "accountNickname",
      ${account.accountType} AS "accountType"
  `;

  return rows[0];
}

/**
 * Updates whether a recurring rule is active.
 */
export async function setRecurringTransactionActive(userId: string, id: string, active: boolean) {
  const existing = await selectRecurringTransactionById(userId, id);
  if (!existing) {
    throw new AppError(404, `Recurring transaction ${id} not found`);
  }

  const rows = await prisma.$queryRaw<RecurringTransactionRecord[]>`
    UPDATE "RecurringTransaction"
    SET "active" = ${active},
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id} AND "userId" = ${userId}
    RETURNING
      "id",
      "userId",
      "accountId",
      "name",
      "type",
      "amount",
      "category",
      "description",
      "frequency",
      "startDate",
      "endDate",
      "nextRunAt",
      "lastRunAt",
      "active",
      "createdAt",
      "updatedAt",
      ${existing.accountOwnerName} AS "accountOwnerName",
      ${existing.accountNickname} AS "accountNickname",
      ${existing.accountType} AS "accountType"
  `;

  return rows[0];
}

/**
 * Deletes a recurring rule without removing previously generated transactions.
 */
export async function deleteRecurringTransaction(userId: string, id: string) {
  const existing = await selectRecurringTransactionById(userId, id);
  if (!existing) {
    throw new AppError(404, `Recurring transaction ${id} not found`);
  }

  await prisma.$queryRaw`
    DELETE FROM "RecurringTransaction"
    WHERE "id" = ${id} AND "userId" = ${userId}
  `;
}

/**
 * Applies all due recurring rules for the current user.
 * Each successful occurrence creates a normal deposit or withdrawal entry.
 */
export async function applyDueRecurringTransactions(userId: string, now = new Date()): Promise<ApplyDueResult> {
  const rules = await prisma.$queryRaw<RecurringTransactionRecord[]>`
    SELECT
      r."id",
      r."userId",
      r."accountId",
      r."name",
      r."type",
      r."amount",
      r."category",
      r."description",
      r."frequency",
      r."startDate",
      r."endDate",
      r."nextRunAt",
      r."lastRunAt",
      r."active",
      r."createdAt",
      r."updatedAt",
      a."ownerName" AS "accountOwnerName",
      a."nickname" AS "accountNickname",
      a."accountType" AS "accountType"
    FROM "RecurringTransaction" r
    JOIN "Account" a ON a."id" = r."accountId"
    WHERE r."userId" = ${userId}
      AND r."active" = true
      AND r."nextRunAt" <= ${now}
    ORDER BY r."nextRunAt" ASC, r."createdAt" ASC
  `;

  const result: ApplyDueResult = {
    appliedCount: 0,
    failedCount: 0,
    applied: [],
    failures: [],
  };

  for (const rule of rules) {
    let nextRunAt = new Date(rule.nextRunAt);
    let lastRunAt = rule.lastRunAt ? new Date(rule.lastRunAt) : null;
    let shouldDeactivate = false;

    while (nextRunAt <= now) {
      if (rule.endDate && nextRunAt > rule.endDate) {
        shouldDeactivate = true;
        break;
      }

      try {
        if (rule.type === "DEPOSIT") {
          await deposit(userId, rule.accountId, rule.amount, rule.category ?? undefined, rule.description ?? undefined, nextRunAt);
        } else {
          await withdraw(userId, rule.accountId, rule.amount, rule.category ?? undefined, rule.description ?? undefined, nextRunAt);
        }

        result.appliedCount += 1;
        result.applied.push({
          recurringTransactionId: rule.id,
          occurrenceAt: new Date(nextRunAt),
          type: rule.type,
          amount: rule.amount,
          accountId: rule.accountId,
        });

        lastRunAt = new Date(nextRunAt);
        nextRunAt = advanceRunDate(nextRunAt, rule.frequency);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to apply recurring transaction";
        result.failedCount += 1;
        result.failures.push({
          recurringTransactionId: rule.id,
          accountId: rule.accountId,
          occurrenceAt: new Date(nextRunAt),
          message,
        });
        break;
      }
    }

    if (rule.endDate && nextRunAt > rule.endDate) {
      shouldDeactivate = true;
    }

    await prisma.$queryRaw`
      UPDATE "RecurringTransaction"
      SET "nextRunAt" = ${nextRunAt},
          "lastRunAt" = ${lastRunAt},
          "active" = ${shouldDeactivate ? false : rule.active},
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${rule.id}
    `;
  }

  return result;
}
