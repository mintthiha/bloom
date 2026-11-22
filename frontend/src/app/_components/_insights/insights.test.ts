import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateInsights } from "./insights";
import type { Budget, MonthlySummary, RecurringTransaction } from "@/lib/api";

// Pin the clock to 2026-05-15 so daysLeftInMonth (= 31 - 15 = 16) is stable
// and overdue-date comparisons are deterministic.
const FIXED_NOW = new Date("2026-05-15T12:00:00.000Z");

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
    month: "2026-01",
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

/** Creates an active RecurringTransaction fixture with a given nextRunAt date string. */
function makeRule(nextRunAt: string, active = true, id = "r-1"): RecurringTransaction {
  return {
    id,
    userId: "u-1",
    accountId: "a-1",
    name: "Rent",
    type: "WITHDRAWAL",
    amount: 1000,
    category: "Rent",
    merchant: null,
    description: null,
    frequency: "MONTHLY",
    startDate: "2026-01-01T00:00:00.000Z",
    endDate: null,
    nextRunAt,
    lastRunAt: null,
    active,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    accountOwnerName: "Test",
    accountNickname: null,
    accountType: "CHEQUING",
  };
}

const EMPTY_INPUT = {
  budgets: [] as Budget[],
  monthlySummary: makeSummary(0, 0),
  recurringRules: [] as RecurringTransaction[],
};

// ---------------------------------------------------------------------------
// Empty inputs
// ---------------------------------------------------------------------------

describe("generateInsights — empty inputs", () => {
  it("returns no insights when there is no actionable data", () => {
    expect(generateInsights(EMPTY_INPUT)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Rule 1: over-budget categories
// ---------------------------------------------------------------------------

describe("generateInsights — Rule 1: over-budget", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("produces a warning insight when at least one budget is over its limit", () => {
    const result = generateInsights({
      ...EMPTY_INPUT,
      budgets: [makeBudget("Dining", 300, 400)],
    });

    expect(result[0]).toMatchObject({ id: "over-budget", severity: "warning" });
    expect(result[0].message).toContain("Dining");
  });

  it("selects the category with the largest absolute overage as the worst", () => {
    const result = generateInsights({
      ...EMPTY_INPUT,
      budgets: [
        makeBudget("Dining", 300, 350, "b-1"), // overage 50
        makeBudget("Entertainment", 200, 400, "b-2"), // overage 200 — worst
      ],
    });

    expect(result[0].message).toContain("Entertainment");
    expect(result[0].message).not.toContain("Dining");
  });

  it("mentions the number of other over-budget categories in the detail when multiple are over", () => {
    const result = generateInsights({
      ...EMPTY_INPUT,
      budgets: [
        makeBudget("Dining", 300, 400, "b-1"),
        makeBudget("Groceries", 200, 300, "b-2"),
        makeBudget("Entertainment", 100, 200, "b-3"),
      ],
    });

    expect(result[0].detail).toContain("2 other");
  });

  it("does not mention other categories in the detail when only one is over", () => {
    const result = generateInsights({
      ...EMPTY_INPUT,
      budgets: [makeBudget("Dining", 300, 400)],
    });

    expect(result[0].detail).not.toContain("other");
  });

  it("does not produce an over-budget insight when all budgets are within limit", () => {
    const result = generateInsights({
      ...EMPTY_INPUT,
      budgets: [makeBudget("Dining", 300, 200)],
    });

    expect(result.find((i) => i.id === "over-budget")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Rule 2: overdue recurring transactions
// ---------------------------------------------------------------------------

describe("generateInsights — Rule 2: overdue recurring", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("produces a warning when an active rule's nextRunAt is before today", () => {
    const result = generateInsights({
      ...EMPTY_INPUT,
      recurringRules: [makeRule("2026-05-14T00:00:00.000Z")],
    });

    expect(result[0]).toMatchObject({ id: "overdue-recurring", severity: "warning" });
  });

  it("does not flag a rule whose nextRunAt is today", () => {
    // nextRunAt = today → not strictly less than today
    const result = generateInsights({
      ...EMPTY_INPUT,
      recurringRules: [makeRule("2026-05-15T00:00:00.000Z")],
    });

    expect(result.find((i) => i.id === "overdue-recurring")).toBeUndefined();
  });

  it("does not flag inactive rules", () => {
    const result = generateInsights({
      ...EMPTY_INPUT,
      recurringRules: [makeRule("2026-05-10T00:00:00.000Z", false)],
    });

    expect(result.find((i) => i.id === "overdue-recurring")).toBeUndefined();
  });

  it("includes the total count of overdue rules in the message", () => {
    const result = generateInsights({
      ...EMPTY_INPUT,
      recurringRules: [
        makeRule("2026-05-01T00:00:00.000Z", true, "r-1"),
        makeRule("2026-05-10T00:00:00.000Z", true, "r-2"),
      ],
    });

    expect(result[0].message).toContain("2");
  });
});

// ---------------------------------------------------------------------------
// Rule 3: low savings rate
// ---------------------------------------------------------------------------

describe("generateInsights — Rule 3: low savings rate", () => {
  it("produces a warning when savings rate is below 10% and income is positive", () => {
    // rate = (1000 - 950) / 1000 = 5%
    const result = generateInsights({
      ...EMPTY_INPUT,
      monthlySummary: makeSummary(1000, 950),
    });

    expect(result.find((i) => i.id === "low-savings-rate")).toMatchObject({ severity: "warning" });
  });

  it("does not produce a low-savings-rate insight when income is zero", () => {
    const result = generateInsights({
      ...EMPTY_INPUT,
      monthlySummary: makeSummary(0, 500),
    });

    expect(result.find((i) => i.id === "low-savings-rate")).toBeUndefined();
  });

  it("does not produce a low-savings-rate insight when rate is exactly 10%", () => {
    // rate = 100 / 1000 = 10% — threshold is strictly less than 10%
    const result = generateInsights({
      ...EMPTY_INPUT,
      monthlySummary: makeSummary(1000, 900),
    });

    expect(result.find((i) => i.id === "low-savings-rate")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Rule 4: no budgets set
// ---------------------------------------------------------------------------

describe("generateInsights — Rule 4: no budgets set", () => {
  it("produces an info insight when no budgets are set but spending exists", () => {
    const result = generateInsights({
      ...EMPTY_INPUT,
      monthlySummary: makeSummary(0, 500),
    });

    expect(result.find((i) => i.id === "no-budgets")).toMatchObject({ severity: "info" });
  });

  it("does not produce a no-budgets insight when there is no spending to track", () => {
    const result = generateInsights({ ...EMPTY_INPUT });

    expect(result.find((i) => i.id === "no-budgets")).toBeUndefined();
  });

  it("does not produce a no-budgets insight when budgets are already configured", () => {
    const result = generateInsights({
      ...EMPTY_INPUT,
      budgets: [makeBudget("Dining", 300, 100)],
      monthlySummary: makeSummary(0, 400),
    });

    expect(result.find((i) => i.id === "no-budgets")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Rule 5: good savings rate (success, only when no warnings)
// ---------------------------------------------------------------------------

describe("generateInsights — Rule 5: good savings rate", () => {
  it("produces a success insight when savings rate is ≥20% and no warnings are present", () => {
    // income=1000 with no spending → 100% savings rate → Rule 5 fires
    const result = generateInsights({
      ...EMPTY_INPUT,
      monthlySummary: makeSummary(1000, 0),
    });

    expect(result.find((i) => i.id === "good-savings-rate")).toMatchObject({ severity: "success" });
  });

  it("suppresses the good-savings-rate success insight when any warning insight is present", () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    // Over-budget warning is present even though savings rate is 20%
    const result = generateInsights({
      ...EMPTY_INPUT,
      budgets: [makeBudget("Dining", 300, 400)],
      monthlySummary: makeSummary(1000, 800),
    });
    vi.useRealTimers();

    expect(result.find((i) => i.id === "good-savings-rate")).toBeUndefined();
    expect(result.some((i) => i.severity === "warning")).toBe(true);
  });

  it("does not produce a good-savings-rate insight when income is zero", () => {
    const result = generateInsights({
      ...EMPTY_INPUT,
      monthlySummary: makeSummary(0, 0),
    });

    expect(result.find((i) => i.id === "good-savings-rate")).toBeUndefined();
  });

  it("does not produce a good-savings-rate insight when savings rate is below 20%", () => {
    // rate = 150 / 1000 = 15%
    const result = generateInsights({
      ...EMPTY_INPUT,
      monthlySummary: makeSummary(1000, 850),
    });

    expect(result.find((i) => i.id === "good-savings-rate")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Priority order when several rules fire
// ---------------------------------------------------------------------------

describe("generateInsights — priority order", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("lists over-budget, then overdue recurring, then low savings rate", () => {
    // rate = (1000 - 950) / 1000 = 5% → low savings rate also fires
    const result = generateInsights({
      budgets: [makeBudget("Dining", 300, 400)],
      monthlySummary: makeSummary(1000, 950),
      recurringRules: [makeRule("2026-05-01T00:00:00.000Z")],
    });

    expect(result.map((i) => i.id)).toEqual([
      "over-budget",
      "overdue-recurring",
      "low-savings-rate",
    ]);
  });

  it("does not offer emergency-fund or idle-cash advice — the money ladder owns that", () => {
    const result = generateInsights({
      ...EMPTY_INPUT,
      monthlySummary: makeSummary(0, 1000),
    });

    expect(result.map((i) => i.id)).toEqual(["no-budgets"]);
  });
});
