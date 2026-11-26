import type { RecurringTransaction } from "@/lib/api";
import { MAX_COUNTED_OCCURRENCES, type RuleDueStatus } from "./recurring-due-status";

export type SkipMissedConfirmation = { title: string; description: string };

/** "Jul 29, 2026" in the user's local calendar, matching the dates the rule rows show. */
function formatRunDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-CA", { dateStyle: "medium" });
}

/** "1 missed payment" / "4 missed payments" / "100+ missed payments" once the count is capped. */
function describeMissedPaymentCount(count: number): string {
  const countLabel = count >= MAX_COUNTED_OCCURRENCES ? `${MAX_COUNTED_OCCURRENCES}+` : `${count}`;
  return `${countLabel} missed payment${count === 1 ? "" : "s"}`;
}

/**
 * Title and body for the "Skip missed" confirm: what gets passed over, that no money moves,
 * and where the schedule picks up afterwards (or that it ends, if the end date has passed).
 */
export function describeSkipMissedConfirmation(
  rule: RecurringTransaction,
  dueStatus: RuleDueStatus,
  formatAmount: (amount: number) => string
): SkipMissedConfirmation {
  const missedPayments = describeMissedPaymentCount(dueStatus.pendingOccurrenceCount);
  const whatHappensNext = dueStatus.endsAfterPending
    ? `"${rule.name}" is past its end date, so it will stop after this.`
    : dueStatus.nextUpcomingRunAt
      ? `"${rule.name}" picks up again on ${formatRunDate(dueStatus.nextUpcomingRunAt)}.`
      : `"${rule.name}" picks up again at its next upcoming date.`;

  return {
    title: `Skip ${missedPayments} for "${rule.name}"?`,
    description:
      `The ${missedPayments} due since ${formatRunDate(rule.nextRunAt)} ` +
      `(${formatAmount(dueStatus.pendingTotal)}) won't be recorded, and no account balance changes. ` +
      `Use this for payments you already entered another way. ${whatHappensNext}`,
  };
}

/** Success toast after a skip, e.g. `Skipped 4 missed payments for "Rent"`. */
export function describeSkipMissedSuccess(ruleName: string, skippedCount: number): string {
  return `Skipped ${skippedCount} missed payment${skippedCount === 1 ? "" : "s"} for "${ruleName}"`;
}
