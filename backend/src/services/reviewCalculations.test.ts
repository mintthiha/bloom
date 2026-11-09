import { describe, expect, it } from "vitest";
import {
  compareCategorySpending,
  computeGoalMonthProgress,
  computePercentChange,
  computeReviewStreak,
  computeSavingsRate,
  fillYearMonths,
  isReviewReminderWindow,
  isValidMonthKey,
  monthKeyOfDate,
  pickYearHighlights,
  shiftMonthKey,
  summarizeBudgetResults,
  utcMonthStart,
} from "./reviewCalculations";

describe("isValidMonthKey", () => {
  it("accepts YYYY-MM months 01 through 12", () => {
    expect(isValidMonthKey("2026-01")).toBe(true);
    expect(isValidMonthKey("2026-12")).toBe(true);
  });

  it("rejects month 00, month 13, and other shapes", () => {
    for (const value of ["2026-00", "2026-13", "2026-1", "26-10", "2026-10-01", ""]) {
      expect(isValidMonthKey(value)).toBe(false);
    }
  });
});

describe("shiftMonthKey", () => {
  it("moves within a year", () => {
    expect(shiftMonthKey("2026-10", 1)).toBe("2026-11");
    expect(shiftMonthKey("2026-10", -1)).toBe("2026-09");
  });

  it("crosses year boundaries in both directions", () => {
    expect(shiftMonthKey("2026-12", 1)).toBe("2027-01");
    expect(shiftMonthKey("2026-01", -1)).toBe("2025-12");
    expect(shiftMonthKey("2026-03", -15)).toBe("2024-12");
  });
});

describe("monthKeyOfDate / utcMonthStart", () => {
  it("reads the UTC month of a date", () => {
    expect(monthKeyOfDate(new Date("2026-11-30T23:59:59.000Z"))).toBe("2026-11");
  });

  it("returns UTC midnight on the 1st", () => {
    expect(utcMonthStart("2026-02").toISOString()).toBe("2026-02-01T00:00:00.000Z");
  });
});

describe("computeReviewStreak", () => {
  it("is zero with no reviews", () => {
    expect(computeReviewStreak([], "2026-10")).toBe(0);
  });

  it("counts consecutive months ending at the reviewed month", () => {
    expect(computeReviewStreak(["2026-10", "2026-09", "2026-08"], "2026-10")).toBe(3);
  });

  it("stops at the first gap", () => {
    expect(computeReviewStreak(["2026-10", "2026-09", "2026-07"], "2026-10")).toBe(2);
  });

  it("counts from the month before when this month isn't reviewed yet", () => {
    expect(computeReviewStreak(["2026-09", "2026-08"], "2026-10")).toBe(2);
  });

  it("is broken when neither this month nor the one before is reviewed", () => {
    expect(computeReviewStreak(["2026-08", "2026-07"], "2026-10")).toBe(0);
  });

  it("follows the streak across a new year", () => {
    expect(computeReviewStreak(["2027-01", "2026-12", "2026-11"], "2027-01")).toBe(3);
  });
});

describe("computeSavingsRate", () => {
  it("is the share of income left after spending", () => {
    expect(computeSavingsRate(2000, 1500)).toBeCloseTo(0.25);
  });

  it("goes negative when spending beats income", () => {
    expect(computeSavingsRate(1000, 1200)).toBeCloseTo(-0.2);
  });

  it("is null with no income", () => {
    expect(computeSavingsRate(0, 300)).toBeNull();
  });
});

describe("computePercentChange", () => {
  it("is the relative change", () => {
    expect(computePercentChange(110, 100)).toBeCloseTo(0.1);
    expect(computePercentChange(80, 100)).toBeCloseTo(-0.2);
  });

  it("is null when there was nothing to compare against", () => {
    expect(computePercentChange(50, 0)).toBeNull();
  });
});

describe("compareCategorySpending", () => {
  const october = [
    { category: "Rent", spending: 1450 },
    { category: "Groceries", spending: 300 },
    { category: "Salary", spending: 0 },
    { category: "Dining", spending: 250 },
  ];
  const september = [
    { category: "Groceries", spending: 250 },
    { category: "Dining", spending: 250 },
  ];

  it("ranks spending categories largest first and drops ones with no spending", () => {
    expect(compareCategorySpending(october, september).map((row) => row.category)).toEqual([
      "Rent",
      "Groceries",
      "Dining",
    ]);
  });

  it("pairs each category with last month and its change", () => {
    const groceries = compareCategorySpending(october, september)[1]!;
    expect(groceries).toMatchObject({ previousSpending: 250, spending: 300 });
    expect(groceries.changePercent).toBeCloseTo(0.2);
  });

  it("reports no change percent for a category that is new this month", () => {
    expect(compareCategorySpending(october, september)[0]!.changePercent).toBeNull();
  });

  it("computes each category's share of total spending", () => {
    expect(compareCategorySpending(october, september)[0]!.shareOfSpending).toBeCloseTo(
      1450 / 2000
    );
  });

  it("respects the limit", () => {
    expect(compareCategorySpending(october, september, 1)).toHaveLength(1);
  });

  it("returns nothing for a month with no spending", () => {
    expect(compareCategorySpending([{ category: "Salary", spending: 0 }], [])).toEqual([]);
  });
});

describe("summarizeBudgetResults", () => {
  it("counts kept and over envelopes", () => {
    expect(
      summarizeBudgetResults([
        { isOverBudget: false },
        { isOverBudget: true },
        { isOverBudget: false },
      ])
    ).toEqual({ total: 3, keptCount: 2, overCount: 1 });
  });

  it("handles no budgets", () => {
    expect(summarizeBudgetResults([])).toEqual({ total: 0, keptCount: 0, overCount: 0 });
  });
});

describe("computeGoalMonthProgress", () => {
  it("reports what was added and where the goal ended", () => {
    expect(computeGoalMonthProgress(1000, 200, 450)).toEqual({
      contributed: 250,
      percentAtEnd: 0.45,
      isReached: false,
      wasReachedThisMonth: false,
    });
  });

  it("flags a goal crossed during the month", () => {
    expect(computeGoalMonthProgress(1000, 900, 1000)).toMatchObject({
      isReached: true,
      wasReachedThisMonth: true,
      percentAtEnd: 1,
    });
  });

  it("does not re-announce a goal that was already reached", () => {
    expect(computeGoalMonthProgress(1000, 1200, 1300).wasReachedThisMonth).toBe(false);
  });

  it("reports a withdrawal as a negative contribution and clamps the percent at zero", () => {
    expect(computeGoalMonthProgress(1000, 100, -50)).toMatchObject({
      contributed: -150,
      percentAtEnd: 0,
    });
  });

  it("treats a zero target as never reached", () => {
    expect(computeGoalMonthProgress(0, 0, 100)).toMatchObject({
      isReached: false,
      percentAtEnd: 0,
    });
  });
});

describe("isReviewReminderWindow", () => {
  it("is open on days 1 through 7 and closed from day 8", () => {
    expect(isReviewReminderWindow(new Date("2026-11-01T00:00:00.000Z"))).toBe(true);
    expect(isReviewReminderWindow(new Date("2026-11-07T23:59:00.000Z"))).toBe(true);
    expect(isReviewReminderWindow(new Date("2026-11-08T00:00:00.000Z"))).toBe(false);
  });
});

describe("fillYearMonths / pickYearHighlights", () => {
  it("fills every month of the year in order, zeroing missing ones", () => {
    const months = fillYearMonths(2026, [{ month: "2026-03", income: 100, spending: 40 }]);
    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({ month: "2026-01", income: 0, spending: 0 });
    expect(months[2]).toEqual({ month: "2026-03", income: 100, spending: 40 });
    expect(months[11]!.month).toBe("2026-12");
  });

  it("picks the best saving month and the highest spending month", () => {
    const months = fillYearMonths(2026, [
      { month: "2026-01", income: 3000, spending: 1000 },
      { month: "2026-02", income: 3000, spending: 2800 },
      { month: "2026-03", income: 1000, spending: 3200 },
    ]);
    expect(pickYearHighlights(months)).toEqual({
      bestSavingMonth: { month: "2026-01", netSaved: 2000 },
      highestSpendingMonth: { month: "2026-03", spending: 3200 },
      activeMonthCount: 3,
    });
  });

  it("returns no highlights for a year with no activity", () => {
    expect(pickYearHighlights(fillYearMonths(2026, []))).toEqual({
      bestSavingMonth: null,
      highestSpendingMonth: null,
      activeMonthCount: 0,
    });
  });
});
