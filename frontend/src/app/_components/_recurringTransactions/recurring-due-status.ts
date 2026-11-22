import type { RecurringFrequency, RecurringTransaction } from "@/lib/api";

/** Safety cap so a years-old weekly rule can't loop for long; the UI shows "N+" past it. */
export const MAX_COUNTED_OCCURRENCES = 100;

export type RuleDueStatus = {
  isDue: boolean;
  /** How many occurrences "Apply due" would post right now (capped at MAX_COUNTED_OCCURRENCES). */
  pendingOccurrenceCount: number;
  /** Total amount of those pending occurrences. */
  pendingTotal: number;
};

/** One frequency step forward, using the same UTC arithmetic as the backend's apply-due loop. */
function advanceRunDate(date: Date, frequency: RecurringFrequency): Date {
  const next = new Date(date);
  if (frequency === "WEEKLY") next.setUTCDate(next.getUTCDate() + 7);
  else if (frequency === "BIWEEKLY") next.setUTCDate(next.getUTCDate() + 14);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

/**
 * Whether a rule is due and how many occurrences have piled up since its next run date,
 * mirroring the backend: only active rules apply, and occurrences after the end date don't count.
 */
export function getRuleDueStatus(rule: RecurringTransaction, now: Date): RuleDueStatus {
  const notDue: RuleDueStatus = { isDue: false, pendingOccurrenceCount: 0, pendingTotal: 0 };
  if (!rule.active) return notDue;

  const endDate = rule.endDate ? new Date(rule.endDate) : null;
  let occurrence = new Date(rule.nextRunAt);
  let pendingOccurrenceCount = 0;
  while (
    occurrence <= now &&
    (!endDate || occurrence <= endDate) &&
    pendingOccurrenceCount < MAX_COUNTED_OCCURRENCES
  ) {
    pendingOccurrenceCount += 1;
    occurrence = advanceRunDate(occurrence, rule.frequency);
  }

  if (pendingOccurrenceCount === 0) return notDue;
  return {
    isDue: true,
    pendingOccurrenceCount,
    pendingTotal: pendingOccurrenceCount * rule.amount,
  };
}

/** Due rules first (keeping their relative order), so what needs attention is at the top. */
export function sortDueRulesFirst(
  rules: RecurringTransaction[],
  now: Date
): RecurringTransaction[] {
  return [...rules].sort(
    (first, second) =>
      Number(getRuleDueStatus(second, now).isDue) - Number(getRuleDueStatus(first, now).isDue)
  );
}
