import { describe, expect, it } from "vitest";
import type {
  Account,
  Budget,
  MonthlySummary,
  Profile,
  SavingsGoal,
  SubscriptionSummary,
  Transaction,
} from "@/lib/api";
import { calculateTfsaLifetimeRoom } from "@/lib/contribution-room";
import { formatCurrency } from "@/lib/format";
import { buildFinancialContext, type FinancialSnapshot } from "./financial-context";

const REFERENCE_DATE = new Date("2026-07-26T12:00:00Z");

/** Builds an account with sensible defaults so tests only specify what matters. */
function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "acc-1",
    ownerName: "Me",
    nickname: null,
    accountType: "CHEQUING",
    balance: 0,
    frozen: false,
    isLinked: false,
    plaidAccountId: null,
    plaidItemId: null,
    institutionName: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

/** Builds a budget with sensible defaults. */
function makeBudget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: "budget-1",
    userId: "user-1",
    category: "Groceries",
    monthlyLimit: 500,
    rolloverEnabled: false,
    month: "2026-07",
    limit: 500,
    carryIn: 0,
    adjustment: 0,
    available: 500,
    currentSpending: 0,
    remaining: 500,
    carryOut: 0,
    percentageUsed: 0,
    isOverBudget: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

/** Builds a savings goal with sensible defaults. */
function makeGoal(overrides: Partial<SavingsGoal> = {}): SavingsGoal {
  return {
    id: "goal-1",
    userId: "user-1",
    accountId: "acc-1",
    name: "Emergency Fund",
    targetAmount: 10000,
    currentBalance: 2500,
    accountName: "Me",
    accountNickname: null,
    accountOwnerName: "Me",
    accountType: "SAVINGS",
    percentageReached: 25,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

/** Builds a profile with sensible defaults. */
function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    userId: "user-1",
    firstName: "Test",
    lastName: "User",
    username: "test",
    email: "test@example.com",
    tfsaBirthYear: null,
    tfsaRoomUsedElsewhere: null,
    rrspContributionRoom: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

/** Builds a monthly summary with sensible defaults. */
function makeMonthlySummary(overrides: Partial<MonthlySummary> = {}): MonthlySummary {
  return {
    month: "2026-07",
    income: 4000,
    spending: 2500,
    netCashFlow: 1500,
    topExpenseCategory: "Rent",
    categories: [{ category: "Rent", income: 0, spending: 1200 }],
    ...overrides,
  };
}

/** Builds a deposit transaction into the given account. */
function makeDeposit(toAccountId: string, amount: number): Transaction {
  return {
    id: `txn-${toAccountId}-${amount}`,
    type: "DEPOSIT",
    amount,
    balanceAfter: amount,
    category: null,
    merchant: null,
    description: null,
    effectiveAt: "2026-03-01T00:00:00Z",
    createdAt: "2026-03-01T00:00:00Z",
    fromAccountId: null,
    toAccountId,
  };
}

/** Builds a snapshot with empty sections, overridable per test. */
function makeSnapshot(overrides: Partial<FinancialSnapshot> = {}): FinancialSnapshot {
  return {
    accounts: [],
    monthlySummary: null,
    budgets: [],
    savingsGoals: [],
    subscriptions: null,
    recurringTransactions: [],
    profile: null,
    registeredTransactions: {},
    ...overrides,
  };
}

describe("buildFinancialContext", () => {
  it("returns an empty string when the user has no accounts", () => {
    expect(buildFinancialContext(makeSnapshot(), REFERENCE_DATE)).toBe("");
  });

  it("reports net worth as assets minus credit debt with a per-type breakdown", () => {
    const context = buildFinancialContext(
      makeSnapshot({
        accounts: [
          makeAccount({ id: "chq", accountType: "CHEQUING", balance: 3000 }),
          makeAccount({ id: "tfsa", accountType: "TFSA", balance: 5000 }),
          makeAccount({ id: "cc", accountType: "CREDIT", balance: 1000 }),
        ],
      }),
      REFERENCE_DATE
    );
    // assets 8000, debt 1000 => net worth 7000
    expect(context).toContain(`Net worth ${formatCurrency(7000)}`);
    expect(context).toContain(`assets ${formatCurrency(8000)}`);
    expect(context).toContain(`debt ${formatCurrency(1000)}`);
    expect(context).toContain(`Chequing ${formatCurrency(3000)}`);
    expect(context).toContain(`Credit ${formatCurrency(1000)}`);
  });

  it("includes this month's cash flow and top spending category", () => {
    const context = buildFinancialContext(
      makeSnapshot({
        accounts: [makeAccount({ balance: 1000 })],
        monthlySummary: makeMonthlySummary(),
      }),
      REFERENCE_DATE
    );
    expect(context).toContain(`income ${formatCurrency(4000)}`);
    expect(context).toContain(`net cash flow ${formatCurrency(1500)}`);
    expect(context).toContain(`Top spending category: Rent (${formatCurrency(1200)})`);
  });

  it("omits the cash-flow line when no monthly summary is available", () => {
    const context = buildFinancialContext(
      makeSnapshot({ accounts: [makeAccount({ balance: 1000 })] }),
      REFERENCE_DATE
    );
    expect(context).not.toContain("This month");
  });

  it("flags only over-limit budgets, and notes when all are within limit", () => {
    const overBudget = buildFinancialContext(
      makeSnapshot({
        accounts: [makeAccount({ balance: 1000 })],
        budgets: [
          makeBudget({ category: "Dining", currentSpending: 600, limit: 400, isOverBudget: true }),
          makeBudget({ category: "Groceries", currentSpending: 200, limit: 500 }),
        ],
      }),
      REFERENCE_DATE
    );
    expect(overBudget).toContain(
      `Budgets over limit: Dining (${formatCurrency(600)}/${formatCurrency(400)})`
    );
    expect(overBudget).not.toContain("Groceries");

    const withinBudget = buildFinancialContext(
      makeSnapshot({
        accounts: [makeAccount({ balance: 1000 })],
        budgets: [makeBudget({ category: "Groceries" })],
      }),
      REFERENCE_DATE
    );
    expect(withinBudget).toContain("all within limit");
  });

  it("summarizes savings goals and subscriptions", () => {
    const context = buildFinancialContext(
      makeSnapshot({
        accounts: [makeAccount({ balance: 1000 })],
        savingsGoals: [
          makeGoal({
            name: "Vacation",
            currentBalance: 500,
            targetAmount: 2000,
            percentageReached: 25,
          }),
        ],
        subscriptions: {
          monthlyTotal: 45,
          annualTotal: 540,
          count: 3,
          subscriptions: [],
        } as SubscriptionSummary,
      }),
      REFERENCE_DATE
    );
    expect(context).toContain(`Vacation 25% (${formatCurrency(500)}/${formatCurrency(2000)})`);
    expect(context).toContain(`Subscriptions: 3 totalling ${formatCurrency(45)}/month`);
  });

  it("estimates TFSA room from birth year, in-Bloom contributions, and external usage", () => {
    const context = buildFinancialContext(
      makeSnapshot({
        accounts: [makeAccount({ id: "tfsa-1", accountType: "TFSA", balance: 3000 })],
        profile: makeProfile({ tfsaBirthYear: 2000, tfsaRoomUsedElsewhere: 1000 }),
        registeredTransactions: { TFSA: [makeDeposit("tfsa-1", 3000)] },
      }),
      REFERENCE_DATE
    );
    const lifetimeRoom = calculateTfsaLifetimeRoom(2000, 2026);
    // net contributions 3000 + external 1000 = 4000 used
    expect(context).toContain(
      `about ${formatCurrency(4000)} used of ${formatCurrency(lifetimeRoom)}`
    );
    expect(context).toContain(`roughly ${formatCurrency(lifetimeRoom - 4000)} remaining`);
  });

  it("omits TFSA and RRSP room lines when the profile lacks the inputs", () => {
    const context = buildFinancialContext(
      makeSnapshot({
        accounts: [makeAccount({ accountType: "TFSA", balance: 3000 })],
        profile: makeProfile(),
      }),
      REFERENCE_DATE
    );
    expect(context).not.toContain("TFSA room");
    expect(context).not.toContain("RRSP room");
  });

  it("reports RRSP room remaining against the deduction limit", () => {
    const context = buildFinancialContext(
      makeSnapshot({
        accounts: [makeAccount({ id: "rrsp-1", accountType: "RRSP", balance: 2000 })],
        profile: makeProfile({ rrspContributionRoom: 10000 }),
        registeredTransactions: { RRSP: [makeDeposit("rrsp-1", 2000)] },
      }),
      REFERENCE_DATE
    );
    expect(context).toContain(`deduction limit ${formatCurrency(10000)}`);
    expect(context).toContain(`roughly ${formatCurrency(8000)} remaining`);
  });
});
