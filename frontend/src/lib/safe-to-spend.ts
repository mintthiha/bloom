import { Account, RecurringFrequency, RecurringTransaction } from "@/lib/api";
import { formatLocalDate } from "@/lib/date-range";

/** A single upcoming bill occurrence contributing to the "still due" total. */
export type SafeToSpendBillItem = {
  key: string;
  label: string;
  amount: number;
  date: string;
};

/** Full breakdown behind the safe-to-spend figure, transparent enough to render as a mini ledger. */
export type SafeToSpendResult = {
  availableCash: number;
  expectedIncome: number;
  upcomingBills: number;
  safeToSpend: number;
  daysRemaining: number;
  perDay: number;
  billItems: SafeToSpendBillItem[];
};

// Liquid accounts a user can actually spend from today; registered and credit accounts are excluded.
const LIQUID_ACCOUNT_TYPES = new Set(["CHEQUING", "SAVINGS"]);

// Safety bound on occurrence expansion so a stale rule can never spin the loop indefinitely.
const MAX_OCCURRENCES_PER_RULE = 60;

/** Advances a YYYY-MM-DD date by one frequency interval, preserving local-calendar boundaries. */
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

/**
 * Lists a rule's occurrence dates that fall inside [today, cutoff] inclusive. Expansion starts at
 * the rule's next run and skips any dates before today, so a lapsed rule can't stack stale overdue
 * occurrences into the total — the figure only reflects money scheduled to move for the rest of the month.
 */
function occurrencesInWindow(rule: RecurringTransaction, today: string, cutoff: string): string[] {
  const dates: string[] = [];
  let currentDate = rule.nextRunAt.slice(0, 10);
  let count = 0;

  while (currentDate <= cutoff && count < MAX_OCCURRENCES_PER_RULE) {
    if (rule.endDate && currentDate > rule.endDate.slice(0, 10)) break;
    if (currentDate >= today) dates.push(currentDate);
    currentDate = advanceByFrequency(currentDate, rule.frequency);
    count++;
  }

  return dates;
}

/**
 * Computes how much a user can freely spend for the rest of the current month:
 * liquid cash on hand, plus recurring income still expected, minus recurring bills still due
 * before month-end. Also returns a per-day allowance across the remaining days (today included).
 * `referenceDate` is injectable so the calculation is deterministic under test.
 */
export function computeSafeToSpend(
  accounts: Account[],
  recurringRules: RecurringTransaction[],
  referenceDate: Date = new Date()
): SafeToSpendResult {
  const availableCash = accounts
    .filter((account) => LIQUID_ACCOUNT_TYPES.has(account.accountType))
    .reduce((sum, account) => sum + account.balance, 0);

  const today = formatLocalDate(referenceDate);
  const monthEnd = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);
  const cutoff = formatLocalDate(monthEnd);

  let expectedIncome = 0;
  let upcomingBills = 0;
  const billItems: SafeToSpendBillItem[] = [];

  for (const rule of recurringRules) {
    if (!rule.active) continue;
    for (const date of occurrencesInWindow(rule, today, cutoff)) {
      if (rule.type === "DEPOSIT") {
        expectedIncome += rule.amount;
      } else {
        upcomingBills += rule.amount;
        billItems.push({
          key: `${rule.id}-${date}`,
          label: rule.merchant || rule.name,
          amount: rule.amount,
          date,
        });
      }
    }
  }

  billItems.sort((a, b) => a.date.localeCompare(b.date));

  const safeToSpend = availableCash + expectedIncome - upcomingBills;
  const daysRemaining = monthEnd.getDate() - referenceDate.getDate() + 1;
  const perDay = safeToSpend > 0 ? safeToSpend / daysRemaining : 0;

  return {
    availableCash,
    expectedIncome,
    upcomingBills,
    safeToSpend,
    daysRemaining,
    perDay,
    billItems,
  };
}
