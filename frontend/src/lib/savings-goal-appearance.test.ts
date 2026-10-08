import { describe, expect, it } from "vitest";
import { resolveSavingsGoalAppearance } from "./savings-goal-appearance";
import { ACCOUNT_COLOR_PALETTES } from "./constants/account";

describe("resolveSavingsGoalAppearance", () => {
  it("uses the amber app accent when the goal has no colour of its own", () => {
    const appearance = resolveSavingsGoalAppearance({
      color: null,
      icon: null,
      percentageReached: 40,
    });

    expect(appearance.color).toBe("#f59e0b");
    expect(appearance.icon).toBeNull();
  });

  it("uses the shared palette entry for a recognized colour name", () => {
    const appearance = resolveSavingsGoalAppearance({
      color: "VIOLET",
      icon: "✈️",
      percentageReached: 40,
    });

    expect(appearance.color).toBe(ACCOUNT_COLOR_PALETTES.VIOLET.color);
    expect(appearance.icon).toBe("✈️");
  });

  it("falls back to the app accent for an unrecognized colour name", () => {
    const appearance = resolveSavingsGoalAppearance({
      color: "CHARTREUSE",
      icon: null,
      percentageReached: 40,
    });

    expect(appearance.color).toBe("#f59e0b");
  });

  it("goes green once the goal is funded, overriding the chosen colour", () => {
    const appearance = resolveSavingsGoalAppearance({
      color: "VIOLET",
      icon: null,
      percentageReached: 100,
    });

    expect(appearance.color).toBe("#22c55e");
  });

  it("keeps the chosen colour just below completion", () => {
    const appearance = resolveSavingsGoalAppearance({
      color: "VIOLET",
      icon: null,
      percentageReached: 99.9,
    });

    expect(appearance.color).toBe(ACCOUNT_COLOR_PALETTES.VIOLET.color);
  });
});
