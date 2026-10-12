import { describe, expect, it } from "vitest";
import {
  calculateUnexplainedDifference,
  computeReceiptSplits,
  MAX_RECEIPT_SPLITS,
  sumReceiptItems,
} from "./receipt-splits";

/** Adds split amounts in whole cents, the way the backend checks them against the total. */
function sumSplitCents(splits: { amount: number }[]): number {
  return splits.reduce((totalCents, split) => totalCents + Math.round(split.amount * 100), 0);
}

describe("sumReceiptItems", () => {
  it("adds amounts without floating-point drift", () => {
    expect(sumReceiptItems([{ amount: 0.1 }, { amount: 0.2 }, { amount: 0.7 }])).toBe(1);
  });

  it("returns 0 for no items", () => {
    expect(sumReceiptItems([])).toBe(0);
  });
});

describe("computeReceiptSplits", () => {
  it("groups items by category when they already add up to the total", () => {
    const splits = computeReceiptSplits(
      [
        { category: "Groceries", amount: 10 },
        { category: "Household", amount: 5 },
        { category: "Groceries", amount: 5 },
      ],
      20
    );

    expect(splits).toEqual([
      { category: "Groceries", amount: 15 },
      { category: "Household", amount: 5 },
    ]);
  });

  it("spreads tax across categories in proportion to what their items cost", () => {
    // $100 of items with 13% tax: each category grows by 13%.
    const splits = computeReceiptSplits(
      [
        { category: "Groceries", amount: 75 },
        { category: "Household", amount: 25 },
      ],
      113
    );

    expect(splits).toEqual([
      { category: "Groceries", amount: 84.75 },
      { category: "Household", amount: 28.25 },
    ]);
  });

  it("shrinks every category proportionally when a discount makes the total smaller", () => {
    const splits = computeReceiptSplits(
      [
        { category: "Clothing", amount: 60 },
        { category: "Shoes", amount: 40 },
      ],
      80
    );

    expect(splits).toEqual([
      { category: "Clothing", amount: 48 },
      { category: "Shoes", amount: 32 },
    ]);
  });

  it("always adds up to the total exactly, giving leftover cents to the largest remainders", () => {
    // Three equal categories can't share $10.00 evenly: 3.34 + 3.33 + 3.33.
    const splits = computeReceiptSplits(
      [
        { category: "A", amount: 1 },
        { category: "B", amount: 1 },
        { category: "C", amount: 1 },
      ],
      10
    );

    expect(splits.map((split) => split.amount)).toEqual([3.34, 3.33, 3.33]);
    expect(sumSplitCents(splits)).toBe(1000);
  });

  it("stays exact for awkward real-world amounts", () => {
    const splits = computeReceiptSplits(
      [
        { category: "Groceries", amount: 1.48 },
        { category: "Groceries", amount: 5.49 },
        { category: "Household", amount: 3.97 },
        { category: "Household", amount: 8.99 },
      ],
      21.61
    );

    expect(sumSplitCents(splits)).toBe(2161);
    expect(splits.map((split) => split.category)).toEqual(["Household", "Groceries"]);
  });

  it("returns a single entry when every item shares one category", () => {
    const splits = computeReceiptSplits(
      [
        { category: "Dining", amount: 12 },
        { category: "Dining", amount: 8 },
      ],
      26.6
    );

    expect(splits).toEqual([{ category: "Dining", amount: 26.6 }]);
  });

  it("orders splits from the largest share to the smallest", () => {
    const splits = computeReceiptSplits(
      [
        { category: "Small", amount: 1 },
        { category: "Large", amount: 9 },
      ],
      10
    );

    expect(splits.map((split) => split.category)).toEqual(["Large", "Small"]);
  });

  it("ignores items with zero or negative amounts", () => {
    const splits = computeReceiptSplits(
      [
        { category: "Groceries", amount: 10 },
        { category: "Returns", amount: -4 },
        { category: "Freebies", amount: 0 },
      ],
      10
    );

    expect(splits).toEqual([{ category: "Groceries", amount: 10 }]);
  });

  it("drops a category whose share rounds down to nothing", () => {
    const splits = computeReceiptSplits(
      [
        { category: "Furniture", amount: 1000 },
        { category: "Bag fee", amount: 0.01 },
      ],
      0.5
    );

    expect(splits).toEqual([{ category: "Furniture", amount: 0.5 }]);
  });

  it("folds the smallest categories into the largest once past the split cap", () => {
    const items = Array.from({ length: MAX_RECEIPT_SPLITS + 2 }, (_, index) => ({
      category: `Category ${index}`,
      // Category 0 is the largest at $12; the last two are the smallest at $2 and $1.
      amount: MAX_RECEIPT_SPLITS + 2 - index,
    }));
    const total = sumReceiptItems(items);

    const splits = computeReceiptSplits(items, total);

    expect(splits).toHaveLength(MAX_RECEIPT_SPLITS);
    expect(splits[0]).toEqual({ category: "Category 0", amount: 12 + 2 + 1 });
    expect(splits.map((split) => split.category)).not.toContain("Category 11");
    expect(sumSplitCents(splits)).toBe(Math.round(total * 100));
  });

  it("keeps exactly the cap's worth of categories without folding", () => {
    const items = Array.from({ length: MAX_RECEIPT_SPLITS }, (_, index) => ({
      category: `Category ${index}`,
      amount: 5,
    }));

    expect(computeReceiptSplits(items, 50)).toHaveLength(MAX_RECEIPT_SPLITS);
  });

  it.each([
    ["the total is zero", [{ category: "Groceries", amount: 10 }], 0],
    ["the total is negative", [{ category: "Groceries", amount: 10 }], -5],
    ["the total is not a number", [{ category: "Groceries", amount: 10 }], Number.NaN],
    ["there are no items", [], 20],
    ["no item has a positive amount", [{ category: "Groceries", amount: 0 }], 20],
  ])("returns no splits when %s", (_description, items, total) => {
    expect(computeReceiptSplits(items, total)).toEqual([]);
  });
});

describe("calculateUnexplainedDifference", () => {
  it("returns 0 when items plus tax equal the total", () => {
    expect(calculateUnexplainedDifference(19.93, 1.68, 0, 21.61)).toBe(0);
  });

  it("returns 0 when a discount accounts for the gap", () => {
    expect(calculateUnexplainedDifference(20, 0, 3.5, 16.5)).toBe(0);
  });

  it("treats a difference of up to two cents as rounding", () => {
    expect(calculateUnexplainedDifference(10, 1.3, 0, 11.32)).toBe(0);
    expect(calculateUnexplainedDifference(10, 1.3, 0, 11.28)).toBe(0);
  });

  it("reports a positive difference when the total is larger than its parts", () => {
    expect(calculateUnexplainedDifference(10, 1.3, 0, 11.33)).toBe(0.03);
    expect(calculateUnexplainedDifference(20, 2.6, 0, 26.6)).toBe(4);
  });

  it("reports a negative difference when the items exceed the total", () => {
    expect(calculateUnexplainedDifference(30, 0, 0, 25)).toBe(-5);
  });
});
