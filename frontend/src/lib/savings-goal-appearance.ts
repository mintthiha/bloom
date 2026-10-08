import { SavingsGoal } from "@/lib/api";
import { parseAccountColor } from "@/lib/account-identity";
import { ACCOUNT_COLOR_PALETTES } from "@/lib/constants/account";

/** The brand amber used when a goal has no colour of its own, matching `var(--brand-accent)`. */
const DEFAULT_GOAL_PALETTE = {
  color: "#f59e0b",
  soft: "#f59e0b22",
  border: "#f59e0b44",
};

/** Green shown once a goal is funded, so "done" reads the same everywhere in the app. */
const COMPLETE_GOAL_PALETTE = {
  color: "#22c55e",
  soft: "#22c55e22",
  border: "#22c55e44",
};

export type SavingsGoalAppearance = {
  /** Accent for the progress bar, percentage, and icon bubble. */
  color: string;
  soft: string;
  border: string;
  /** The goal's emoji, or null when the caller should fall back to a target icon. */
  icon: string | null;
};

/** The goal fields appearance depends on, so callers can pass a partial in tests. */
export type SavingsGoalAppearanceInput = Pick<SavingsGoal, "color" | "icon" | "percentageReached">;

/**
 * Resolves how a goal should be tinted: a funded goal always goes green so progress reads at a
 * glance, otherwise the user's chosen colour, otherwise the app's amber accent. Goals share the
 * account colour palette so the same colour name looks the same everywhere.
 */
export function resolveSavingsGoalAppearance(
  goal: SavingsGoalAppearanceInput
): SavingsGoalAppearance {
  const customColor = parseAccountColor(goal.color);
  const palette =
    goal.percentageReached >= 100
      ? COMPLETE_GOAL_PALETTE
      : customColor
        ? ACCOUNT_COLOR_PALETTES[customColor]
        : DEFAULT_GOAL_PALETTE;

  return {
    color: palette.color,
    soft: palette.soft,
    border: palette.border,
    icon: goal.icon ?? null,
  };
}
