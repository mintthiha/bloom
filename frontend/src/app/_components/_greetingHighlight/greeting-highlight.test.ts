import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatTimeToTarget,
  GreetingHighlightInput,
  selectGreetingHighlight,
} from "./greeting-highlight";
import type { Account, Budget, MonthlySummary, RecurringTransaction, SavingsGoal } from "@/lib/api";

// Pinned to 2026-05-15 so "days to go" (= 31 - 15 = 16) is stable across runs.
const FIXED_NOW = new Date("2026-05-15T12:00:00.000Z");

/** Creates an Account fixture. */
function makeAccount(accountType: Account["accountType"], balance: number, id = "a-1"): Account {
  return {
    id,
    ownerName: "Test",
    nickname: null,
    accountType,
    balance,
    frozen: false,
    isLinked: false,
    plaidAccountId: null,
    plaidItemId: null,
    institutionName: null,
    color: null,
    icon: null,
    createdAt: "",
    updatedAt: "",
  };
}

/** Creates a Budget fixture with isOverBudget derived from the amounts. */
function makeBudget(
  category: string,
  monthlyLimit: number,
  currentSpending: number,
  id = "b-1"
): Budget {
  return {
    id,
    userId: "u-1",
    category,
    monthlyLimit,
    rolloverEnabled: false,
    month: "2026-05",
    limit: monthlyLimit,
    carryIn: 0,
    adjustment: 0,
    available: monthlyLimit,
    currentSpending,
    remaining: monthlyLimit - currentSpending,
    carryOut: monthlyLimit - currentSpending,
    percentageUsed: monthlyLimit > 0 ? (currentSpending / monthlyLimit) * 100 : 0,
    isOverBudget: currentSpending > monthlyLimit,
    createdAt: "",
    updatedAt: "",
  };
}

/** Creates a MonthlySummary fixture; netCashFlow is derived so surplus projections are consistent. */
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

/** Creates a SavingsGoal fixture with percentageReached derived from the amounts. */
function makeGoal(
  name: string,
  targetAmount: number,
  currentBalance: number,
  id = "g-1"
): SavingsGoal {
  return {
    id,
    userId: "u-1",
    accountId: "a-1",
    name,
    targetAmount,
    currentBalance,
    accountName: "Savings",
    accountNickname: null,
    accountOwnerName: "Test",
    accountType: "SAVINGS",
    percentageReached: targetAmount > 0 ? (currentBalance / targetAmount) * 100 : 0,
    createdAt: "",
    updatedAt: "",
  };
}

/** Builds a minimal input where every rule is dormant, so each test enables only what it needs. */
function makeInput(overrides: Partial<GreetingHighlightInput> = {}): GreetingHighlightInput {
  return {
    accounts: [],
    budgets: [],
    goals: [],
    monthlySummary: makeSummary(0, 0),
    previousMonthlySummary: null,
    recurringRules: [] as RecurringTransaction[],
    primaryFinancialGoal: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("formatTimeToTarget", () => {
  it("returns null without a surplus to project from", () => {
    expect(formatTimeToTarget(500, 0)).toBeNull();
    expect(formatTimeToTarget(500, -100)).toBeNull();
  });

  it("returns null when nothing is remaining", () => {
    expect(formatTimeToTarget(0, 400)).toBeNull();
    expect(formatTimeToTarget(-50, 400)).toBeNull();
  });

  it("collapses a sub-week horizon into words", () => {
    expect(formatTimeToTarget(50, 1000)).toBe("less than a week");
  });

  it("reports weeks up to the 8-week boundary", () => {
    // 8 weeks of a $434.50/month surplus is ~$800.
    expect(formatTimeToTarget(800, 434.5)).toBe("8 weeks");
  });

  it("switches to months past 8 weeks", () => {
    expect(formatTimeToTarget(2000, 400)).toBe("about 5 months");
  });

  it("returns null when the horizon exceeds 18 months", () => {
    expect(formatTimeToTarget(20000, 400)).toBeNull();
  });
});

describe("selectGreetingHighlight", () => {
  it("returns null before the monthly summary has loaded", () => {
    expect(selectGreetingHighlight(makeInput({ monthlySummary: null }))).toBeNull();
  });

  it("returns null when there is no data for any rule", () => {
    expect(selectGreetingHighlight(makeInput())).toBeNull();
  });

  it("leads with the worst over-budget category and the days left in the month", () => {
    const highlight = selectGreetingHighlight(
      makeInput({
        budgets: [makeBudget("Groceries", 400, 445, "b-1"), makeBudget("Dining", 200, 320, "b-2")],
      })
    );

    expect(highlight).toEqual({
      id: "over-budget",
      tone: "warning",
      text: "You're $120 over on Dining this month, with 16 days to go.",
    });
  });

  it("celebrates the category with the most room left when nothing is over budget", () => {
    const highlight = selectGreetingHighlight(
      makeInput({
        primaryFinancialGoal: "TRACK_SPENDING",
        budgets: [makeBudget("Groceries", 400, 280, "b-1"), makeBudget("Dining", 200, 180, "b-2")],
      })
    );

    expect(highlight?.id).toBe("under-budget");
    expect(highlight?.tone).toBe("positive");
    expect(highlight?.text).toBe("You're $120 under on Groceries this month, with 16 days to go.");
  });

  it("ignores an untouched budget so a fresh limit is not reported as progress", () => {
    const highlight = selectGreetingHighlight(
      makeInput({
        primaryFinancialGoal: "TRACK_SPENDING",
        budgets: [makeBudget("Groceries", 400, 0)],
      })
    );

    expect(highlight).toBeNull();
  });

  it("projects the emergency fund as a countdown when there is a surplus", () => {
    const highlight = selectGreetingHighlight(
      makeInput({
        primaryFinancialGoal: "EMERGENCY_FUND",
        accounts: [makeAccount("SAVINGS", 2600)],
        monthlySummary: makeSummary(4000, 1000),
      })
    );

    // Target is 3 x $1,000 = $3,000, leaving $400 at a $3,000/month surplus.
    expect(highlight).toEqual({
      id: "emergency-fund",
      tone: "neutral",
      text: "Emergency fund is less than a week from full — $400 to go.",
    });
  });

  it("falls back to months of coverage when there is no surplus", () => {
    const highlight = selectGreetingHighlight(
      makeInput({
        primaryFinancialGoal: "EMERGENCY_FUND",
        accounts: [makeAccount("CHEQUING", 500)],
        monthlySummary: makeSummary(1000, 1000),
      })
    );

    expect(highlight?.id).toBe("emergency-fund");
    expect(highlight?.tone).toBe("warning");
    expect(highlight?.text).toBe(
      "Emergency fund covers 0.5 months — $2,500 short of a 3-month cushion."
    );
  });

  it("skips the emergency fund when the user has no cash account to hold one", () => {
    const highlight = selectGreetingHighlight(
      makeInput({
        primaryFinancialGoal: "EMERGENCY_FUND",
        accounts: [makeAccount("TFSA", 5000)],
        monthlySummary: makeSummary(0, 1000),
      })
    );

    expect(highlight?.id).not.toBe("emergency-fund");
  });

  it("reports a funded emergency fund positively", () => {
    const highlight = selectGreetingHighlight(
      makeInput({
        primaryFinancialGoal: "EMERGENCY_FUND",
        accounts: [makeAccount("SAVINGS", 4000)],
        monthlySummary: makeSummary(0, 1000),
      })
    );

    expect(highlight?.tone).toBe("positive");
    expect(highlight?.text).toBe(
      "Your emergency fund is full — $4,000 covers 4.0 months of expenses."
    );
  });

  it("prefers last month's spending as the emergency-fund reference", () => {
    const highlight = selectGreetingHighlight(
      makeInput({
        primaryFinancialGoal: "EMERGENCY_FUND",
        accounts: [makeAccount("SAVINGS", 3000)],
        monthlySummary: makeSummary(0, 100),
        previousMonthlySummary: makeSummary(0, 2000),
      })
    );

    // $3,000 against a $6,000 target derived from last month's $2,000 of spending.
    expect(highlight?.text).toBe(
      "Emergency fund covers 1.5 months — $3,000 short of a 3-month cushion."
    );
  });

  it("picks the savings goal closest to done for a big-purchase user", () => {
    const highlight = selectGreetingHighlight(
      makeInput({
        primaryFinancialGoal: "BIG_PURCHASE",
        goals: [makeGoal("Car", 10000, 1000, "g-1"), makeGoal("Japan trip", 4000, 3600, "g-2")],
        monthlySummary: makeSummary(1000, 1000),
      })
    );

    expect(highlight?.id).toBe("savings-goal");
    expect(highlight?.text).toBe("Japan trip is 90% funded — $400 to go.");
  });

  it("projects weeks to a savings goal when there is a surplus", () => {
    const highlight = selectGreetingHighlight(
      makeInput({
        primaryFinancialGoal: "BIG_PURCHASE",
        goals: [makeGoal("Japan trip", 4000, 3600)],
        monthlySummary: makeSummary(1400, 1000),
      })
    );

    // $400 remaining at a $400/month surplus lands at ~5 weeks.
    expect(highlight?.text).toBe("Japan trip is 5 weeks from full — $400 to go.");
  });

  it("reports every goal being funded", () => {
    const highlight = selectGreetingHighlight(
      makeInput({
        primaryFinancialGoal: "BIG_PURCHASE",
        goals: [makeGoal("Car", 10000, 10000, "g-1"), makeGoal("Japan trip", 4000, 4200, "g-2")],
      })
    );

    expect(highlight).toEqual({
      id: "savings-goal",
      tone: "positive",
      text: "All 2 of your savings goals are fully funded.",
    });
  });

  it("names the single funded goal rather than counting it", () => {
    const highlight = selectGreetingHighlight(
      makeInput({
        primaryFinancialGoal: "BIG_PURCHASE",
        goals: [makeGoal("Japan trip", 4000, 4000)],
      })
    );

    expect(highlight?.text).toBe("Japan trip is fully funded.");
  });

  it("projects a credit payoff for a debt-focused user", () => {
    const highlight = selectGreetingHighlight(
      makeInput({
        primaryFinancialGoal: "PAY_OFF_DEBT",
        accounts: [makeAccount("CREDIT", 1200)],
        monthlySummary: makeSummary(3000, 2600),
      })
    );

    expect(highlight?.id).toBe("credit-payoff");
    expect(highlight?.text).toBe(
      "You're about 3 months from clearing $1,200 of credit debt at this month's pace."
    );
  });

  it("warns a debt-focused user when the month left no surplus", () => {
    const highlight = selectGreetingHighlight(
      makeInput({
        primaryFinancialGoal: "PAY_OFF_DEBT",
        accounts: [makeAccount("CREDIT", 1200)],
        monthlySummary: makeSummary(2000, 2000),
      })
    );

    expect(highlight?.tone).toBe("warning");
    expect(highlight?.text).toBe(
      "You owe $1,200 on credit, and this month hasn't left a surplus to pay it down."
    );
  });

  it("compares spending with last month when no budget or goal rule applies", () => {
    const highlight = selectGreetingHighlight(
      makeInput({
        monthlySummary: makeSummary(0, 800),
        previousMonthlySummary: makeSummary(0, 1000),
      })
    );

    expect(highlight).toEqual({
      id: "spending-pace",
      tone: "positive",
      text: "You've spent $800 this month — $200 less than last month.",
    });
  });

  it("flags spending that rose against last month", () => {
    const highlight = selectGreetingHighlight(
      makeInput({
        primaryFinancialGoal: "TRACK_SPENDING",
        monthlySummary: makeSummary(0, 1300),
        previousMonthlySummary: makeSummary(0, 1000),
      })
    );

    expect(highlight?.tone).toBe("warning");
    expect(highlight?.text).toBe("You've spent $1,300 this month — $300 more than last month.");
  });

  it("treats a change under 5% as flat rather than a swing", () => {
    const highlight = selectGreetingHighlight(
      makeInput({
        primaryFinancialGoal: "TRACK_SPENDING",
        monthlySummary: makeSummary(0, 1020),
        previousMonthlySummary: makeSummary(0, 1000),
      })
    );

    expect(highlight?.tone).toBe("neutral");
    expect(highlight?.text).toBe("You've spent $1,020 this month — right in line with last month.");
  });

  it("ranks the same data differently for two different primary goals", () => {
    const sharedData = {
      accounts: [makeAccount("SAVINGS", 500, "a-1"), makeAccount("CREDIT", 1200, "a-2")],
      budgets: [makeBudget("Groceries", 400, 280)],
      monthlySummary: makeSummary(3000, 1000),
    };

    expect(
      selectGreetingHighlight(makeInput({ ...sharedData, primaryFinancialGoal: "EMERGENCY_FUND" }))
        ?.id
    ).toBe("emergency-fund");
    expect(
      selectGreetingHighlight(makeInput({ ...sharedData, primaryFinancialGoal: "PAY_OFF_DEBT" }))
        ?.id
    ).toBe("credit-payoff");
    expect(
      selectGreetingHighlight(makeInput({ ...sharedData, primaryFinancialGoal: "TRACK_SPENDING" }))
        ?.id
    ).toBe("under-budget");
  });

  it("falls back to the top dashboard insight when no goal-specific rule has data", () => {
    const highlight = selectGreetingHighlight(
      makeInput({
        accounts: [makeAccount("CHEQUING", 5000, "a-1"), makeAccount("TFSA", 0, "a-2")],
        monthlySummary: makeSummary(0, 0),
      })
    );

    expect(highlight).toEqual({
      id: "top-insight",
      tone: "neutral",
      text: "$5,000 sitting in chequing.",
    });
  });

  it("uses the injected clock for the days-left wording", () => {
    const highlight = selectGreetingHighlight(
      makeInput({
        budgets: [makeBudget("Groceries", 400, 500)],
        now: new Date("2026-05-30T12:00:00.000Z"),
      })
    );

    expect(highlight?.text).toBe("You're $100 over on Groceries this month, with 1 day to go.");
  });
});
