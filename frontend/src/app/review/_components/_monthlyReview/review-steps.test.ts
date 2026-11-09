import { describe, expect, it } from "vitest";
import { buildReviewSteps } from "./review-steps";

const category = {
  category: "Rent",
  spending: 1450,
  previousSpending: 1450,
  changePercent: 0,
  shareOfSpending: 1,
};

describe("buildReviewSteps", () => {
  it("shows only the numbers and the wrap-up for a month with nothing else", () => {
    expect(buildReviewSteps({ topCategories: [], budgets: [], goals: [] })).toEqual([
      "cashFlow",
      "finish",
    ]);
  });

  it("adds each step that has something to show, in order", () => {
    expect(
      buildReviewSteps({
        topCategories: [category],
        budgets: [{} as never],
        goals: [{} as never],
      })
    ).toEqual(["cashFlow", "categories", "budgets", "goals", "finish"]);
  });

  it("skips budgets when there are none but keeps goals", () => {
    expect(
      buildReviewSteps({ topCategories: [category], budgets: [], goals: [{} as never] })
    ).toEqual(["cashFlow", "categories", "goals", "finish"]);
  });
});
