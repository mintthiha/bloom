import { HealthScore, SUB_SCORE_MAX_POINTS, SubScore } from "@/lib/financial-health-score";

/**
 * Picks the factor with the most points left to gain — the one that would move the score most.
 * Worked out here rather than left to the model, which is unreliable at arithmetic. The earlier
 * factor wins a tie; returns null when every factor already has full marks.
 */
export function findBiggestOpportunity(subScores: SubScore[]): SubScore | null {
  let biggestOpportunity: SubScore | null = null;
  for (const subScore of subScores) {
    const pointsAvailable = SUB_SCORE_MAX_POINTS - subScore.score;
    if (pointsAvailable <= 0) continue;
    if (!biggestOpportunity || subScore.score < biggestOpportunity.score) {
      biggestOpportunity = subScore;
    }
  }
  return biggestOpportunity;
}

/** Builds the chat question for the health score card, carrying the full factor breakdown. */
export function buildHealthScorePrompt(healthScore: HealthScore): string {
  const scoreSummary = `${healthScore.total} out of 100 (${healthScore.grade}, ${healthScore.label})`;
  const biggestOpportunity = findBiggestOpportunity(healthScore.subScores);

  const question = biggestOpportunity
    ? `Why is my financial health score ${scoreSummary}, and what would move it most?`
    : `My financial health score is ${scoreSummary}. How do I keep it there?`;

  const factorLines = healthScore.subScores.map(
    (subScore) =>
      `- ${subScore.label}: ${subScore.score}/${SUB_SCORE_MAX_POINTS}. ${subScore.status}`
  );

  const sections = [
    question,
    [`My score breakdown (each factor is out of ${SUB_SCORE_MAX_POINTS}):`, ...factorLines].join(
      "\n"
    ),
  ];

  if (biggestOpportunity) {
    const pointsAvailable = SUB_SCORE_MAX_POINTS - biggestOpportunity.score;
    const tip = biggestOpportunity.tip ? ` Bloom's tip: ${biggestOpportunity.tip}` : "";
    sections.push(
      `The factor with the most room to grow is ${biggestOpportunity.label}: up to ${pointsAvailable} more points.${tip}`
    );
  }

  return sections.join("\n\n");
}
