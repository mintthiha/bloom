/**
 * Derivation helpers for the display currency (CAD/USD/EUR) a user can pick on their profile.
 * This only changes the symbol/locale `formatCurrency` renders amounts with — no conversion is
 * applied, so the underlying numbers are unchanged across currencies.
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
