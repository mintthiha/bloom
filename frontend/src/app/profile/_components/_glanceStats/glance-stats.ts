/** One tile in the profile page's at-a-glance strip. */
export type GlanceStat = {
  /** Stable key for list rendering. */
  key: string;
  /** The headline figure, already formatted for display. */
  value: string;
  /** What the figure counts, pluralized to match it. */
  label: string;
  /** One short line of context under the label. */
  hint: string;
};

/** The raw figures the strip derives its tiles from; `null` means the read hasn't landed or failed. */
export type GlanceStatsInput = {
  createdAt: string | null;
  accountCount: number | null;
  transactionCount: number | null;
  monthsOfHistory: number | null;
};

/** Stands in for a figure that never arrived, so one failed read degrades to a dash instead of a zero. */
export const UNAVAILABLE_VALUE = "—";

/**
 * Formats a stored ISO timestamp as "Jun 2026". Abbreviated because the tile is only as wide as a
 * quarter of the card, and read in UTC so the label matches the stored signup date rather than
 * slipping to the previous month for viewers west of it.
 */
export function formatMemberSince(createdAt: string | null): string {
  if (!createdAt) return UNAVAILABLE_VALUE;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return UNAVAILABLE_VALUE;
  return created.toLocaleDateString("en-CA", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Renders a count with thousands separators, clamping stray negatives and fractions the API shouldn't send. */
export function formatCount(count: number | null): string {
  if (count === null || !Number.isFinite(count)) return UNAVAILABLE_VALUE;
  return new Intl.NumberFormat("en-CA").format(Math.max(0, Math.trunc(count)));
}

/** Chooses the singular or plural noun for a count, treating an unknown count as plural. */
export function pluralizeLabel(count: number | null, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

/**
 * Builds the four read-only tiles shown under the profile header, so the page opens with a
 * sense of how much history Bloom is holding rather than a wall of settings.
 */
export function buildGlanceStats({
  createdAt,
  accountCount,
  transactionCount,
  monthsOfHistory,
}: GlanceStatsInput): GlanceStat[] {
  return [
    {
      key: "memberSince",
      value: formatMemberSince(createdAt),
      label: "Member since",
      hint: "When you joined Bloom",
    },
    {
      key: "accounts",
      value: formatCount(accountCount),
      label: pluralizeLabel(accountCount, "Account tracked", "Accounts tracked"),
      hint: "Linked and manual accounts",
    },
    {
      key: "transactions",
      value: formatCount(transactionCount),
      label: pluralizeLabel(transactionCount, "Transaction recorded", "Transactions recorded"),
      hint: "Imported and added by hand",
    },
    {
      key: "history",
      value: formatCount(monthsOfHistory),
      label: pluralizeLabel(monthsOfHistory, "Month of history", "Months of history"),
      hint: "Monthly net-worth snapshots",
    },
  ];
}
