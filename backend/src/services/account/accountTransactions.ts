// Transaction history and edits: listing, splits, receipt purchases, update, delete, and restore.
// Split out of accountService.ts, which re-exports its public API.
import { TransactionType, AccountType, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { AppError } from "../../middleware/errorHandler";
import { resolveDateRange } from "../../lib/date-range";
import prisma from "../../lib/prisma";
import { logActivity } from "../activityService";
import {
  ActivityFieldChange,
  describeActivityFieldChanges,
  pushActivityFieldChange,
} from "../activityChanges";
import {
  accountLabel,
  normalizeTransaction,
  selectSplitsByTransactionIds,
  selectAccountByUserId,
  selectTransactionByAccount,
  selectTransactionsByTransferGroup,
  replayAccountBalances,
  createTransaction,
} from "./accountRecords";
import type {
  TransactionRecord,
  TransactionSplitInput,
  TransactionFilters,
  TransactionUpdateInput,
} from "./accountRecords";
import { getAccount } from "./accountLifecycle";

/**
 * Retrieves all transactions associated with an account, ordered by most recent first.
 * Includes both sent and received transactions.
 * Throws 404 if the account does not exist.
 */
export async function getTransactions(userId: string, id: string, filters?: TransactionFilters) {
  await getAccount(userId, id);
  const categoryFilter = filters?.category?.trim() ? filters.category.trim() : null;
  const searchFilter = filters?.search?.trim().toLowerCase() ?? null;
  const range =
    filters?.start && filters?.end
      ? resolveDateRange({ start: filters.start, end: filters.end })
      : null;

  const rawTransactions = await prisma.$queryRaw<TransactionRecord[]>`
    SELECT "id", "type", "amount", "balanceAfter", "transferGroupId", "category", "merchant", "description", "effectiveAt", "createdAt", "fromAccountId", "toAccountId"
    FROM "Transaction"
    WHERE "deletedAt" IS NULL
      AND (
        ("fromAccountId" = ${id} AND "type" IN ('WITHDRAWAL'::"TransactionType", 'TRANSFER_OUT'::"TransactionType"))
        OR
        ("toAccountId" = ${id} AND "type" IN ('DEPOSIT'::"TransactionType", 'TRANSFER_IN'::"TransactionType"))
      )
    ORDER BY "effectiveAt" DESC, "createdAt" DESC
  `;

  const filteredTransactions = rawTransactions.filter((transaction) => {
    if (filters?.type && transaction.type !== filters.type) {
      return false;
    }
    if (categoryFilter) {
      if (categoryFilter === "Uncategorized") {
        if (transaction.category != null && transaction.category.trim() !== "") return false;
      } else if ((transaction.category ?? "") !== categoryFilter) {
        return false;
      }
    }
    if (searchFilter) {
      const haystack = [transaction.description ?? "", transaction.merchant ?? ""]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(searchFilter)) {
        return false;
      }
    }
    if (range && !(transaction.effectiveAt >= range.start && transaction.effectiveAt < range.end)) {
      return false;
    }
    return true;
  });

  const splitsByTransaction = await selectSplitsByTransactionIds(
    filteredTransactions.map((transaction) => transaction.id)
  );
  return filteredTransactions.map((transaction) => ({
    ...normalizeTransaction(transaction),
    splits: splitsByTransaction.get(transaction.id) ?? [],
  }));
}

/**
 * Validates a full set of category splits against the transaction amount they divide up, and
 * returns them trimmed and ready to insert.
 * Throws 400 for fewer than two splits, a missing category, a non-positive amount, or a total
 * that doesn't match the transaction's amount (to the cent).
 */
function normalizeTransactionSplits(
  splits: TransactionSplitInput[],
  transactionAmount: string | number
) {
  if (splits.length < 2) {
    throw new AppError(400, "A split needs at least two categories");
  }

  const normalizedSplits = splits.map((split, index) => {
    const category = split.category?.trim();
    if (!category) throw new AppError(400, `Split ${index + 1}: category is required`);
    if (!Number.isFinite(split.amount) || split.amount <= 0) {
      throw new AppError(400, `Split ${index + 1}: amount must be positive`);
    }
    return {
      category,
      amount: split.amount,
      description: split.description?.trim() || null,
    };
  });

  const splitTotal = normalizedSplits.reduce(
    (sum, split) => sum.plus(split.amount),
    new Prisma.Decimal(0)
  );
  if (!splitTotal.equals(new Prisma.Decimal(transactionAmount))) {
    throw new AppError(400, "Split amounts must add up to the transaction total");
  }
  return normalizedSplits;
}

/**
 * Replaces the full set of category splits on a manual deposit or withdrawal.
 * Splits let one transaction (e.g. a $120 grocery run) count toward multiple
 * categories for the 50/30/20 summary and budgets, instead of just one.
 * Throws 404 if the transaction is not visible from this account for the current user.
 * Throws 400 for transfers (both legs would need splitting together), fewer than
 * two splits, a non-positive split amount, or a total that doesn't match the
 * transaction's amount (to the cent).
 */
export async function setTransactionSplits(
  userId: string,
  accountId: string,
  transactionId: string,
  splits: TransactionSplitInput[]
) {
  await getAccount(userId, accountId);
  const transaction = await selectTransactionByAccount(userId, accountId, transactionId);
  if (!transaction) throw new AppError(404, `Transaction ${transactionId} not found`);
  if (
    transaction.type !== TransactionType.DEPOSIT &&
    transaction.type !== TransactionType.WITHDRAWAL
  ) {
    throw new AppError(400, "Only deposits and withdrawals can be split");
  }
  const normalizedSplits = normalizeTransactionSplits(splits, transaction.amount);

  await prisma.$transaction(async (tx) => {
    await tx.transactionSplit.deleteMany({ where: { transactionId } });
    await tx.transactionSplit.createMany({
      data: normalizedSplits.map((split) => ({
        id: randomUUID(),
        transactionId,
        category: split.category,
        amount: split.amount,
        description: split.description,
      })),
    });
  });

  const updatedAccount = await getAccount(userId, accountId);
  logActivity(
    userId,
    "TRANSACTION_UPDATED",
    `Split a transaction on "${accountLabel(updatedAccount.ownerName, updatedAccount.nickname)}" into ${normalizedSplits.length} categories`,
    { accountId, transactionId, categories: normalizedSplits.map((split) => split.category) }
  );
  return updatedAccount;
}

/**
 * Removes all category splits from a transaction, reverting it to its own
 * single category for the 50/30/20 summary and budgets.
 * Throws 404 if the transaction is not visible from this account for the current user.
 */
export async function clearTransactionSplits(
  userId: string,
  accountId: string,
  transactionId: string
) {
  await getAccount(userId, accountId);
  const transaction = await selectTransactionByAccount(userId, accountId, transactionId);
  if (!transaction) throw new AppError(404, `Transaction ${transactionId} not found`);

  await prisma.transactionSplit.deleteMany({ where: { transactionId } });

  const updatedAccount = await getAccount(userId, accountId);
  logActivity(
    userId,
    "TRANSACTION_UPDATED",
    `Removed the category split on a transaction on "${accountLabel(updatedAccount.ownerName, updatedAccount.nickname)}"`,
    { accountId, transactionId }
  );
  return updatedAccount;
}

export type ReceiptPurchaseInput = {
  amount: number;
  effectiveAt: Date;
  merchant?: string;
  category?: string;
  splits?: TransactionSplitInput[];
};

/**
 * Records a purchase read from a scanned receipt — the transaction, dated when the receipt says
 * it happened, together with its category splits — in one database transaction, so a split
 * purchase can never exist half-written. On a credit card the purchase is a charge (a deposit
 * that grows the balance owed); on every other account it is a withdrawal.
 * Balances are replayed rather than adjusted in place because the receipt may be dated before
 * transactions already on the account.
 * Throws 400 for a non-positive amount, invalid splits, or insufficient funds.
 * Throws 403 if the account is frozen and 404 if it is not the user's.
 */
export async function recordReceiptPurchase(
  userId: string,
  accountId: string,
  input: ReceiptPurchaseInput
) {
  if (input.amount <= 0) throw new AppError(400, "Purchase amount must be positive");
  const rawAccount = await selectAccountByUserId(userId, accountId);
  if (!rawAccount) throw new AppError(404, `Account ${accountId} not found`);
  if (rawAccount.frozen) throw new AppError(403, "Account is frozen");
  const isCreditCard = rawAccount.accountType === AccountType.CREDIT;
  if (!isCreditCard && new Prisma.Decimal(rawAccount.balance).lessThan(input.amount)) {
    throw new AppError(400, "Insufficient funds");
  }
  const normalizedSplits =
    input.splits && input.splits.length > 0
      ? normalizeTransactionSplits(input.splits, input.amount)
      : [];

  await prisma.$transaction(async (tx) => {
    const transaction = await createTransaction(tx, {
      type: isCreditCard ? TransactionType.DEPOSIT : TransactionType.WITHDRAWAL,
      amount: input.amount,
      // Placeholder: the replay below writes the real running balance for every transaction.
      balanceAfter: 0,
      category: input.category,
      merchant: input.merchant,
      effectiveAt: input.effectiveAt,
      ...(isCreditCard ? { toAccountId: accountId } : { fromAccountId: accountId }),
    });
    if (normalizedSplits.length > 0) {
      await tx.transactionSplit.createMany({
        data: normalizedSplits.map((split) => ({
          id: randomUUID(),
          transactionId: transaction.id,
          category: split.category,
          amount: split.amount,
          description: split.description,
        })),
      });
    }
    // The current balance was checked above; a backdated purchase may dip an earlier point in the
    // history below zero, which imports allow too.
    await replayAccountBalances(tx as Prisma.TransactionClient, accountId, { allowNegative: true });
  });

  const updatedAccount = await getAccount(userId, accountId);
  const merchantSuffix = input.merchant?.trim() ? ` at "${input.merchant.trim()}"` : "";
  logActivity(
    userId,
    isCreditCard ? "TRANSACTION_DEPOSIT" : "TRANSACTION_WITHDRAWAL",
    `Recorded a $${input.amount.toFixed(2)} receipt purchase${merchantSuffix} on "${accountLabel(updatedAccount.ownerName, updatedAccount.nickname)}"`,
    {
      accountId,
      amount: input.amount,
      ...(normalizedSplits.length > 0
        ? { categories: normalizedSplits.map((split) => split.category) }
        : {}),
    }
  );
  return updatedAccount;
}

/**
 * Updates a manual deposit or withdrawal and replays the account balance history.
 * Transfers are intentionally excluded because both sides must be edited together.
 * Throws 404 if the transaction is not visible from this account for the current user.
 * Throws 400 if the updated amount is not positive or the edit would overdraw the account.
 */
export async function updateTransaction(
  userId: string,
  accountId: string,
  transactionId: string,
  input: TransactionUpdateInput
) {
  if (input.amount <= 0) throw new AppError(400, "amount must be positive");
  await getAccount(userId, accountId);
  const transaction = await selectTransactionByAccount(userId, accountId, transactionId);
  if (!transaction) throw new AppError(404, `Transaction ${transactionId} not found`);

  const category = input.category?.trim() ? input.category.trim() : null;
  const effectiveAt = input.effectiveAt ?? transaction.effectiveAt;

  if (
    transaction.type === TransactionType.TRANSFER_OUT ||
    transaction.type === TransactionType.TRANSFER_IN
  ) {
    if (!transaction.transferGroupId) {
      throw new AppError(400, "Only newly linked transfers can be edited");
    }

    const linkedTransactions = await selectTransactionsByTransferGroup(
      userId,
      transaction.transferGroupId
    );
    if (linkedTransactions.length !== 2) {
      throw new AppError(400, "Transfer records are incomplete");
    }

    const affectedAccountIds = Array.from(
      new Set(
        linkedTransactions
          .flatMap((linkedTransaction) => [
            linkedTransaction.fromAccountId,
            linkedTransaction.toAccountId,
          ])
          .filter(Boolean)
      )
    ) as string[];

    await prisma.$transaction(async (tx) => {
      for (const linkedTransaction of linkedTransactions) {
        await tx.$queryRaw`
          UPDATE "Transaction"
          SET "amount" = ${input.amount},
              "category" = ${category},
              "effectiveAt" = ${effectiveAt}
          WHERE "id" = ${linkedTransaction.id}
        `;
      }
      for (const affectedAccountId of affectedAccountIds) {
        await replayAccountBalances(tx as Prisma.TransactionClient, affectedAccountId);
      }
    });

    const transferChanges: ActivityFieldChange[] = [];
    pushActivityFieldChange(
      transferChanges,
      "amount",
      "Amount",
      "currency",
      Number(transaction.amount),
      input.amount
    );
    pushActivityFieldChange(
      transferChanges,
      "category",
      "Category",
      "text",
      transaction.category,
      category
    );
    pushActivityFieldChange(
      transferChanges,
      "effectiveAt",
      "Date",
      "date",
      transaction.effectiveAt.toISOString().slice(0, 10),
      effectiveAt.toISOString().slice(0, 10)
    );

    const updatedAccountAfterTransfer = await getAccount(userId, accountId);
    logActivity(
      userId,
      "TRANSACTION_UPDATED",
      `Edited a transfer on account "${accountLabel(updatedAccountAfterTransfer.ownerName, updatedAccountAfterTransfer.nickname)}": ${describeActivityFieldChanges(transferChanges, "no changes")}`,
      { accountId, transactionId, changes: transferChanges }
    );
    return updatedAccountAfterTransfer;
  }

  const description = input.description?.trim() ? input.description.trim() : null;
  const merchant = input.merchant?.trim() ? input.merchant.trim() : null;

  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      UPDATE "Transaction"
      SET "amount" = ${input.amount},
          "category" = ${category},
          "merchant" = ${merchant},
          "description" = ${description},
          "effectiveAt" = ${effectiveAt}
      WHERE "id" = ${transactionId}
    `;
    await replayAccountBalances(tx as Prisma.TransactionClient, accountId);
  });

  const transactionChanges: ActivityFieldChange[] = [];
  pushActivityFieldChange(
    transactionChanges,
    "amount",
    "Amount",
    "currency",
    Number(transaction.amount),
    input.amount
  );
  pushActivityFieldChange(
    transactionChanges,
    "category",
    "Category",
    "text",
    transaction.category,
    category
  );
  pushActivityFieldChange(
    transactionChanges,
    "merchant",
    "Merchant",
    "text",
    transaction.merchant,
    merchant
  );
  pushActivityFieldChange(
    transactionChanges,
    "description",
    "Description",
    "text",
    transaction.description,
    description
  );
  pushActivityFieldChange(
    transactionChanges,
    "effectiveAt",
    "Date",
    "date",
    transaction.effectiveAt.toISOString().slice(0, 10),
    effectiveAt.toISOString().slice(0, 10)
  );

  const updatedAccount = await getAccount(userId, accountId);
  logActivity(
    userId,
    "TRANSACTION_UPDATED",
    `Edited a transaction on "${accountLabel(updatedAccount.ownerName, updatedAccount.nickname)}": ${describeActivityFieldChanges(transactionChanges, "no changes")}`,
    { accountId, transactionId, changes: transactionChanges }
  );
  return updatedAccount;
}

/**
 * Deletes a manual deposit or withdrawal and replays the account balance history.
 * Transfers are intentionally excluded because both account histories would need to be adjusted together.
 * Throws 404 if the transaction is not visible from this account for the current user.
 * Throws 400 if deleting the transaction would invalidate later balances.
 */
export async function deleteTransaction(userId: string, accountId: string, transactionId: string) {
  await getAccount(userId, accountId);
  const transaction = await selectTransactionByAccount(userId, accountId, transactionId);
  if (!transaction) throw new AppError(404, `Transaction ${transactionId} not found`);
  if (
    transaction.type === TransactionType.TRANSFER_OUT ||
    transaction.type === TransactionType.TRANSFER_IN
  ) {
    if (!transaction.transferGroupId) {
      throw new AppError(400, "Only newly linked transfers can be deleted");
    }

    const linkedTransactions = await selectTransactionsByTransferGroup(
      userId,
      transaction.transferGroupId
    );
    if (linkedTransactions.length !== 2) {
      throw new AppError(400, "Transfer records are incomplete");
    }

    const affectedAccountIds = Array.from(
      new Set(
        linkedTransactions
          .flatMap((linkedTransaction) => [
            linkedTransaction.fromAccountId,
            linkedTransaction.toAccountId,
          ])
          .filter(Boolean)
      )
    ) as string[];

    await prisma.$transaction(async (tx) => {
      await tx.transaction.updateMany({
        where: { transferGroupId: transaction.transferGroupId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      for (const affectedAccountId of affectedAccountIds) {
        await replayAccountBalances(tx as Prisma.TransactionClient, affectedAccountId);
      }
    });

    const accountAfterTransferDelete = await getAccount(userId, accountId);
    logActivity(
      userId,
      "TRANSACTION_DELETED",
      `Deleted a transfer on "${accountLabel(accountAfterTransferDelete.ownerName, accountAfterTransferDelete.nickname)}"`,
      { accountId, transactionId }
    );
    return accountAfterTransferDelete;
  }

  await prisma.$transaction(async (tx) => {
    await tx.transaction.update({
      where: { id: transactionId },
      data: { deletedAt: new Date() },
    });
    await replayAccountBalances(tx as Prisma.TransactionClient, accountId);
  });

  const accountAfterDelete = await getAccount(userId, accountId);
  logActivity(
    userId,
    "TRANSACTION_DELETED",
    `Deleted a transaction on "${accountLabel(accountAfterDelete.ownerName, accountAfterDelete.nickname)}"`,
    { accountId, transactionId }
  );
  return accountAfterDelete;
}

/**
 * Fetches a single transaction by id (regardless of soft-delete state) and
 * verifies it is visible from `accountId` for `userId`. Used by the undo path.
 */
async function selectAnyTransactionByAccount(
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
    LIMIT 1
  `;
  return rows[0] ?? null;
}

/**
 * Restores a soft-deleted transaction (the "Undo" action after a delete) and
 * replays the affected account balances. For a transfer, both legs are restored
 * together. Throws 404 if the transaction is not found for this account, 409 if
 * replaying balances afterwards would overdraw an account.
 */
export async function restoreTransaction(userId: string, accountId: string, transactionId: string) {
  await getAccount(userId, accountId);
  const transaction = await selectAnyTransactionByAccount(userId, accountId, transactionId);
  if (!transaction) throw new AppError(404, `Transaction ${transactionId} not found`);

  const isTransfer =
    transaction.type === TransactionType.TRANSFER_OUT ||
    transaction.type === TransactionType.TRANSFER_IN;

  try {
    await prisma.$transaction(async (tx) => {
      if (isTransfer && transaction.transferGroupId) {
        const legs = await tx.$queryRaw<TransactionRecord[]>`
          SELECT "id", "fromAccountId", "toAccountId"
          FROM "Transaction"
          WHERE "transferGroupId" = ${transaction.transferGroupId}
        `;
        await tx.transaction.updateMany({
          where: { transferGroupId: transaction.transferGroupId, deletedAt: { not: null } },
          data: { deletedAt: null },
        });
        const affectedAccountIds = Array.from(
          new Set(legs.flatMap((leg) => [leg.fromAccountId, leg.toAccountId]).filter(Boolean))
        ) as string[];
        for (const affectedAccountId of affectedAccountIds) {
          await replayAccountBalances(tx as Prisma.TransactionClient, affectedAccountId);
        }
      } else {
        await tx.transaction.update({
          where: { id: transactionId },
          data: { deletedAt: null },
        });
        await replayAccountBalances(tx as Prisma.TransactionClient, accountId);
      }
    });
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 400) {
      throw new AppError(409, "Restoring this transaction would overdraw the account");
    }
    throw err;
  }

  const accountAfterRestore = await getAccount(userId, accountId);
  logActivity(
    userId,
    "TRANSACTION_RESTORED",
    `Restored a transaction on "${accountLabel(accountAfterRestore.ownerName, accountAfterRestore.nickname)}"`,
    { accountId, transactionId }
  );
  return accountAfterRestore;
}
