/**
 * Picks the single highest milestone a savings goal has reached, or null when it
 * has not reached any. Only the highest fires so a goal that jumps straight from
 * 10% to 80% raises one notification instead of one per milestone passed.
 */
export function highestMilestoneReached(
  percentageReached: number,
  milestonePercentages: number[]
): number | null {
  let highest: number | null = null;
  for (const milestone of milestonePercentages) {
    if (percentageReached < milestone) continue;
    if (highest === null || milestone > highest) highest = milestone;
  }
  return highest;
}
