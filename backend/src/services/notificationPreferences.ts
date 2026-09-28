/**
 * Shared shape and defaults for the per-user notification preferences stored on
 * the Profile row. Lives apart from the services so both the generator
 * (reminderService) and the writer (profileService) agree on one definition.
 */
export type NotificationPreferences = {
  billRemindersEnabled: boolean;
  billReminderLeadDays: number;
  budgetOverspendAlertsEnabled: boolean;
  lowBalanceAlertsEnabled: boolean;
  lowBalanceThreshold: number;
  goalMilestoneAlertsEnabled: boolean;
  goalMilestonePercentages: number[];
  subscriptionPriceAlertsEnabled: boolean;
};

/** Upper bound on how far ahead of a due date a bill reminder may be raised. */
export const MAX_REMINDER_LEAD_DAYS = 30;

/** Upper bound on the low-balance threshold, matching the column's precision. */
export const MAX_LOW_BALANCE_THRESHOLD = 1_000_000;

/** How many distinct savings-goal milestones a user may track at once. */
export const MAX_GOAL_MILESTONES = 6;

/** Column defaults, mirrored here so a missing profile still behaves sensibly. */
export const DEFAULT_BILL_REMINDER_LEAD_DAYS = 3;
export const DEFAULT_LOW_BALANCE_THRESHOLD = 100;
export const DEFAULT_GOAL_MILESTONE_PERCENTAGES = [50, 75, 100];

/**
 * Preferences applied when the user has no Profile row yet. Alerts derived from
 * their data stay on, but bill reminders stay off because opting into those has
 * always required a saved profile.
 */
export const PREFERENCES_WITHOUT_PROFILE: NotificationPreferences = {
  billRemindersEnabled: false,
  billReminderLeadDays: DEFAULT_BILL_REMINDER_LEAD_DAYS,
  budgetOverspendAlertsEnabled: true,
  lowBalanceAlertsEnabled: true,
  lowBalanceThreshold: DEFAULT_LOW_BALANCE_THRESHOLD,
  goalMilestoneAlertsEnabled: true,
  goalMilestonePercentages: DEFAULT_GOAL_MILESTONE_PERCENTAGES,
  subscriptionPriceAlertsEnabled: true,
};

/**
 * Sorts milestone percentages ascending and drops duplicates so the stored
 * array is canonical regardless of the order the client sent them in.
 */
export function normalizeGoalMilestonePercentages(percentages: number[]): number[] {
  return [...new Set(percentages)].sort((first, second) => first - second);
}
