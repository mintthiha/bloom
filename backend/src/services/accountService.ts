import { PrismaClient, TransactionType, AccountType } from "@prisma/client";
import { AppError } from "../middleware/errorHandler";

const prisma = new PrismaClient();

/**
 * Retrieves all accounts, ordered by most recently created first.
 */
export async function listAccounts() {
  return prisma.account.findMany({ orderBy: { createdAt: "desc" } });
}

/**
 * Creates a new bank account with a zero balance.
 * Throws 400 if the owner name is empty or missing.
 * Throws 400 if the account type is not a valid AccountType enum value.
 */
export async function createAccount(ownerName: string, accountType: AccountType = AccountType.CHEQUING) {
  if (!ownerName || ownerName.trim() === "") {
    throw new AppError(400, "ownerName is required");
  }
  if (!Object.values(AccountType).includes(accountType)) {
    throw new AppError(400, "accountType must be CHEQUING or SAVINGS");
  }
  return prisma.account.create({
    data: { ownerName: ownerName.trim(), accountType },
  });
}

/**
 * Retrieves a single account by its ID.
 * Throws 404 if no account is found with the given ID.
 */
export async function getAccount(id: string) {
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) throw new AppError(404, `Account ${id} not found`);
  return account;
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
  return prisma.$transaction([
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
  return prisma.$transaction([
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
  return prisma.$transaction([
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
}

/**
 * Retrieves all transactions associated with an account, ordered by most recent first.
 * Includes both sent and received transactions.
 * Throws 404 if the account does not exist.
 */
export async function getTransactions(id: string) {
  await getAccount(id);
  return prisma.transaction.findMany({
    where: { OR: [{ fromAccountId: id }, { toAccountId: id }] },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Freezes an account, preventing all future transactions.
 * Throws 404 if the account does not exist.
 */
export async function freezeAccount(id: string) {
  await getAccount(id);
  return prisma.account.update({
    where: { id },
    data: { frozen: true },
  });
}

/**
 * Unfreezes an account, restoring the ability to transact.
 * Throws 404 if the account does not exist.
 */
export async function unfreezeAccount(id: string) {
  await getAccount(id);
  return prisma.account.update({
    where: { id },
    data: { frozen: false },
  });
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