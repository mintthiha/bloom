import { describe, expect, it } from "vitest";
import { highestMilestoneReached } from "./goalMilestones";

describe("highestMilestoneReached", () => {
  const DEFAULT_MILESTONES = [50, 75, 100];

  it("returns null below the lowest milestone", () => {
    expect(highestMilestoneReached(49, DEFAULT_MILESTONES)).toBeNull();
  });

  it("returns a milestone the goal has exactly hit", () => {
    expect(highestMilestoneReached(50, DEFAULT_MILESTONES)).toBe(50);
  });

  it("returns only the highest milestone when several were passed at once", () => {
    expect(highestMilestoneReached(80, DEFAULT_MILESTONES)).toBe(75);
  });

  it("returns 100 for a completed goal", () => {
    expect(highestMilestoneReached(100, DEFAULT_MILESTONES)).toBe(100);
  });

  it("caps at 100 for a goal that is over-funded", () => {
    expect(highestMilestoneReached(180, DEFAULT_MILESTONES)).toBe(100);
  });

  it("returns null when the user tracks no milestones", () => {
    expect(highestMilestoneReached(90, [])).toBeNull();
  });

  it("handles an unsorted milestone list", () => {
    expect(highestMilestoneReached(80, [100, 25, 75])).toBe(75);
  });

  it("returns null for an empty goal", () => {
    expect(highestMilestoneReached(0, DEFAULT_MILESTONES)).toBeNull();
  });
});
