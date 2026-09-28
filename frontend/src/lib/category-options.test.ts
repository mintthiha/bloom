import { describe, expect, it } from "vitest";
import {
  isValidCategoryColor,
  validateCategoryName,
  MAX_CATEGORY_NAME_LENGTH,
} from "./category-options";

describe("isValidCategoryColor", () => {
  it("accepts a well-formed hex color", () => {
    expect(isValidCategoryColor("#22c55e")).toBe(true);
  });

  it("accepts uppercase hex digits", () => {
    expect(isValidCategoryColor("#22C55E")).toBe(true);
  });

  it("rejects a color missing the leading #", () => {
    expect(isValidCategoryColor("22c55e")).toBe(false);
  });

  it("rejects a 3-digit shorthand hex", () => {
    expect(isValidCategoryColor("#2c5")).toBe(false);
  });

  it("rejects a named color", () => {
    expect(isValidCategoryColor("green")).toBe(false);
  });
});

describe("validateCategoryName", () => {
  it("returns null for a normal name", () => {
    expect(validateCategoryName("Hobbies")).toBeNull();
  });

  it("rejects a blank name", () => {
    expect(validateCategoryName("   ")).toBe("Name is required");
  });

  it("rejects a name over the max length", () => {
    const tooLong = "a".repeat(MAX_CATEGORY_NAME_LENGTH + 1);
    expect(validateCategoryName(tooLong)).toBe(
      `Name must be at most ${MAX_CATEGORY_NAME_LENGTH} characters`
    );
  });

  it("accepts a name exactly at the max length", () => {
    const exact = "a".repeat(MAX_CATEGORY_NAME_LENGTH);
    expect(validateCategoryName(exact)).toBeNull();
  });
});
