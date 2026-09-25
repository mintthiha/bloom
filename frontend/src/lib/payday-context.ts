import { Profile } from "@/lib/api";
import { advancePaydayToUpcoming, getDaysUntil } from "@/lib/financial-profile";
import { SafeToSpendBillItem } from "@/lib/safe-to-spend";

/** Paycheque-shaped context layered onto the month-end safe-to-spend figure. */
export type PaydayContext = {
  /** The next payday, as `YYYY-MM-DD`, rolled forward from the saved anchor date. */
  payday: string;
  /** Whole days from today until that payday; 0 means payday is today. */
  daysUntilPayday: number;
  /** Total of the bills falling before payday — the part of the figure you need sooner. */
  billsBeforePayday: number;
  /** Total of the bills falling on or after payday, which the next paycheque can cover. */
  billsAfterPayday: number;
};

/**
 * The part of the financial profile this needs. Structural rather than a whole `Profile`
 * so callers can pass a partial without inventing the other fields.
 */
export type PayCycleProfile = Pick<Profile, "payFrequency" | "nextPayday">;

/**
 * Splits the already-computed month-end bills around the user's next payday.
 *
 * Safe to Spend answers "what's left after this month's bills", which silently reserves money
 * for bills that may not hit for weeks. This says how much of that reservation is needed
 * *before* the next paycheque arrives — the gap between the two is what the next cheque covers.
 *
 * Returns null when no pay cycle is saved, so the card simply omits the line rather than
 * showing a hedged or zeroed figure. `referenceDate` is injectable for deterministic tests.
 */
export function computePaydayContext(
  billItems: SafeToSpendBillItem[],
  profile: PayCycleProfile | null | undefined,
  referenceDate: Date = new Date()
): PaydayContext | null {
  if (!profile?.payFrequency || !profile?.nextPayday) {
    return null;
  }

  const payday = advancePaydayToUpcoming(profile.nextPayday, profile.payFrequency, referenceDate);
  if (!payday) {
    return null;
  }

  const daysUntilPayday = getDaysUntil(payday, referenceDate);
  if (daysUntilPayday === null) {
    return null;
  }

  let billsBeforePayday = 0;
  let billsAfterPayday = 0;
  for (const bill of billItems) {
    // A bill dated on payday itself is covered by that cheque, so it counts as "after".
    if (bill.date < payday) {
      billsBeforePayday += bill.amount;
    } else {
      billsAfterPayday += bill.amount;
    }
  }

  return { payday, daysUntilPayday, billsBeforePayday, billsAfterPayday };
}
