/**
 * Pure subscription-detection logic. Given raw WITHDRAWAL charges (with a
 * merchant) and known WITHDRAWAL recurring rules, this module groups charges by
 * merchant, infers a billing cadence from the spacing between charges, and
 * surfaces the ones that look like recurring subscriptions. No database access
 * lives here so the rules can be unit-tested in isolation.
 */

export type SubscriptionCadence = "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUAL";

/** Where a surfaced subscription came from: detected history, a known rule, or both agreeing. */
export type SubscriptionSource = "detected" | "rule" | "both";

/** A single WITHDRAWAL charge fed into the detector. */
export type SubscriptionCharge = {
  merchant: string;
  amount: number;
  date: Date;
};

/** A known recurring WITHDRAWAL rule that can confirm or stand in for a subscription. */
export type SubscriptionRule = {
  merchant: string | null;
  name: string;
  amount: number;
  frequency: "WEEKLY" | "BIWEEKLY" | "MONTHLY";
};

/** A step change in a subscription's price between its two most recent distinct amounts. */
export type SubscriptionPriceChange = {
  from: number;
  to: number;
  /** Percentage increase from `from` to `to`, rounded to one decimal place. */
  pct: number;
};

/** One surfaced subscription, with its inferred cadence and normalized monthly cost. */
export type Subscription = {
  merchant: string;
  cadence: SubscriptionCadence;
  currentPrice: number;
  monthlyCost: number;
  occurrences: number;
  lastChargedAt: Date | null;
  nextExpectedAt: Date | null;
  source: SubscriptionSource;
  priceChange: SubscriptionPriceChange | null;
};

/** Full summary returned to the API: headline totals plus the per-subscription list. */
export type SubscriptionSummary = {
  monthlyTotal: number;
  annualTotal: number;
  count: number;
  subscriptions: Subscription[];
};

/** Minimum number of charges from one merchant before a cadence can be inferred. */
const MINIMUM_OCCURRENCES = 3;

/**
 * Widest allowed ratio between the largest and smallest charge from one merchant.
 * Subscriptions have stable prices; a spread beyond this means variable spend
 * (e.g. groceries) rather than a subscription. A clean price increase stays well
 * within this band and is reported separately via `priceChange`.
 */
const MAXIMUM_AMOUNT_RATIO = 1.5;

/** Smallest fractional increase (1%) that counts as a real price hike rather than rounding noise. */
const PRICE_INCREASE_THRESHOLD = 0.01;

/** Cadence bands keyed by the inclusive day-interval range that maps to each cadence. */
const CADENCE_BANDS: { cadence: SubscriptionCadence; minDays: number; maxDays: number }[] = [
  { cadence: "WEEKLY", minDays: 5, maxDays: 9 },
  { cadence: "BIWEEKLY", minDays: 11, maxDays: 17 },
  { cadence: "MONTHLY", minDays: 24, maxDays: 38 },
  { cadence: "QUARTERLY", minDays: 79, maxDays: 103 },
  { cadence: "ANNUAL", minDays: 325, maxDays: 405 },
];

/** Multiplier that converts one charge at a given cadence into its monthly-equivalent cost. */
const CADENCE_TO_MONTHLY: Record<SubscriptionCadence, number> = {
  WEEKLY: 52 / 12,
  BIWEEKLY: 26 / 12,
  MONTHLY: 1,
  QUARTERLY: 1 / 3,
  ANNUAL: 1 / 12,
};

/** Typical interval in days for each cadence, used to project the next expected charge. */
const CADENCE_INTERVAL_DAYS: Record<SubscriptionCadence, number> = {
  WEEKLY: 7,
  BIWEEKLY: 14,
  MONTHLY: 30,
  QUARTERLY: 91,
  ANNUAL: 365,
};

/** Normalizes a merchant name to a comparison key (trimmed, lowercased, collapsed whitespace). */
function normalizeMerchantKey(merchant: string): string {
  return merchant.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Maps a recurring rule's frequency onto the detector's cadence vocabulary. */
function ruleFrequencyToCadence(frequency: SubscriptionRule["frequency"]): SubscriptionCadence {
  return frequency;
}

/** Returns the median of a numeric list; the list must be non-empty. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

/** Classifies a median day-interval into a cadence band, or null when it fits no band. */
function classifyCadence(medianIntervalDays: number): SubscriptionCadence | null {
  for (const band of CADENCE_BANDS) {
    if (medianIntervalDays >= band.minDays && medianIntervalDays <= band.maxDays) {
      return band.cadence;
    }
  }
  return null;
}

/** Rounds a monetary value to whole cents to avoid floating-point drift in totals. */
function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Detects a price increase by comparing the most recent charge amount against the
 * most recent *earlier* amount that differs from it. Returns null when the price
 * never rose beyond the threshold.
 */
function detectPriceChange(sortedAmounts: number[]): SubscriptionPriceChange | null {
  if (sortedAmounts.length < 2) return null;

  const latest = sortedAmounts[sortedAmounts.length - 1];
  for (let index = sortedAmounts.length - 2; index >= 0; index -= 1) {
    const previous = sortedAmounts[index];
    if (previous === latest) continue;
    if (latest > previous * (1 + PRICE_INCREASE_THRESHOLD)) {
      return {
        from: roundToCents(previous),
        to: roundToCents(latest),
        pct: Math.round(((latest - previous) / previous) * 1000) / 10,
      };
    }
    // The first differing earlier amount that is not an increase settles the comparison.
    return null;
  }
  return null;
}

/** Milliseconds in a day, for converting timestamp deltas into day counts. */
const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Attempts to detect a subscription from one merchant's charges. Returns null
 * when the group is too small, has an irregular cadence, or has too wide an
 * amount spread to be a subscription.
 */
function detectFromCharges(merchant: string, charges: SubscriptionCharge[]): Subscription | null {
  if (charges.length < MINIMUM_OCCURRENCES) return null;

  const sorted = [...charges].sort((a, b) => a.date.getTime() - b.date.getTime());

  const intervals: number[] = [];
  for (let index = 1; index < sorted.length; index += 1) {
    const deltaDays =
      (sorted[index].date.getTime() - sorted[index - 1].date.getTime()) / MILLISECONDS_PER_DAY;
    intervals.push(deltaDays);
  }

  const cadence = classifyCadence(median(intervals));
  if (!cadence) return null;

  const amounts = sorted.map((charge) => charge.amount);
  const minAmount = Math.min(...amounts);
  const maxAmount = Math.max(...amounts);
  if (minAmount <= 0 || maxAmount / minAmount > MAXIMUM_AMOUNT_RATIO) return null;

  const lastCharge = sorted[sorted.length - 1];
  const currentPrice = lastCharge.amount;
  const nextExpectedAt = new Date(
    lastCharge.date.getTime() + CADENCE_INTERVAL_DAYS[cadence] * MILLISECONDS_PER_DAY
  );

  return {
    merchant,
    cadence,
    currentPrice: roundToCents(currentPrice),
    monthlyCost: roundToCents(currentPrice * CADENCE_TO_MONTHLY[cadence]),
    occurrences: sorted.length,
    lastChargedAt: lastCharge.date,
    nextExpectedAt,
    source: "detected",
    priceChange: detectPriceChange(amounts),
  };
}

/**
 * Groups charges by merchant, detects recurring subscriptions, merges in known
 * WITHDRAWAL recurring rules (deduped by merchant), and returns headline totals
 * plus the per-subscription list sorted by monthly cost descending.
 */
export function detectSubscriptions(
  charges: SubscriptionCharge[],
  rules: SubscriptionRule[]
): SubscriptionSummary {
  const groups = new Map<string, { display: string; charges: SubscriptionCharge[] }>();
  for (const charge of charges) {
    if (!charge.merchant.trim()) continue;
    const key = normalizeMerchantKey(charge.merchant);
    const group = groups.get(key);
    if (group) {
      group.charges.push(charge);
    } else {
      groups.set(key, { display: charge.merchant.trim(), charges: [charge] });
    }
  }

  const detectedByKey = new Map<string, Subscription>();
  for (const [key, group] of groups) {
    const detected = detectFromCharges(group.display, group.charges);
    if (detected) detectedByKey.set(key, detected);
  }

  // Merge rules: a rule with a matching detected merchant confirms it ("both");
  // a rule with no match is surfaced on its own ("rule"). Rules without a merchant
  // cannot be matched or surfaced by merchant, so they are skipped.
  const matchedRuleKeys = new Set<string>();
  const ruleOnlySubscriptions: Subscription[] = [];
  for (const rule of rules) {
    if (!rule.merchant || !rule.merchant.trim()) continue;
    const key = normalizeMerchantKey(rule.merchant);
    const detected = detectedByKey.get(key);
    if (detected) {
      detected.source = "both";
      matchedRuleKeys.add(key);
      continue;
    }
    if (matchedRuleKeys.has(key)) continue;
    matchedRuleKeys.add(key);
    const cadence = ruleFrequencyToCadence(rule.frequency);
    ruleOnlySubscriptions.push({
      merchant: rule.merchant.trim(),
      cadence,
      currentPrice: roundToCents(rule.amount),
      monthlyCost: roundToCents(rule.amount * CADENCE_TO_MONTHLY[cadence]),
      occurrences: 0,
      lastChargedAt: null,
      nextExpectedAt: null,
      source: "rule",
      priceChange: null,
    });
  }

  const subscriptions = [...detectedByKey.values(), ...ruleOnlySubscriptions].sort(
    (a, b) => b.monthlyCost - a.monthlyCost
  );

  const monthlyTotal = roundToCents(
    subscriptions.reduce((sum, subscription) => sum + subscription.monthlyCost, 0)
  );

  return {
    monthlyTotal,
    annualTotal: roundToCents(monthlyTotal * 12),
    count: subscriptions.length,
    subscriptions,
  };
}
