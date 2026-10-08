import { SavingsGoal } from "@/lib/api";
import { getDaysUntil, parseDateOnly } from "@/lib/financial-profile";
import { formatCurrency } from "@/lib/format";

/**
 * Turns a savings goal's target date into the only number that actually helps a beginner:
 * how much to put aside each month (or week, when the deadline is close) to make it.
 */

/** Average days in a calendar month (365.2425 / 12), used to turn a day count into months. */
const DAYS_PER_MONTH = 30.436875;

/** At or below this many days left, a monthly figure is misleading, so the pace is quoted per week. */
export const WEEKLY_PACE_THRESHOLD_DAYS = 31;

export type GoalPaceStatus =
  /** The linked account already covers the target. */
  | "COMPLETE"
  /** No deadline saved, so there is nothing to pace against. */
  | "NO_TARGET_DATE"
  /** The deadline has gone by with money still to save. */
  | "PAST_DUE"
  /** A month or less to go — paced per week rather than per month. */
  | "DUE_SOON"
  /** More than a month to go — paced per month. */
  | "ON_SCHEDULE";

export type GoalPace = {
  status: GoalPaceStatus;
  /** Money still needed to hit the target; 0 once the goal is reached. */
  remainingAmount: number;
  /** Whole days until the target date (negative once past due), or null without a target date. */
  daysRemaining: number | null;
  /** Amount to set aside each month to make it, or null when no pace can be computed. */
  requiredMonthlyContribution: number | null;
  /** Amount to set aside each week to make it, or null when no pace can be computed. */
  requiredWeeklyContribution: number | null;
  /** One-line plain-language version of the above, ready to render under the progress bar. */
  summary: string;
};

/** The goal fields the pace math needs, so callers can pass a partial in tests. */
export type GoalPaceInput = Pick<SavingsGoal, "currentBalance" | "targetAmount" | "targetDate">;

/** Rounds a contribution up to the cent, so the quoted pace never undershoots the target. */
function roundUpToCent(amount: number): number {
  return Math.ceil(amount * 100) / 100;
}

/**
 * Works out what it takes to reach a goal by its target date.
 *
 * Periods shorter than one month (or one week) are floored at that single period: with 10 days
 * left you need the whole remainder inside one week, not seven times it. `today` is injectable
 * so tests are deterministic.
 */
export function calculateGoalPace(goal: GoalPaceInput, today: Date = new Date()): GoalPace {
  const remainingAmount = Math.max(goal.targetAmount - goal.currentBalance, 0);

  if (remainingAmount === 0) {
    return {
      status: "COMPLETE",
      remainingAmount: 0,
      daysRemaining: goal.targetDate ? getDaysUntil(goal.targetDate, today) : null,
      requiredMonthlyContribution: null,
      requiredWeeklyContribution: null,
      summary: "Goal reached — nothing left to save.",
    };
  }

  const daysRemaining = getDaysUntil(goal.targetDate, today);
  if (daysRemaining === null) {
    return {
      status: "NO_TARGET_DATE",
      remainingAmount,
      daysRemaining: null,
      requiredMonthlyContribution: null,
      requiredWeeklyContribution: null,
      summary: `${formatCurrency(remainingAmount)} to go — add a target date to see a monthly pace.`,
    };
  }

  if (daysRemaining < 0) {
    return {
      status: "PAST_DUE",
      remainingAmount,
      daysRemaining,
      requiredMonthlyContribution: null,
      requiredWeeklyContribution: null,
      summary: `Target date has passed — still ${formatCurrency(remainingAmount)} to go.`,
    };
  }

  const requiredMonthlyContribution = roundUpToCent(
    remainingAmount / Math.max(daysRemaining / DAYS_PER_MONTH, 1)
  );
  const requiredWeeklyContribution = roundUpToCent(
    remainingAmount / Math.max(daysRemaining / 7, 1)
  );

  if (daysRemaining <= WEEKLY_PACE_THRESHOLD_DAYS) {
    return {
      status: "DUE_SOON",
      remainingAmount,
      daysRemaining,
      requiredMonthlyContribution,
      requiredWeeklyContribution,
      summary:
        daysRemaining === 0
          ? `${formatCurrency(remainingAmount)} to go and the target date is today.`
          : `Save ${formatCurrency(requiredWeeklyContribution)}/week to make it with ${daysRemaining} ${
              daysRemaining === 1 ? "day" : "days"
            } left.`,
    };
  }

  return {
    status: "ON_SCHEDULE",
    remainingAmount,
    daysRemaining,
    requiredMonthlyContribution,
    requiredWeeklyContribution,
    summary: `Save ${formatCurrency(requiredMonthlyContribution)}/month to make it by ${formatTargetMonth(
      goal.targetDate
    )}.`,
  };
}

/** Formats a target date as a short month and year ("Jun 2027") for the pace summary. */
export function formatTargetMonth(targetDate: string | null): string {
  const parsed = parseDateOnly(targetDate);
  if (!parsed) return "your target date";
  return parsed.toLocaleDateString("en-CA", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Formats a target date as a full day label ("Jun 30, 2027") for the target-date chip. */
export function formatTargetDate(targetDate: string | null): string | null {
  const parsed = parseDateOnly(targetDate);
  if (!parsed) return null;
  return parsed.toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
