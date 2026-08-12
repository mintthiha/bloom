import { describe, expect, it } from "vitest";
import { optionalString, requireObject, requirePositiveNumber, requireString } from "./validation";

describe("validation sanitization", () => {
  it("normalizes whitespace and strips control characters for required strings", () => {
    const value = requireString("  Jane\t\n\u0000Doe  ", "firstName");

    expect(value).toBe("Jane Doe");
  });

  it("normalizes whitespace and strips control characters for optional strings", () => {
    const value = optionalString("  Main\u0000 \n Account  ", "nickname");

    expect(value).toBe("Main Account");
  });

  it("returns undefined for optional strings that become empty after sanitization", () => {
    const value = optionalString(" \u0000 \n ", "description");

    expect(value).toBeUndefined();
  });
});

describe("requireObject", () => {
  it("throws 400 for null", () => {
    expect(() => requireObject(null)).toThrow("Request body must be an object");
  });

  it("throws 400 for arrays (which are typeof object)", () => {
    expect(() => requireObject([])).toThrow("Request body must be an object");
  });

  it("throws 400 for primitive values", () => {
    expect(() => requireObject("string")).toThrow("Request body must be an object");
    expect(() => requireObject(42)).toThrow("Request body must be an object");
  });

  it("returns the object when valid", () => {
    const body = { key: "value" };
    expect(requireObject(body)).toBe(body);
  });

  it("uses the provided message in the error", () => {
    expect(() => requireObject(null, "Payload is required")).toThrow("Payload is required");
  });
});

describe("requireString — options", () => {
  it("throws 400 when the value is shorter than min", () => {
    expect(() => requireString("ab", "name", { min: 3 })).toThrow("at least 3 characters");
  });

  it("accepts a value exactly at the min boundary", () => {
    expect(requireString("abc", "name", { min: 3 })).toBe("abc");
  });

  it("throws 400 when the value exceeds max", () => {
    expect(() => requireString("toolong", "name", { max: 5 })).toThrow("at most 5 characters");
  });

  it("accepts a value exactly at the max boundary", () => {
    expect(requireString("exact", "name", { max: 5 })).toBe("exact");
  });

  it("throws 400 when the value does not match the pattern", () => {
    expect(() =>
      requireString("bad-value!", "code", {
        pattern: /^[a-z]+$/,
        patternMessage: "code must be lowercase letters only",
      })
    ).toThrow("code must be lowercase letters only");
  });

  it("falls back to a default pattern message when patternMessage is not provided", () => {
    expect(() => requireString("123", "slug", { pattern: /^[a-z]+$/ })).toThrow("slug is invalid");
  });

  it("accepts a value that matches the pattern", () => {
    expect(requireString("valid", "slug", { pattern: /^[a-z]+$/ })).toBe("valid");
  });
});

describe("optionalString — null / undefined inputs and max", () => {
  it("returns undefined when the value is null", () => {
    expect(optionalString(null, "nickname")).toBeUndefined();
  });

  it("returns undefined when the value is undefined", () => {
    expect(optionalString(undefined, "nickname")).toBeUndefined();
  });

  it("throws 400 when the value exceeds max", () => {
    expect(() => optionalString("toolong", "note", { max: 4 })).toThrow("at most 4 characters");
  });

  it("accepts a value within max", () => {
    expect(optionalString("ok", "note", { max: 10 })).toBe("ok");
  });
});

describe("requirePositiveNumber", () => {
  it("throws 400 for a non-number value", () => {
    expect(() => requirePositiveNumber("100", "amount")).toThrow("amount must be a number");
    expect(() => requirePositiveNumber(null, "amount")).toThrow("amount must be a number");
  });

  it("throws 400 for non-finite numbers", () => {
    expect(() => requirePositiveNumber(NaN, "amount")).toThrow("amount must be a number");
    expect(() => requirePositiveNumber(Infinity, "amount")).toThrow("amount must be a number");
  });

  it("throws 400 for zero", () => {
    expect(() => requirePositiveNumber(0, "amount")).toThrow("amount must be positive");
  });

  it("throws 400 for negative numbers", () => {
    expect(() => requirePositiveNumber(-1, "amount")).toThrow("amount must be positive");
  });

  it("returns the value when it is a positive finite number", () => {
    expect(requirePositiveNumber(0.01, "amount")).toBe(0.01);
    expect(requirePositiveNumber(1000, "amount")).toBe(1000);
  });
});
