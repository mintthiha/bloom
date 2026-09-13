import { AccountType } from "@prisma/client";
import * as credentialsAuthService from "./credentialsAuthService";
import * as accountService from "./accountService";
import * as profileService from "./profileService";
import * as budgetService from "./budgetService";
import * as savingsGoalService from "./savingsGoalService";
import type { ImportRow } from "./accountService";

const MONTHS_OF_HISTORY = 6;
const SALARY = 4300;
const RENT = 1500;
const SAVINGS_CONTRIBUTION = 400;

/** Spending per category for each of the last six months, oldest first. */
const MONTHLY_SPEND: Record<string, number[]> = {
  Groceries: [520, 560, 470, 600, 540, 300],
  Utilities: [180, 195, 178, 188, 170, 90],
  Transport: [105, 118, 125, 100, 112, 55],
  Dining: [115, 95, 150, 130, 140, 100],
  Shopping: [160, 70, 140, 90, 110, 50],
  Entertainment: [45, 70, 25, 80, 55, 30],
};

/** Rotating merchant names per category so the history reads realistically. */
const MERCHANTS: Record<string, string[]> = {
  Groceries: ["Loblaws", "Metro", "Costco", "No Frills", "Sobeys", "Farm Boy"],
  Utilities: ["Hydro One", "Enbridge Gas", "Bell Canada", "Rogers", "City Water", "Hydro One"],
  Transport: ["Presto Transit", "Shell", "Petro-Canada", "Uber", "Esso", "Presto Transit"],
  Dining: ["Uber Eats", "Chipotle", "The Keg", "DoorDash", "Tim Hortons", "A&W"],
  Shopping: ["Amazon", "Simons", "Best Buy", "IKEA", "Winners", "Amazon"],
  Entertainment: ["Netflix", "Cineplex", "Spotify", "Steam", "Prime Video", "Netflix"],
};

/** Day of month each category's expense lands on. */
const CATEGORY_DAY: Record<string, number> = {
  Groceries: 6,
  Utilities: 8,
  Transport: 10,
  Dining: 14,
  Shopping: 18,
  Entertainment: 22,
};

/** Category budgets to create; two use rollover so the feature has something to show. */
const BUDGETS: Array<{ category: string; monthlyLimit: number; rollover: boolean }> = [
  { category: "Groceries", monthlyLimit: 600, rollover: true },
  { category: "Dining", monthlyLimit: 150, rollover: true },
  { category: "Entertainment", monthlyLimit: 80, rollover: false },
  { category: "Transport", monthlyLimit: 120, rollover: false },
  { category: "Utilities", monthlyLimit: 200, rollover: false },
  { category: "Shopping", monthlyLimit: 150, rollover: false },
  { category: "Rent", monthlyLimit: 1500, rollover: false },
];

/** Returns a UTC date `monthsAgo` months back on the given day, clamped to today for the current month. */
function atMonth(monthsAgo: number, day: number): Date {
  const now = new Date();
  const clampedDay = monthsAgo === 0 ? Math.min(day, now.getUTCDate()) : day;
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, clampedDay, 12, 0, 0)
  );
}

/** Builds six months of salary, rent, category spend, and a savings transfer for the chequing account. */
function buildChequingRows(): ImportRow[] {
  const rows: ImportRow[] = [];

  for (let index = 0; index < MONTHS_OF_HISTORY; index++) {
    const monthsAgo = MONTHS_OF_HISTORY - 1 - index;

    rows.push({
      type: "DEPOSIT",
      amount: SALARY,
      effectiveAt: atMonth(monthsAgo, 1),
      merchant: "Northwind Payroll",
      description: "Salary",
      category: "Salary",
    });

    rows.push({
      type: "WITHDRAWAL",
      amount: RENT,
      effectiveAt: atMonth(monthsAgo, 2),
      category: "Rent",
      merchant: "Maple Property Mgmt",
    });

    for (const category of Object.keys(MONTHLY_SPEND)) {
      rows.push({
        type: "WITHDRAWAL",
        amount: MONTHLY_SPEND[category]![index]!,
        effectiveAt: atMonth(monthsAgo, CATEGORY_DAY[category]!),
        category,
        merchant: MERCHANTS[category]![index]!,
      });
    }

    rows.push({
      type: "WITHDRAWAL",
      amount: SAVINGS_CONTRIBUTION,
      effectiveAt: atMonth(monthsAgo, 25),
      description: "Transfer to savings",
      category: "Transfer",
    });
  }

  return rows;
}

/** Builds six months of matching deposits into the savings account. */
function buildSavingsRows(): ImportRow[] {
  const rows: ImportRow[] = [];
  for (let index = 0; index < MONTHS_OF_HISTORY; index++) {
    const monthsAgo = MONTHS_OF_HISTORY - 1 - index;
    rows.push({
      type: "DEPOSIT",
      amount: SAVINGS_CONTRIBUTION,
      effectiveAt: atMonth(monthsAgo, 25),
      description: "Transfer from chequing",
      category: "Transfer",
    });
  }
  return rows;
}

/** A one-time opening deposit so the TFSA doesn't start at zero. */
function buildTfsaRows(): ImportRow[] {
  return [
    {
      type: "DEPOSIT",
      amount: 12000,
      effectiveAt: atMonth(MONTHS_OF_HISTORY - 1, 1),
      description: "Opening contribution",
    },
  ];
}

/**
 * Provisions a throwaway demo account for the "Try Bloom" flow: a fresh
 * credential user, a profile, three accounts, six months of transaction
 * history across them, a handful of category budgets, and one savings goal.
 * Returns a remember-me token so the frontend can sign the visitor straight in.
 */
export async function createDemoAccount(): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const demoUser = await credentialsAuthService.registerDemoUser();
  const userId = demoUser.id;

  await profileService.upsertProfile(userId, {
    firstName: "Alex",
    lastName: "Rivera",
    username: `demo_${userId.slice(0, 8).toLowerCase()}`,
    email: demoUser.email,
  });

  const ownerName = "Alex Rivera";
  const chequing = await accountService.createAccount(
    userId,
    ownerName,
    AccountType.CHEQUING,
    "Everyday Chequing"
  );
  const savings = await accountService.createAccount(
    userId,
    ownerName,
    AccountType.SAVINGS,
    "High-Interest Savings"
  );
  const tfsa = await accountService.createAccount(userId, ownerName, AccountType.TFSA, "TFSA");

  await accountService.importTransactions(userId, chequing.id, buildChequingRows());
  await accountService.importTransactions(userId, savings.id, buildSavingsRows());
  await accountService.importTransactions(userId, tfsa.id, buildTfsaRows());

  for (const budget of BUDGETS) {
    const created = await budgetService.upsertBudget(userId, budget);
    if (budget.rollover) {
      await budgetService.setRolloverEnabled(userId, created.id, true);
    }
  }

  await savingsGoalService.createSavingsGoal(userId, {
    accountId: savings.id,
    name: "Emergency Fund",
    targetAmount: 10000,
  });

  const { token, expiresAt } = await credentialsAuthService.issueRememberTokenForUserId(userId);
  return { token, expiresAt };
}
