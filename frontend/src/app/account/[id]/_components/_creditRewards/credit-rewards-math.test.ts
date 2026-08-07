import { describe, expect, it } from "vitest";
import {
  CARD_PROGRAMS,
  computePointsByCategory,
  computeTotalPoints,
  type CardProgram,
} from "./credit-rewards-math";

/** Looks up a seeded program by id for tests that exercise real reward tables. */
function program(id: string): CardProgram {
  const found = CARD_PROGRAMS.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`unknown program ${id}`);
  return found;
}

describe("computePointsByCategory", () => {
  it("applies the base rate to categories with no multiplier", () => {
    const result = computePointsByCategory(
      [{ amount: 100, category: "Utilities" }],
      program("basic")
    );
    expect(result).toEqual([{ category: "Utilities", spending: 100, multiplier: 1, points: 100 }]);
  });

  it("applies category multipliers over the base rate for points programs", () => {
    const result = computePointsByCategory(
      [{ amount: 100, category: "Transport" }],
      program("travel")
    );
    expect(result[0]).toEqual({ category: "Transport", spending: 100, multiplier: 3, points: 300 });
  });

  it("floors fractional points for points programs", () => {
    // 1 point per $ at base; $10.99 -> floor(10.99) = 10
    const result = computePointsByCategory(
      [{ amount: 10.99, category: "Other" }],
      program("basic")
    );
    expect(result[0].points).toBe(10);
  });

  it("computes cashback as a rounded dollar value (2dp)", () => {
    // 1.5% of $200 = $3.00 -> round(200 * 1.5) / 100 = 3
    const result = computePointsByCategory(
      [{ amount: 200, category: "Other" }],
      program("flat-cashback")
    );
    expect(result[0].points).toBe(3);
  });

  it("buckets a null category under 'Other'", () => {
    const result = computePointsByCategory([{ amount: 50, category: null }], program("basic"));
    expect(result[0].category).toBe("Other");
  });

  it("aggregates multiple charges within the same category", () => {
    const result = computePointsByCategory(
      [
        { amount: 30, category: "Groceries" },
        { amount: 20, category: "Groceries" },
      ],
      program("grocery")
    );
    expect(result[0]).toEqual({
      category: "Groceries",
      spending: 50,
      multiplier: 5,
      points: 250,
    });
  });

  it("sorts categories by points descending", () => {
    const result = computePointsByCategory(
      [
        { amount: 100, category: "Groceries" }, // 5x -> 500
        { amount: 100, category: "Dining" }, // 3x -> 300
        { amount: 100, category: "Other" }, // 1x -> 100
      ],
      program("grocery")
    );
    expect(result.map((entry) => entry.category)).toEqual(["Groceries", "Dining", "Other"]);
  });

  it("drops categories with no spending", () => {
    const result = computePointsByCategory(
      [
        { amount: 0, category: "Dining" },
        { amount: 40, category: "Groceries" },
      ],
      program("grocery")
    );
    expect(result.map((entry) => entry.category)).toEqual(["Groceries"]);
  });

  it("returns an empty array for no charges", () => {
    expect(computePointsByCategory([], program("basic"))).toEqual([]);
  });
});

describe("computeTotalPoints", () => {
  it("sums points across all categories", () => {
    const categoryPoints = computePointsByCategory(
      [
        { amount: 100, category: "Transport" }, // 3x -> 300
        { amount: 100, category: "Groceries" }, // 2x -> 200
      ],
      program("travel")
    );
    expect(computeTotalPoints(categoryPoints)).toBe(500);
  });

  it("returns 0 for an empty breakdown", () => {
    expect(computeTotalPoints([])).toBe(0);
  });
});
