import { PrismaClient, TransactionType } from "@prisma/client";
import { AppError } from "../middleware/errorHandler";

const prisma = new PrismaClient();

export async function createAccount(ownerName: string) {
  if (!ownerName || ownerName.trim() === "") {
    throw new AppError(400, "ownerName is required");
  }
  return prisma.account.create({
    data: { ownerName: ownerName.trim() },
  });
}

export async function getAccount(id: string) {
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) throw new AppError(404, `Account ${id} not found`);
  return account;
}

export async function deposit(id: string, amount: number) {
  if (amount <= 0) throw new AppError(400, "Deposit amount must be positive");
  const account = await getAccount(id);
  if (account.frozen) throw new AppError(403, "Account is frozen");
  const newBalance = account.balance + amount;
  return prisma.$transaction([
    prisma.account.update({ where: { id }, data: { balance: newBalance } }),
    prisma.transaction.create({
      data: { type: TransactionType.DEPOSIT, amount, balanceAfter: newBalance, toAccountId: id },
    }),
  ]);
}

export async function withdraw(id: string, amount: number) {
  if (amount <= 0) throw new AppError(400, "Withdrawal amount must be positive");
  const account = await getAccount(id);
  if (account.frozen) throw new AppError(403, "Account is frozen");
  if (account.balance < amount) throw new AppError(400, "Insufficient funds");
  const newBalance = account.balance - amount;
  return prisma.$transaction([
    prisma.account.update({ where: { id }, data: { balance: newBalance } }),
    prisma.transaction.create({
      data: { type: TransactionType.WITHDRAWAL, amount, balanceAfter: newBalance, fromAccountId: id },
    }),
  ]);
}

export async function transfer(fromId: string, toId: string, amount: number) {
  if (amount <= 0) throw new AppError(400, "Transfer amount must be positive");
  if (fromId === toId) throw new AppError(400, "Cannot transfer to the same account");
  const from = await getAccount(fromId);
  if (from.frozen) throw new AppError(403, "Source account is frozen");
  if (from.balance < amount) throw new AppError(400, "Insufficient funds");
  const to = await getAccount(toId);
  if (to.frozen) throw new AppError(403, "Destination account is frozen");
  const fromNewBalance = from.balance - amount;
  const toNewBalance = to.balance + amount;
  return prisma.$transaction([
    prisma.account.update({ where: { id: fromId }, data: { balance: fromNewBalance } }),
    prisma.account.update({ where: { id: toId }, data: { balance: toNewBalance } }),
    prisma.transaction.create({
      data: { type: TransactionType.TRANSFER_OUT, amount, balanceAfter: fromNewBalance, fromAccountId: fromId, toAccountId: toId },
    }),
    prisma.transaction.create({
      data: { type: TransactionType.TRANSFER_IN, amount, balanceAfter: toNewBalance, fromAccountId: fromId, toAccountId: toId },
    }),
  ]);
}

export async function getTransactions(id: string) {
  await getAccount(id);
  return prisma.transaction.findMany({
    where: { OR: [{ fromAccountId: id }, { toAccountId: id }] },
    orderBy: { createdAt: "desc" },
  });
}
