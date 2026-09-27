import { TransactionListItem } from "@/lib/api";

const EXPORT_HEADERS = ["date", "type", "amount", "account", "description", "merchant", "category"];

/** Wraps a CSV cell value in quotes if it contains a comma, quote, or newline. */
function escapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Converts a TransactionListItem array to a CSV string that includes an account column. */
export function transactionListItemsToCsv(items: TransactionListItem[]): string {
  const rows = items.map((item) => {
    const date = item.effectiveAt.slice(0, 10);
    const type = item.type.toLowerCase().replace("_", " ");
    const amount = Number(item.amount).toFixed(2);
    const account = item.accountNickname ?? item.accountName;
    return [
      date,
      type,
      amount,
      account,
      item.description ?? "",
      item.merchant ?? "",
      item.category ?? "",
    ]
      .map(escapeCell)
      .join(",");
  });
  return [EXPORT_HEADERS.join(","), ...rows].join("\n");
}

/** Returns a safe filename for a cross-account transactions export. */
export function buildTransactionsExportFilename(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `bloom-transactions-${date}.csv`;
}
