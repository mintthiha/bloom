import type { BudgetHighlightRanking, PayFrequency, PrimaryFinancialGoal } from "@/lib/api";

export const PAY_FREQUENCY_OPTIONS: { value: PayFrequency; label: string }[] = [
  { value: "WEEKLY", label: "Every week" },
  { value: "BIWEEKLY", label: "Every 2 weeks" },
  { value: "SEMIMONTHLY", label: "Twice a month" },
  { value: "MONTHLY", label: "Once a month" },
];

export const PRIMARY_FINANCIAL_GOAL_OPTIONS: {
  value: PrimaryFinancialGoal;
  label: string;
  hint: string;
}[] = [
  {
    value: "EMERGENCY_FUND",
    label: "Build an emergency fund",
    hint: "Saved for future use — Bloom will tailor its guidance to this goal.",
  },
  {
    value: "PAY_OFF_DEBT",
    label: "Pay off debt",
    hint: "Saved for future use — Bloom will tailor its guidance to this goal.",
  },
  {
    value: "BIG_PURCHASE",
    label: "Save for a big purchase",
    hint: "Saved for future use — Bloom will tailor its guidance to this goal.",
  },
  {
    value: "TRACK_SPENDING",
    label: "Just track my spending",
    hint: "Saved for future use — Bloom will tailor its guidance to this goal.",
  },
];

/** The ranking used when the profile has not set one, matching the behaviour before the setting existed. */
export const DEFAULT_BUDGET_HIGHLIGHT_RANKING: BudgetHighlightRanking = "LARGEST_AMOUNT";

export const BUDGET_HIGHLIGHT_RANKING_OPTIONS: {
  value: BudgetHighlightRanking;
  label: string;
  hint: string;
}[] = [
  {
    value: "LARGEST_AMOUNT",
    label: "Biggest dollar cushion",
    hint: "Names the category with the most money left, in dollars. Your largest budgets tend to win.",
  },
  {
    value: "LARGEST_PERCENTAGE",
    label: "Best-managed category",
    hint: "Names the category with the largest share of its limit unspent, so small budgets can win too.",
  },
  {
    value: "CLOSEST_TO_LIMIT",
    label: "Closest to its limit",
    hint: "Names the category you have the least room left in — the most actionable warning before you go over.",
  },
];

/**
 * What the dashboard greeting leads with ahead of the budget line, per primary goal. Used to
 * explain, on the profile form, that the budget-highlight ranking is a tie-breaker for a line the
 * user's goal may outrank — rather than letting the setting imply it always decides the greeting.
 */
const GREETING_LEAD_BY_GOAL: Record<PrimaryFinancialGoal, string | null> = {
  EMERGENCY_FUND: "your emergency fund",
  PAY_OFF_DEBT: "your credit payoff",
  BIG_PURCHASE: "your savings goals",
  // Track-spending users lead with the budget line itself, so there is nothing to warn about.
  TRACK_SPENDING: null,
};

/**
 * Explains when the budget-highlight ranking actually changes the greeting, given the primary
 * goal. Returns null when the budget line already leads, so the form shows no caveat.
 */
export function describeBudgetHighlightApplicability(
  primaryFinancialGoal: PrimaryFinancialGoal | null
): string | null {
  if (!primaryFinancialGoal) return null;
  const lead = GREETING_LEAD_BY_GOAL[primaryFinancialGoal];
  if (!lead) return null;
  return `Your greeting leads with ${lead}, so this only applies once there's no update to show there. An over-budget category always wins.`;
}

/** Average number of paycheques per month for each cadence, used to split monthly income. */
const PAYCHEQUES_PER_MONTH: Record<PayFrequency, number> = {
  WEEKLY: 52 / 12,
  BIWEEKLY: 26 / 12,
  SEMIMONTHLY: 2,
  MONTHLY: 1,
};

/** Days between paycheques, for cadences that advance by a fixed interval. */
const DAYS_BETWEEN_PAYCHEQUES: Partial<Record<PayFrequency, number>> = {
  WEEKLY: 7,
  BIWEEKLY: 14,
};

/**
 * Splits monthly take-home income across the pay cadence so the card can show
 * roughly what lands each payday. Returns null when either input is missing.
 */
export function estimateIncomePerPaycheque(
  monthlyTakeHomeIncome: number | null,
  payFrequency: PayFrequency | null
): number | null {
  if (monthlyTakeHomeIncome === null || payFrequency === null) {
    return null;
  }
  if (!Number.isFinite(monthlyTakeHomeIncome) || monthlyTakeHomeIncome <= 0) {
    return null;
  }
  return monthlyTakeHomeIncome / PAYCHEQUES_PER_MONTH[payFrequency];
}

/**
 * Parses a `YYYY-MM-DD` string as a UTC date, returning null for anything that
 * isn't a real calendar date. Parsing in UTC avoids the local-timezone shift
 * that would otherwise move a payday to the previous day west of Greenwich.
 */
export function parseDateOnly(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return null;
  }
  return parsed;
}

/** Formats a UTC date back to the `YYYY-MM-DD` shape the API stores. */
function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Pins a moment to the start of its **local** calendar day, expressed in the same UTC-midnight
 * space `parseDateOnly` produces so the two can be compared directly.
 *
 * Reading the local date rather than the UTC one matters: west of Greenwich, late evening is
 * already tomorrow in UTC, which would shift every countdown a day ahead of the date the user
 * sees on their own calendar — and out of step with the rest of the app, which is local.
 */
function startOfLocalDay(moment: Date): Date {
  return new Date(Date.UTC(moment.getFullYear(), moment.getMonth(), moment.getDate()));
}

/**
 * Rolls a saved payday forward by its cadence until it is on or after today, so a
 * date the user entered months ago still shows the *next* payday rather than a
 * stale past one. Weekly and bi-weekly step by a fixed interval; monthly and
 * semi-monthly walk calendar months from the anchor day.
 * Returns null when the date or cadence is missing.
 */
export function advancePaydayToUpcoming(
  nextPayday: string | null,
  payFrequency: PayFrequency | null,
  today: Date
): string | null {
  const start = parseDateOnly(nextPayday);
  if (!start || !payFrequency) {
    return null;
  }

  const todayUtc = startOfLocalDay(today);
  if (start >= todayUtc) {
    return formatDateOnly(start);
  }

  const intervalDays = DAYS_BETWEEN_PAYCHEQUES[payFrequency];
  if (intervalDays !== undefined) {
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const elapsedIntervals = Math.ceil(
      (todayUtc.getTime() - start.getTime()) / (intervalDays * millisecondsPerDay)
    );
    return formatDateOnly(
      new Date(start.getTime() + elapsedIntervals * intervalDays * millisecondsPerDay)
    );
  }

  // MONTHLY repeats on the anchor day each month; SEMIMONTHLY adds a second
  // payday 15 days later in the month (the common 15th/end-of-month pattern).
  // Both clamp to the last day of shorter months, so a 31st anchor pays Feb 28.
  const anchorDay = start.getUTCDate();
  const secondAnchorDay = payFrequency === "SEMIMONTHLY" ? anchorDay + 15 : null;
  const year = start.getUTCFullYear();
  const startMonth = start.getUTCMonth();

  for (let monthsAhead = 0; monthsAhead <= 1200; monthsAhead += 1) {
    const month = startMonth + monthsAhead;
    const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const daysThisMonth = secondAnchorDay !== null ? [anchorDay, secondAnchorDay] : [anchorDay];
    for (const day of daysThisMonth) {
      const candidate = new Date(Date.UTC(year, month, Math.min(day, lastDayOfMonth)));
      if (candidate >= todayUtc) {
        return formatDateOnly(candidate);
      }
    }
  }
  return null;
}

/**
 * Whole days from today until a `YYYY-MM-DD` date, in UTC.
 * Returns null when the date can't be parsed.
 */
export function getDaysUntil(dateOnly: string | null, today: Date): number | null {
  const target = parseDateOnly(dateOnly);
  if (!target) {
    return null;
  }
  const todayUtc = startOfLocalDay(today).getTime();
  return Math.round((target.getTime() - todayUtc) / (24 * 60 * 60 * 1000));
}

/**
 * Builds the plain-language summary shown under the form, e.g.
 * "About $1,730.77 lands every 2 weeks — next payday in 5 days."
 * Returns null when there isn't enough saved data to say anything useful.
 */
export function describePayCycle(
  monthlyTakeHomeIncome: number | null,
  payFrequency: PayFrequency | null,
  nextPayday: string | null,
  today: Date
): string | null {
  if (!payFrequency) {
    return null;
  }

  const cadenceLabel =
    PAY_FREQUENCY_OPTIONS.find((option) => option.value === payFrequency)?.label.toLowerCase() ??
    "";
  const perPaycheque = estimateIncomePerPaycheque(monthlyTakeHomeIncome, payFrequency);

  const amountPart =
    perPaycheque !== null
      ? `About ${perPaycheque.toLocaleString("en-CA", {
          style: "currency",
          currency: "CAD",
        })} lands ${cadenceLabel}`
      : `You're paid ${cadenceLabel}`;

  const upcomingPayday = advancePaydayToUpcoming(nextPayday, payFrequency, today);
  const daysUntil = getDaysUntil(upcomingPayday, today);
  if (daysUntil === null) {
    return `${amountPart}.`;
  }
  if (daysUntil === 0) {
    return `${amountPart} — payday is today.`;
  }
  if (daysUntil === 1) {
    return `${amountPart} — next payday is tomorrow.`;
  }
  return `${amountPart} — next payday in ${daysUntil} days.`;
}
