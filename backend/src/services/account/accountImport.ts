// CSV/bank import of transactions, including backfilling net-worth snapshots for imported history.
// Split out of accountService.ts, which re-exports its public API.
import { AccountType, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { AppError } from "../../middleware/errorHandler";
import prisma from "../../lib/prisma";
import { logActivity } from "../activityService";
import { accountLabel, replayAccountBalances } from "./accountRecords";
import type { AccountRecord } from "./accountRecords";
import { getAccount } from "./accountLifecycle";

export type ImportRow = {
  type: "DEPOSIT" | "WITHDRAWAL";
  amount: number;
  effectiveAt: Date;
  description?: string;
  merchant?: string;
  category?: string;
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
 * Bulk-inserts deposit and withdrawal transactions from a parsed CSV import.
 * All rows are inserted inside a single Prisma transaction, then account balances
 * are replayed to ensure correctness regardless of the order rows were provided.
 * After inserting, backfills NetWorthSnapshot records for each affected month.
 * Throws 403 if the account is frozen.
 */
export async function importTransactions(userId: string, accountId: string, rows: ImportRow[]) {
  const account = await getAccount(userId, accountId);
  if (account.frozen) throw new AppError(403, "Account is frozen");
  if (rows.length === 0) return { imported: 0, account };

  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const id = randomUUID();
      const isDeposit = row.type === "DEPOSIT";
      const category = row.category?.trim() || null;
      const merchant = row.merchant?.trim() || null;
      const description = row.description?.trim() || null;
      await tx.$queryRaw`
        INSERT INTO "Transaction" ("id", "type", "amount", "balanceAfter", "category", "merchant", "description", "effectiveAt", "createdAt", "fromAccountId", "toAccountId")
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
          ${isDeposit ? accountId : null}
        )
      `;
    }
    await replayAccountBalances(tx as Prisma.TransactionClient, accountId, { allowNegative: true });
  });

  await backfillNetWorthSnapshots(userId, accountId, account.accountType as AccountType);

  const importedAccount = await getAccount(userId, accountId);
  logActivity(
    userId,
    "TRANSACTION_IMPORTED",
    `Imported ${rows.length} transaction${rows.length === 1 ? "" : "s"} to "${accountLabel(importedAccount.ownerName, importedAccount.nickname)}"`,
    { accountId, count: rows.length }
  );
  return { imported: rows.length, account: importedAccount };
}
