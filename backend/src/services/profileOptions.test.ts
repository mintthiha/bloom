import { describe, expect, it } from "vitest";
import { AppError } from "../middleware/errorHandler";
import { PROVINCE_CODES, normalizeEnumValue, parseOptionalDateOnly } from "./profileOptions";

/** Runs `action` and returns the AppError it throws, failing the test if it doesn't throw one. */
function captureAppError(action: () => unknown): AppError {
  try {
    action();
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error("Expected an AppError to be thrown");
}

describe("normalizeEnumValue", () => {
  it("returns an allowed value unchanged", () => {
    expect(normalizeEnumValue("ON", "province", PROVINCE_CODES)).toBe("ON");
  });

  it("uppercases and trims so either casing from the client is accepted", () => {
    expect(normalizeEnumValue("  qc ", "province", PROVINCE_CODES)).toBe("QC");
  });

  it.each([undefined, null, ""])("returns null for %j so the stored value is cleared", (value) => {
    expect(normalizeEnumValue(value, "province", PROVINCE_CODES)).toBeNull();
  });

  it("rejects a value outside the allowed set with a 400 that lists the options", () => {
    const error = captureAppError(() => normalizeEnumValue("XX", "province", PROVINCE_CODES));

    expect(error.statusCode).toBe(400);
    expect(error.message).toBe(`province must be one of: ${PROVINCE_CODES.join(", ")}`);
  });

  it("rejects a non-string value with a 400", () => {
    const error = captureAppError(() => normalizeEnumValue(42, "province", PROVINCE_CODES));

    expect(error.statusCode).toBe(400);
    expect(error.message).toBe("province must be a string");
  });

  it("rejects whitespace-only input as not in the allowed set", () => {
    expect(() => normalizeEnumValue("   ", "province", PROVINCE_CODES)).toThrow(
      "province must be one of"
    );
  });
});

describe("parseOptionalDateOnly", () => {
  it("parses a YYYY-MM-DD date as UTC midnight", () => {
    expect(parseOptionalDateOnly("2026-03-15", "nextPayday")?.toISOString()).toBe(
      "2026-03-15T00:00:00.000Z"
    );
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseOptionalDateOnly(" 2026-03-15 ", "nextPayday")?.toISOString()).toBe(
      "2026-03-15T00:00:00.000Z"
    );
  });

  it("accepts a leap day in a leap year", () => {
    expect(parseOptionalDateOnly("2028-02-29", "nextPayday")?.toISOString()).toBe(
      "2028-02-29T00:00:00.000Z"
    );
  });

  it.each([undefined, null, ""])("returns null for %j", (value) => {
    expect(parseOptionalDateOnly(value, "nextPayday")).toBeNull();
  });

  it.each([
    ["a date-time", "2026-03-15T10:00:00Z"],
    ["a slash-separated date", "2026/03/15"],
    ["a short year", "26-03-15"],
    ["a number", 20260315],
  ])("rejects %s as not YYYY-MM-DD", (_description, value) => {
    const error = captureAppError(() => parseOptionalDateOnly(value, "nextPayday"));

    expect(error.statusCode).toBe(400);
    expect(error.message).toBe("nextPayday must be a YYYY-MM-DD date");
  });

  it.each([
    ["February 31st", "2026-02-31"],
    ["a leap day in a non-leap year", "2026-02-29"],
    ["month 13", "2026-13-01"],
  ])("rejects %s as not a real calendar date", (_description, value) => {
    const error = captureAppError(() => parseOptionalDateOnly(value, "nextPayday"));

    expect(error.statusCode).toBe(400);
    expect(error.message).toBe("nextPayday must be a valid calendar date");
  });
});
