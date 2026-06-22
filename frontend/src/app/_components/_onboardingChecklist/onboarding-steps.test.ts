import { describe, expect, it } from "vitest";
import { deriveOnboardingSteps } from "./onboarding-steps";
import type { Account, Budget, MonthlySummary, SavingsGoal } from "@/lib/api";

/** Creates a minimal Account fixture. */
function makeAccount(id = "a-1"): Account {
  return {
    id,
    ownerName: "Test",
    nickname: null,
    accountType: "CHEQUING",
    balance: 0,
    frozen: false,
    isLinked: false,
    plaidAccountId: null,
    plaidItemId: null,
    institutionName: null,
    createdAt: "",
    updatedAt: "",
  };
}

/** Creates a minimal Budget fixture. */
function makeBudget(id = "b-1"): Budget {
  return {
    id,
    userId: "u-1",
    category: "Dining",
    monthlyLimit: 300,
    currentSpending: 100,
    remaining: 200,
    percentageUsed: 33,
    isOverBudget: false,
    createdAt: "",
    updatedAt: "",
  };
}

/** Creates a minimal SavingsGoal fixture. */
function makeGoal(id = "g-1"): SavingsGoal {
  return {
    id,
    userId: "u-1",
    accountId: "a-1",
    name: "Emergency Fund",
    targetAmount: 5000,
    currentBalance: 1000,
    accountName: "Savings",
    accountNickname: null,
    accountOwnerName: "Test",
    accountType: "SAVINGS",
    percentageReached: 20,
    createdAt: "",
    updatedAt: "",
  };
}

/** Creates a MonthlySummary fixture. */
function makeSummary(income: number, spending: number): MonthlySummary {
  return {
    month: "2026-05",
    income,
    spending,
    netCashFlow: income - spending,
    topExpenseCategory: null,
    categories: [],
  };
}

const EMPTY_INPUT = {
  accounts: [] as Account[],
  budgets: [] as Budget[],
  goals: [] as SavingsGoal[],
  monthlySummary: null,
  hasExploredLearnPage: false,
};

// ---------------------------------------------------------------------------
// Structure invariants
// ---------------------------------------------------------------------------

describe("deriveOnboardingSteps — structure", () => {
  it("always returns exactly 6 steps", () => {
    expect(deriveOnboardingSteps(EMPTY_INPUT)).toHaveLength(6);
  });

  it("returns steps in the correct fixed order", () => {
    const ids = deriveOnboardingSteps(EMPTY_INPUT).map((s) => s.id);
    expect(ids).toEqual([
      "profile-setup",
      "add-first-account",
      "add-first-transaction",
      "setup-budget",
      "create-savings-goal",
      "explore-learn",
    ]);
  });

  it("profile-setup is always complete with a null href", () => {
    const step = deriveOnboardingSteps(EMPTY_INPUT).find((s) => s.id === "profile-setup")!;
    expect(step.isComplete).toBe(true);
    expect(step.href).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Step completion — individual conditions
// ---------------------------------------------------------------------------

describe("deriveOnboardingSteps — step completion", () => {
  it("marks add-first-account complete when at least one account exists", () => {
    const result = deriveOnboardingSteps({ ...EMPTY_INPUT, accounts: [makeAccount()] });
    expect(result.find((s) => s.id === "add-first-account")!.isComplete).toBe(true);
  });

  it("marks add-first-account incomplete when accounts is empty", () => {
    const result = deriveOnboardingSteps(EMPTY_INPUT);
    expect(result.find((s) => s.id === "add-first-account")!.isComplete).toBe(false);
  });

  it("marks add-first-transaction complete when monthlySummary has income > 0", () => {
    const result = deriveOnboardingSteps({ ...EMPTY_INPUT, monthlySummary: makeSummary(500, 0) });
    expect(result.find((s) => s.id === "add-first-transaction")!.isComplete).toBe(true);
  });

  it("marks add-first-transaction complete when monthlySummary has spending > 0", () => {
    const result = deriveOnboardingSteps({ ...EMPTY_INPUT, monthlySummary: makeSummary(0, 200) });
    expect(result.find((s) => s.id === "add-first-transaction")!.isComplete).toBe(true);
  });

  it("marks add-first-transaction incomplete when monthlySummary is null", () => {
    const result = deriveOnboardingSteps({ ...EMPTY_INPUT, monthlySummary: null });
    expect(result.find((s) => s.id === "add-first-transaction")!.isComplete).toBe(false);
  });

  it("marks add-first-transaction incomplete when monthlySummary has zero income and zero spending", () => {
    const result = deriveOnboardingSteps({ ...EMPTY_INPUT, monthlySummary: makeSummary(0, 0) });
    expect(result.find((s) => s.id === "add-first-transaction")!.isComplete).toBe(false);
  });

  it("marks setup-budget complete when at least one budget exists", () => {
    const result = deriveOnboardingSteps({ ...EMPTY_INPUT, budgets: [makeBudget()] });
    expect(result.find((s) => s.id === "setup-budget")!.isComplete).toBe(true);
  });

  it("marks setup-budget incomplete when budgets is empty", () => {
    const result = deriveOnboardingSteps(EMPTY_INPUT);
    expect(result.find((s) => s.id === "setup-budget")!.isComplete).toBe(false);
  });

  it("marks create-savings-goal complete when at least one goal exists", () => {
    const result = deriveOnboardingSteps({ ...EMPTY_INPUT, goals: [makeGoal()] });
    expect(result.find((s) => s.id === "create-savings-goal")!.isComplete).toBe(true);
  });

  it("marks create-savings-goal incomplete when goals is empty", () => {
    const result = deriveOnboardingSteps(EMPTY_INPUT);
    expect(result.find((s) => s.id === "create-savings-goal")!.isComplete).toBe(false);
  });

  it("marks explore-learn complete when hasExploredLearnPage is true", () => {
    const result = deriveOnboardingSteps({ ...EMPTY_INPUT, hasExploredLearnPage: true });
    expect(result.find((s) => s.id === "explore-learn")!.isComplete).toBe(true);
  });

  it("marks explore-learn incomplete when hasExploredLearnPage is false", () => {
    const result = deriveOnboardingSteps(EMPTY_INPUT);
    expect(result.find((s) => s.id === "explore-learn")!.isComplete).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// firstTransactionHref branching
// ---------------------------------------------------------------------------

describe("deriveOnboardingSteps — add-first-transaction href", () => {
  it("links to the first account's page when an account exists", () => {
    const result = deriveOnboardingSteps({ ...EMPTY_INPUT, accounts: [makeAccount("account-42")] });
    expect(result.find((s) => s.id === "add-first-transaction")!.href).toBe("/account/account-42");
  });

  it("links to the open-account section hash when no accounts exist", () => {
    const result = deriveOnboardingSteps(EMPTY_INPUT);
    expect(result.find((s) => s.id === "add-first-transaction")!.href).toBe(
      "#open-account-section"
    );
  });

  it("uses the first account's id even when multiple accounts are present", () => {
    const result = deriveOnboardingSteps({
      ...EMPTY_INPUT,
      accounts: [makeAccount("first-id"), makeAccount("second-id")],
    });
    expect(result.find((s) => s.id === "add-first-transaction")!.href).toBe("/account/first-id");
  });
});

// ---------------------------------------------------------------------------
// End-to-end: all steps incomplete vs. all complete
// ---------------------------------------------------------------------------

describe("deriveOnboardingSteps — all-incomplete / all-complete", () => {
  it("returns only profile-setup as complete when all inputs are empty", () => {
    const result = deriveOnboardingSteps(EMPTY_INPUT);
    const completedIds = result.filter((s) => s.isComplete).map((s) => s.id);
    expect(completedIds).toEqual(["profile-setup"]);
  });

  it("returns all 6 steps as complete when all conditions are satisfied", () => {
    const result = deriveOnboardingSteps({
      accounts: [makeAccount()],
      budgets: [makeBudget()],
      goals: [makeGoal()],
      monthlySummary: makeSummary(1000, 500),
      hasExploredLearnPage: true,
    });
    expect(result.every((s) => s.isComplete)).toBe(true);
  });
});
