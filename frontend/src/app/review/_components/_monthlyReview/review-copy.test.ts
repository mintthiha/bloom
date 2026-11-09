import { describe, expect, it } from "vitest";
import {
  describeBudgetResults,
  describeCarryOut,
  describeGoalProgress,
  describeSavingsRate,
  describeSpendingChange,
  describeStreak,
  formatPercent,
} from "./review-copy";

const money = (amount: number) => `$${amount.toFixed(2)}`;

describe("formatPercent", () => {
  it("rounds to a whole, unsigned percent", () => {
    expect(formatPercent(0.204)).toBe("20%");
    expect(formatPercent(-0.156)).toBe("16%");
  });
});

describe("describeSpendingChange", () => {
  it("is null with nothing to compare", () => {
    expect(describeSpendingChange(null, "September")).toBeNull();
  });

  it("calls a small change 'about the same'", () => {
    expect(describeSpendingChange(0.04, "September")).toBe("About the same as September");
    expect(describeSpendingChange(-0.049, "September")).toBe("About the same as September");
  });

  it("says more or less beyond the threshold", () => {
    expect(describeSpendingChange(0.05, "September")).toBe("5% more than September");
    expect(describeSpendingChange(-0.2, "September")).toBe("20% less than September");
  });
});

describe("describeSavingsRate", () => {
  it("covers no income, saving, and overspending", () => {
    expect(describeSavingsRate(null)).toBe("No income was recorded this month.");
    expect(describeSavingsRate(0.2)).toBe("You kept 20% of what came in.");
    expect(describeSavingsRate(0)).toBe("You kept 0% of what came in.");
    expect(describeSavingsRate(-0.15)).toBe("You spent 15% more than came in.");
  });
});

describe("describeBudgetResults", () => {
  it("is null with no budgets", () => {
    expect(describeBudgetResults({ total: 0, keptCount: 0, overCount: 0 })).toBeNull();
  });

  it("covers all kept, all over, and mixed — singular and plural", () => {
    expect(describeBudgetResults({ total: 1, keptCount: 1, overCount: 0 })).toBe(
      "You stayed within your budget."
    );
    expect(describeBudgetResults({ total: 3, keptCount: 3, overCount: 0 })).toBe(
      "You stayed within all 3 budgets."
    );
    expect(describeBudgetResults({ total: 1, keptCount: 0, overCount: 1 })).toBe(
      "Your budget went over."
    );
    expect(describeBudgetResults({ total: 2, keptCount: 0, overCount: 2 })).toBe(
      "Every budget went over this month."
    );
    expect(describeBudgetResults({ total: 4, keptCount: 3, overCount: 1 })).toBe(
      "You stayed within 3 of 4 budgets."
    );
  });
});

describe("describeCarryOut", () => {
  it("with rollover: leftover rolls forward, overspend comes out, zero carries nothing", () => {
    expect(
      describeCarryOut({ rolloverEnabled: true, carryOut: 50, remaining: 50 }, "November", money)
    ).toBe("$50.00 rolls into November");
    expect(
      describeCarryOut({ rolloverEnabled: true, carryOut: -60, remaining: -60 }, "November", money)
    ).toBe("$60.00 overspend comes out of November");
    expect(
      describeCarryOut({ rolloverEnabled: true, carryOut: 0, remaining: 0 }, "November", money)
    ).toBe("Nothing carries into November");
  });

  it("without rollover: nudges to keep leftovers, and resets overspend", () => {
    expect(
      describeCarryOut({ rolloverEnabled: false, carryOut: 50, remaining: 50 }, "November", money)
    ).toBe("$50.00 unspent — turn on rollover to keep it");
    expect(
      describeCarryOut({ rolloverEnabled: false, carryOut: -60, remaining: -60 }, "November", money)
    ).toBe("Over by $60.00 — starts fresh in November");
    expect(
      describeCarryOut({ rolloverEnabled: false, carryOut: 0, remaining: 0 }, "November", money)
    ).toBe("Starts fresh in November");
  });
});

describe("describeGoalProgress", () => {
  it("celebrates a goal reached this month", () => {
    expect(
      describeGoalProgress({ contributed: 100, isReached: true, wasReachedThisMonth: true }, money)
    ).toBe("Reached this month!");
  });

  it("reports additions, drops, and no change", () => {
    expect(
      describeGoalProgress(
        { contributed: 250, isReached: false, wasReachedThisMonth: false },
        money
      )
    ).toBe("Added $250.00");
    expect(
      describeGoalProgress({ contributed: 50, isReached: true, wasReachedThisMonth: false }, money)
    ).toBe("Added $50.00 (already reached)");
    expect(
      describeGoalProgress(
        { contributed: -40, isReached: false, wasReachedThisMonth: false },
        money
      )
    ).toBe("Down $40.00");
    expect(
      describeGoalProgress({ contributed: 0, isReached: false, wasReachedThisMonth: false }, money)
    ).toBe("No change this month");
    expect(
      describeGoalProgress({ contributed: 0, isReached: true, wasReachedThisMonth: false }, money)
    ).toBe("Reached");
  });
});

describe("describeStreak", () => {
  it("is null before the first review, singular at one, plural after", () => {
    expect(describeStreak(0)).toBeNull();
    expect(describeStreak(1)).toBe("1-month review streak");
    expect(describeStreak(4)).toBe("4-month review streak");
  });
});
