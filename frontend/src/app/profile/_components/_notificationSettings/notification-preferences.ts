import type { NotificationPreferences } from "@/lib/api";

/** Lead-time choices offered for bill reminders, in days before the due date. */
export const LEAD_DAY_OPTIONS = [1, 3, 5, 7];

/** Savings-goal milestones a user can track. 100% is the goal being reached. */
export const MILESTONE_OPTIONS = [25, 50, 75, 100];

/** Mirrors the backend ceiling on the low-balance threshold. */
export const MAX_LOW_BALANCE_THRESHOLD = 1_000_000;

/**
 * Parses a typed low-balance threshold, returning null when it is not a usable
 * dollar amount so the caller can keep the last saved value instead of saving
 * something the backend would reject.
 */
export function parseLowBalanceThreshold(rawValue: string): number | null {
  const trimmed = rawValue.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0 || parsed > MAX_LOW_BALANCE_THRESHOLD) return null;
  return Math.round(parsed * 100) / 100;
}

/**
 * Adds or removes a milestone, keeping the list sorted. Removing the final
 * milestone is ignored because an empty list would leave the toggle on with
 * nothing to alert about (and the backend rejects it).
 */
export function toggleMilestone(percentages: number[], percentage: number): number[] {
  if (percentages.includes(percentage)) {
    if (percentages.length === 1) return percentages;
    return percentages.filter((existing) => existing !== percentage);
  }
  return [...percentages, percentage].sort((first, second) => first - second);
}

/** Counts how many of the five alert kinds are switched on, for the card summary. */
export function countEnabledAlerts(preferences: NotificationPreferences): number {
  const toggles = [
    preferences.billRemindersEnabled,
    preferences.budgetOverspendAlertsEnabled,
    preferences.lowBalanceAlertsEnabled,
    preferences.goalMilestoneAlertsEnabled,
    preferences.subscriptionPriceAlertsEnabled,
  ];
  return toggles.filter(Boolean).length;
}

/** Total number of alert kinds a user can switch on. */
export const TOTAL_ALERT_KINDS = 5;

/** Summarises the card's state for its description line, e.g. "3 of 5 alerts on". */
export function describeEnabledAlerts(preferences: NotificationPreferences): string {
  return `${countEnabledAlerts(preferences)} of ${TOTAL_ALERT_KINDS} alerts on`;
}
