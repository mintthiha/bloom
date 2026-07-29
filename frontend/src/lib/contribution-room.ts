import type { Transaction } from "./api";

/** CRA annual TFSA contribution limits by year. */
const TFSA_ANNUAL_LIMITS: Record<number, number> = {
  2009: 5000,
  2010: 5000,
  2011: 5000,
  2012: 5000,
  2013: 5500,
  2014: 5500,
  2015: 10000,
  2016: 5500,
  2017: 5500,
  2018: 5500,
  2019: 6000,
  2020: 6000,
  2021: 6000,
  2022: 6000,
  2023: 6500,
  2024: 7000,
  2025: 7000,
  2026: 7000,
};

/** The CRA TFSA annual contribution dollar limit for a given year, or null if not on record. */
export function getTfsaAnnualLimit(year: number): number | null {
  return TFSA_ANNUAL_LIMITS[year] ?? null;
}

/** CRA fixed annual FHSA contribution limit. */
export const FHSA_ANNUAL_LIMIT = 8000;

/** CRA fixed lifetime FHSA contribution limit. */
export const FHSA_LIFETIME_LIMIT = 40000;

/**
 * TFSA lifetime room a person has accumulated by the given year, given their birth year.
 * Accumulation starts in the year they turn 18, or 2009 (TFSA introduction), whichever is later.
 * Returns 0 if they have not yet turned 18 by currentYear.
 */
export function calculateTfsaLifetimeRoom(birthYear: number, currentYear: number): number {
  const yearTurning18 = birthYear + 18;
  if (yearTurning18 > currentYear) return 0;
  const startYear = Math.max(yearTurning18, 2009);
  let total = 0;
  for (let year = startYear; year <= currentYear; year++) {
    total += TFSA_ANNUAL_LIMITS[year] ?? 0;
  }
  return total;
}

/**
 * Net contributions to a list of accounts of a given type in Bloom: deposits minus withdrawals.
 * Transfers between accounts of the same type (both in accountIds) are excluded so they
 * don't inflate or deflate the contribution total.
 */
export function calculateNetContributions(
  transactions: Transaction[],
  accountIds: string[]
): number {
  const accountIdSet = new Set(accountIds);
  let net = 0;
  for (const txn of transactions) {
    if (txn.type === "DEPOSIT") {
      if (txn.toAccountId && accountIdSet.has(txn.toAccountId)) {
        net += txn.amount;
      }
    } else if (txn.type === "WITHDRAWAL") {
      if (txn.fromAccountId && accountIdSet.has(txn.fromAccountId)) {
        net -= txn.amount;
      }
    } else if (txn.type === "TRANSFER_IN") {
      // Count cross-type inflows only; same-type transfers cancel out
      if (
        txn.toAccountId &&
        accountIdSet.has(txn.toAccountId) &&
        (!txn.fromAccountId || !accountIdSet.has(txn.fromAccountId))
      ) {
        net += txn.amount;
      }
    } else if (txn.type === "TRANSFER_OUT") {
      // Count cross-type outflows only; same-type transfers cancel out
      if (
        txn.fromAccountId &&
        accountIdSet.has(txn.fromAccountId) &&
        (!txn.toAccountId || !accountIdSet.has(txn.toAccountId))
      ) {
        net -= txn.amount;
      }
    }
  }
  return net;
}

/**
 * Same as calculateNetContributions but restricted to transactions that occurred in a specific calendar year.
 */
export function calculateNetContributionsForYear(
  transactions: Transaction[],
  accountIds: string[],
  year: number
): number {
  const yearTransactions = transactions.filter(
    (txn) => new Date(txn.effectiveAt).getFullYear() === year
  );
  return calculateNetContributions(yearTransactions, accountIds);
}
