import { Currency, DEFAULT_CURRENCY, getCurrencyLocale } from "./currency";

let activeCurrency: Currency = DEFAULT_CURRENCY;

/**
 * Sets the currency `formatCurrency` renders amounts in for the rest of the session.
 * Called by `CurrencyProvider` once the user's saved display-currency preference loads.
 */
export function setActiveCurrency(currency: Currency): void {
  activeCurrency = currency;
}

/** Formats a number as currency (e.g. $1,234.56), optionally rounding off the cents (e.g. $1,235). */
export function formatCurrency(
  n: number,
  options?: { hideCents?: boolean; currency?: Currency }
): string {
  const hideCents = options?.hideCents ?? false;
  const currency = options?.currency ?? activeCurrency;
  return new Intl.NumberFormat(getCurrencyLocale(currency), {
    style: "currency",
    currency,
    minimumFractionDigits: hideCents ? 0 : 2,
    maximumFractionDigits: hideCents ? 0 : 2,
  }).format(n);
}
