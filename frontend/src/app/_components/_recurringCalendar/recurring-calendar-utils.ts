import { RecurringFrequency, RecurringTransaction } from "@/lib/api";
import { formatLocalDate } from "@/lib/date-range";

export type OccurrenceStatus = "overdue" | "due-soon" | "upcoming";

export type RecurringOccurrence = {
  key: string;
  rule: RecurringTransaction;
  occurrenceDate: string;
  status: OccurrenceStatus;
};

export type MonthGroup = {
  monthLabel: string;
  occurrences: RecurringOccurrence[];
};

const DAYS_AHEAD = 90;
const MAX_OCCURRENCES_PER_RULE = 12;
const DUE_SOON_THRESHOLD_DAYS = 7;

/** Advances a YYYY-MM-DD date by one frequency interval. */
function advanceByFrequency(dateString: string, frequency: RecurringFrequency): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (frequency === "WEEKLY") {
    date.setDate(date.getDate() + 7);
  } else if (frequency === "BIWEEKLY") {
    date.setDate(date.getDate() + 14);
  } else {
    date.setMonth(date.getMonth() + 1);
  }
  return formatLocalDate(date);
}

/** Returns the number of days between two YYYY-MM-DD strings (target minus base). */
function daysBetween(baseDateString: string, targetDateString: string): number {
  const [by, bm, bd] = baseDateString.split("-").map(Number);
  const [ty, tm, td] = targetDateString.split("-").map(Number);
  const baseMs = new Date(by, bm - 1, bd).getTime();
  const targetMs = new Date(ty, tm - 1, td).getTime();
  return Math.round((targetMs - baseMs) / (1000 * 60 * 60 * 24));
}

/** Classifies an occurrence date relative to today. */
function classifyOccurrenceStatus(occurrenceDate: string, today: string): OccurrenceStatus {
  const diff = daysBetween(today, occurrenceDate);
  if (diff < 0) return "overdue";
  if (diff <= DUE_SOON_THRESHOLD_DAYS) return "due-soon";
  return "upcoming";
}

/**
 * Generates upcoming (and overdue) occurrences for all active recurring rules,
 * sorted by date ascending, limited to the next 90 days.
 */
export function computeUpcomingOccurrences(rules: RecurringTransaction[]): RecurringOccurrence[] {
  const today = formatLocalDate(new Date());
  const cutoffDate = (() => {
    const date = new Date();
    date.setDate(date.getDate() + DAYS_AHEAD);
    return formatLocalDate(date);
  })();

  const occurrences: RecurringOccurrence[] = [];

  for (const rule of rules) {
    if (!rule.active) continue;

    let currentDate = rule.nextRunAt.slice(0, 10);
    let count = 0;

    while (currentDate <= cutoffDate && count < MAX_OCCURRENCES_PER_RULE) {
      if (rule.endDate && currentDate > rule.endDate.slice(0, 10)) break;

      occurrences.push({
        key: `${rule.id}-${currentDate}`,
        rule,
        occurrenceDate: currentDate,
        status: classifyOccurrenceStatus(currentDate, today),
      });

      count++;
      currentDate = advanceByFrequency(currentDate, rule.frequency);
    }
  }

  occurrences.sort((a, b) => a.occurrenceDate.localeCompare(b.occurrenceDate));
  return occurrences;
}

/** Groups a sorted list of occurrences by calendar month. */
export function groupOccurrencesByMonth(occurrences: RecurringOccurrence[]): MonthGroup[] {
  const groups = new Map<string, RecurringOccurrence[]>();

  for (const occurrence of occurrences) {
    const [year, month] = occurrence.occurrenceDate.split("-").map(Number);
    const label = new Date(year, month - 1, 1).toLocaleDateString("en-CA", {
      month: "long",
      year: "numeric",
    });
    const existing = groups.get(label);
    if (existing) {
      existing.push(occurrence);
    } else {
      groups.set(label, [occurrence]);
    }
  }

  return Array.from(groups.entries()).map(([monthLabel, groupOccurrences]) => ({
    monthLabel,
    occurrences: groupOccurrences,
  }));
}

/**
 * Returns a human-readable relative date label for a YYYY-MM-DD string.
 * Shows "Today", "Tomorrow", "In N days", or a short date for farther dates.
 */
export function formatRelativeDate(dateString: string): string {
  const today = formatLocalDate(new Date());
  const diff = daysBetween(today, dateString);

  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff <= 14) return `In ${diff} days`;
  if (diff < -1 && diff >= -14) return `${Math.abs(diff)} days ago`;

  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
  });
}
