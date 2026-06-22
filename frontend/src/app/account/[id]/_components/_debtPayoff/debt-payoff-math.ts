/** Represents the result of a debt payoff timeline computation. */
export type PayoffResult =
  | {
      feasible: true;
      monthsToPayoff: number;
      totalInterest: number;
      totalPaid: number;
    }
  | { feasible: false };

/** Returns the standard minimum credit card payment: 2% of balance or $25, whichever is greater. */
export function computeMinimumPayment(balance: number): number {
  return Math.max(balance * 0.02, 25);
}

/**
 * Simulates monthly repayment to compute total months and interest to pay off the given balance.
 * Returns infeasible when the monthly payment cannot cover the accruing interest.
 * Caps at 600 months (50 years) to prevent runaway loops near the infeasibility threshold.
 */
export function computePayoffSchedule(
  balance: number,
  annualRatePercent: number,
  monthlyPayment: number
): PayoffResult {
  const monthlyRate = annualRatePercent / 100 / 12;

  if (monthlyRate > 0 && monthlyPayment <= balance * monthlyRate) {
    return { feasible: false };
  }

  const MAX_MONTHS = 600;
  let remaining = balance;
  let totalInterest = 0;
  let months = 0;

  while (remaining > 0.005 && months < MAX_MONTHS) {
    const interestThisMonth = remaining * monthlyRate;
    totalInterest += interestThisMonth;
    const balanceAfterInterest = remaining + interestThisMonth;
    const payment = Math.min(monthlyPayment, balanceAfterInterest);
    remaining = balanceAfterInterest - payment;
    months++;
  }

  return {
    feasible: true,
    monthsToPayoff: months,
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalPaid: Math.round((balance + totalInterest) * 100) / 100,
  };
}

/** A single data point in a payoff balance series, used to build the payoff chart. */
export type PayoffChartPoint = {
  month: number;
  minimum: number;
  userPayment?: number;
  boosted?: number;
};

/**
 * Generates the month-by-month remaining balance series for a payoff scenario.
 * Returns an array of length maxMonths + 1, starting with the initial balance at index 0.
 */
export function buildPayoffBalanceSeries(
  balance: number,
  annualRatePercent: number,
  monthlyPayment: number,
  maxMonths: number
): number[] {
  const monthlyRate = annualRatePercent / 100 / 12;
  const series: number[] = [balance];
  let remaining = balance;

  for (let month = 1; month <= maxMonths; month++) {
    if (remaining <= 0.005) {
      series.push(0);
      continue;
    }
    const interest = remaining * monthlyRate;
    const balanceAfterInterest = remaining + interest;
    const payment = Math.min(monthlyPayment, balanceAfterInterest);
    remaining = Math.max(0, balanceAfterInterest - payment);
    series.push(Math.round(remaining * 100) / 100);
  }

  return series;
}

/** Formats a number of months as a concise human-readable duration string. */
export function formatPayoffDuration(months: number): string {
  if (months >= 600) return "50+ years";
  if (months < 12) return `${months} month${months !== 1 ? "s" : ""}`;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (remainingMonths === 0) return `${years} year${years !== 1 ? "s" : ""}`;
  return `${years} yr ${remainingMonths} mo`;
}
