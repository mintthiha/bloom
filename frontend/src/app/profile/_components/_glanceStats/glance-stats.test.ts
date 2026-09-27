import { describe, expect, it } from "vitest";
import {
  buildGlanceStats,
  formatCount,
  formatMemberSince,
  pluralizeLabel,
  UNAVAILABLE_VALUE,
} from "./glance-stats";

describe("formatMemberSince", () => {
  it("formats a stored timestamp as month and year", () => {
    expect(formatMemberSince("2026-06-10T14:23:00.000Z")).toBe("June 2026");
  });

  it("reads the timestamp in UTC so a late-evening signup keeps its own month", () => {
    expect(formatMemberSince("2026-07-01T02:00:00.000Z")).toBe("July 2026");
  });

  it("falls back to a dash when there is no timestamp", () => {
    expect(formatMemberSince(null)).toBe(UNAVAILABLE_VALUE);
  });

  it("falls back to a dash for an unparseable timestamp", () => {
    expect(formatMemberSince("not-a-date")).toBe(UNAVAILABLE_VALUE);
  });
});

describe("formatCount", () => {
  it("separates thousands", () => {
    expect(formatCount(1312)).toBe("1,312");
  });

  it("keeps a genuine zero rather than hiding it", () => {
    expect(formatCount(0)).toBe("0");
  });

  it("falls back to a dash when the count is unknown", () => {
    expect(formatCount(null)).toBe(UNAVAILABLE_VALUE);
  });

  it("clamps a negative count to zero", () => {
    expect(formatCount(-4)).toBe("0");
  });

  it("truncates a fractional count", () => {
    expect(formatCount(7.8)).toBe("7");
  });
});

describe("pluralizeLabel", () => {
  it("uses the singular for exactly one", () => {
    expect(pluralizeLabel(1, "Account tracked", "Accounts tracked")).toBe("Account tracked");
  });

  it("uses the plural for zero", () => {
    expect(pluralizeLabel(0, "Account tracked", "Accounts tracked")).toBe("Accounts tracked");
  });

  it("uses the plural for many", () => {
    expect(pluralizeLabel(5, "Account tracked", "Accounts tracked")).toBe("Accounts tracked");
  });

  it("uses the plural when the count is unknown", () => {
    expect(pluralizeLabel(null, "Account tracked", "Accounts tracked")).toBe("Accounts tracked");
  });
});

describe("buildGlanceStats", () => {
  it("builds the four tiles in display order", () => {
    const stats = buildGlanceStats({
      createdAt: "2026-06-10T14:23:00.000Z",
      accountCount: 4,
      transactionCount: 1312,
      monthsOfHistory: 7,
    });

    expect(stats.map((stat) => stat.key)).toEqual([
      "memberSince",
      "accounts",
      "transactions",
      "history",
    ]);
    expect(stats.map((stat) => stat.value)).toEqual(["June 2026", "4", "1,312", "7"]);
  });

  it("pluralizes each count label independently", () => {
    const stats = buildGlanceStats({
      createdAt: "2026-06-10T14:23:00.000Z",
      accountCount: 1,
      transactionCount: 1,
      monthsOfHistory: 1,
    });

    expect(stats.map((stat) => stat.label)).toEqual([
      "Member since",
      "Account tracked",
      "Transaction recorded",
      "Month of history",
    ]);
  });

  it("shows a dash for every figure that failed to load", () => {
    const stats = buildGlanceStats({
      createdAt: null,
      accountCount: null,
      transactionCount: null,
      monthsOfHistory: null,
    });

    expect(stats.every((stat) => stat.value === UNAVAILABLE_VALUE)).toBe(true);
  });

  it("keeps the loaded figures when only one read failed", () => {
    const stats = buildGlanceStats({
      createdAt: "2026-06-10T14:23:00.000Z",
      accountCount: 4,
      transactionCount: null,
      monthsOfHistory: 7,
    });

    expect(stats.map((stat) => stat.value)).toEqual(["June 2026", "4", UNAVAILABLE_VALUE, "7"]);
  });

  it("reports a brand-new account with zeroes rather than dashes", () => {
    const stats = buildGlanceStats({
      createdAt: "2026-09-26T09:00:00.000Z",
      accountCount: 0,
      transactionCount: 0,
      monthsOfHistory: 0,
    });

    expect(stats.map((stat) => stat.value)).toEqual(["September 2026", "0", "0", "0"]);
  });
});
