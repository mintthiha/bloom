import { describe, expect, it } from "vitest";
import {
  computeCategoryChartHeight,
  MAXIMUM_CATEGORY_LABEL_LENGTH,
  truncateCategoryLabel,
} from "./category-chart-layout";

describe("computeCategoryChartHeight", () => {
  it("grows with the category count once past the minimum", () => {
    expect(computeCategoryChartHeight(8)).toBeGreaterThan(computeCategoryChartHeight(5));
  });

  it("floors a small month at a readable minimum height", () => {
    expect(computeCategoryChartHeight(1)).toBe(120);
    expect(computeCategoryChartHeight(3)).toBe(120);
  });

  it("returns the minimum for zero and negative counts rather than collapsing", () => {
    expect(computeCategoryChartHeight(0)).toBe(120);
    expect(computeCategoryChartHeight(-2)).toBe(120);
  });

  it("caps the height so many custom categories can't push the card off-screen", () => {
    expect(computeCategoryChartHeight(40)).toBe(420);
    expect(computeCategoryChartHeight(500)).toBe(420);
  });

  it("never returns a height outside the min/max band", () => {
    for (const count of [0, 1, 4, 7, 12, 20, 100]) {
      const height = computeCategoryChartHeight(count);
      expect(height).toBeGreaterThanOrEqual(120);
      expect(height).toBeLessThanOrEqual(420);
    }
  });
});

describe("truncateCategoryLabel", () => {
  it("leaves a short label untouched", () => {
    expect(truncateCategoryLabel("Rent")).toBe("Rent");
  });

  it("trims surrounding whitespace", () => {
    expect(truncateCategoryLabel("  Dining  ")).toBe("Dining");
  });

  it("keeps a label exactly at the limit intact", () => {
    const exact = "A".repeat(MAXIMUM_CATEGORY_LABEL_LENGTH);
    expect(truncateCategoryLabel(exact)).toBe(exact);
  });

  it("ellipsizes a label one character past the limit", () => {
    const overLimit = "B".repeat(MAXIMUM_CATEGORY_LABEL_LENGTH + 1);
    const result = truncateCategoryLabel(overLimit);

    expect(result).toHaveLength(MAXIMUM_CATEGORY_LABEL_LENGTH);
    expect(result.endsWith("…")).toBe(true);
  });

  it("shortens a long custom category name", () => {
    expect(truncateCategoryLabel("Kids extracurriculars")).toBe("Kids extracur…");
  });

  it("cuts mid-word when the limit falls inside one", () => {
    expect(truncateCategoryLabel("Hockey gear and fees")).toBe("Hockey gear a…");
  });

  it("does not leave a dangling space before the ellipsis", () => {
    expect(truncateCategoryLabel("Kids classes and gear")).toBe("Kids classes…");
  });

  it("returns an empty string for a blank label", () => {
    expect(truncateCategoryLabel("   ")).toBe("");
  });
});
