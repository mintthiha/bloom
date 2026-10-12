const DATE_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Formats a date as the YYYY-MM-DD value a date input expects, in the viewer's own time zone. */
export function formatLocalDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Builds a calendar date in the viewer's time zone, or null when the parts don't name a real day
 * (e.g. month 13, or February 30 — which `Date` would otherwise silently roll into March).
 */
export function toLocalCalendarDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day);
  const isRealDay =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return isRealDay ? date : null;
}

/**
 * Turns the receipt's YYYY-MM-DD date into the moment the transaction is recorded at, or null
 * when the value isn't a real date. A receipt from today is stamped with the current time so it
 * sorts after the day's earlier transactions; any other day is stamped at local noon, which keeps
 * it on the right calendar day however the timestamp is later shifted between time zones.
 */
export function toReceiptEffectiveAt(receiptDate: string, now: Date): Date | null {
  const match = DATE_INPUT_PATTERN.exec(receiptDate);
  if (!match) return null;
  const calendarDate = toLocalCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]));
  if (!calendarDate) return null;
  if (formatLocalDate(calendarDate) === formatLocalDate(now)) return now;
  calendarDate.setHours(12);
  return calendarDate;
}
