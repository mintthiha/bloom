import { formatLocalDate } from "@/lib/date-range";

export type ReminderUrgency = "overdue" | "due-soon" | "upcoming";

const DUE_SOON_THRESHOLD_DAYS = 7;

/** Returns whole days from `today` to `dueDate` (both YYYY-MM-DD); negative when overdue. */
export function daysUntil(dueDate: string, today: string = formatLocalDate(new Date())): number {
  const [dy, dm, dd] = dueDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  const dueMs = new Date(dy, dm - 1, dd).getTime();
  const todayMs = new Date(ty, tm - 1, td).getTime();
  return Math.round((dueMs - todayMs) / (1000 * 60 * 60 * 24));
}

/**
 * Classifies how urgent a reminder is relative to today. Reminders without a
 * due date are treated as plain upcoming items.
 */
export function classifyReminderUrgency(
  dueDate: string | null,
  today: string = formatLocalDate(new Date())
): ReminderUrgency {
  if (!dueDate) return "upcoming";
  const diff = daysUntil(dueDate, today);
  if (diff < 0) return "overdue";
  if (diff <= DUE_SOON_THRESHOLD_DAYS) return "due-soon";
  return "upcoming";
}

/** Human-readable relative label for a due date, e.g. "Today", "In 3 days", "2 days ago". */
export function formatDueLabel(
  dueDate: string | null,
  today: string = formatLocalDate(new Date())
): string {
  if (!dueDate) return "";
  const diff = daysUntil(dueDate, today);
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  if (diff === -1) return "1 day overdue";
  if (diff > 1) return `Due in ${diff} days`;
  return `${Math.abs(diff)} days overdue`;
}
