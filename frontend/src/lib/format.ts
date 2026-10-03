import { Currency, DEFAULT_CURRENCY, getCurrencyLocale } from "./currency";

let activeCurrency: Currency = DEFAULT_CURRENCY;
let conversionRate = 1;

/**
 * Sets the currency (and its CAD conversion rate) that `formatCurrency` renders amounts in for
 * the rest of the session. Called by `CurrencyProvider` once the user's saved display-currency
 * preference (and matching exchange rate) loads. `rate` defaults to 1 for CAD, where no
 * conversion is needed since every amount is stored in CAD.
 */
export function setActiveCurrency(currency: Currency, rate: number = 1): void {
  activeCurrency = currency;
  conversionRate = rate;
}

/**
 * Formats a CAD-stored amount as currency (e.g. $1,234.56), converting it to the active display
 * currency first when one other than CAD is set, and optionally rounding off the cents
 * (e.g. $1,235).
 */
export function formatCurrency(n: number, options?: { hideCents?: boolean }): string {
  const hideCents = options?.hideCents ?? false;
  return new Intl.NumberFormat(getCurrencyLocale(activeCurrency), {
    style: "currency",
    currency: activeCurrency,
    minimumFractionDigits: hideCents ? 0 : 2,
    maximumFractionDigits: hideCents ? 0 : 2,
  }).format(n * conversionRate);
}
