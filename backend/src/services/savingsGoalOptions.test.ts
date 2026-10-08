import { describe, expect, it } from "vitest";
import {
  normalizeSavingsGoalColor,
  normalizeSavingsGoalIcon,
  SAVINGS_GOAL_ICONS,
} from "./savingsGoalOptions";

describe("normalizeSavingsGoalColor", () => {
  it("accepts a palette colour in any casing and returns it uppercased", () => {
    expect(normalizeSavingsGoalColor("violet")).toBe("VIOLET");
    expect(normalizeSavingsGoalColor(" Blue ")).toBe("BLUE");
  });

  it("returns null for absent values so they clear the stored colour", () => {
    expect(normalizeSavingsGoalColor(undefined)).toBeNull();
    expect(normalizeSavingsGoalColor(null)).toBeNull();
    expect(normalizeSavingsGoalColor("")).toBeNull();
  });

  it("rejects a colour outside the shared palette", () => {
    expect(() => normalizeSavingsGoalColor("CHARTREUSE")).toThrowError(/color must be one of/);
  });

  it("rejects a non-string colour", () => {
    expect(() => normalizeSavingsGoalColor(7)).toThrowError(/color must be a string/);
  });
});

describe("normalizeSavingsGoalIcon", () => {
  it("accepts every icon in the curated set", () => {
    for (const icon of SAVINGS_GOAL_ICONS) {
      expect(normalizeSavingsGoalIcon(icon)).toBe(icon);
    }
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeSavingsGoalIcon(" 🏠 ")).toBe("🏠");
  });

  it("returns null for absent values so they clear the stored icon", () => {
    expect(normalizeSavingsGoalIcon(undefined)).toBeNull();
    expect(normalizeSavingsGoalIcon(null)).toBeNull();
    expect(normalizeSavingsGoalIcon("")).toBeNull();
  });

  it("rejects an emoji outside the curated set", () => {
    expect(() => normalizeSavingsGoalIcon("🦖")).toThrowError(/icon must be one of/);
  });

  it("rejects a non-string icon", () => {
    expect(() => normalizeSavingsGoalIcon({})).toThrowError(/icon must be a string/);
  });
});
