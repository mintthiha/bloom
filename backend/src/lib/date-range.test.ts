import { describe, expect, it } from "vitest";
import { AppError } from "../middleware/errorHandler";
import { defaultMonthRange, parseDateRangeQuery, resolveDateRange } from "./date-range";

describe("date-range", () => {
  describe("defaultMonthRange", () => {
    it("returns the UTC first-of-month to first-of-next-month for the given date", () => {
      const range = defaultMonthRange(new Date("2026-07-15T12:34:56.000Z"));
      expect(range.start.toISOString()).toBe("2026-07-01T00:00:00.000Z");
      expect(range.end.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    });

    it("rolls the end into the next year for December", () => {
      const range = defaultMonthRange(new Date("2026-12-31T23:59:59.000Z"));
      expect(range.start.toISOString()).toBe("2026-12-01T00:00:00.000Z");
      expect(range.end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
    });
  });

  describe("resolveDateRange", () => {
    it("falls back to the default month range when neither bound is provided", () => {
      const now = new Date("2026-03-10T00:00:00.000Z");
      expect(resolveDateRange({ now })).toEqual(defaultMonthRange(now));
    });

    it("falls back to the default month range for an empty input", () => {
      const range = resolveDateRange();
      expect(range.start.getUTCDate()).toBe(1);
      expect(range.end.getTime()).toBeGreaterThan(range.start.getTime());
    });

    it("returns the provided range when both bounds are valid and ordered", () => {
      const start = new Date("2026-01-01T00:00:00.000Z");
      const end = new Date("2026-02-01T00:00:00.000Z");
      expect(resolveDateRange({ start, end })).toEqual({ start, end });
    });

    it("rejects when only start is provided", () => {
      expect(() => resolveDateRange({ start: new Date("2026-01-01") })).toThrow(AppError);
      expect(() => resolveDateRange({ start: new Date("2026-01-01") })).toThrow(
        "start and end must both be provided"
      );
    });

    it("rejects when only end is provided", () => {
      expect(() => resolveDateRange({ end: new Date("2026-01-01") })).toThrow(
        "start and end must both be provided"
      );
    });

    it("rejects an invalid start date", () => {
      expect(() =>
        resolveDateRange({ start: new Date("not-a-date"), end: new Date("2026-02-01") })
      ).toThrow("start must be a valid ISO date");
    });

    it("rejects an invalid end date", () => {
      expect(() =>
        resolveDateRange({ start: new Date("2026-01-01"), end: new Date("not-a-date") })
      ).toThrow("end must be a valid ISO date");
    });

    it("rejects when start is not before end", () => {
      const same = new Date("2026-01-01T00:00:00.000Z");
      expect(() => resolveDateRange({ start: same, end: same })).toThrow(
        "start must be before end"
      );
      expect(() =>
        resolveDateRange({ start: new Date("2026-02-01"), end: new Date("2026-01-01") })
      ).toThrow("start must be before end");
    });
  });

  describe("parseDateRangeQuery", () => {
    it("returns undefined when both query params are absent", () => {
      expect(parseDateRangeQuery({})).toBeUndefined();
    });

    it("parses valid ISO date strings into Date objects", () => {
      const result = parseDateRangeQuery({ start: "2026-01-01", end: "2026-02-01" });
      expect(result?.start.toISOString()).toBe("2026-01-01T00:00:00.000Z");
      expect(result?.end.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    });

    it("rejects when only one param is provided", () => {
      expect(() => parseDateRangeQuery({ start: "2026-01-01" })).toThrow(
        "start and end must be ISO date strings"
      );
    });

    it("rejects non-string param values", () => {
      expect(() => parseDateRangeQuery({ start: 123, end: 456 })).toThrow(
        "start and end must be ISO date strings"
      );
    });
  });
});
