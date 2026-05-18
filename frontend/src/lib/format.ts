/** Formats a number as CAD currency (e.g. $1,234.56). */
export const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(n);
