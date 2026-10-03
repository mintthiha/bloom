/**
 * Derivation helpers for the display currency (CAD/USD/EUR) a user can pick on their profile.
 * Every amount is stored in CAD; picking USD or EUR converts amounts for display using a cached
 * CAD-to-target exchange rate (see `getRateForCurrency` and `exchangeRateService` on the backend).
 */

/** The currencies a user can pick as their display currency. Stored on the profile as `currency`. */
export const CURRENCIES = ["CAD", "USD", "EUR"] as const;

export type Currency = (typeof CURRENCIES)[number];

/** The currency applied when the user has not chosen one. */
export const DEFAULT_CURRENCY: Currency = "CAD";

/** Locale passed to `Intl.NumberFormat` for each currency's symbol/grouping conventions. */
const CURRENCY_LOCALE: Record<Currency, string> = {
  CAD: "en-CA",
  USD: "en-US",
  EUR: "en-IE",
};

/** Human-readable option list for the profile display-currency picker. */
export const CURRENCY_OPTIONS: { value: Currency; label: string }[] = [
  { value: "CAD", label: "Canadian Dollar (CAD)" },
  { value: "USD", label: "US Dollar (USD)" },
  { value: "EUR", label: "Euro (EUR)" },
];

/** Narrows an arbitrary stored value to a known currency, or null when unrecognized. */
export function parseCurrency(value: string | null | undefined): Currency | null {
  const normalized = (value ?? "").trim().toUpperCase();
  return (CURRENCIES as readonly string[]).includes(normalized) ? (normalized as Currency) : null;
}

/** Resolves the `Intl.NumberFormat` locale for a currency. */
export function getCurrencyLocale(currency: Currency): string {
  return CURRENCY_LOCALE[currency];
}

/** The CAD-to-target rates `getRateForCurrency` picks from; shaped to match `ExchangeRates` from `@/lib/api`. */
export type CadExchangeRates = {
  cadToUsd: number;
  cadToEur: number;
};

/** Resolves the CAD-to-`currency` conversion multiplier. CAD is always 1 since amounts are stored in CAD. */
export function getRateForCurrency(currency: Currency, rates: CadExchangeRates): number {
  switch (currency) {
    case "CAD":
      return 1;
    case "USD":
      return rates.cadToUsd;
    case "EUR":
      return rates.cadToEur;
  }
}
