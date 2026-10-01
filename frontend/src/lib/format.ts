/** Formats a number as CAD currency (e.g. $1,234.56), optionally rounding off the cents (e.g. $1,235). */
export function formatCurrency(n: number, options?: { hideCents?: boolean }): string {
  const hideCents = options?.hideCents ?? false;
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: hideCents ? 0 : 2,
    maximumFractionDigits: hideCents ? 0 : 2,
  }).format(n);
}
