// Pure formatting for the "Recent imports" list and its undo confirmation.
import type { ImportBatchSummary } from "@/lib/api";
import { countTransactions } from "./import-duplicates";

/**
 * Imported transaction dates are stored as UTC midnight (a CSV date has no time), so they are
 * formatted in UTC — formatting them locally would show the previous day across Canada.
 */
function formatTransactionDay(isoDate: string, includeYear: boolean): string {
  return new Date(isoDate).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

/** The span of transaction dates an import covered, e.g. "Oct 1 – Oct 31, 2026" or "Oct 3, 2026". */
export function formatImportDateRange(batch: ImportBatchSummary): string {
  const earliestDay = formatTransactionDay(batch.earliestEffectiveAt, true);
  const latestDay = formatTransactionDay(batch.latestEffectiveAt, true);
  if (earliestDay === latestDay) return latestDay;
  const isSameYear =
    new Date(batch.earliestEffectiveAt).getUTCFullYear() ===
    new Date(batch.latestEffectiveAt).getUTCFullYear();
  return `${formatTransactionDay(batch.earliestEffectiveAt, !isSameYear)} – ${latestDay}`;
}

/** The day the import ran, in the viewer's own time zone, e.g. "Nov 4, 2026". */
function formatImportDay(batch: ImportBatchSummary): string {
  return new Date(batch.importedAt).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** When the import ran, e.g. "Imported Nov 4, 2026". */
export function formatImportedOn(batch: ImportBatchSummary): string {
  return `Imported ${formatImportDay(batch)}`;
}

/** Title and detail for the undo confirmation, naming exactly what will be removed. */
export function describeUndoImport(batch: ImportBatchSummary): {
  title: string;
  description: string;
} {
  return {
    title: `Undo import of ${countTransactions(batch.transactionCount)}?`,
    description: `This removes the ${countTransactions(batch.transactionCount)} dated ${formatImportDateRange(batch)} that were imported ${formatImportDay(batch)}. Transactions you added any other way are not affected.`,
  };
}
