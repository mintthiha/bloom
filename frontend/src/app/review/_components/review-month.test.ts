import { describe, expect, it } from "vitest";
import {
  currentMonthKey,
  defaultRecapYear,
  defaultReviewMonth,
  formatMonthName,
  formatShortMonthName,
  isCurrentOrFutureMonth,
  isRecapSeason,
  isValidMonthKey,
  resolveRecapYear,
  resolveReviewMonth,
  shiftMonthKey,
} from "./review-month";

const novemberFourth = new Date(2026, 10, 4, 12);

describe("isValidMonthKey", () => {
  it("accepts YYYY-MM and rejects everything else", () => {
    expect(isValidMonthKey("2026-10")).toBe(true);
    for (const value of ["2026-13", "2026-00", "2026-1", "", null, undefined]) {
      expect(isValidMonthKey(value)).toBe(false);
    }
  });
});

describe("shiftMonthKey", () => {
  it("shifts within and across years", () => {
    expect(shiftMonthKey("2026-10", -1)).toBe("2026-09");
    expect(shiftMonthKey("2026-12", 1)).toBe("2027-01");
    expect(shiftMonthKey("2026-01", -1)).toBe("2025-12");
  });
});

describe("currentMonthKey / defaultReviewMonth", () => {
  it("reads the local month and defaults the review to last month", () => {
    expect(currentMonthKey(novemberFourth)).toBe("2026-11");
    expect(defaultReviewMonth(novemberFourth)).toBe("2026-10");
  });

  it("defaults to December of last year in January", () => {
    expect(defaultReviewMonth(new Date(2027, 0, 3))).toBe("2026-12");
  });
});

describe("resolveReviewMonth", () => {
  it("uses a valid past month from the URL", () => {
    expect(resolveReviewMonth("2026-03", novemberFourth)).toBe("2026-03");
  });

  it("allows the current month (an early look)", () => {
    expect(resolveReviewMonth("2026-11", novemberFourth)).toBe("2026-11");
  });

  it("falls back to last month for a missing, malformed, or future month", () => {
    expect(resolveReviewMonth(null, novemberFourth)).toBe("2026-10");
    expect(resolveReviewMonth("october", novemberFourth)).toBe("2026-10");
    expect(resolveReviewMonth("2026-12", novemberFourth)).toBe("2026-10");
  });
});

describe("isCurrentOrFutureMonth", () => {
  it("is true from the current month onward", () => {
    expect(isCurrentOrFutureMonth("2026-10", novemberFourth)).toBe(false);
    expect(isCurrentOrFutureMonth("2026-11", novemberFourth)).toBe(true);
  });
});

describe("formatMonthName / formatShortMonthName", () => {
  it("names the month, optionally with the year", () => {
    expect(formatMonthName("2026-10")).toBe("October");
    expect(formatMonthName("2026-10", true)).toBe("October 2026");
    expect(formatShortMonthName("2026-01")).toBe("Jan");
  });
});

describe("recap year", () => {
  it("defaults to last year in January and the current year otherwise", () => {
    expect(defaultRecapYear(new Date(2027, 0, 10))).toBe(2026);
    expect(defaultRecapYear(novemberFourth)).toBe(2026);
    expect(defaultRecapYear(new Date(2026, 1, 1))).toBe(2026);
  });

  it("accepts a valid past year and rejects future or malformed ones", () => {
    expect(resolveRecapYear("2025", novemberFourth)).toBe(2025);
    expect(resolveRecapYear("2027", novemberFourth)).toBe(2026);
    expect(resolveRecapYear("26", novemberFourth)).toBe(2026);
    expect(resolveRecapYear(null, novemberFourth)).toBe(2026);
  });

  it("treats December and January as recap season", () => {
    expect(isRecapSeason(new Date(2026, 11, 1))).toBe(true);
    expect(isRecapSeason(new Date(2027, 0, 31))).toBe(true);
    expect(isRecapSeason(novemberFourth)).toBe(false);
  });
});
