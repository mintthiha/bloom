import { describe, expect, it } from "vitest";
import {
  advancePaydayToUpcoming,
  describePayCycle,
  estimateIncomePerPaycheque,
  getDaysUntil,
  parseDateOnly,
} from "./financial-profile";

describe("parseDateOnly", () => {
  it("parses a valid date at UTC midnight", () => {
    expect(parseDateOnly("2026-09-15")?.toISOString()).toBe("2026-09-15T00:00:00.000Z");
  });

  it("rejects a calendar date that does not exist", () => {
    expect(parseDateOnly("2026-02-31")).toBeNull();
  });

  it("rejects malformed and empty values", () => {
    expect(parseDateOnly("15/09/2026")).toBeNull();
    expect(parseDateOnly("")).toBeNull();
    expect(parseDateOnly(null)).toBeNull();
  });
});

describe("estimateIncomePerPaycheque", () => {
  it("splits monthly income across a bi-weekly cadence", () => {
    expect(estimateIncomePerPaycheque(3750, "BIWEEKLY")).toBeCloseTo(1730.77, 2);
  });

  it("returns the full amount for monthly pay", () => {
    expect(estimateIncomePerPaycheque(3750, "MONTHLY")).toBe(3750);
  });

  it("halves the amount for semi-monthly pay", () => {
    expect(estimateIncomePerPaycheque(3750, "SEMIMONTHLY")).toBe(1875);
  });

  it("returns null when income or frequency is missing", () => {
    expect(estimateIncomePerPaycheque(null, "WEEKLY")).toBeNull();
    expect(estimateIncomePerPaycheque(3750, null)).toBeNull();
  });

  it("returns null for a zero or negative income", () => {
    expect(estimateIncomePerPaycheque(0, "WEEKLY")).toBeNull();
    expect(estimateIncomePerPaycheque(-100, "WEEKLY")).toBeNull();
  });
});

describe("advancePaydayToUpcoming", () => {
  it("keeps a payday that is still in the future", () => {
    expect(
      advancePaydayToUpcoming("2026-09-25", "BIWEEKLY", new Date("2026-09-15T12:00:00Z"))
    ).toBe("2026-09-25");
  });

  it("keeps a payday that falls exactly on today", () => {
    expect(advancePaydayToUpcoming("2026-09-15", "WEEKLY", new Date("2026-09-15T23:00:00Z"))).toBe(
      "2026-09-15"
    );
  });

  it("rolls a stale bi-weekly payday forward to the next occurrence", () => {
    // The 14-day series from Jan 2 lands on Sep 11, so the next one is Sep 25.
    expect(
      advancePaydayToUpcoming("2026-01-02", "BIWEEKLY", new Date("2026-09-15T00:00:00Z"))
    ).toBe("2026-09-25");
  });

  it("rolls a stale weekly payday forward", () => {
    expect(advancePaydayToUpcoming("2026-09-01", "WEEKLY", new Date("2026-09-15T00:00:00Z"))).toBe(
      "2026-09-15"
    );
  });

  it("rolls a monthly payday forward to the same day next month", () => {
    expect(advancePaydayToUpcoming("2026-06-20", "MONTHLY", new Date("2026-09-15T00:00:00Z"))).toBe(
      "2026-09-20"
    );
  });

  it("clamps a month-end monthly payday to a shorter month", () => {
    expect(advancePaydayToUpcoming("2026-01-31", "MONTHLY", new Date("2026-02-15T00:00:00Z"))).toBe(
      "2026-02-28"
    );
  });

  it("finds the mid-month second payday for a semi-monthly cadence", () => {
    expect(
      advancePaydayToUpcoming("2026-09-01", "SEMIMONTHLY", new Date("2026-09-05T00:00:00Z"))
    ).toBe("2026-09-16");
  });

  it("returns null when the payday or frequency is missing", () => {
    expect(advancePaydayToUpcoming(null, "WEEKLY", new Date("2026-09-15T00:00:00Z"))).toBeNull();
    expect(
      advancePaydayToUpcoming("2026-09-15", null, new Date("2026-09-15T00:00:00Z"))
    ).toBeNull();
  });
});

describe("getDaysUntil", () => {
  it("counts whole days ahead", () => {
    expect(getDaysUntil("2026-09-20", new Date("2026-09-15T18:00:00Z"))).toBe(5);
  });

  it("returns zero for today", () => {
    expect(getDaysUntil("2026-09-15", new Date("2026-09-15T18:00:00Z"))).toBe(0);
  });

  it("returns a negative count for a past date", () => {
    expect(getDaysUntil("2026-09-10", new Date("2026-09-15T00:00:00Z"))).toBe(-5);
  });

  it("returns null for an unparseable date", () => {
    expect(getDaysUntil(null, new Date("2026-09-15T00:00:00Z"))).toBeNull();
  });
});

describe("describePayCycle", () => {
  it("includes the per-paycheque amount and the countdown", () => {
    const summary = describePayCycle(
      3750,
      "BIWEEKLY",
      "2026-09-20",
      new Date("2026-09-15T00:00:00Z")
    );
    expect(summary).toContain("every 2 weeks");
    expect(summary).toContain("next payday in 5 days");
  });

  it("says payday is today when the date is today", () => {
    expect(
      describePayCycle(3750, "MONTHLY", "2026-09-15", new Date("2026-09-15T00:00:00Z"))
    ).toContain("payday is today");
  });

  it("says tomorrow for a next-day payday", () => {
    expect(
      describePayCycle(3750, "MONTHLY", "2026-09-16", new Date("2026-09-15T00:00:00Z"))
    ).toContain("next payday is tomorrow");
  });

  it("falls back to the cadence alone when income is unset", () => {
    const summary = describePayCycle(null, "WEEKLY", null, new Date("2026-09-15T00:00:00Z"));
    expect(summary).toBe("You're paid every week.");
  });

  it("returns null when there is no pay frequency", () => {
    expect(describePayCycle(3750, null, "2026-09-20", new Date("2026-09-15T00:00:00Z"))).toBeNull();
  });
});
