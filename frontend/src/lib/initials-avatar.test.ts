import { describe, expect, it } from "vitest";
import {
  AVATAR_COLOR_OPTIONS,
  getAvatarInitials,
  getAvatarPalette,
  parseAvatarColor,
} from "./initials-avatar";

describe("getAvatarInitials", () => {
  it("uses the first letter of the first and last name", () => {
    expect(getAvatarInitials("Ada", "Lovelace")).toBe("AL");
  });

  it("uses only the first name when there is no last name", () => {
    expect(getAvatarInitials("Ada", "")).toBe("A");
    expect(getAvatarInitials("Ada", null)).toBe("A");
  });

  it("uses only the last name when there is no first name", () => {
    expect(getAvatarInitials("", "Lovelace")).toBe("L");
  });

  it("skips punctuation and whitespace when picking an initial", () => {
    expect(getAvatarInitials("  ada", "'o brien")).toBe("AO");
  });

  it("keeps accented letters", () => {
    expect(getAvatarInitials("Émile", "Zola")).toBe("ÉZ");
  });

  it("falls back to the first two characters of a handle", () => {
    expect(getAvatarInitials(null, null, "ada_lovelace")).toBe("AD");
  });

  it("uses the local part when the fallback is an email address", () => {
    expect(getAvatarInitials("", "", "zoe@bloom.test")).toBe("ZO");
  });

  it("returns an empty string when there is nothing to derive from", () => {
    expect(getAvatarInitials(null, null)).toBe("");
    expect(getAvatarInitials("", "", "@@@")).toBe("");
  });
});

describe("getAvatarPalette", () => {
  it("returns the same palette for the same seed", () => {
    expect(getAvatarPalette("Ada Lovelace")).toEqual(getAvatarPalette("Ada Lovelace"));
  });

  it("ignores casing and surrounding whitespace", () => {
    expect(getAvatarPalette("  ADA lovelace ")).toEqual(getAvatarPalette("ada lovelace"));
  });

  it("spreads names across several palettes instead of collapsing to one", () => {
    const names = [
      "Ada Lovelace",
      "Grace Hopper",
      "Alan Turing",
      "Katherine Johnson",
      "Linus Torvalds",
      "Margaret Hamilton",
      "Barbara Liskov",
      "Donald Knuth",
    ];
    const distinctTextColors = new Set(names.map((name) => getAvatarPalette(name).text));
    expect(distinctTextColors.size).toBeGreaterThanOrEqual(3);
  });

  it("falls back to a valid palette for an empty seed", () => {
    const palette = getAvatarPalette("");
    expect(palette.background).toMatch(/^#[0-9a-f]{8}$/i);
    expect(palette.text).toMatch(/^#[0-9a-f]{6}$/i);
    expect(getAvatarPalette(null)).toEqual(palette);
  });
});

describe("getAvatarPalette with an explicit choice", () => {
  it("uses the chosen colour instead of the name-derived one", () => {
    const violet = AVATAR_COLOR_OPTIONS.find((option) => option.value === "VIOLET");

    expect(getAvatarPalette("Ada Lovelace", "VIOLET")).toEqual(violet?.palette);
  });

  it("accepts a stored value in any casing", () => {
    expect(getAvatarPalette("Ada Lovelace", "violet")).toEqual(
      getAvatarPalette("Ada Lovelace", "VIOLET")
    );
  });

  it("falls back to the name-derived colour for an unknown or missing choice", () => {
    expect(getAvatarPalette("Ada Lovelace", "TEAL")).toEqual(getAvatarPalette("Ada Lovelace"));
    expect(getAvatarPalette("Ada Lovelace", null)).toEqual(getAvatarPalette("Ada Lovelace"));
  });

  it("honours the choice even when there is no name to hash", () => {
    expect(getAvatarPalette("", "PINK")).not.toEqual(getAvatarPalette(""));
  });
});

describe("parseAvatarColor", () => {
  it("normalizes a known colour", () => {
    expect(parseAvatarColor(" green ")).toBe("GREEN");
  });

  it("returns null for unknown, empty, or missing values", () => {
    expect(parseAvatarColor("TEAL")).toBeNull();
    expect(parseAvatarColor("")).toBeNull();
    expect(parseAvatarColor(null)).toBeNull();
    expect(parseAvatarColor(undefined)).toBeNull();
  });
});
