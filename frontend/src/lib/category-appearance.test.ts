import { describe, expect, it } from "vitest";
import { Category } from "@/lib/api";
import {
  buildCategoryAppearanceLookup,
  resolveCategoryAppearance,
} from "@/lib/category-appearance";
import { CATEGORY_COLOR_OPTIONS } from "@/lib/category-options";

/** Builds a Category row with only the fields the appearance helpers read. */
function makeCategory(overrides: Partial<Category> & Pick<Category, "name" | "color">): Category {
  return {
    id: `category-${overrides.name}`,
    userId: "user-1",
    type: "EXPENSE",
    icon: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildCategoryAppearanceLookup", () => {
  it("indexes each category by its normalized name", () => {
    const lookup = buildCategoryAppearanceLookup([
      makeCategory({ name: "Groceries", color: "#22c55e", icon: "🛒" }),
      makeCategory({ name: "Rent", color: "#6366f1" }),
    ]);

    expect(lookup.get("groceries")).toEqual({ color: "#22c55e", icon: "🛒", isKnown: true });
    expect(lookup.get("rent")).toEqual({ color: "#6366f1", icon: null, isKnown: true });
  });

  it("skips categories whose name is blank or whitespace only", () => {
    const lookup = buildCategoryAppearanceLookup([
      makeCategory({ name: "   ", color: "#ef4444" }),
      makeCategory({ name: "", color: "#ef4444" }),
    ]);

    expect(lookup.size).toBe(0);
  });

  it("keeps the first row when two categories normalize to the same name", () => {
    const lookup = buildCategoryAppearanceLookup([
      makeCategory({ name: "Dining", color: "#f97316", icon: "🍽️" }),
      makeCategory({ name: " dining ", color: "#000000", icon: "❌" }),
    ]);

    expect(lookup.size).toBe(1);
    expect(lookup.get("dining")).toEqual({ color: "#f97316", icon: "🍽️", isKnown: true });
  });

  it("returns an empty lookup for an empty category list", () => {
    expect(buildCategoryAppearanceLookup([]).size).toBe(0);
  });
});

describe("resolveCategoryAppearance", () => {
  const lookup = buildCategoryAppearanceLookup([
    makeCategory({ name: "Groceries", color: "#22c55e", icon: "🛒" }),
  ]);

  it("returns the user's own colour and icon for a known category", () => {
    expect(resolveCategoryAppearance("Groceries", lookup)).toEqual({
      color: "#22c55e",
      icon: "🛒",
      isKnown: true,
    });
  });

  it("matches a known category regardless of casing and padding", () => {
    expect(resolveCategoryAppearance("  gRoCeRiEs  ", lookup).color).toBe("#22c55e");
    expect(resolveCategoryAppearance("  gRoCeRiEs  ", lookup).isKnown).toBe(true);
  });

  it("falls back to the uncategorized colour for null, undefined, and blank names", () => {
    const expected = { color: "#64748b", icon: null, isKnown: false };
    expect(resolveCategoryAppearance(null, lookup)).toEqual(expected);
    expect(resolveCategoryAppearance(undefined, lookup)).toEqual(expected);
    expect(resolveCategoryAppearance("   ", lookup)).toEqual(expected);
  });

  it("hashes an unknown name to a palette colour with no icon", () => {
    const result = resolveCategoryAppearance("Hockey", lookup);

    expect(result.isKnown).toBe(false);
    expect(result.icon).toBeNull();
    expect(CATEGORY_COLOR_OPTIONS.map((option) => option.value)).toContain(result.color);
  });

  it("gives an unknown name the same colour on every call", () => {
    const first = resolveCategoryAppearance("Daycare", lookup);
    const second = resolveCategoryAppearance("daycare", lookup);

    expect(first.color).toBe(second.color);
  });

  it("distinguishes different unknown names rather than greying them all out", () => {
    const colors = new Set(
      ["Hockey", "Daycare", "Tuition", "Vet", "Storage"].map(
        (name) => resolveCategoryAppearance(name, lookup).color
      )
    );

    expect(colors.size).toBeGreaterThan(1);
  });
});
