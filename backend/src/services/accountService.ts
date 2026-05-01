import { PrismaClient, TransactionType, AccountType } from "@prisma/client";
import { randomUUID } from "crypto";
import { AppError } from "../middleware/errorHandler";
import { resolveDateRange } from "../lib/date-range";

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

type TransactionRecord = {
  id: string;
  type: TransactionType;
  amount: number;
  balanceAfter: number;
  transferGroupId: string | null;
  category: string | null;
  merchant: string | null;
  description: string | null;
  effectiveAt: Date;
  createdAt: Date;
  fromAccountId: string | null;
  toAccountId: string | null;
};

type MonthlySummaryRow = {
  category: string;
  income: number | string | null;
  spending: number | string | null;
};

type TransactionFilters = {
  type?: TransactionType;
  category?: string;
  search?: string;
  start?: Date;
  end?: Date;
};

type TransactionUpdateInput = {
  amount: number;
  category?: string;
  merchant?: string;
  description?: string;
  effectiveAt?: Date;
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

async function selectAccountByUserId(userId: string, id: string) {
  const rows = await prisma.$queryRaw<AccountRecord[]>`
    SELECT "id", "userId", "ownerName", "nickname", "accountType", "balance", "frozen", "createdAt", "updatedAt"
    FROM "Account"
    WHERE "id" = ${id} AND "userId" = ${userId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function selectTransactionByAccount(userId: string, accountId: string, transactionId: string) {
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

async function selectTransactionsByTransferGroup(userId: string, transferGroupId: string) {
  return prisma.$queryRaw<TransactionRecord[]>`
    SELECT t."id", t."type", t."amount", t."balanceAfter", t."transferGroupId", t."category", t."merchant", t."description", t."effectiveAt", t."createdAt", t."fromAccountId", t."toAccountId"
    FROM "Transaction" t
    LEFT JOIN "Account" fa ON fa."id" = t."fromAccountId"
    LEFT JOIN "Account" ta ON ta."id" = t."toAccountId"
    WHERE t."transferGroupId" = ${transferGroupId}
      AND (fa."userId" = ${userId} OR ta."userId" = ${userId})
    ORDER BY t."createdAt" ASC, t."id" ASC
  `;
}

async function listTransactionsForBalanceReplay(client: Pick<PrismaClient, "$queryRaw">, accountId: string) {
  return client.$queryRaw<TransactionRecord[]>`
    SELECT "id", "type", "amount", "balanceAfter", "transferGroupId", "category", "merchant", "description", "effectiveAt", "createdAt", "fromAccountId", "toAccountId"
    FROM "Transaction"
    WHERE
      ("fromAccountId" = ${accountId} AND "type" IN ('WITHDRAWAL'::"TransactionType", 'TRANSFER_OUT'::"TransactionType"))
      OR
      ("toAccountId" = ${accountId} AND "type" IN ('DEPOSIT'::"TransactionType", 'TRANSFER_IN'::"TransactionType"))
    ORDER BY "effectiveAt" ASC, "createdAt" ASC, "id" ASC
  `;
}

function getTransactionDelta(transaction: TransactionRecord, accountId: string) {
  if (transaction.type === TransactionType.DEPOSIT && transaction.toAccountId === accountId) {
    return transaction.amount;
  }
  if (transaction.type === TransactionType.TRANSFER_IN && transaction.toAccountId === accountId) {
    return transaction.amount;
  }
  if (transaction.type === TransactionType.WITHDRAWAL && transaction.fromAccountId === accountId) {
    return -transaction.amount;
  }
  if (transaction.type === TransactionType.TRANSFER_OUT && transaction.fromAccountId === accountId) {
    return -transaction.amount;
  }
  return 0;
}

async function replayAccountBalances(client: PrismaClient, accountId: string) {
  const transactions = await listTransactionsForBalanceReplay(client, accountId);
  let balance = 0;

  for (const transaction of transactions) {
    balance += getTransactionDelta(transaction, accountId);
    if (balance < 0) {
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

async function createTransaction(client: Pick<PrismaClient, "$queryRaw">, input: {
  type: TransactionType;
  amount: number;
  balanceAfter: number;
  transferGroupId?: string;
  category?: string;
  merchant?: string;
  description?: string;
  effectiveAt?: Date;
  fromAccountId?: string;
  toAccountId?: string;
}) {
  const id = randomUUID();
  const category = input.category?.trim() ? input.category.trim() : null;
  const merchant = input.merchant?.trim() ? input.merchant.trim() : null;
  const description = input.description?.trim() ? input.description.trim() : null;
  const rows = await client.$queryRaw<TransactionRecord[]>`
    INSERT INTO "Transaction" ("id", "type", "amount", "balanceAfter", "transferGroupId", "category", "merchant", "description", "effectiveAt", "createdAt", "fromAccountId", "toAccountId")
    VALUES (${id}, ${input.type}::"TransactionType", ${input.amount}, ${input.balanceAfter}, ${input.transferGroupId ?? null}, ${category}, ${merchant}, ${description}, ${input.effectiveAt ?? new Date()}, CURRENT_TIMESTAMP, ${input.fromAccountId ?? null}, ${input.toAccountId ?? null})
    RETURNING "id", "type", "amount", "balanceAfter", "transferGroupId", "category", "merchant", "description", "effectiveAt", "createdAt", "fromAccountId", "toAccountId"
  `;
  return rows[0];
}

/**
 * Builds a monthly cash-flow summary for a user's accounts.
 * Includes deposits as income and withdrawals as spending; transfers are excluded
 * because they move money between accounts instead of changing total cash flow.
 */
export async function getMonthlySummary(userId: string, input?: { start?: Date; end?: Date; now?: Date }) {
  const dateRange = input ? resolveDateRange(input) : null;

  const rows = dateRange
    ? await prisma.$queryRaw<MonthlySummaryRow[]>`
        SELECT
          COALESCE(t."category", 'Uncategorized') AS "category",
          SUM(CASE WHEN t."type" = 'DEPOSIT'::"TransactionType" AND a."accountType" != 'CREDIT'::"AccountType" THEN t."amount" ELSE 0 END) AS "income",
          SUM(CASE
            WHEN t."type" = 'WITHDRAWAL'::"TransactionType" AND a."accountType" != 'CREDIT'::"AccountType" THEN t."amount"
            WHEN t."type" = 'DEPOSIT'::"TransactionType" AND a."accountType" = 'CREDIT'::"AccountType" THEN t."amount"
            ELSE 0
          END) AS "spending"
        FROM "Transaction" t
        JOIN "Account" a ON t."toAccountId" = a."id" OR t."fromAccountId" = a."id"
        WHERE a."userId" = ${userId}
          AND t."effectiveAt" >= ${dateRange.start}
          AND t."effectiveAt" < ${dateRange.end}
          AND t."type" IN ('DEPOSIT'::"TransactionType", 'WITHDRAWAL'::"TransactionType")
        GROUP BY COALESCE(t."category", 'Uncategorized')
        ORDER BY "spending" DESC, "income" DESC
      `
    : await prisma.$queryRaw<MonthlySummaryRow[]>`
        SELECT
          COALESCE(t."category", 'Uncategorized') AS "category",
          SUM(CASE WHEN t."type" = 'DEPOSIT'::"TransactionType" AND a."accountType" != 'CREDIT'::"AccountType" THEN t."amount" ELSE 0 END) AS "income",
          SUM(CASE
            WHEN t."type" = 'WITHDRAWAL'::"TransactionType" AND a."accountType" != 'CREDIT'::"AccountType" THEN t."amount"
            WHEN t."type" = 'DEPOSIT'::"TransactionType" AND a."accountType" = 'CREDIT'::"AccountType" THEN t."amount"
            ELSE 0
          END) AS "spending"
        FROM "Transaction" t
        JOIN "Account" a ON t."toAccountId" = a."id" OR t."fromAccountId" = a."id"
        WHERE a."userId" = ${userId}
          AND t."type" IN ('DEPOSIT'::"TransactionType", 'WITHDRAWAL'::"TransactionType")
        GROUP BY COALESCE(t."category", 'Uncategorized')
        ORDER BY "spending" DESC, "income" DESC
      `;

  const categories = rows.map((row) => ({
    category: row.category,
    income: Number(row.income ?? 0),
    spending: Number(row.spending ?? 0),
  }));
  const income = categories.reduce((sum, category) => sum + category.income, 0);
  const spending = categories.reduce((sum, category) => sum + category.spending, 0);
  const topExpenseCategory = categories.find((category) => category.spending > 0)?.category ?? null;

  return {
    month: dateRange ? dateRange.start.toISOString().slice(0, 7) : "all-time",
    income,
    spending,
    netCashFlow: income - spending,
    topExpenseCategory,
    categories,
  };
}

type MonthlyTrendRow = {
  month: Date;
  income: number | string | null;
  spending: number | string | null;
};

/**
 * Returns month-by-month income and spending totals for the last N calendar months,
 * using the same credit-aware logic as getMonthlySummary.
 */
export async function getMonthlyTrends(userId: string, months: number = 6) {
  const rows = await prisma.$queryRaw<MonthlyTrendRow[]>`
    SELECT
      DATE_TRUNC('month', t."effectiveAt") AS "month",
      SUM(CASE WHEN t."type" = 'DEPOSIT'::"TransactionType" AND a."accountType" != 'CREDIT'::"AccountType" THEN t."amount" ELSE 0 END) AS "income",
      SUM(CASE
        WHEN t."type" = 'WITHDRAWAL'::"TransactionType" AND a."accountType" != 'CREDIT'::"AccountType" THEN t."amount"
        WHEN t."type" = 'DEPOSIT'::"TransactionType" AND a."accountType" = 'CREDIT'::"AccountType" THEN t."amount"
        ELSE 0
      END) AS "spending"
    FROM "Transaction" t
    JOIN "Account" a ON t."toAccountId" = a."id" OR t."fromAccountId" = a."id"
    WHERE a."userId" = ${userId}
      AND t."type" IN ('DEPOSIT'::"TransactionType", 'WITHDRAWAL'::"TransactionType")
      AND t."effectiveAt" >= DATE_TRUNC('month', NOW()) - ${months - 1} * INTERVAL '1 month'
    GROUP BY DATE_TRUNC('month', t."effectiveAt")
    ORDER BY "month" ASC
  `;

  return rows.map((row) => {
    const income = Number(row.income ?? 0);
    const spending = Number(row.spending ?? 0);
    return {
      month: (row.month as Date).toISOString().slice(0, 7),
      income,
      spending,
      net: income - spending,
    };
  });
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
    throw new AppError(400, "accountType must be CHEQUING, SAVINGS, TFSA, RRSP, FHSA, or CREDIT");
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
export async function getAccount(userId: string, id: string) {
  const account = await selectAccountByUserId(userId, id);
  if (!account) throw new AppError(404, `Account ${id} not found`);
  return account;
}

/**
 * Updates an account nickname.
 * Passing an empty nickname clears the custom label.
 * Throws 404 if the account does not exist.
 */
export async function updateNickname(userId: string, id: string, nickname?: string) {
  await getAccount(userId, id);
  const rows = await prisma.$queryRaw<AccountRecord[]>`
    UPDATE "Account"
    SET "nickname" = ${nickname?.trim() ? nickname.trim() : null},
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id} AND "userId" = ${userId}
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
export async function deposit(userId: string, id: string, amount: number, category?: string, description?: string, effectiveAt?: Date, merchant?: string) {
  if (amount <= 0) throw new AppError(400, "Deposit amount must be positive");
  const account = await getAccount(userId, id);
  if (account.frozen) throw new AppError(403, "Account is frozen");
  const newBalance = account.balance + amount;
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
  return [await getAccount(userId, id), transaction] as const;
}

/**
 * Withdraws a positive amount from an account and records the transaction.
 * Throws 400 if the amount is zero or negative.
 * Throws 403 if the account is frozen.
 * Throws 400 if the account has insufficient funds.
 * Uses a Prisma transaction to ensure the balance update and transaction record are atomic.
 */
export async function withdraw(userId: string, id: string, amount: number, category?: string, description?: string, effectiveAt?: Date, merchant?: string) {
  if (amount <= 0) throw new AppError(400, "Withdrawal amount must be positive");
  const account = await getAccount(userId, id);
  if (account.frozen) throw new AppError(403, "Account is frozen");
  if (account.balance < amount) throw new AppError(400, "Insufficient funds");
  const newBalance = account.balance - amount;
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
  return [await getAccount(userId, id), transaction] as const;
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
export async function transfer(userId: string, fromId: string, toId: string, amount: number, description?: string, category: string = "Transfer") {
  if (amount <= 0) throw new AppError(400, "Transfer amount must be positive");
  if (fromId === toId) throw new AppError(400, "Cannot transfer to the same account");
  const from = await getAccount(userId, fromId);
  if (from.frozen) throw new AppError(403, "Source account is frozen");
  if (from.balance < amount) throw new AppError(400, "Insufficient funds");
  const to = await getAccount(userId, toId);
  if (to.frozen) throw new AppError(403, "Destination account is frozen");
  const fromNewBalance = from.balance - amount;
  const toNewBalance = to.balance + amount;
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
  return [await getAccount(userId, fromId), outgoingTransaction, incomingTransaction] as const;
}

/**
 * Retrieves all transactions associated with an account, ordered by most recent first.
 * Includes both sent and received transactions.
 * Throws 404 if the account does not exist.
 */
export async function getTransactions(userId: string, id: string, filters?: TransactionFilters) {
  await getAccount(userId, id);
  const categoryFilter = filters?.category?.trim() ? filters.category.trim() : null;
  const searchFilter = filters?.search?.trim().toLowerCase() ?? null;
  const range = filters?.start && filters?.end ? resolveDateRange({ start: filters.start, end: filters.end }) : null;

  const transactions = await prisma.$queryRaw<TransactionRecord[]>`
    SELECT "id", "type", "amount", "balanceAfter", "transferGroupId", "category", "merchant", "description", "effectiveAt", "createdAt", "fromAccountId", "toAccountId"
    FROM "Transaction"
    WHERE
      ("fromAccountId" = ${id} AND "type" IN ('WITHDRAWAL'::"TransactionType", 'TRANSFER_OUT'::"TransactionType"))
      OR
      ("toAccountId" = ${id} AND "type" IN ('DEPOSIT'::"TransactionType", 'TRANSFER_IN'::"TransactionType"))
    ORDER BY "effectiveAt" DESC, "createdAt" DESC
  `;

  return transactions.filter((transaction) => {
    if (filters?.type && transaction.type !== filters.type) {
      return false;
    }
    if (categoryFilter && (transaction.category ?? "") !== categoryFilter) {
      return false;
    }
    if (searchFilter) {
      const haystack = [transaction.description ?? "", transaction.merchant ?? ""].join(" ").toLowerCase();
      if (!haystack.includes(searchFilter)) {
        return false;
      }
    }
    if (range && !(transaction.effectiveAt >= range.start && transaction.effectiveAt < range.end)) {
      return false;
    }
    return true;
  });
}

/**
 * Updates a manual deposit or withdrawal and replays the account balance history.
 * Transfers are intentionally excluded because both sides must be edited together.
 * Throws 404 if the transaction is not visible from this account for the current user.
 * Throws 400 if the updated amount is not positive or the edit would overdraw the account.
 */
export async function updateTransaction(userId: string, accountId: string, transactionId: string, input: TransactionUpdateInput) {
  if (input.amount <= 0) throw new AppError(400, "amount must be positive");
  await getAccount(userId, accountId);
  const transaction = await selectTransactionByAccount(userId, accountId, transactionId);
  if (!transaction) throw new AppError(404, `Transaction ${transactionId} not found`);

  const category = input.category?.trim() ? input.category.trim() : null;
  const effectiveAt = input.effectiveAt ?? transaction.effectiveAt;

  if (transaction.type === TransactionType.TRANSFER_OUT || transaction.type === TransactionType.TRANSFER_IN) {
    if (!transaction.transferGroupId) {
      throw new AppError(400, "Only newly linked transfers can be edited");
    }

    const linkedTransactions = await selectTransactionsByTransferGroup(userId, transaction.transferGroupId);
    if (linkedTransactions.length !== 2) {
      throw new AppError(400, "Transfer records are incomplete");
    }

    const affectedAccountIds = Array.from(new Set(
      linkedTransactions.flatMap((linkedTransaction) => [linkedTransaction.fromAccountId, linkedTransaction.toAccountId]).filter(Boolean)
    )) as string[];

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
        await replayAccountBalances(tx as PrismaClient, affectedAccountId);
      }
    });

    return getAccount(userId, accountId);
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
    await replayAccountBalances(tx as PrismaClient, accountId);
  });

  return getAccount(userId, accountId);
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
  if (transaction.type === TransactionType.TRANSFER_OUT || transaction.type === TransactionType.TRANSFER_IN) {
    if (!transaction.transferGroupId) {
      throw new AppError(400, "Only newly linked transfers can be deleted");
    }

    const linkedTransactions = await selectTransactionsByTransferGroup(userId, transaction.transferGroupId);
    if (linkedTransactions.length !== 2) {
      throw new AppError(400, "Transfer records are incomplete");
    }

    const affectedAccountIds = Array.from(new Set(
      linkedTransactions.flatMap((linkedTransaction) => [linkedTransaction.fromAccountId, linkedTransaction.toAccountId]).filter(Boolean)
    )) as string[];

    await prisma.$transaction(async (tx) => {
      await tx.transaction.deleteMany({
        where: { transferGroupId: transaction.transferGroupId },
      });
      for (const affectedAccountId of affectedAccountIds) {
        await replayAccountBalances(tx as PrismaClient, affectedAccountId);
      }
    });

    return getAccount(userId, accountId);
  }

  await prisma.$transaction(async (tx) => {
    await tx.transaction.delete({ where: { id: transactionId } });
    await replayAccountBalances(tx as PrismaClient, accountId);
  });

  return getAccount(userId, accountId);
}

/**
 * Freezes an account, preventing all future transactions.
 * Throws 404 if the account does not exist.
 */
export async function freezeAccount(userId: string, id: string) {
  await getAccount(userId, id);
  await prisma.account.update({
    where: { id },
    data: { frozen: true },
  });
  return getAccount(userId, id);
}

/**
 * Unfreezes an account, restoring the ability to transact.
 * Throws 404 if the account does not exist.
 */
export async function unfreezeAccount(userId: string, id: string) {
  await getAccount(userId, id);
  await prisma.account.update({
    where: { id },
    data: { frozen: false },
  });
  return getAccount(userId, id);
}

/**
 * Deletes an account and all of its associated transactions.
 * Throws 404 if the account does not exist.
 * Runs inside a Prisma transaction to ensure atomicity.
 */
export async function deleteAccount(userId: string, id: string) {
  await getAccount(userId, id);
  await prisma.$transaction([
    prisma.transaction.deleteMany({
      where: { OR: [{ fromAccountId: id }, { toAccountId: id }] },
    }),
    prisma.account.delete({ where: { id } }),
  ]);
}
