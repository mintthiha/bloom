// Pure helpers for the import preview's duplicate handling: which rows get sent, how they're
// counted, and what the user is told afterwards.
import type { ImportCsvResult, ImportCsvRow } from "@/lib/api";
import { CsvRow, resolveApiType } from "./import-csv";

/** Row counts the preview header and import button are built from. */
export type ImportRowSummary = {
  validCount: number;
  errorCount: number;
  duplicateCount: number;
  importableCount: number;
};

/** True when the row will be sent to the import: valid, and either new or kept on purpose. */
function isImportable(row: CsvRow): boolean {
  if (row.error) return false;
  return !row.isDuplicate || row.shouldImportAnyway === true;
}

/** Converts a preview row into the API payload, marking kept duplicates so the server keeps them too. */
export function toImportPayloadRow(row: CsvRow): ImportCsvRow {
  return {
    type: resolveApiType(row.type),
    amount: Number(row.amount),
    date: row.date,
    description: row.description,
    merchant: row.merchant,
    category: row.category,
    ...(row.isDuplicate && row.shouldImportAnyway ? { allowDuplicate: true } : {}),
  };
}

/** Rows without parse errors, in file order — the exact list sent to the duplicate check. */
export function selectValidRows(rows: CsvRow[]): CsvRow[] {
  return rows.filter((row) => !row.error);
}

/**
 * Flags the rows the server reported as already imported. The server's indexes refer to the
 * valid rows that were sent, so they are mapped back onto the full list (which includes rows
 * with errors). Any earlier flag or "import anyway" choice is reset.
 */
export function markDuplicateRows(rows: CsvRow[], duplicateValidRowIndexes: number[]): CsvRow[] {
  const duplicateIndexes = new Set(duplicateValidRowIndexes);
  let validRowIndex = 0;
  return rows.map((row) => {
    if (row.error) return row;
    const isDuplicate = duplicateIndexes.has(validRowIndex);
    validRowIndex += 1;
    return { ...row, isDuplicate, shouldImportAnyway: false };
  });
}

/** The rows the import button will send: valid rows minus skipped duplicates. */
export function selectRowsToImport(rows: CsvRow[]): CsvRow[] {
  return rows.filter(isImportable);
}

/** Counts valid, errored, duplicate, and importable rows for the preview header and button. */
export function summarizeImportRows(rows: CsvRow[]): ImportRowSummary {
  const validRows = selectValidRows(rows);
  return {
    validCount: validRows.length,
    errorCount: rows.length - validRows.length,
    duplicateCount: validRows.filter((row) => row.isDuplicate).length,
    importableCount: validRows.filter(isImportable).length,
  };
}

/** Pluralises "transaction" for a count, e.g. "1 transaction" / "3 transactions". */
export function countTransactions(count: number): string {
  return `${count} transaction${count === 1 ? "" : "s"}`;
}

/**
 * Builds the toast shown after an import. The server re-checks duplicates, so it may skip rows
 * the preview didn't flag (e.g. a second tab imported them first) — those are reported too.
 */
export function describeImportResult(
  result: Pick<ImportCsvResult, "imported" | "skippedDuplicates">
): { tone: "success" | "info"; message: string } {
  if (result.imported === 0) {
    return {
      tone: "info",
      message:
        result.skippedDuplicates > 0
          ? `Nothing new to import — ${countTransactions(result.skippedDuplicates)} already imported`
          : "Nothing to import",
    };
  }
  const skippedNote =
    result.skippedDuplicates > 0
      ? ` · ${result.skippedDuplicates} duplicate${result.skippedDuplicates === 1 ? "" : "s"} skipped`
      : "";
  return {
    tone: "success",
    message: `Imported ${countTransactions(result.imported)}${skippedNote}`,
  };
}
