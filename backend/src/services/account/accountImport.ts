// CSV/bank import of transactions: duplicate-skipping, undoing a whole import, and backfilling
// net-worth snapshots for imported history.
// Split out of accountService.ts, which re-exports its public API.
import { AccountType, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { AppError } from "../../middleware/errorHandler";
import prisma from "../../lib/prisma";
import { logActivity } from "../activityService";
import { accountLabel, replayAccountBalances } from "./accountRecords";
import type { AccountRecord } from "./accountRecords";
import { getAccount } from "./accountLifecycle";
import { findDuplicateRowIndexes, getImportDayWindow } from "./importDuplicates";
import type { DuplicateComparable } from "./importDuplicates";

export type ImportRow = {
  type: "DEPOSIT" | "WITHDRAWAL";
  amount: number;
  effectiveAt: Date;
  description?: string;
  merchant?: string;
  category?: string;
  /** True when the user chose to keep a row the duplicate check flagged as already imported. */
  allowDuplicate?: boolean;
};

/** How many past imports the "Recent imports" list shows, newest first. */
const RECENT_IMPORT_BATCH_LIMIT = 5;

/** One past CSV import on an account, summarised for the "Recent imports" list. */
export type ImportBatchSummary = {
  importBatchId: string;
  transactionCount: number;
  importedAt: Date;
  earliestEffectiveAt: Date;
  latestEffectiveAt: Date;
};

/**
 * Backfills NetWorthSnapshot records for each calendar month that has transactions
 * on the imported account. Uses the last balanceAfter in each month as the
 * month-end balance, combined with the current balances of all other accounts.
 */
async function backfillNetWorthSnapshots(
  userId: string,
  accountId: string,
  accountType: AccountType
) {
  type MonthEndRow = { month: string; balanceAfter: string };
  const rows = await prisma.$queryRaw<MonthEndRow[]>`
    SELECT
      TO_CHAR(DATE_TRUNC('month', "effectiveAt"), 'YYYY-MM') AS month,
      "balanceAfter"
    FROM "Transaction"
    WHERE "deletedAt" IS NULL
      AND (
        ("toAccountId" = ${accountId} AND "type" IN ('DEPOSIT'::"TransactionType", 'TRANSFER_IN'::"TransactionType"))
        OR
        ("fromAccountId" = ${accountId} AND "type" IN ('WITHDRAWAL'::"TransactionType", 'TRANSFER_OUT'::"TransactionType"))
      )
    ORDER BY "effectiveAt" DESC, "createdAt" DESC, "id" DESC
  `;

  const monthBalances = new Map<string, number>();
  for (const row of rows) {
    if (!monthBalances.has(row.month)) {
      monthBalances.set(row.month, Number(row.balanceAfter));
    }
  }
  if (monthBalances.size === 0) return;

  const otherAccounts = await prisma.$queryRaw<AccountRecord[]>`
    SELECT "id", "userId", "ownerName", "nickname", "accountType", "balance", "frozen", "createdAt", "updatedAt"
    FROM "Account"
    WHERE "userId" = ${userId} AND "id" != ${accountId} AND "deletedAt" IS NULL
  `;
  const otherAssets = otherAccounts
    .filter((a) => a.accountType !== AccountType.CREDIT)
    .reduce((sum, a) => sum + Number(a.balance), 0);
  const otherDebt = otherAccounts
    .filter((a) => a.accountType === AccountType.CREDIT)
    .reduce((sum, a) => sum + Number(a.balance), 0);

  for (const [month, balance] of monthBalances) {
    const totalAssets = accountType === AccountType.CREDIT ? otherAssets : otherAssets + balance;
    const totalDebt = accountType === AccountType.CREDIT ? otherDebt + balance : otherDebt;
    const netWorth = totalAssets - totalDebt;
    const id = randomUUID();
    await prisma.$queryRaw`
      INSERT INTO "NetWorthSnapshot" ("id", "userId", "month", "netWorth", "totalAssets", "totalDebt", "createdAt", "updatedAt")
      VALUES (${id}, ${userId}, ${month}, ${netWorth}, ${totalAssets}, ${totalDebt}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("userId", "month") DO UPDATE
      SET "netWorth" = EXCLUDED."netWorth",
          "totalAssets" = EXCLUDED."totalAssets",
          "totalDebt" = EXCLUDED."totalDebt",
          "updatedAt" = CURRENT_TIMESTAMP
    `;
  }
}

/**
 * Loads the account's live deposits and withdrawals dated within the days the incoming rows
 * span — the only history an incoming row could duplicate.
 */
async function selectTransactionsOverlappingRows(
  accountId: string,
  rows: ImportRow[]
): Promise<DuplicateComparable[]> {
  const dayWindow = getImportDayWindow(rows);
  if (!dayWindow) return [];
  type OverlappingTransactionRow = {
    type: "DEPOSIT" | "WITHDRAWAL";
    amount: string;
    effectiveAt: Date;
    description: string | null;
    merchant: string | null;
  };
  return prisma.$queryRaw<OverlappingTransactionRow[]>`
    SELECT "type", "amount", "effectiveAt", "description", "merchant"
    FROM "Transaction"
    WHERE "deletedAt" IS NULL
      AND "effectiveAt" >= ${dayWindow.start}
      AND "effectiveAt" < ${dayWindow.end}
      AND (
        ("toAccountId" = ${accountId} AND "type" = 'DEPOSIT'::"TransactionType")
        OR
        ("fromAccountId" = ${accountId} AND "type" = 'WITHDRAWAL'::"TransactionType")
      )
  `;
}

/**
 * Reports which incoming rows are already on the account, so the import preview can mark them
 * before the user commits. Indexes refer to positions in `rows`.
 * Throws 404 if the account is not the user's.
 */
export async function findImportDuplicates(userId: string, accountId: string, rows: ImportRow[]) {
  await getAccount(userId, accountId);
  const existingTransactions = await selectTransactionsOverlappingRows(accountId, rows);
  return { duplicateRowIndexes: findDuplicateRowIndexes(rows, existingTransactions) };
}

/**
 * Bulk-inserts deposit and withdrawal transactions from a parsed CSV import, skipping rows that
 * are already on the account unless the user explicitly kept them (`allowDuplicate`). The check
 * runs here as well as in the preview so a stale preview or a second tab can't double-import.
 * All inserted rows share one import batch id so the import can be undone as a whole, and
 * balances are replayed afterwards so row order doesn't matter. Finally backfills
 * NetWorthSnapshot records for each affected month.
 * Throws 403 if the account is frozen.
 */
export async function importTransactions(userId: string, accountId: string, rows: ImportRow[]) {
  const account = await getAccount(userId, accountId);
  if (account.frozen) throw new AppError(403, "Account is frozen");
  if (rows.length === 0) {
    return { imported: 0, skippedDuplicates: 0, importBatchId: null, account };
  }

  const existingTransactions = await selectTransactionsOverlappingRows(accountId, rows);
  const duplicateRowIndexes = new Set(findDuplicateRowIndexes(rows, existingTransactions));
  const rowsToInsert = rows.filter(
    (row, index) => row.allowDuplicate === true || !duplicateRowIndexes.has(index)
  );
  const skippedDuplicates = rows.length - rowsToInsert.length;
  if (rowsToInsert.length === 0) {
    return { imported: 0, skippedDuplicates, importBatchId: null, account };
  }

  const importBatchId = randomUUID();
  await prisma.$transaction(async (tx) => {
    for (const row of rowsToInsert) {
      const id = randomUUID();
      const isDeposit = row.type === "DEPOSIT";
      const category = row.category?.trim() || null;
      const merchant = row.merchant?.trim() || null;
      const description = row.description?.trim() || null;
      await tx.$queryRaw`
        INSERT INTO "Transaction" ("id", "type", "amount", "balanceAfter", "category", "merchant", "description", "effectiveAt", "createdAt", "fromAccountId", "toAccountId", "importBatchId")
        VALUES (
          ${id},
          ${row.type}::"TransactionType",
          ${row.amount},
          0,
          ${category},
          ${merchant},
          ${description},
          ${row.effectiveAt},
          CURRENT_TIMESTAMP,
          ${isDeposit ? null : accountId},
          ${isDeposit ? accountId : null},
          ${importBatchId}
        )
      `;
    }
    await replayAccountBalances(tx as Prisma.TransactionClient, accountId, { allowNegative: true });
  });

  await backfillNetWorthSnapshots(userId, accountId, account.accountType as AccountType);

  const importedAccount = await getAccount(userId, accountId);
  const importedCount = rowsToInsert.length;
  logActivity(
    userId,
    "TRANSACTION_IMPORTED",
    `Imported ${importedCount} transaction${importedCount === 1 ? "" : "s"} to "${accountLabel(importedAccount.ownerName, importedAccount.nickname)}"`,
    { accountId, count: importedCount, skippedDuplicates, importBatchId }
  );
  return { imported: importedCount, skippedDuplicates, importBatchId, account: importedAccount };
}

/**
 * Lists the account's most recent CSV imports that still have live transactions, newest first.
 * Counts reflect only transactions not deleted since, so a fully-deleted import drops off the list.
 * Throws 404 if the account is not the user's.
 */
export async function listImportBatches(
  userId: string,
  accountId: string
): Promise<ImportBatchSummary[]> {
  await getAccount(userId, accountId);
  return prisma.$queryRaw<ImportBatchSummary[]>`
    SELECT
      "importBatchId",
      COUNT(*)::int AS "transactionCount",
      MIN("createdAt") AS "importedAt",
      MIN("effectiveAt") AS "earliestEffectiveAt",
      MAX("effectiveAt") AS "latestEffectiveAt"
    FROM "Transaction"
    WHERE "importBatchId" IS NOT NULL
      AND "deletedAt" IS NULL
      AND ("toAccountId" = ${accountId} OR "fromAccountId" = ${accountId})
    GROUP BY "importBatchId"
    ORDER BY MIN("createdAt") DESC
    LIMIT ${RECENT_IMPORT_BATCH_LIMIT}
  `;
}

/**
 * Undoes a whole CSV import: soft-deletes every live transaction it wrote to this account, then
 * replays balances and refreshes net-worth snapshots. Negative balances are allowed during the
 * replay because the import itself allowed them.
 * Throws 404 if the account is not the user's or the import has nothing left to undo.
 */
export async function undoImportBatch(userId: string, accountId: string, importBatchId: string) {
  const account = await getAccount(userId, accountId);

  const removed = await prisma.$transaction(async (tx) => {
    const { count } = await tx.transaction.updateMany({
      where: {
        importBatchId,
        deletedAt: null,
        OR: [{ toAccountId: accountId }, { fromAccountId: accountId }],
      },
      data: { deletedAt: new Date() },
    });
    if (count === 0) throw new AppError(404, "Import not found");
    await replayAccountBalances(tx as Prisma.TransactionClient, accountId, { allowNegative: true });
    return count;
  });

  await backfillNetWorthSnapshots(userId, accountId, account.accountType as AccountType);

  const accountAfterUndo = await getAccount(userId, accountId);
  logActivity(
    userId,
    "TRANSACTION_DELETED",
    `Undid an import of ${removed} transaction${removed === 1 ? "" : "s"} on "${accountLabel(accountAfterUndo.ownerName, accountAfterUndo.nickname)}"`,
    { accountId, importBatchId, count: removed }
  );
  return { removed, account: accountAfterUndo };
}
