import { Transaction } from "@/lib/api";

const EXPORT_HEADERS = ["date", "type", "amount", "description", "merchant", "category"];

/** Wraps a CSV cell value in quotes if it contains a comma, quote, or newline. */
function escapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Converts a Transaction array to a CSV string using the Bloom import column format. */
export function transactionsToCsv(transactions: Transaction[]): string {
  const rows = transactions.map((txn) => {
    const date = txn.effectiveAt.slice(0, 10);
    const type = txn.type.toLowerCase().replace("_", " ");
    const amount = txn.amount.toFixed(2);
    return [
      date,
      type,
      amount,
      txn.description ?? "",
      txn.merchant ?? "",
      txn.category ?? "",
    ]
      .map(escapeCell)
      .join(",");
  });
  return [EXPORT_HEADERS.join(","), ...rows].join("\n");
}

/** Returns a safe filename for the CSV export given an account display name. */
export function buildExportFilename(accountName: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const safeName = accountName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  return `bloom-${safeName}-transactions-${date}.csv`;
}
