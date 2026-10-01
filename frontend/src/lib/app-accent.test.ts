import { describe, expect, it } from "vitest";
import { getAccentHex, parseAccentColor } from "./app-accent";

describe("parseAccentColor", () => {
  it("normalizes a recognized colour regardless of casing", () => {
    expect(parseAccentColor("violet")).toBe("VIOLET");
    expect(parseAccentColor("BLUE")).toBe("BLUE");
  });

  it("returns null for unrecognized or missing values", () => {
    expect(parseAccentColor("TEAL")).toBeNull();
    expect(parseAccentColor(null)).toBeNull();
    expect(parseAccentColor(undefined)).toBeNull();
  });
});

describe("getAccentHex", () => {
  it("resolves the hex for a chosen colour", () => {
    expect(getAccentHex("GREEN")).toBe("#10b981");
  });

  it("falls back to the default blue when unset or unrecognized", () => {
    expect(getAccentHex(null)).toBe("#3b82f6");
    expect(getAccentHex("NOT_A_COLOUR")).toBe("#3b82f6");
  });
});
