import { describe, expect, it } from "vitest";
import {
  buildDateRangeQuery,
  formatLocalDate,
  getPresetDateRange,
  parseLocalDate,
  shiftLocalDate,
} from "./date-range";

// ---------------------------------------------------------------------------
// formatLocalDate
// ---------------------------------------------------------------------------

describe("formatLocalDate", () => {
  it("formats a date as YYYY-MM-DD", () => {
    expect(formatLocalDate(new Date(2026, 4, 15))).toBe("2026-05-15");
  });

  it("pads single-digit months and days with a leading zero", () => {
    expect(formatLocalDate(new Date(2026, 0, 7))).toBe("2026-01-07");
  });

  it("handles end-of-year dates correctly", () => {
    expect(formatLocalDate(new Date(2025, 11, 31))).toBe("2025-12-31");
  });
});

// ---------------------------------------------------------------------------
// parseLocalDate
// ---------------------------------------------------------------------------

describe("parseLocalDate", () => {
  it("parses a YYYY-MM-DD string into a local midnight Date", () => {
    const date = parseLocalDate("2026-05-15");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(4); // May = 4
    expect(date.getDate()).toBe(15);
  });

  it("round-trips correctly with formatLocalDate", () => {
    expect(formatLocalDate(parseLocalDate("2026-05-15"))).toBe("2026-05-15");
    expect(formatLocalDate(parseLocalDate("2025-12-31"))).toBe("2025-12-31");
    expect(formatLocalDate(parseLocalDate("2026-01-01"))).toBe("2026-01-01");
  });
});

// ---------------------------------------------------------------------------
// shiftLocalDate
// ---------------------------------------------------------------------------

describe("shiftLocalDate", () => {
  it("advances a date by a positive number of days", () => {
    expect(shiftLocalDate("2026-05-15", 1)).toBe("2026-05-16");
    expect(shiftLocalDate("2026-05-15", 10)).toBe("2026-05-25");
  });

  it("moves a date backward with a negative number of days", () => {
    expect(shiftLocalDate("2026-05-15", -1)).toBe("2026-05-14");
    expect(shiftLocalDate("2026-05-15", -14)).toBe("2026-05-01");
  });

  it("returns the same date when shifting by zero", () => {
    expect(shiftLocalDate("2026-05-15", 0)).toBe("2026-05-15");
  });

  it("crosses a month boundary correctly when shifting forward", () => {
    expect(shiftLocalDate("2026-05-31", 1)).toBe("2026-06-01");
  });

  it("crosses a month boundary correctly when shifting backward", () => {
    expect(shiftLocalDate("2026-06-01", -1)).toBe("2026-05-31");
  });

  it("crosses a year boundary when shifting forward", () => {
    expect(shiftLocalDate("2025-12-31", 1)).toBe("2026-01-01");
  });

  it("crosses a year boundary when shifting backward", () => {
    expect(shiftLocalDate("2026-01-01", -1)).toBe("2025-12-31");
  });
});

// ---------------------------------------------------------------------------
// buildDateRangeQuery
// ---------------------------------------------------------------------------

describe("buildDateRangeQuery", () => {
  it("returns undefined when start is an empty string", () => {
    expect(
      buildDateRangeQuery({ preset: "this-month", start: "", end: "2026-06-01" })
    ).toBeUndefined();
  });

  it("returns undefined when end is an empty string", () => {
    expect(
      buildDateRangeQuery({ preset: "this-month", start: "2026-05-01", end: "" })
    ).toBeUndefined();
  });

  it("returns undefined for the all-time preset (both strings empty)", () => {
    expect(buildDateRangeQuery({ preset: "all-time", start: "", end: "" })).toBeUndefined();
  });

  it("uses the end date as-is for non-custom presets (already exclusive)", () => {
    // For "this-month" the end "2026-06-01" is already the exclusive upper bound
    const result = buildDateRangeQuery({
      preset: "this-month",
      start: "2026-05-01",
      end: "2026-06-01",
    });

    expect(result).toBeDefined();
    // The end ISO string should correspond to June 1 (not June 2)
    const endDate = new Date(result!.end);
    expect(endDate.getFullYear()).toBe(parseLocalDate("2026-06-01").getFullYear());
    expect(endDate.getMonth()).toBe(parseLocalDate("2026-06-01").getMonth());
    expect(endDate.getDate()).toBe(parseLocalDate("2026-06-01").getDate());
  });

  it("shifts the end date forward by 1 day for the custom preset (inclusive → exclusive)", () => {
    // User selected May 31 as the last day; service receives June 1 as exclusive end
    const result = buildDateRangeQuery({
      preset: "custom",
      start: "2026-05-01",
      end: "2026-05-31",
    });

    expect(result).toBeDefined();
    const endDate = new Date(result!.end);
    expect(endDate.getFullYear()).toBe(2026);
    expect(endDate.getMonth()).toBe(5); // June = 5
    expect(endDate.getDate()).toBe(1);
  });

  it("does not shift the end date for non-custom presets", () => {
    const customResult = buildDateRangeQuery({
      preset: "custom",
      start: "2026-05-01",
      end: "2026-05-31",
    });
    const nonCustomResult = buildDateRangeQuery({
      preset: "this-month",
      start: "2026-05-01",
      end: "2026-05-31",
    });

    // Custom shifts by +1 day; non-custom does not — the ISO strings differ
    expect(customResult!.end).not.toBe(nonCustomResult!.end);
  });

  it("returns the start as an ISO string of the parsed start date", () => {
    const result = buildDateRangeQuery({
      preset: "this-month",
      start: "2026-05-01",
      end: "2026-06-01",
    });

    expect(result!.start).toBe(parseLocalDate("2026-05-01").toISOString());
  });
});

// ---------------------------------------------------------------------------
// getPresetDateRange
// ---------------------------------------------------------------------------

describe("getPresetDateRange", () => {
  it("returns empty start and end strings for the all-time preset", () => {
    const result = getPresetDateRange("all-time", new Date(2026, 4, 15));
    expect(result).toEqual({ preset: "all-time", start: "", end: "" });
  });

  it("returns the first day of the current month to the first of the next for this-month", () => {
    const result = getPresetDateRange("this-month", new Date(2026, 4, 15)); // May 15
    expect(result).toEqual({
      preset: "this-month",
      start: "2026-05-01",
      end: "2026-06-01",
    });
  });

  it("this-month works correctly at the start of the month", () => {
    const result = getPresetDateRange("this-month", new Date(2026, 4, 1)); // May 1
    expect(result.start).toBe("2026-05-01");
    expect(result.end).toBe("2026-06-01");
  });

  it("returns the previous calendar month for previous-month", () => {
    const result = getPresetDateRange("previous-month", new Date(2026, 4, 15)); // May 15
    expect(result).toEqual({
      preset: "previous-month",
      start: "2026-04-01",
      end: "2026-05-01",
    });
  });

  it("previous-month crosses the year boundary correctly in January", () => {
    const result = getPresetDateRange("previous-month", new Date(2026, 0, 15)); // Jan 15
    expect(result).toEqual({
      preset: "previous-month",
      start: "2025-12-01",
      end: "2026-01-01",
    });
  });

  it("last-90-days starts 89 days before today and ends the day after today", () => {
    // now = May 15, 2026
    // start = May 15 - 89 days = February 15, 2026
    // end = May 15 + 1 day = May 16, 2026
    const result = getPresetDateRange("last-90-days", new Date(2026, 4, 15));
    expect(result.preset).toBe("last-90-days");
    expect(result.start).toBe("2026-02-15");
    expect(result.end).toBe("2026-05-16");
  });

  it("last-90-days crosses a year boundary correctly", () => {
    // now = Feb 1, 2026
    // start = Feb 1 - 89 days = November 4, 2025
    const result = getPresetDateRange("last-90-days", new Date(2026, 1, 1));
    expect(result.start).toBe("2025-11-04");
    expect(result.end).toBe("2026-02-02");
  });
});
