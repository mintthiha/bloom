// Money movement between and into accounts: deposit, withdraw, and transfer.
// Split out of accountService.ts, which re-exports its public API.
import { TransactionType, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { AppError } from "../../middleware/errorHandler";
import prisma from "../../lib/prisma";
import { logActivity } from "../activityService";
import {
  accountLabel,
  recurringActivitySuffix,
  recurringActivityMetadata,
  selectAccountByUserId,
  createTransaction,
} from "./accountRecords";
import type { RecurringActivitySource } from "./accountRecords";
import { getAccount } from "./accountLifecycle";

/**
 * Deposits a positive amount into an account and records the transaction.
 * Throws 400 if the amount is zero or negative.
 * Throws 403 if the account is frozen.
 * Uses a Prisma transaction to ensure the balance update and transaction record are atomic.
 */
export async function deposit(
  userId: string,
  id: string,
  amount: number,
  category?: string,
  description?: string,
  effectiveAt?: Date,
  merchant?: string,
  recurringSource?: RecurringActivitySource
) {
  if (amount <= 0) throw new AppError(400, "Deposit amount must be positive");
  const rawAccount = await selectAccountByUserId(userId, id);
  if (!rawAccount) throw new AppError(404, `Account ${id} not found`);
  if (rawAccount.frozen) throw new AppError(403, "Account is frozen");
  const newBalance = new Prisma.Decimal(rawAccount.balance).plus(amount);
  const transaction = await prisma.$transaction(async (tx) => {
    await tx.account.update({ where: { id }, data: { balance: newBalance } });
    return createTransaction(tx, {
      type: TransactionType.DEPOSIT,
      amount,
      balanceAfter: newBalance,
      category,
      merchant,
      description,
      effectiveAt,
      toAccountId: id,
    });
  });
  const updatedAccount = await getAccount(userId, id);
  logActivity(
    userId,
    "TRANSACTION_DEPOSIT",
    `Deposited $${amount.toFixed(2)} to "${accountLabel(rawAccount.ownerName, rawAccount.nickname)}"${recurringActivitySuffix(recurringSource)}`,
    { accountId: id, amount, ...recurringActivityMetadata(recurringSource) }
  );
  return [updatedAccount, transaction] as const;
}

/**
 * Withdraws a positive amount from an account and records the transaction.
 * Throws 400 if the amount is zero or negative.
 * Throws 403 if the account is frozen.
 * Throws 400 if the account has insufficient funds.
 * Uses a Prisma transaction to ensure the balance update and transaction record are atomic.
 */
export async function withdraw(
  userId: string,
  id: string,
  amount: number,
  category?: string,
  description?: string,
  effectiveAt?: Date,
  merchant?: string,
  recurringSource?: RecurringActivitySource
) {
  if (amount <= 0) throw new AppError(400, "Withdrawal amount must be positive");
  const rawAccount = await selectAccountByUserId(userId, id);
  if (!rawAccount) throw new AppError(404, `Account ${id} not found`);
  if (rawAccount.frozen) throw new AppError(403, "Account is frozen");
  if (new Prisma.Decimal(rawAccount.balance).lessThan(amount))
    throw new AppError(400, "Insufficient funds");
  const newBalance = new Prisma.Decimal(rawAccount.balance).minus(amount);
  const transaction = await prisma.$transaction(async (tx) => {
    await tx.account.update({ where: { id }, data: { balance: newBalance } });
    return createTransaction(tx, {
      type: TransactionType.WITHDRAWAL,
      amount,
      balanceAfter: newBalance,
      category,
      merchant,
      description,
      effectiveAt,
      fromAccountId: id,
    });
  });
  const updatedAccount = await getAccount(userId, id);
  logActivity(
    userId,
    "TRANSACTION_WITHDRAWAL",
    `Withdrew $${amount.toFixed(2)} from "${accountLabel(rawAccount.ownerName, rawAccount.nickname)}"${recurringActivitySuffix(recurringSource)}`,
    { accountId: id, amount, ...recurringActivityMetadata(recurringSource) }
  );
  return [updatedAccount, transaction] as const;
}

/**
 * Transfers a positive amount from one account to another and records both sides of the transaction.
 * Throws 400 if the amount is zero or negative.
 * Throws 400 if the source and destination accounts are the same.
 * Throws 403 if either account is frozen.
 * Throws 404 if the destination account does not exist.
 * Throws 400 if the source account has insufficient funds.
 * Uses a Prisma transaction to ensure all four operations (two balance updates, two transaction records) are atomic.
 */
export async function transfer(
  userId: string,
  fromId: string,
  toId: string,
  amount: number,
  description?: string,
  category: string = "Transfer"
) {
  if (amount <= 0) throw new AppError(400, "Transfer amount must be positive");
  if (fromId === toId) throw new AppError(400, "Cannot transfer to the same account");
  const rawFrom = await selectAccountByUserId(userId, fromId);
  if (!rawFrom) throw new AppError(404, `Account ${fromId} not found`);
  if (rawFrom.frozen) throw new AppError(403, "Source account is frozen");
  if (new Prisma.Decimal(rawFrom.balance).lessThan(amount))
    throw new AppError(400, "Insufficient funds");
  const rawTo = await selectAccountByUserId(userId, toId);
  if (!rawTo) throw new AppError(404, `Account ${toId} not found`);
  if (rawTo.frozen) throw new AppError(403, "Destination account is frozen");
  const fromNewBalance = new Prisma.Decimal(rawFrom.balance).minus(amount);
  const toNewBalance = new Prisma.Decimal(rawTo.balance).plus(amount);
  const transferGroupId = randomUUID();
  const [outgoingTransaction, incomingTransaction] = await prisma.$transaction(async (tx) => {
    await tx.account.update({ where: { id: fromId }, data: { balance: fromNewBalance } });
    await tx.account.update({ where: { id: toId }, data: { balance: toNewBalance } });
    const outgoing = await createTransaction(tx, {
      type: TransactionType.TRANSFER_OUT,
      amount,
      balanceAfter: fromNewBalance,
      transferGroupId,
      category,
      description,
      fromAccountId: fromId,
      toAccountId: toId,
    });
    const incoming = await createTransaction(tx, {
      type: TransactionType.TRANSFER_IN,
      amount,
      balanceAfter: toNewBalance,
      transferGroupId,
      category,
      description,
      fromAccountId: fromId,
      toAccountId: toId,
    });
    return [outgoing, incoming] as const;
  });
  const updatedFromAccount = await getAccount(userId, fromId);
  logActivity(
    userId,
    "TRANSACTION_TRANSFER",
    `Transferred $${amount.toFixed(2)} from "${accountLabel(rawFrom.ownerName, rawFrom.nickname)}" to "${accountLabel(rawTo.ownerName, rawTo.nickname)}"`,
    { fromAccountId: fromId, toAccountId: toId, amount }
  );
  return [updatedFromAccount, outgoingTransaction, incomingTransaction] as const;
}
