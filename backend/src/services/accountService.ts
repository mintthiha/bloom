import { PrismaClient, TransactionType, AccountType } from "@prisma/client";
import { randomUUID } from "crypto";
import { AppError } from "../middleware/errorHandler";

const prisma = new PrismaClient();

type AccountRecord = {
  id: string;
  userId: string;
  ownerName: string;
  nickname: string | null;
  accountType: AccountType;
  balance: number;
  frozen: boolean;
  createdAt: Date;
  updatedAt: Date;
};

async function selectAccountById(id: string) {
  const rows = await prisma.$queryRaw<AccountRecord[]>`
    SELECT "id", "userId", "ownerName", "nickname", "accountType", "balance", "frozen", "createdAt", "updatedAt"
    FROM "Account"
    WHERE "id" = ${id}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

/**
 * Retrieves all accounts for a given user, ordered by most recently created first.
 */
export async function listAccounts(userId: string) {
  return prisma.$queryRaw<AccountRecord[]>`
    SELECT "id", "userId", "ownerName", "nickname", "accountType", "balance", "frozen", "createdAt", "updatedAt"
    FROM "Account"
    WHERE "userId" = ${userId}
    ORDER BY "createdAt" DESC
  `;
}

/**
 * Creates a new bank account with a zero balance for the given user.
 * Throws 400 if the owner name is empty or missing.
 * Accepts an optional account nickname for friendlier account labels.
 * Throws 400 if the account type is not a valid AccountType enum value.
 */
export async function createAccount(
  userId: string,
  ownerName: string,
  accountType: AccountType = AccountType.CHEQUING,
  nickname?: string
) {
  if (!ownerName || ownerName.trim() === "") {
    throw new AppError(400, "ownerName is required");
  }
  if (!Object.values(AccountType).includes(accountType)) {
    throw new AppError(400, "accountType must be CHEQUING or SAVINGS");
  }
  const id = randomUUID();
  const rows = await prisma.$queryRaw<AccountRecord[]>`
    INSERT INTO "Account" ("id", "userId", "ownerName", "nickname", "accountType", "balance", "frozen", "createdAt", "updatedAt")
    VALUES (${id}, ${userId}, ${ownerName.trim()}, ${nickname?.trim() ? nickname.trim() : null}, ${accountType}::"AccountType", 0, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING "id", "userId", "ownerName", "nickname", "accountType", "balance", "frozen", "createdAt", "updatedAt"
  `;
  return rows[0];
}

/**
 * Retrieves a single account by its ID.
 * Throws 404 if no account is found with the given ID.
 */
export async function getAccount(id: string) {
  const account = await selectAccountById(id);
  if (!account) throw new AppError(404, `Account ${id} not found`);
  return account;
}

/**
 * Updates an account nickname.
 * Passing an empty nickname clears the custom label.
 * Throws 404 if the account does not exist.
 */
export async function updateNickname(id: string, nickname?: string) {
  await getAccount(id);
  const rows = await prisma.$queryRaw<AccountRecord[]>`
    UPDATE "Account"
    SET "nickname" = ${nickname?.trim() ? nickname.trim() : null},
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id}
    RETURNING "id", "userId", "ownerName", "nickname", "accountType", "balance", "frozen", "createdAt", "updatedAt"
  `;
  return rows[0];
}

/**
 * Deposits a positive amount into an account and records the transaction.
 * Throws 400 if the amount is zero or negative.
 * Throws 403 if the account is frozen.
 * Uses a Prisma transaction to ensure the balance update and transaction record are atomic.
 */
export async function deposit(id: string, amount: number, description?: string) {
  if (amount <= 0) throw new AppError(400, "Deposit amount must be positive");
  const account = await getAccount(id);
  if (account.frozen) throw new AppError(403, "Account is frozen");
  const newBalance = account.balance + amount;
  const [, transaction] = await prisma.$transaction([
    prisma.account.update({ where: { id }, data: { balance: newBalance } }),
    prisma.transaction.create({
      data: {
        type: TransactionType.DEPOSIT,
        amount,
        balanceAfter: newBalance,
        description: description ?? null,
        toAccountId: id,
      },
    }),
  ]);
  return [await getAccount(id), transaction] as const;
}

/**
 * Withdraws a positive amount from an account and records the transaction.
 * Throws 400 if the amount is zero or negative.
 * Throws 403 if the account is frozen.
 * Throws 400 if the account has insufficient funds.
 * Uses a Prisma transaction to ensure the balance update and transaction record are atomic.
 */
export async function withdraw(id: string, amount: number, description?: string) {
  if (amount <= 0) throw new AppError(400, "Withdrawal amount must be positive");
  const account = await getAccount(id);
  if (account.frozen) throw new AppError(403, "Account is frozen");
  if (account.balance < amount) throw new AppError(400, "Insufficient funds");
  const newBalance = account.balance - amount;
  const [, transaction] = await prisma.$transaction([
    prisma.account.update({ where: { id }, data: { balance: newBalance } }),
    prisma.transaction.create({
      data: {
        type: TransactionType.WITHDRAWAL,
        amount,
        balanceAfter: newBalance,
        description: description ?? null,
        fromAccountId: id,
      },
    }),
  ]);
  return [await getAccount(id), transaction] as const;
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
export async function transfer(fromId: string, toId: string, amount: number, description?: string) {
  if (amount <= 0) throw new AppError(400, "Transfer amount must be positive");
  if (fromId === toId) throw new AppError(400, "Cannot transfer to the same account");
  const from = await getAccount(fromId);
  if (from.frozen) throw new AppError(403, "Source account is frozen");
  if (from.balance < amount) throw new AppError(400, "Insufficient funds");
  const to = await getAccount(toId);
  if (to.frozen) throw new AppError(403, "Destination account is frozen");
  const fromNewBalance = from.balance - amount;
  const toNewBalance = to.balance + amount;
  const autoDesc = description ?? null;
  const [, , outgoingTransaction, incomingTransaction] = await prisma.$transaction([
    prisma.account.update({ where: { id: fromId }, data: { balance: fromNewBalance } }),
    prisma.account.update({ where: { id: toId }, data: { balance: toNewBalance } }),
    prisma.transaction.create({
      data: {
        type: TransactionType.TRANSFER_OUT,
        amount,
        balanceAfter: fromNewBalance,
        description: autoDesc,
        fromAccountId: fromId,
        toAccountId: toId,
      },
    }),
    prisma.transaction.create({
      data: {
        type: TransactionType.TRANSFER_IN,
        amount,
        balanceAfter: toNewBalance,
        description: autoDesc,
        fromAccountId: fromId,
        toAccountId: toId,
      },
    }),
  ]);
  return [await getAccount(fromId), outgoingTransaction, incomingTransaction] as const;
}

/**
 * Retrieves all transactions associated with an account, ordered by most recent first.
 * Includes both sent and received transactions.
 * Throws 404 if the account does not exist.
 */
export async function getTransactions(id: string) {
  await getAccount(id);
  return prisma.transaction.findMany({
    where: {
      OR: [
        { fromAccountId: id, type: { in: [TransactionType.WITHDRAWAL, TransactionType.TRANSFER_OUT] } },
        { toAccountId: id, type: { in: [TransactionType.DEPOSIT, TransactionType.TRANSFER_IN] } },
      ],
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Freezes an account, preventing all future transactions.
 * Throws 404 if the account does not exist.
 */
export async function freezeAccount(id: string) {
  await getAccount(id);
  await prisma.account.update({
    where: { id },
    data: { frozen: true },
  });
  return getAccount(id);
}

/**
 * Unfreezes an account, restoring the ability to transact.
 * Throws 404 if the account does not exist.
 */
export async function unfreezeAccount(id: string) {
  await getAccount(id);
  await prisma.account.update({
    where: { id },
    data: { frozen: false },
  });
  return getAccount(id);
}

/**
 * Deletes an account and all of its associated transactions.
 * Throws 404 if the account does not exist.
 * Runs inside a Prisma transaction to ensure atomicity.
 */
export async function deleteAccount(id: string) {
  await getAccount(id);
  await prisma.$transaction([
    prisma.transaction.deleteMany({
      where: { OR: [{ fromAccountId: id }, { toAccountId: id }] },
    }),
    prisma.account.delete({ where: { id } }),
  ]);
}
