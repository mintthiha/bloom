import { describe, expect, it } from "vitest";
import { normalizeAccountColor, normalizeAccountIcon } from "./accountOptions";

describe("normalizeAccountColor", () => {
  it("returns null for absent values", () => {
    expect(normalizeAccountColor(undefined)).toBeNull();
    expect(normalizeAccountColor(null)).toBeNull();
    expect(normalizeAccountColor("")).toBeNull();
  });

  it("uppercases a valid colour", () => {
    expect(normalizeAccountColor("blue")).toBe("BLUE");
  });

  it("throws 400 for an unknown colour", () => {
    expect(() => normalizeAccountColor("ORANGE")).toThrowError(
      expect.objectContaining({ statusCode: 400 })
    );
  });

  it("throws 400 for a non-string value", () => {
    expect(() => normalizeAccountColor(42)).toThrowError(
      expect.objectContaining({ statusCode: 400 })
    );
  });
});

describe("normalizeAccountIcon", () => {
  it("returns null for absent values", () => {
    expect(normalizeAccountIcon(undefined)).toBeNull();
    expect(normalizeAccountIcon(null)).toBeNull();
    expect(normalizeAccountIcon("")).toBeNull();
  });

  it("accepts an emoji from the curated set", () => {
    expect(normalizeAccountIcon("🏦")).toBe("🏦");
  });

  it("throws 400 for an emoji outside the curated set", () => {
    expect(() => normalizeAccountIcon("🦄")).toThrowError(
      expect.objectContaining({ statusCode: 400 })
    );
  });
});
