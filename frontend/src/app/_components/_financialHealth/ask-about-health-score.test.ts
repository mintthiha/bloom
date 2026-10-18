import { describe, expect, it } from "vitest";
import type { HealthScore, SubScore } from "@/lib/financial-health-score";
import { buildHealthScorePrompt, findBiggestOpportunity } from "./ask-about-health-score";

/** Builds a sub-score with a recognisable status and an optional tip. */
function makeSubScore(label: string, score: number, tip: string | null = null): SubScore {
  return { id: label, label, score, status: `${label} status.`, tip };
}

describe("findBiggestOpportunity", () => {
  it("picks the factor with the most points left to gain", () => {
    const subScores = [
      makeSubScore("Savings Rate", 12),
      makeSubScore("Debt Ratio", 5),
      makeSubScore("Emergency Coverage", 15),
    ];
    expect(findBiggestOpportunity(subScores)?.label).toBe("Debt Ratio");
  });

  it("keeps the earlier factor on a tie", () => {
    const subScores = [makeSubScore("Savings Rate", 10), makeSubScore("Net Worth Trend", 10)];
    expect(findBiggestOpportunity(subScores)?.label).toBe("Savings Rate");
  });

  it("skips factors at full marks", () => {
    const subScores = [makeSubScore("Savings Rate", 20), makeSubScore("Debt Ratio", 19)];
    expect(findBiggestOpportunity(subScores)?.label).toBe("Debt Ratio");
  });

  it("returns null when every factor has full marks", () => {
    expect(findBiggestOpportunity([makeSubScore("Savings Rate", 20)])).toBeNull();
    expect(findBiggestOpportunity([])).toBeNull();
  });
});

describe("buildHealthScorePrompt", () => {
  const healthScore: HealthScore = {
    total: 62,
    grade: "C",
    label: "Fair",
    subScores: [
      makeSubScore("Savings Rate", 6, "Review your largest spending categories."),
      makeSubScore("Budget Adherence", 20),
      makeSubScore("Debt Ratio", 14, "Reduce debt below 5% of assets."),
      makeSubScore("Emergency Coverage", 10),
      makeSubScore("Net Worth Trend", 12),
    ],
  };

  it("asks why the score is what it is and what would move it most", () => {
    expect(buildHealthScorePrompt(healthScore)).toMatch(
      /^Why is my financial health score 62 out of 100 \(C, Fair\), and what would move it most\?/
    );
  });

  it("lists every factor with its score and status", () => {
    const prompt = buildHealthScorePrompt(healthScore);
    expect(prompt).toContain("each factor is out of 20");
    expect(prompt).toContain("- Savings Rate: 6/20. Savings Rate status.");
    expect(prompt).toContain("- Budget Adherence: 20/20. Budget Adherence status.");
    expect(prompt).toContain("- Net Worth Trend: 12/20. Net Worth Trend status.");
  });

  it("names the biggest opportunity with its points and Bloom's tip", () => {
    expect(buildHealthScorePrompt(healthScore)).toContain(
      "The factor with the most room to grow is Savings Rate: up to 14 more points. Bloom's tip: Review your largest spending categories."
    );
  });

  it("leaves the tip out when the biggest opportunity has none", () => {
    const prompt = buildHealthScorePrompt({
      ...healthScore,
      subScores: [makeSubScore("Emergency Coverage", 10), makeSubScore("Debt Ratio", 20)],
    });
    expect(prompt).toContain("Emergency Coverage: up to 10 more points.");
    expect(prompt).not.toContain("Bloom's tip");
  });

  it("asks how to keep a perfect score instead of what would move it", () => {
    const prompt = buildHealthScorePrompt({
      total: 100,
      grade: "A",
      label: "Excellent",
      subScores: [makeSubScore("Savings Rate", 20), makeSubScore("Debt Ratio", 20)],
    });
    expect(prompt).toMatch(
      /^My financial health score is 100 out of 100 \(A, Excellent\)\. How do I keep it there\?/
    );
    expect(prompt).not.toContain("most room to grow");
  });
});
