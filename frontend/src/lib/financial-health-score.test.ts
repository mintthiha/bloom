import { describe, expect, it } from "vitest";
import { computeHealthScore, HealthScoreInputs } from "./financial-health-score";
import type { Account, Budget, NetWorthSnapshot } from "./api";

/** Builds a HealthScoreInputs with all-neutral defaults so individual tests can vary one dimension at a time. */
function makeInputs(overrides: Partial<HealthScoreInputs> = {}): HealthScoreInputs {
  return {
    accounts: [],
    budgets: [],
    monthlySummary: {
      month: "2026-05",
      income: 0,
      spending: 0,
      netCashFlow: 0,
      topExpenseCategory: null,
      categories: [],
    },
    netWorthHistory: [],
    ...overrides,
  };
}

/** Creates an Account fixture with the given type and balance. */
function makeAccount(
  accountType: Account["accountType"],
  balance: number,
  id = "a-1"
): Account {
  return {
    id,
    ownerName: "Test User",
    nickname: null,
    accountType,
    balance,
    frozen: false,
    isLinked: false,
    plaidAccountId: null,
    plaidItemId: null,
    institutionName: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

/** Creates a Budget fixture where isOverBudget is derived from the amounts. */
function makeBudget(monthlyLimit: number, currentSpending: number, id = "b-1"): Budget {
  return {
    id,
    userId: "u-1",
    category: "Test",
    monthlyLimit,
    currentSpending,
    remaining: monthlyLimit - currentSpending,
    percentageUsed: monthlyLimit > 0 ? (currentSpending / monthlyLimit) * 100 : 0,
    isOverBudget: currentSpending > monthlyLimit,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

/** Creates a NetWorthSnapshot fixture. */
function makeSnapshot(netWorth: number, id = "s-1"): NetWorthSnapshot {
  return {
    id,
    month: "2026-05",
    netWorth,
    totalAssets: Math.max(netWorth, 0),
    totalDebt: Math.max(-netWorth, 0),
  };
}

// ---------------------------------------------------------------------------
// Savings Rate sub-score
// ---------------------------------------------------------------------------

describe("computeHealthScore — savings rate sub-score", () => {
  it("returns score 10 (neutral) when income is zero", () => {
    const result = computeHealthScore(makeInputs());
    const sub = result.subScores.find((s) => s.id === "savings_rate")!;
    expect(sub.score).toBe(10);
    expect(sub.tip).not.toBeNull();
  });

  it("returns score 0 when spending exceeds income (negative savings rate)", () => {
    const result = computeHealthScore(
      makeInputs({
        monthlySummary: { month: "2026-05", income: 1000, spending: 1100, netCashFlow: -100, topExpenseCategory: null, categories: [] },
      })
    );
    expect(result.subScores.find((s) => s.id === "savings_rate")!.score).toBe(0);
  });

  it("returns score 2 when savings rate is above 0% but below 5%", () => {
    // rate = 10 / 1000 = 1%
    const result = computeHealthScore(
      makeInputs({
        monthlySummary: { month: "2026-05", income: 1000, spending: 990, netCashFlow: 10, topExpenseCategory: null, categories: [] },
      })
    );
    expect(result.subScores.find((s) => s.id === "savings_rate")!.score).toBe(2);
  });

  it("returns score 6 when savings rate is exactly 5%", () => {
    const result = computeHealthScore(
      makeInputs({
        monthlySummary: { month: "2026-05", income: 1000, spending: 950, netCashFlow: 50, topExpenseCategory: null, categories: [] },
      })
    );
    expect(result.subScores.find((s) => s.id === "savings_rate")!.score).toBe(6);
  });

  it("returns score 12 when savings rate is exactly 10%", () => {
    const result = computeHealthScore(
      makeInputs({
        monthlySummary: { month: "2026-05", income: 1000, spending: 900, netCashFlow: 100, topExpenseCategory: null, categories: [] },
      })
    );
    expect(result.subScores.find((s) => s.id === "savings_rate")!.score).toBe(12);
  });

  it("returns score 16 when savings rate is exactly 15%", () => {
    const result = computeHealthScore(
      makeInputs({
        monthlySummary: { month: "2026-05", income: 1000, spending: 850, netCashFlow: 150, topExpenseCategory: null, categories: [] },
      })
    );
    expect(result.subScores.find((s) => s.id === "savings_rate")!.score).toBe(16);
  });

  it("returns score 20 and null tip when savings rate is exactly 20%", () => {
    const result = computeHealthScore(
      makeInputs({
        monthlySummary: { month: "2026-05", income: 1000, spending: 800, netCashFlow: 200, topExpenseCategory: null, categories: [] },
      })
    );
    const sub = result.subScores.find((s) => s.id === "savings_rate")!;
    expect(sub.score).toBe(20);
    expect(sub.tip).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Budget Adherence sub-score
// ---------------------------------------------------------------------------

describe("computeHealthScore — budget adherence sub-score", () => {
  it("returns score 8 (neutral) when no budgets exist", () => {
    const result = computeHealthScore(makeInputs({ budgets: [] }));
    const sub = result.subScores.find((s) => s.id === "budget_adherence")!;
    expect(sub.score).toBe(8);
    expect(sub.tip).not.toBeNull();
  });

  it("returns score 20 and null tip when all budgets are within limit", () => {
    const result = computeHealthScore(
      makeInputs({ budgets: [makeBudget(300, 200, "b-1"), makeBudget(200, 100, "b-2")] })
    );
    const sub = result.subScores.find((s) => s.id === "budget_adherence")!;
    expect(sub.score).toBe(20);
    expect(sub.tip).toBeNull();
  });

  it("returns score 15 when 3 of 4 budgets are within limit (75% adherence)", () => {
    const result = computeHealthScore(
      makeInputs({
        budgets: [
          makeBudget(100, 50, "b-1"),
          makeBudget(100, 50, "b-2"),
          makeBudget(100, 50, "b-3"),
          makeBudget(100, 150, "b-4"), // over
        ],
      })
    );
    expect(result.subScores.find((s) => s.id === "budget_adherence")!.score).toBe(15);
  });

  it("returns score 10 when 2 of 4 budgets are within limit (50% adherence)", () => {
    const result = computeHealthScore(
      makeInputs({
        budgets: [
          makeBudget(100, 50, "b-1"),
          makeBudget(100, 50, "b-2"),
          makeBudget(100, 150, "b-3"),
          makeBudget(100, 150, "b-4"),
        ],
      })
    );
    expect(result.subScores.find((s) => s.id === "budget_adherence")!.score).toBe(10);
  });

  it("returns score 5 when 1 of 4 budgets are within limit (25% adherence)", () => {
    const result = computeHealthScore(
      makeInputs({
        budgets: [
          makeBudget(100, 50, "b-1"),
          makeBudget(100, 150, "b-2"),
          makeBudget(100, 150, "b-3"),
          makeBudget(100, 150, "b-4"),
        ],
      })
    );
    expect(result.subScores.find((s) => s.id === "budget_adherence")!.score).toBe(5);
  });

  it("returns score 0 when all budgets are over limit", () => {
    const result = computeHealthScore(
      makeInputs({ budgets: [makeBudget(100, 150, "b-1"), makeBudget(100, 200, "b-2")] })
    );
    expect(result.subScores.find((s) => s.id === "budget_adherence")!.score).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Debt Ratio sub-score
// ---------------------------------------------------------------------------

describe("computeHealthScore — debt ratio sub-score", () => {
  it("returns score 20 and null tip when there is no credit debt", () => {
    const result = computeHealthScore(makeInputs({ accounts: [makeAccount("CHEQUING", 1000)] }));
    const sub = result.subScores.find((s) => s.id === "debt_ratio")!;
    expect(sub.score).toBe(20);
    expect(sub.tip).toBeNull();
  });

  it("returns score 0 when credit debt exists but there are no cash assets", () => {
    // Only a CREDIT account — cashBalance is 0
    const result = computeHealthScore(makeInputs({ accounts: [makeAccount("CREDIT", 500)] }));
    expect(result.subScores.find((s) => s.id === "debt_ratio")!.score).toBe(0);
  });

  it("returns score 18 when credit balance is below 5% of cash assets (ratio < 0.05)", () => {
    // credit=40, cash=1000, ratio=0.04
    const result = computeHealthScore(
      makeInputs({ accounts: [makeAccount("CHEQUING", 1000, "a-1"), makeAccount("CREDIT", 40, "a-2")] })
    );
    expect(result.subScores.find((s) => s.id === "debt_ratio")!.score).toBe(18);
  });

  it("returns score 14 when credit balance is 10% of cash assets (0.05 <= ratio < 0.15)", () => {
    const result = computeHealthScore(
      makeInputs({ accounts: [makeAccount("CHEQUING", 1000, "a-1"), makeAccount("CREDIT", 100, "a-2")] })
    );
    expect(result.subScores.find((s) => s.id === "debt_ratio")!.score).toBe(14);
  });

  it("returns score 10 when credit balance is 20% of cash assets (0.15 <= ratio < 0.3)", () => {
    const result = computeHealthScore(
      makeInputs({ accounts: [makeAccount("CHEQUING", 1000, "a-1"), makeAccount("CREDIT", 200, "a-2")] })
    );
    expect(result.subScores.find((s) => s.id === "debt_ratio")!.score).toBe(10);
  });

  it("returns score 5 when credit balance is 40% of cash assets (0.3 <= ratio < 0.5)", () => {
    const result = computeHealthScore(
      makeInputs({ accounts: [makeAccount("CHEQUING", 1000, "a-1"), makeAccount("CREDIT", 400, "a-2")] })
    );
    expect(result.subScores.find((s) => s.id === "debt_ratio")!.score).toBe(5);
  });

  it("returns score 2 when credit balance is 60% of cash assets (0.5 <= ratio < 1.0)", () => {
    const result = computeHealthScore(
      makeInputs({ accounts: [makeAccount("CHEQUING", 1000, "a-1"), makeAccount("CREDIT", 600, "a-2")] })
    );
    expect(result.subScores.find((s) => s.id === "debt_ratio")!.score).toBe(2);
  });

  it("returns score 0 when credit balance equals or exceeds cash assets (ratio >= 1.0)", () => {
    const result = computeHealthScore(
      makeInputs({ accounts: [makeAccount("CHEQUING", 1000, "a-1"), makeAccount("CREDIT", 1000, "a-2")] })
    );
    expect(result.subScores.find((s) => s.id === "debt_ratio")!.score).toBe(0);
  });

  it("treats TFSA and RRSP balances as cash assets when computing the debt ratio", () => {
    // 10000 in registered accounts is cash; 100 credit → ratio=0.01 → score 18
    const result = computeHealthScore(
      makeInputs({
        accounts: [
          makeAccount("TFSA", 5000, "a-1"),
          makeAccount("RRSP", 5000, "a-2"),
          makeAccount("CREDIT", 100, "a-3"),
        ],
      })
    );
    expect(result.subScores.find((s) => s.id === "debt_ratio")!.score).toBe(18);
  });
});

// ---------------------------------------------------------------------------
// Emergency Coverage sub-score
// ---------------------------------------------------------------------------

describe("computeHealthScore — emergency coverage sub-score", () => {
  it("returns score 10 (neutral) when monthly spending is zero", () => {
    const result = computeHealthScore(makeInputs());
    expect(result.subScores.find((s) => s.id === "emergency_coverage")!.score).toBe(10);
  });

  it("returns score 0 when liquid savings cover less than 1 month of expenses", () => {
    // liquid=500, spending=1000 → 0.5 months
    const result = computeHealthScore(
      makeInputs({
        accounts: [makeAccount("CHEQUING", 500)],
        monthlySummary: { month: "2026-05", income: 0, spending: 1000, netCashFlow: -1000, topExpenseCategory: null, categories: [] },
      })
    );
    expect(result.subScores.find((s) => s.id === "emergency_coverage")!.score).toBe(0);
  });

  it("returns score 6 when liquid savings cover exactly 1 month", () => {
    const result = computeHealthScore(
      makeInputs({
        accounts: [makeAccount("CHEQUING", 1000)],
        monthlySummary: { month: "2026-05", income: 0, spending: 1000, netCashFlow: -1000, topExpenseCategory: null, categories: [] },
      })
    );
    expect(result.subScores.find((s) => s.id === "emergency_coverage")!.score).toBe(6);
  });

  it("returns score 10 when liquid savings cover exactly 2 months", () => {
    const result = computeHealthScore(
      makeInputs({
        accounts: [makeAccount("CHEQUING", 2000)],
        monthlySummary: { month: "2026-05", income: 0, spending: 1000, netCashFlow: -1000, topExpenseCategory: null, categories: [] },
      })
    );
    expect(result.subScores.find((s) => s.id === "emergency_coverage")!.score).toBe(10);
  });

  it("returns score 15 when liquid savings cover exactly 3 months", () => {
    const result = computeHealthScore(
      makeInputs({
        accounts: [makeAccount("SAVINGS", 3000)],
        monthlySummary: { month: "2026-05", income: 0, spending: 1000, netCashFlow: -1000, topExpenseCategory: null, categories: [] },
      })
    );
    expect(result.subScores.find((s) => s.id === "emergency_coverage")!.score).toBe(15);
  });

  it("returns score 20 and null tip when liquid savings cover 6 or more months", () => {
    const result = computeHealthScore(
      makeInputs({
        accounts: [makeAccount("SAVINGS", 6000)],
        monthlySummary: { month: "2026-05", income: 0, spending: 1000, netCashFlow: -1000, topExpenseCategory: null, categories: [] },
      })
    );
    const sub = result.subScores.find((s) => s.id === "emergency_coverage")!;
    expect(sub.score).toBe(20);
    expect(sub.tip).toBeNull();
  });

  it("does not count registered accounts (TFSA, RRSP) as liquid for emergency coverage", () => {
    // TFSA is not liquid — only CHEQUING and SAVINGS count
    const result = computeHealthScore(
      makeInputs({
        accounts: [
          makeAccount("TFSA", 10000, "a-1"),  // not liquid
          makeAccount("CHEQUING", 500, "a-2"), // liquid
        ],
        monthlySummary: { month: "2026-05", income: 0, spending: 1000, netCashFlow: -1000, topExpenseCategory: null, categories: [] },
      })
    );
    // liquidBalance=500, spending=1000 → 0.5 months → score 0
    expect(result.subScores.find((s) => s.id === "emergency_coverage")!.score).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Net Worth Trend sub-score
// ---------------------------------------------------------------------------

describe("computeHealthScore — net worth trend sub-score", () => {
  it("returns score 10 (neutral) with no history snapshots", () => {
    const result = computeHealthScore(makeInputs({ netWorthHistory: [] }));
    expect(result.subScores.find((s) => s.id === "net_worth_trend")!.score).toBe(10);
  });

  it("returns score 10 (neutral) with exactly one snapshot", () => {
    const result = computeHealthScore(makeInputs({ netWorthHistory: [makeSnapshot(1000)] }));
    expect(result.subScores.find((s) => s.id === "net_worth_trend")!.score).toBe(10);
  });

  it("returns score 20 and null tip when net worth is positive and growing by more than $50", () => {
    const result = computeHealthScore(
      makeInputs({ netWorthHistory: [makeSnapshot(500, "s-1"), makeSnapshot(600, "s-2")] })
    );
    const sub = result.subScores.find((s) => s.id === "net_worth_trend")!;
    expect(sub.score).toBe(20);
    expect(sub.tip).toBeNull();
  });

  it("returns score 14 when net worth is negative but improving by more than $50", () => {
    // trend = -400 - (-500) = +100, latest.netWorth = -400 (still negative)
    const result = computeHealthScore(
      makeInputs({ netWorthHistory: [makeSnapshot(-500, "s-1"), makeSnapshot(-400, "s-2")] })
    );
    expect(result.subScores.find((s) => s.id === "net_worth_trend")!.score).toBe(14);
  });

  it("returns score 12 when net worth is positive and flat (change within ±$50)", () => {
    const result = computeHealthScore(
      makeInputs({ netWorthHistory: [makeSnapshot(1000, "s-1"), makeSnapshot(1020, "s-2")] })
    );
    expect(result.subScores.find((s) => s.id === "net_worth_trend")!.score).toBe(12);
  });

  it("returns score 6 when net worth is negative and flat", () => {
    // trend = -1020 - (-1000) = -20, |trend|<=50, net worth negative
    const result = computeHealthScore(
      makeInputs({ netWorthHistory: [makeSnapshot(-1000, "s-1"), makeSnapshot(-1020, "s-2")] })
    );
    expect(result.subScores.find((s) => s.id === "net_worth_trend")!.score).toBe(6);
  });

  it("returns score 5 when net worth is positive but declining by more than $50", () => {
    // trend = 900 - 1000 = -100, net worth still positive
    const result = computeHealthScore(
      makeInputs({ netWorthHistory: [makeSnapshot(1000, "s-1"), makeSnapshot(900, "s-2")] })
    );
    expect(result.subScores.find((s) => s.id === "net_worth_trend")!.score).toBe(5);
  });

  it("returns score 0 when net worth is negative and declining by more than $50", () => {
    const result = computeHealthScore(
      makeInputs({ netWorthHistory: [makeSnapshot(-500, "s-1"), makeSnapshot(-600, "s-2")] })
    );
    expect(result.subScores.find((s) => s.id === "net_worth_trend")!.score).toBe(0);
  });

  it("evaluates only the two most recent snapshots when history is longer", () => {
    // Latest two: 5000 → 5100 (positive, growing > $50) → score 20
    const result = computeHealthScore(
      makeInputs({
        netWorthHistory: [
          makeSnapshot(0, "s-1"),
          makeSnapshot(1000, "s-2"),
          makeSnapshot(5000, "s-3"),
          makeSnapshot(5100, "s-4"),
        ],
      })
    );
    expect(result.subScores.find((s) => s.id === "net_worth_trend")!.score).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// Grade boundaries
// ---------------------------------------------------------------------------

describe("computeHealthScore — grade boundaries", () => {
  it("returns grade F (Critical) when total is 0", () => {
    // savings=0 (negative cashflow), budgets=0 (all over), debt=0 (no cash + credit), emergency=0, trend=0
    const result = computeHealthScore(
      makeInputs({
        accounts: [makeAccount("CREDIT", 500)],
        budgets: [makeBudget(100, 200, "b-1"), makeBudget(100, 200, "b-2")],
        monthlySummary: { month: "2026-05", income: 1000, spending: 1100, netCashFlow: -100, topExpenseCategory: null, categories: [] },
        netWorthHistory: [makeSnapshot(-1000, "s-1"), makeSnapshot(-1100, "s-2")],
      })
    );
    expect(result.total).toBe(0);
    expect(result.grade).toBe("F");
    expect(result.label).toBe("Critical");
  });

  it("returns grade D (Needs Work) when total is between 35 and 49", () => {
    // savings=10 (no income, neutral), budgets=8 (none, neutral), debt=20 (no credit), emergency=0 (liquid=0, spending>0), trend=0 (negative, declining)
    // total = 10+8+20+0+0 = 38
    const result = computeHealthScore(
      makeInputs({
        monthlySummary: { month: "2026-05", income: 0, spending: 1000, netCashFlow: -1000, topExpenseCategory: null, categories: [] },
        netWorthHistory: [makeSnapshot(-1000, "s-1"), makeSnapshot(-1100, "s-2")],
      })
    );
    expect(result.grade).toBe("D");
    expect(result.label).toBe("Needs Work");
  });

  it("returns grade C (Fair) when total is between 50 and 69", () => {
    // savings=20 (rate=20%), budgets=8 (none), debt=20 (no credit), emergency=0 (no liquid, spending>0), trend=10 (neutral, no history)
    // total = 20+8+20+0+10 = 58
    const result = computeHealthScore(
      makeInputs({
        monthlySummary: { month: "2026-05", income: 1000, spending: 800, netCashFlow: 200, topExpenseCategory: null, categories: [] },
      })
    );
    expect(result.grade).toBe("C");
    expect(result.label).toBe("Fair");
  });

  it("returns grade B (Good) when total is between 70 and 84", () => {
    // savings=20, budgets=20 (1 budget, all within), debt=20 (no credit), emergency=0 (no liquid, spending>0), trend=10 (neutral)
    // total = 20+20+20+0+10 = 70
    const result = computeHealthScore(
      makeInputs({
        budgets: [makeBudget(200, 100)],
        monthlySummary: { month: "2026-05", income: 1000, spending: 800, netCashFlow: 200, topExpenseCategory: null, categories: [] },
      })
    );
    expect(result.grade).toBe("B");
    expect(result.label).toBe("Good");
  });

  it("returns grade A (Excellent) and total 100 in a perfect scenario", () => {
    // savings=20 (rate=20%), budgets=20 (all within), debt=20 (no credit), emergency=20 (6 months covered), trend=20 (positive, growing)
    // liquid=3000, spending=500 → 6 months exactly
    const result = computeHealthScore(
      makeInputs({
        accounts: [makeAccount("CHEQUING", 3000)],
        budgets: [makeBudget(200, 100)],
        monthlySummary: { month: "2026-05", income: 1000, spending: 500, netCashFlow: 200, topExpenseCategory: null, categories: [] },
        netWorthHistory: [makeSnapshot(1000, "s-1"), makeSnapshot(1100, "s-2")],
      })
    );
    expect(result.total).toBe(100);
    expect(result.grade).toBe("A");
    expect(result.label).toBe("Excellent");
  });
});

// ---------------------------------------------------------------------------
// Overall structure
// ---------------------------------------------------------------------------

describe("computeHealthScore — structure invariants", () => {
  it("total always equals the sum of the five sub-scores", () => {
    const result = computeHealthScore(makeInputs());
    const sumFromSubScores = result.subScores.reduce((acc, s) => acc + s.score, 0);
    expect(result.total).toBe(sumFromSubScores);
  });

  it("returns exactly five sub-scores in the expected order", () => {
    const result = computeHealthScore(makeInputs());
    expect(result.subScores.map((s) => s.id)).toEqual([
      "savings_rate",
      "budget_adherence",
      "debt_ratio",
      "emergency_coverage",
      "net_worth_trend",
    ]);
  });

  it("each sub-score has a non-empty label and status", () => {
    const result = computeHealthScore(makeInputs());
    for (const sub of result.subScores) {
      expect(sub.label.length).toBeGreaterThan(0);
      expect(sub.status.length).toBeGreaterThan(0);
    }
  });
});
