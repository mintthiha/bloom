import { describe, expect, it } from "vitest";
import { normalizeGoalMilestonePercentages } from "./notificationPreferences";

describe("normalizeGoalMilestonePercentages", () => {
  it("sorts milestones ascending", () => {
    expect(normalizeGoalMilestonePercentages([100, 25, 75])).toEqual([25, 75, 100]);
  });

  it("drops duplicates", () => {
    expect(normalizeGoalMilestonePercentages([50, 50, 100])).toEqual([50, 100]);
  });

  it("leaves an already canonical list unchanged", () => {
    expect(normalizeGoalMilestonePercentages([50, 75, 100])).toEqual([50, 75, 100]);
  });

  it("returns an empty list unchanged", () => {
    expect(normalizeGoalMilestonePercentages([])).toEqual([]);
  });
});
