import { describe, expect, it } from "vitest";
import {
  buildPayoffBalanceSeries,
  computeMinimumPayment,
  computePayoffSchedule,
  formatPayoffDuration,
} from "./debt-payoff-math";

describe("computeMinimumPayment", () => {
  it("returns the $25 floor for small balances", () => {
    expect(computeMinimumPayment(0)).toBe(25);
    expect(computeMinimumPayment(1000)).toBe(25);
  });

  it("returns 2% once that exceeds the floor", () => {
    expect(computeMinimumPayment(2000)).toBe(40);
    expect(computeMinimumPayment(5000)).toBe(100);
  });

  it("uses $25 exactly at the crossover balance of $1,250", () => {
    expect(computeMinimumPayment(1250)).toBe(25);
  });
});

describe("computePayoffSchedule", () => {
  it("pays off an interest-free balance in whole payment increments", () => {
    const result = computePayoffSchedule(1000, 0, 250);
    expect(result).toEqual({
      feasible: true,
      monthsToPayoff: 4,
      totalInterest: 0,
      totalPaid: 1000,
    });
  });

  it("reports infeasible when the payment cannot cover accruing interest", () => {
    // 24% APR on $1000 = $20/mo interest; a $20 payment never reduces principal.
    expect(computePayoffSchedule(1000, 24, 20)).toEqual({ feasible: false });
  });

  it("accrues interest and completes when the payment exceeds monthly interest", () => {
    const result = computePayoffSchedule(1000, 12, 100);
    expect(result.feasible).toBe(true);
    if (result.feasible) {
      expect(result.monthsToPayoff).toBe(11);
      expect(result.totalInterest).toBeGreaterThan(0);
      expect(result.totalPaid).toBeCloseTo(1000 + result.totalInterest, 2);
    }
  });

  it("caps a barely-feasible schedule at 600 months", () => {
    // Payment only marginally above the interest-only threshold drags out near the cap.
    const monthlyInterest = 1000 * (24 / 100 / 12);
    const result = computePayoffSchedule(1000, 24, monthlyInterest + 0.0001);
    expect(result.feasible).toBe(true);
    if (result.feasible) {
      expect(result.monthsToPayoff).toBe(600);
    }
  });
});

describe("buildPayoffBalanceSeries", () => {
  it("starts with the initial balance and has length maxMonths + 1", () => {
    const series = buildPayoffBalanceSeries(1000, 0, 250, 6);
    expect(series).toHaveLength(7);
    expect(series[0]).toBe(1000);
  });

  it("decreases toward zero and stays at zero once paid off", () => {
    const series = buildPayoffBalanceSeries(1000, 0, 250, 6);
    expect(series).toEqual([1000, 750, 500, 250, 0, 0, 0]);
  });

  it("reflects interest accrual for a non-zero rate", () => {
    const series = buildPayoffBalanceSeries(1000, 12, 100, 12);
    // With interest, the balance after one $100 payment is above $900.
    expect(series[1]).toBeGreaterThan(900);
    expect(series[series.length - 1]).toBeLessThan(1000);
  });
});

describe("formatPayoffDuration", () => {
  it("labels the 600-month cap as 50+ years", () => {
    expect(formatPayoffDuration(600)).toBe("50+ years");
    expect(formatPayoffDuration(720)).toBe("50+ years");
  });

  it("formats sub-year durations in months with pluralization", () => {
    expect(formatPayoffDuration(1)).toBe("1 month");
    expect(formatPayoffDuration(11)).toBe("11 months");
  });

  it("formats whole years without a month remainder", () => {
    expect(formatPayoffDuration(12)).toBe("1 year");
    expect(formatPayoffDuration(24)).toBe("2 years");
  });

  it("formats mixed years and months", () => {
    expect(formatPayoffDuration(14)).toBe("1 yr 2 mo");
    expect(formatPayoffDuration(30)).toBe("2 yr 6 mo");
  });
});
