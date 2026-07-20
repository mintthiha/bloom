/**
 * Pure carry-forward math for envelope/rollover budgeting. Kept free of Prisma
 * so the month-chain logic can be unit tested in isolation.
 */

/** A budget's stored per-month inputs: an optional limit override and a manual move in/out. */
export type MonthOverride = {
  limitOverride: number | null;
  adjustment: number;
};

/** The derived envelope figures for a single month. */
export type RolloverMonth = {
  month: string;
  limit: number;
  carryIn: number;
  adjustment: number;
  available: number;
  spent: number;
  carryOut: number;
};

/** Formats a Date as a `YYYY-MM` month key in UTC. */
export function monthKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/** Returns the inclusive list of `YYYY-MM` keys from startMonth to endMonth (empty if start is after end). */
export function enumerateMonths(startMonth: string, endMonth: string): string[] {
  const months: string[] = [];
  const [endYear, endMonthNumber] = endMonth.split("-").map(Number);
  let [year, month] = startMonth.split("-").map(Number);

  while (year! < endYear! || (year === endYear && month! <= endMonthNumber!)) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month! += 1;
    if (month! > 12) {
      month = 1;
      year! += 1;
    }
  }
  return months;
}

/**
 * Walks the month chain from the earliest known month up to the target month and
 * returns the target month's envelope figures. `carryOut` can go negative so an
 * overspent envelope carries its debt into the next month. When rollover is
 * disabled the chain collapses so carry-in is always zero (pure monthly-cap).
 */
export function computeRolloverForMonth(params: {
  targetMonth: string;
  rolloverEnabled: boolean;
  templateLimit: number;
  spendingByMonth: Map<string, number>;
  overridesByMonth: Map<string, MonthOverride>;
}): RolloverMonth {
  const { targetMonth, rolloverEnabled, templateLimit, spendingByMonth, overridesByMonth } = params;

  const limitFor = (month: string) => overridesByMonth.get(month)?.limitOverride ?? templateLimit;
  const adjustmentFor = (month: string) => overridesByMonth.get(month)?.adjustment ?? 0;
  const spentFor = (month: string) => spendingByMonth.get(month) ?? 0;

  if (!rolloverEnabled) {
    const limit = limitFor(targetMonth);
    const adjustment = adjustmentFor(targetMonth);
    const spent = spentFor(targetMonth);
    const available = limit + adjustment;
    return { month: targetMonth, limit, carryIn: 0, adjustment, available, spent, carryOut: available - spent };
  }

  const knownMonths = [...spendingByMonth.keys(), ...overridesByMonth.keys(), targetMonth].filter(
    (month) => month <= targetMonth
  );
  const startMonth = knownMonths.reduce((earliest, month) => (month < earliest ? month : earliest), targetMonth);

  let carryIn = 0;
  let result: RolloverMonth | null = null;
  for (const month of enumerateMonths(startMonth, targetMonth)) {
    const limit = limitFor(month);
    const adjustment = adjustmentFor(month);
    const spent = spentFor(month);
    const available = limit + carryIn + adjustment;
    const carryOut = available - spent;
    if (month === targetMonth) {
      result = { month, limit, carryIn, adjustment, available, spent, carryOut };
    }
    carryIn = carryOut;
  }

  // enumerateMonths always includes targetMonth, so result is guaranteed set.
  return result!;
}
