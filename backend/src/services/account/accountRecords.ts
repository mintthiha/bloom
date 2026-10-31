// Shared account/transaction row shapes, normalizers, lookups, and the balance-replay helpers every account module builds on.
// Split out of accountService.ts, which re-exports its public API.
import { TransactionType, AccountType, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { AppError } from "../../middleware/errorHandler";
import prisma from "../../lib/prisma";

export type AccountRecord = {
  id: string;
  userId: string;
  ownerName: string;
  nickname: string | null;
  color: string | null;
  icon: string | null;
  accountType: AccountType;
  balance: string;
  frozen: boolean;
  isLinked: boolean;
  plaidAccountId: string | null;
  plaidItemId: string | null;
  institutionName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TransactionRecord = {
  id: string;
  type: TransactionType;
  amount: string;
  balanceAfter: string;
  transferGroupId: string | null;
  category: string | null;
  merchant: string | null;
  description: string | null;
  effectiveAt: Date;
  createdAt: Date;
  fromAccountId: string | null;
  toAccountId: string | null;
};

type TransactionSplitRecord = {
  id: string;
  transactionId: string;
  category: string;
  amount: string;
  description: string | null;
};

export type TransactionSplitInput = {
  category: string;
  amount: number;
  description?: string;
};

export type MonthlySummaryRow = {
  category: string;
  income: number | string | null;
  spending: number | string | null;
};

export type TransactionFilters = {
  type?: TransactionType;
  category?: string;
  search?: string;
  start?: Date;
  end?: Date;
};

export type TransactionUpdateInput = {
  amount: number;
  category?: string;
  merchant?: string;
  description?: string;
  effectiveAt?: Date;
};

/** Returns a short display name for an account, preferring the nickname over the owner name. */
export function accountLabel(ownerName: string, nickname: string | null): string {
  return nickname ?? ownerName;
}

/** Identifies a recurring rule that triggered a deposit/withdrawal, so the activity log can attribute it. */
export type RecurringActivitySource = {
  recurringTransactionId: string;
  recurringName: string;
};

/** Builds the "(recurring: ...)" suffix appended to auto-applied deposit/withdrawal activity descriptions. */
export function recurringActivitySuffix(recurringSource?: RecurringActivitySource): string {
  return recurringSource ? ` (recurring: "${recurringSource.recurringName}")` : "";
}

/** Builds the extra activity metadata recording which recurring rule generated a deposit/withdrawal. */
export function recurringActivityMetadata(recurringSource?: RecurringActivitySource) {
  return recurringSource ? { recurringTransactionId: recurringSource.recurringTransactionId } : {};
}

/** Converts a raw DB AccountRecord (Decimal balance string) to API-safe format with numeric balance. */
export function normalizeAccount(row: AccountRecord) {
  return { ...row, balance: Number(row.balance) };
}

/** Converts a raw DB TransactionRecord (Decimal strings) to API-safe format with numeric money fields. */
export function normalizeTransaction(row: TransactionRecord) {
  return { ...row, amount: Number(row.amount), balanceAfter: Number(row.balanceAfter) };
}

/** Converts a raw DB TransactionSplitRecord (Decimal string) to API-safe format with a numeric amount. */
function normalizeSplit(row: TransactionSplitRecord) {
  return {
    id: row.id,
    category: row.category,
    amount: Number(row.amount),
    description: row.description,
  };
}

/** Fetches every split line item for the given transaction ids, grouped by transaction id. */
export async function selectSplitsByTransactionIds(transactionIds: string[]) {
  if (transactionIds.length === 0) return new Map<string, ReturnType<typeof normalizeSplit>[]>();
  const rows = await prisma.$queryRaw<TransactionSplitRecord[]>`
    SELECT "id", "transactionId", "category", "amount", "description"
    FROM "TransactionSplit"
    WHERE "transactionId" IN (${Prisma.join(transactionIds)})
    ORDER BY "createdAt" ASC
  `;
  const byTransaction = new Map<string, ReturnType<typeof normalizeSplit>[]>();
  for (const row of rows) {
    const splits = byTransaction.get(row.transactionId) ?? [];
    splits.push(normalizeSplit(row));
    byTransaction.set(row.transactionId, splits);
  }
  return byTransaction;
}

export async function selectAccountByUserId(userId: string, id: string) {
  const rows = await prisma.$queryRaw<AccountRecord[]>`
    SELECT "id", "userId", "ownerName", "nickname", "color", "icon", "accountType", "balance", "frozen", "isLinked", "plaidAccountId", "plaidItemId", "institutionName", "createdAt", "updatedAt"
    FROM "Account"
    WHERE "id" = ${id} AND "userId" = ${userId} AND "deletedAt" IS NULL
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function selectTransactionByAccount(
  userId: string,
  accountId: string,
  transactionId: string
) {
  const rows = await prisma.$queryRaw<TransactionRecord[]>`
    SELECT t."id", t."type", t."amount", t."balanceAfter", t."transferGroupId", t."category", t."merchant", t."description", t."effectiveAt", t."createdAt", t."fromAccountId", t."toAccountId"
    FROM "Transaction" t
    JOIN "Account" a ON (
      (t."fromAccountId" = a."id" AND t."type" IN ('WITHDRAWAL'::"TransactionType", 'TRANSFER_OUT'::"TransactionType"))
      OR
      (t."toAccountId" = a."id" AND t."type" IN ('DEPOSIT'::"TransactionType", 'TRANSFER_IN'::"TransactionType"))
    )
    WHERE t."id" = ${transactionId}
      AND a."id" = ${accountId}
      AND a."userId" = ${userId}
      AND t."deletedAt" IS NULL
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function selectTransactionsByTransferGroup(userId: string, transferGroupId: string) {
  return prisma.$queryRaw<TransactionRecord[]>`
    SELECT t."id", t."type", t."amount", t."balanceAfter", t."transferGroupId", t."category", t."merchant", t."description", t."effectiveAt", t."createdAt", t."fromAccountId", t."toAccountId"
    FROM "Transaction" t
    LEFT JOIN "Account" fa ON fa."id" = t."fromAccountId"
    LEFT JOIN "Account" ta ON ta."id" = t."toAccountId"
    WHERE t."transferGroupId" = ${transferGroupId}
      AND t."deletedAt" IS NULL
      AND (fa."userId" = ${userId} OR ta."userId" = ${userId})
    ORDER BY t."createdAt" ASC, t."id" ASC
  `;
}

async function listTransactionsForBalanceReplay(
  client: Pick<Prisma.TransactionClient, "$queryRaw">,
  accountId: string
) {
  return client.$queryRaw<TransactionRecord[]>`
    SELECT "id", "type", "amount", "balanceAfter", "transferGroupId", "category", "merchant", "description", "effectiveAt", "createdAt", "fromAccountId", "toAccountId"
    FROM "Transaction"
    WHERE "deletedAt" IS NULL
      AND (
        ("fromAccountId" = ${accountId} AND "type" IN ('WITHDRAWAL'::"TransactionType", 'TRANSFER_OUT'::"TransactionType"))
        OR
        ("toAccountId" = ${accountId} AND "type" IN ('DEPOSIT'::"TransactionType", 'TRANSFER_IN'::"TransactionType"))
      )
    ORDER BY "effectiveAt" ASC, "createdAt" ASC, "id" ASC
  `;
}

function getTransactionDelta(transaction: TransactionRecord, accountId: string): Prisma.Decimal {
  const amount = new Prisma.Decimal(transaction.amount);
  if (transaction.type === TransactionType.DEPOSIT && transaction.toAccountId === accountId) {
    return amount;
  }
  if (transaction.type === TransactionType.TRANSFER_IN && transaction.toAccountId === accountId) {
    return amount;
  }
  if (transaction.type === TransactionType.WITHDRAWAL && transaction.fromAccountId === accountId) {
    return amount.negated();
  }
  if (
    transaction.type === TransactionType.TRANSFER_OUT &&
    transaction.fromAccountId === accountId
  ) {
    return amount.negated();
  }
  return new Prisma.Decimal(0);
}

export async function replayAccountBalances(
  client: Prisma.TransactionClient,
  accountId: string,
  { allowNegative = false } = {}
) {
  const transactions = await listTransactionsForBalanceReplay(client, accountId);
  let balance = new Prisma.Decimal(0);

  for (const transaction of transactions) {
    balance = balance.plus(getTransactionDelta(transaction, accountId));
    if (!allowNegative && balance.lessThan(0)) {
      throw new AppError(400, "This change would overdraw the account");
    }
    await client.transaction.update({
      where: { id: transaction.id },
      data: { balanceAfter: balance },
    });
  }

  await client.account.update({
    where: { id: accountId },
    data: { balance },
  });
}

export async function createTransaction(
  client: Pick<Prisma.TransactionClient, "$queryRaw">,
  input: {
    type: TransactionType;
    amount: number;
    balanceAfter: Prisma.Decimal | number;
    transferGroupId?: string;
    category?: string;
    merchant?: string;
    description?: string;
    effectiveAt?: Date;
    fromAccountId?: string;
    toAccountId?: string;
  }
) {
  const id = randomUUID();
  const category = input.category?.trim() ? input.category.trim() : null;
  const merchant = input.merchant?.trim() ? input.merchant.trim() : null;
  const description = input.description?.trim() ? input.description.trim() : null;
  const rows = await client.$queryRaw<TransactionRecord[]>`
    INSERT INTO "Transaction" ("id", "type", "amount", "balanceAfter", "transferGroupId", "category", "merchant", "description", "effectiveAt", "createdAt", "fromAccountId", "toAccountId")
    VALUES (${id}, ${input.type}::"TransactionType", ${input.amount}, ${input.balanceAfter}, ${input.transferGroupId ?? null}, ${category}, ${merchant}, ${description}, ${input.effectiveAt ?? new Date()}, CURRENT_TIMESTAMP, ${input.fromAccountId ?? null}, ${input.toAccountId ?? null})
    RETURNING "id", "type", "amount", "balanceAfter", "transferGroupId", "category", "merchant", "description", "effectiveAt", "createdAt", "fromAccountId", "toAccountId"
  `;
  return normalizeTransaction(rows[0]);
}
