import { describe, expect, it } from "vitest";
import { computeRolloverForMonth, enumerateMonths, monthKey } from "./budget-rollover";

describe("budget-rollover", () => {
  it("formats UTC month keys", () => {
    expect(monthKey(new Date("2026-07-01T00:00:00.000Z"))).toBe("2026-07");
    expect(monthKey(new Date("2026-12-31T23:59:59.000Z"))).toBe("2026-12");
  });

  it("enumerates inclusive month ranges across a year boundary", () => {
    expect(enumerateMonths("2026-11", "2027-02")).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
    ]);
    expect(enumerateMonths("2026-05", "2026-05")).toEqual(["2026-05"]);
    expect(enumerateMonths("2026-05", "2026-04")).toEqual([]);
  });

  it("accrues unspent money forward when rollover is enabled", () => {
    const result = computeRolloverForMonth({
      targetMonth: "2026-07",
      rolloverEnabled: true,
      templateLimit: 200,
      spendingByMonth: new Map([
        ["2026-05", 150],
        ["2026-06", 120],
        ["2026-07", 100],
      ]),
      overridesByMonth: new Map(),
    });

    // May carryOut 50 -> Jun available 250, carryOut 130 -> Jul carryIn 130
    expect(result).toMatchObject({ carryIn: 130, available: 330, spent: 100, carryOut: 230 });
  });

  it("carries overspend debt forward as a negative balance", () => {
    const result = computeRolloverForMonth({
      targetMonth: "2026-06",
      rolloverEnabled: true,
      templateLimit: 100,
      spendingByMonth: new Map([
        ["2026-05", 180],
        ["2026-06", 50],
      ]),
      overridesByMonth: new Map(),
    });

    // May carryOut -80 -> Jun available 20, carryOut -30
    expect(result).toMatchObject({ carryIn: -80, available: 20, spent: 50, carryOut: -30 });
  });

  it("collapses the chain to a plain cap when rollover is disabled", () => {
    const result = computeRolloverForMonth({
      targetMonth: "2026-06",
      rolloverEnabled: false,
      templateLimit: 100,
      spendingByMonth: new Map([
        ["2026-05", 180],
        ["2026-06", 50],
      ]),
      overridesByMonth: new Map(),
    });

    expect(result).toMatchObject({ carryIn: 0, available: 100, spent: 50, carryOut: 50 });
  });

  it("applies per-month limit overrides and manual adjustments", () => {
    const result = computeRolloverForMonth({
      targetMonth: "2026-06",
      rolloverEnabled: true,
      templateLimit: 100,
      spendingByMonth: new Map([["2026-06", 40]]),
      overridesByMonth: new Map([["2026-06", { limitOverride: 250, adjustment: -30 }]]),
    });

    expect(result).toMatchObject({ limit: 250, adjustment: -30, available: 220, carryOut: 180 });
  });
});
