export type RecurringFrequency = "WEEKLY" | "BIWEEKLY" | "MONTHLY";

/** Upper bound on skipped occurrences, so a corrupt decades-old weekly rule can't spin forever. */
export const MAX_SKIPPED_OCCURRENCES = 10_000;

export type SkipMissedPlan = {
  /** How many due occurrences are passed over without posting a transaction. */
  skippedCount: number;
  /** The rule's next run date once the missed occurrences are skipped. */
  nextRunAt: Date;
  /** True when skipping walks past the rule's end date, so the rule should stop. */
  shouldDeactivate: boolean;
};

/** One frequency step forward in UTC, shared by apply-due and skip-missed so both agree on dates. */
export function advanceRunDate(date: Date, frequency: RecurringFrequency): Date {
  const next = new Date(date);

  if (frequency === "WEEKLY") {
    next.setUTCDate(next.getUTCDate() + 7);
    return next;
  }

  if (frequency === "BIWEEKLY") {
    next.setUTCDate(next.getUTCDate() + 14);
    return next;
  }

  next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

/**
 * Works out where a rule's schedule lands after skipping every occurrence due by `now`
 * (the same occurrences "Apply due" would post). Occurrences after the end date aren't
 * counted, and reaching the end date marks the rule for deactivation.
 */
export function planSkipMissedOccurrences(
  rule: { nextRunAt: Date; endDate: Date | null; frequency: RecurringFrequency },
  now: Date
): SkipMissedPlan {
  let nextRunAt = new Date(rule.nextRunAt);
  let skippedCount = 0;

  while (nextRunAt <= now && skippedCount < MAX_SKIPPED_OCCURRENCES) {
    if (rule.endDate && nextRunAt > rule.endDate) break;
    skippedCount += 1;
    nextRunAt = advanceRunDate(nextRunAt, rule.frequency);
  }

  return {
    skippedCount,
    nextRunAt,
    shouldDeactivate: Boolean(rule.endDate && nextRunAt > rule.endDate),
  };
}
