// Month and year helpers shared by the monthly review (/review) and the year recap (/review/year).
// Months are `YYYY-MM` keys in the viewer's own calendar.

const MONTH_KEY_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** True for a well-formed `YYYY-MM` key. */
export function isValidMonthKey(value: string | null | undefined): value is string {
  return typeof value === "string" && MONTH_KEY_PATTERN.test(value);
}

/** Shifts a `YYYY-MM` key by whole months (negative goes back), crossing years as needed. */
export function shiftMonthKey(monthKey: string, monthCount: number): string {
  const [year, month] = monthKey.split("-").map(Number) as [number, number];
  const total = year * 12 + (month - 1) + monthCount;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** The viewer's current month as a `YYYY-MM` key, in their local time. */
export function currentMonthKey(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** The month the review opens on by default: last month, since it's the one that just finished. */
export function defaultReviewMonth(now: Date): string {
  return shiftMonthKey(currentMonthKey(now), -1);
}

/**
 * Picks the month to review from the `?month=` param, falling back to last month when the param
 * is missing, malformed, or in the future (a month that hasn't happened can't be reviewed).
 */
export function resolveReviewMonth(monthParam: string | null, now: Date): string {
  if (!isValidMonthKey(monthParam)) return defaultReviewMonth(now);
  return monthParam > currentMonthKey(now) ? defaultReviewMonth(now) : monthParam;
}

/** True when `monthKey` is the viewer's current month or later (no "next month" link past it). */
export function isCurrentOrFutureMonth(monthKey: string, now: Date): boolean {
  return monthKey >= currentMonthKey(now);
}

/** A month's name, e.g. "October" — or "October 2026" with `includeYear`. */
export function formatMonthName(monthKey: string, includeYear = false): string {
  const [year, month] = monthKey.split("-").map(Number) as [number, number];
  return new Date(year, month - 1, 1).toLocaleDateString("en-CA", {
    month: "long",
    ...(includeYear ? { year: "numeric" } : {}),
  });
}

/** A month's short name for chart axes, e.g. "Oct". */
export function formatShortMonthName(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number) as [number, number];
  return new Date(year, month - 1, 1).toLocaleDateString("en-CA", { month: "short" });
}

/**
 * The year the recap opens on by default: in January, last year (it just ended); otherwise the
 * current year, shown as year-to-date.
 */
export function defaultRecapYear(now: Date): number {
  return now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
}

/** Picks the recap year from `?year=`, falling back to the default for missing, odd, or future years. */
export function resolveRecapYear(yearParam: string | null, now: Date): number {
  if (!yearParam || !/^\d{4}$/.test(yearParam)) return defaultRecapYear(now);
  const year = Number(yearParam);
  return year > now.getFullYear() || year < 2000 ? defaultRecapYear(now) : year;
}

/** December and January are recap season, when the year-in-review link is promoted. */
export function isRecapSeason(now: Date): boolean {
  return now.getMonth() === 11 || now.getMonth() === 0;
}
