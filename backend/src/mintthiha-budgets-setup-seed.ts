import { randomUUID } from "crypto";
import prisma from "./lib/prisma";

/**
 * Seeds a single user with a coherent five-month financial history: accounts,
 * categorized transactions, category budgets (a mix of rollover and plain caps),
 * a recurring salary, a savings goal, and net-worth snapshots. Everything is
 * scoped to one user id and re-runnable — it wipes only that user's rows first.
 *
 * Target user: process.env.SEED_USER_ID, else the app's real (non-e2e) user.
 */

const DEFAULT_USER_ID = "110015314191616814694";
const MONTHS_OF_HISTORY = 5;

/** Spending per category for each of the last five months, oldest first. */
const MONTHLY_SPEND: Record<string, number[]> = {
  Groceries: [540, 590, 470, 600, 300],
  Utilities: [185, 195, 178, 188, 90],
  Transport: [110, 118, 125, 100, 55],
  Dining: [120, 95, 150, 130, 100],
  Shopping: [160, 70, 140, 90, 50],
  Entertainment: [45, 70, 25, 80, 30],
};

/** Rotating merchant names per category so history reads realistically. */
const MERCHANTS: Record<string, string[]> = {
  Groceries: ["Loblaws", "Metro", "Costco", "No Frills", "Sobeys"],
  Utilities: ["Hydro One", "Enbridge Gas", "Bell Canada", "Rogers", "City Water"],
  Transport: ["Presto Transit", "Shell", "Petro-Canada", "Uber", "Esso"],
  Dining: ["Uber Eats", "Chipotle", "The Keg", "DoorDash", "Tim Hortons"],
  Shopping: ["Amazon", "Simons", "Best Buy", "IKEA", "Winners"],
  Entertainment: ["Netflix", "Cineplex", "Spotify", "Steam", "Prime Video"],
};

/** Day of month each category's expense lands on, in ascending order. */
const CATEGORY_DAY: Record<string, number> = {
  Groceries: 6,
  Utilities: 8,
  Transport: 10,
  Dining: 14,
  Shopping: 18,
  Entertainment: 22,
};

/** Category budgets to create; rollover envelopes accrue unspent money month to month. */
const BUDGETS: Array<{ category: string; limit: number; rollover: boolean }> = [
  { category: "Groceries", limit: 600, rollover: true },
  { category: "Dining", limit: 150, rollover: true },
  { category: "Entertainment", limit: 80, rollover: true },
  { category: "Transport", limit: 120, rollover: false },
  { category: "Utilities", limit: 200, rollover: false },
  { category: "Shopping", limit: 150, rollover: false },
  { category: "Rent", limit: 1500, rollover: false },
];

const SALARY = 4300;
const RENT = 1500;
const MONTHLY_SAVINGS_TRANSFER = 400;

/** Returns a UTC date `monthsAgo` months back on the given day, clamped to today for the current month. */
function atMonth(monthsAgo: number, day: number): Date {
  const now = new Date();
  const clampedDay = monthsAgo === 0 ? Math.min(day, now.getUTCDate()) : day;
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, clampedDay, 12, 0, 0)
  );
}

/** `YYYY-MM` key for a date `monthsAgo` months back, used for net-worth snapshots. */
function monthKey(monthsAgo: number): string {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Deletes every row belonging to the target user so the seed can run repeatedly. */
async function resetUser(userId: string) {
  await prisma.$executeRaw`
    DELETE FROM "Transaction"
    WHERE "fromAccountId" IN (SELECT "id" FROM "Account" WHERE "userId" = ${userId})
       OR "toAccountId" IN (SELECT "id" FROM "Account" WHERE "userId" = ${userId})
  `;
  await prisma.$executeRaw`DELETE FROM "SavingsGoal" WHERE "userId" = ${userId}`;
  await prisma.$executeRaw`DELETE FROM "RecurringTransaction" WHERE "userId" = ${userId}`;
  await prisma.$executeRaw`DELETE FROM "BudgetPeriod" WHERE "userId" = ${userId}`;
  await prisma.$executeRaw`DELETE FROM "CategoryBudget" WHERE "userId" = ${userId}`;
  await prisma.$executeRaw`DELETE FROM "NetWorthSnapshot" WHERE "userId" = ${userId}`;
  await prisma.$executeRaw`DELETE FROM "Account" WHERE "userId" = ${userId}`;
}

/** Inserts one account and returns its generated id. */
async function createAccount(
  userId: string,
  ownerName: string,
  nickname: string,
  accountType: string,
  balance: number
): Promise<string> {
  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "Account" ("id", "userId", "ownerName", "nickname", "accountType", "balance", "frozen", "isLinked", "createdAt", "updatedAt")
    VALUES (${id}, ${userId}, ${ownerName}, ${nickname}, ${accountType}::"AccountType", ${balance}, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `;
  return id;
}

type TxnInput = {
  type: string;
  amount: number;
  balanceAfter: number;
  effectiveAt: Date;
  category?: string | null;
  merchant?: string | null;
  description?: string | null;
  fromAccountId?: string | null;
  toAccountId?: string | null;
  transferGroupId?: string | null;
};

/** Inserts one transaction row using the same column shape the app writes. */
async function createTransaction(input: TxnInput) {
  await prisma.$executeRaw`
    INSERT INTO "Transaction" ("id", "type", "amount", "balanceAfter", "transferGroupId", "category", "merchant", "description", "effectiveAt", "createdAt", "fromAccountId", "toAccountId")
    VALUES (
      ${randomUUID()}, ${input.type}::"TransactionType", ${input.amount}, ${input.balanceAfter},
      ${input.transferGroupId ?? null}, ${input.category ?? null}, ${input.merchant ?? null},
      ${input.description ?? null}, ${input.effectiveAt}, CURRENT_TIMESTAMP,
      ${input.fromAccountId ?? null}, ${input.toAccountId ?? null}
    )
  `;
}

/** Creates one category budget and, when requested, flips rollover on. */
async function createBudget(userId: string, category: string, limit: number, rollover: boolean) {
  await prisma.$executeRaw`
    INSERT INTO "CategoryBudget" ("id", "userId", "category", "monthlyLimit", "rolloverEnabled", "createdAt", "updatedAt")
    VALUES (${randomUUID()}, ${userId}, ${category}, ${limit}, ${rollover}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `;
}

/** Builds the full transaction history and returns the ending account balances. */
async function seedTransactions(chequingId: string, savingsId: string) {
  let chequing = 2500;
  let savings = 8000;

  for (let index = 0; index < MONTHS_OF_HISTORY; index++) {
    const monthsAgo = MONTHS_OF_HISTORY - 1 - index;

    chequing += SALARY;
    await createTransaction({
      type: "DEPOSIT",
      amount: SALARY,
      balanceAfter: chequing,
      effectiveAt: atMonth(monthsAgo, 1),
      merchant: "Northwind Payroll",
      description: "Salary",
      toAccountId: chequingId,
    });

    chequing -= RENT;
    await createTransaction({
      type: "WITHDRAWAL",
      amount: RENT,
      balanceAfter: chequing,
      effectiveAt: atMonth(monthsAgo, 2),
      category: "Rent",
      merchant: "Maple Property Mgmt",
      fromAccountId: chequingId,
    });

    for (const category of Object.keys(MONTHLY_SPEND)) {
      const amount = MONTHLY_SPEND[category]![index]!;
      chequing -= amount;
      await createTransaction({
        type: "WITHDRAWAL",
        amount,
        balanceAfter: chequing,
        effectiveAt: atMonth(monthsAgo, CATEGORY_DAY[category]!),
        category,
        merchant: MERCHANTS[category]![index]!,
        fromAccountId: chequingId,
      });
    }

    const transferGroupId = randomUUID();
    chequing -= MONTHLY_SAVINGS_TRANSFER;
    await createTransaction({
      type: "TRANSFER_OUT",
      amount: MONTHLY_SAVINGS_TRANSFER,
      balanceAfter: chequing,
      effectiveAt: atMonth(monthsAgo, 25),
      description: "Monthly savings",
      fromAccountId: chequingId,
      toAccountId: savingsId,
      transferGroupId,
    });
    savings += MONTHLY_SAVINGS_TRANSFER;
    await createTransaction({
      type: "TRANSFER_IN",
      amount: MONTHLY_SAVINGS_TRANSFER,
      balanceAfter: savings,
      effectiveAt: atMonth(monthsAgo, 25),
      description: "Monthly savings",
      fromAccountId: chequingId,
      toAccountId: savingsId,
      transferGroupId,
    });
  }

  return { chequing, savings };
}

/** Sets an account's stored balance to its computed running balance. */
async function updateAccountBalance(accountId: string, balance: number) {
  await prisma.$executeRaw`
    UPDATE "Account" SET "balance" = ${balance}, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${accountId}
  `;
}

/** Adds a monthly recurring salary rule so the recurring view is populated. */
async function seedRecurring(userId: string, accountId: string) {
  const nextRunAt = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1, 12)
  );
  const startDate = atMonth(MONTHS_OF_HISTORY - 1, 1);
  await prisma.$executeRaw`
    INSERT INTO "RecurringTransaction" ("id", "userId", "accountId", "name", "type", "amount", "category", "merchant", "description", "frequency", "startDate", "nextRunAt", "active", "createdAt", "updatedAt")
    VALUES (${randomUUID()}, ${userId}, ${accountId}, ${"Salary"}, ${"DEPOSIT"}::"RecurringTransactionType", ${SALARY}, ${null}, ${"Northwind Payroll"}, ${"Monthly salary"}, ${"MONTHLY"}::"RecurringFrequency", ${startDate}, ${nextRunAt}, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `;
}

/** Adds one savings goal tied to the savings account. */
async function seedSavingsGoal(userId: string, accountId: string) {
  await prisma.$executeRaw`
    INSERT INTO "SavingsGoal" ("id", "userId", "accountId", "name", "targetAmount", "createdAt", "updatedAt")
    VALUES (${randomUUID()}, ${userId}, ${accountId}, ${"Emergency Fund"}, ${10000}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `;
}

/** Seeds a rising net-worth snapshot for each month of history plus the current one. */
async function seedNetWorth(userId: string, endingNetWorth: number) {
  for (let monthsAgo = MONTHS_OF_HISTORY; monthsAgo >= 0; monthsAgo--) {
    const factor = 1 - monthsAgo * 0.035;
    const netWorth = Math.round(endingNetWorth * factor * 100) / 100;
    const totalDebt = Math.round((600 + monthsAgo * 40) * 100) / 100;
    const totalAssets = Math.round((netWorth + totalDebt) * 100) / 100;
    await prisma.$executeRaw`
      INSERT INTO "NetWorthSnapshot" ("id", "userId", "month", "netWorth", "totalAssets", "totalDebt", "createdAt", "updatedAt")
      VALUES (${randomUUID()}, ${userId}, ${monthKey(monthsAgo)}, ${netWorth}, ${totalAssets}, ${totalDebt}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
  }
}

/** Runs the whole seed for the resolved target user. */
async function main() {
  const userId = process.env.SEED_USER_ID ?? DEFAULT_USER_ID;
  console.log(`Seeding data for user ${userId} ...`);

  await resetUser(userId);

  const ownerName = "Alex Rivera";
  const chequingId = await createAccount(userId, ownerName, "Everyday Chequing", "CHEQUING", 0);
  const savingsId = await createAccount(userId, ownerName, "High-Interest Savings", "SAVINGS", 0);
  await createAccount(userId, ownerName, "TFSA", "TFSA", 15000);
  await createAccount(userId, ownerName, "Rewards Credit", "CREDIT", 0);

  const { chequing, savings } = await seedTransactions(chequingId, savingsId);
  await updateAccountBalance(chequingId, chequing);
  await updateAccountBalance(savingsId, savings);

  for (const budget of BUDGETS) {
    await createBudget(userId, budget.category, budget.limit, budget.rollover);
  }

  await seedRecurring(userId, chequingId);
  await seedSavingsGoal(userId, savingsId);
  await seedNetWorth(userId, chequing + savings + 15000 - 600);

  console.log(
    `Done. Accounts: 4, budgets: ${BUDGETS.length} (3 with rollover), ${MONTHS_OF_HISTORY} months of transactions.`
  );
  console.log(
    `Chequing: $${chequing.toFixed(2)}, Savings: $${savings.toFixed(2)}, TFSA: $15000.00`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
