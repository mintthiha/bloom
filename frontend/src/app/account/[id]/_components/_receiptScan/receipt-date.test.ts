import { describe, expect, it } from "vitest";
import { formatLocalDate, toLocalCalendarDate, toReceiptEffectiveAt } from "./receipt-date";

describe("formatLocalDate", () => {
  it("zero-pads the month and day", () => {
    expect(formatLocalDate(new Date(2026, 2, 5, 9, 30))).toBe("2026-03-05");
  });

  it("uses the local calendar day even late in the evening", () => {
    expect(formatLocalDate(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31");
  });
});

describe("toLocalCalendarDate", () => {
  it("builds the date for a real day", () => {
    const date = toLocalCalendarDate(2026, 10, 9);
    expect(date && formatLocalDate(date)).toBe("2026-10-09");
  });

  it("accepts February 29 in a leap year", () => {
    expect(toLocalCalendarDate(2024, 2, 29)).not.toBeNull();
  });

  it.each([
    ["February 29 in a non-leap year", 2026, 2, 29],
    ["a 31st in a 30-day month", 2026, 4, 31],
    ["month 13", 2026, 13, 1],
    ["month 0", 2026, 0, 10],
    ["day 0", 2026, 5, 0],
  ])("returns null for %s", (_description, year, month, day) => {
    expect(toLocalCalendarDate(year, month, day)).toBeNull();
  });
});

describe("toReceiptEffectiveAt", () => {
  const now = new Date(2026, 9, 11, 15, 42, 7);

  it("stamps a receipt from today with the current time", () => {
    expect(toReceiptEffectiveAt("2026-10-11", now)).toBe(now);
  });

  it("stamps a receipt from another day at local noon of that day", () => {
    const effectiveAt = toReceiptEffectiveAt("2026-10-09", now);
    expect(effectiveAt).toEqual(new Date(2026, 9, 9, 12, 0, 0));
  });

  it.each([
    ["an empty value", ""],
    ["a non-ISO format", "10/09/2026"],
    ["a day that does not exist", "2026-02-30"],
    ["a date with a time attached", "2026-10-09T12:00"],
  ])("returns null for %s", (_description, receiptDate) => {
    expect(toReceiptEffectiveAt(receiptDate, now)).toBeNull();
  });
});
