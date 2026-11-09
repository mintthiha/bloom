import { describe, expect, it } from "vitest";
import type { YearInReview } from "@/lib/api";
import {
  buildRecapHighlights,
  buildRecapShareText,
  formatAxisDollars,
  recapTitle,
} from "./year-recap";

const money = (amount: number) => `$${amount.toFixed(0)}`;

/** A full year with every highlight present; tests remove what they need to. */
function makeRecap(overrides: Partial<YearInReview> = {}): YearInReview {
  return {
    year: 2026,
    isYearComplete: true,
    hasActivity: true,
    totals: {
      income: 60000,
      spending: 48000,
      netSaved: 12000,
      savingsRate: 0.2,
      transactionCount: 900,
    },
    months: [],
    bestSavingMonth: { month: "2026-03", netSaved: 2100 },
    highestSpendingMonth: { month: "2026-12", spending: 5400 },
    activeMonthCount: 12,
    topCategories: [{ category: "Rent", spending: 17400, shareOfSpending: 0.3625 }],
    biggestExpense: {
      label: "Air Canada",
      amount: 1200,
      category: "Travel",
      effectiveAt: "2026-07-01",
    },
    topMerchant: { label: "Tim Hortons", visitCount: 41, spending: 184 },
    reviewsCompleted: 9,
    goalsReached: ["Emergency fund"],
    ...overrides,
  };
}

describe("formatAxisDollars", () => {
  it("shows plain dollars under $1,000", () => {
    expect(formatAxisDollars(0)).toBe("$0");
    expect(formatAxisDollars(500)).toBe("$500");
  });

  it("keeps one decimal below $10k so $500 steps stay distinct", () => {
    const labels = [1000, 1500, 2000, 2500].map(formatAxisDollars);
    expect(labels).toEqual(["$1k", "$1.5k", "$2k", "$2.5k"]);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("rounds to whole thousands from $10k", () => {
    expect(formatAxisDollars(12400)).toBe("$12k");
  });
});

describe("recapTitle", () => {
  it("says 'in Bloom' for a finished year and 'so far' for the current one", () => {
    expect(recapTitle({ year: 2026, isYearComplete: true })).toBe("2026 in Bloom");
    expect(recapTitle({ year: 2026, isYearComplete: false })).toBe("2026 so far");
  });
});

describe("buildRecapHighlights", () => {
  it("builds every highlight in order when the data is there", () => {
    expect(buildRecapHighlights(makeRecap(), money).map((highlight) => highlight.id)).toEqual([
      "bestSavingMonth",
      "highestSpendingMonth",
      "topCategory",
      "topMerchant",
      "biggestExpense",
      "goalsReached",
      "reviewsCompleted",
    ]);
  });

  it("formats each highlight's value and detail", () => {
    const highlights = buildRecapHighlights(makeRecap(), money);
    const byId = Object.fromEntries(highlights.map((highlight) => [highlight.id, highlight]));
    expect(byId.bestSavingMonth).toMatchObject({ value: "March", detail: "$2100 left over" });
    expect(byId.topCategory).toMatchObject({ value: "Rent", detail: "36% of spending" });
    expect(byId.topMerchant).toMatchObject({ value: "Tim Hortons", detail: "41 visits · $184" });
    expect(byId.goalsReached).toMatchObject({ label: "Goal reached", value: "1" });
  });

  it("drops highlights with no data, including a best month that didn't save anything", () => {
    const recap = makeRecap({
      bestSavingMonth: { month: "2026-03", netSaved: -50 },
      topCategories: [],
      topMerchant: null,
      biggestExpense: null,
      goalsReached: [],
      reviewsCompleted: 0,
    });
    expect(buildRecapHighlights(recap, money).map((highlight) => highlight.id)).toEqual([
      "highestSpendingMonth",
    ]);
  });

  it("pluralises visits, goals, and reviews", () => {
    const recap = makeRecap({
      topMerchant: { label: "Metro", visitCount: 1, spending: 20 },
      goalsReached: ["A", "B"],
      reviewsCompleted: 1,
    });
    const byId = Object.fromEntries(
      buildRecapHighlights(recap, money).map((highlight) => [highlight.id, highlight])
    );
    expect(byId.topMerchant!.detail).toBe("1 visit · $20");
    expect(byId.goalsReached).toMatchObject({ label: "Goals reached", detail: "A, B" });
    expect(byId.reviewsCompleted!.detail).toBe("month reviewed");
  });
});

describe("buildRecapShareText", () => {
  it("leads with the title and totals, then the highlights", () => {
    const text = buildRecapShareText(makeRecap(), money);
    const lines = text.split("\n");
    expect(lines[0]).toBe("2026 in Bloom 🌱");
    expect(lines).toContain("Saved: $12000");
    expect(lines).toContain("Savings rate: 20%");
    expect(lines).toContain("Most visited: Tim Hortons (41 visits · $184)");
  });

  it("reports an overspent year and omits a non-positive savings rate", () => {
    const text = buildRecapShareText(
      makeRecap({
        totals: {
          income: 1000,
          spending: 1500,
          netSaved: -500,
          savingsRate: -0.5,
          transactionCount: 10,
        },
      }),
      money
    );
    expect(text).toContain("Overspent: $500");
    expect(text).not.toContain("Savings rate");
  });
});
