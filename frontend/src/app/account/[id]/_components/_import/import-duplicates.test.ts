import { describe, expect, it } from "vitest";
import type { CsvRow } from "./import-csv";
import {
  countTransactions,
  describeImportResult,
  markDuplicateRows,
  selectRowsToImport,
  selectValidRows,
  summarizeImportRows,
  toImportPayloadRow,
} from "./import-duplicates";

/** Builds a valid preview row; pass overrides for what the test cares about. */
function makeRow(overrides: Partial<CsvRow> = {}): CsvRow {
  return {
    date: "2026-01-15",
    type: "withdrawal",
    amount: "4.50",
    description: "Coffee",
    ...overrides,
  };
}

describe("toImportPayloadRow", () => {
  it("converts the preview row into the API shape", () => {
    expect(toImportPayloadRow(makeRow({ merchant: "Tim Hortons", category: "Dining" }))).toEqual({
      type: "WITHDRAWAL",
      amount: 4.5,
      date: "2026-01-15",
      description: "Coffee",
      merchant: "Tim Hortons",
      category: "Dining",
    });
  });

  it("marks a duplicate the user kept so the server keeps it too", () => {
    const row = makeRow({ isDuplicate: true, shouldImportAnyway: true });
    expect(toImportPayloadRow(row).allowDuplicate).toBe(true);
  });

  it("does not mark a duplicate the user is skipping", () => {
    expect(toImportPayloadRow(makeRow({ isDuplicate: true })).allowDuplicate).toBeUndefined();
  });
});

describe("markDuplicateRows", () => {
  it("maps indexes among valid rows back past rows with errors", () => {
    const rows = [
      makeRow({ description: "bad", error: "Invalid date" }),
      makeRow({ description: "first valid" }),
      makeRow({ description: "second valid" }),
    ];

    const marked = markDuplicateRows(rows, [1]);

    expect(marked.map((row) => row.isDuplicate)).toEqual([undefined, false, true]);
  });

  it("resets an earlier 'import anyway' choice when rows are re-checked", () => {
    const rows = [makeRow({ isDuplicate: true, shouldImportAnyway: true })];
    expect(markDuplicateRows(rows, [0])[0]).toMatchObject({
      isDuplicate: true,
      shouldImportAnyway: false,
    });
  });

  it("clears every flag when nothing is a duplicate", () => {
    const rows = [makeRow({ isDuplicate: true })];
    expect(markDuplicateRows(rows, [])[0].isDuplicate).toBe(false);
  });
});

describe("selectValidRows / selectRowsToImport", () => {
  const rows = [
    makeRow({ description: "new" }),
    makeRow({ description: "skipped duplicate", isDuplicate: true }),
    makeRow({ description: "kept duplicate", isDuplicate: true, shouldImportAnyway: true }),
    makeRow({ description: "broken", error: "Invalid amount" }),
  ];

  it("selects every row without an error for the duplicate check", () => {
    expect(selectValidRows(rows).map((row) => row.description)).toEqual([
      "new",
      "skipped duplicate",
      "kept duplicate",
    ]);
  });

  it("imports new rows and kept duplicates only", () => {
    expect(selectRowsToImport(rows).map((row) => row.description)).toEqual([
      "new",
      "kept duplicate",
    ]);
  });

  it("summarises the same rows consistently", () => {
    expect(summarizeImportRows(rows)).toEqual({
      validCount: 3,
      errorCount: 1,
      duplicateCount: 2,
      importableCount: 2,
    });
  });

  it("summarises an empty preview as all zeros", () => {
    expect(summarizeImportRows([])).toEqual({
      validCount: 0,
      errorCount: 0,
      duplicateCount: 0,
      importableCount: 0,
    });
  });
});

describe("countTransactions", () => {
  it("uses the singular only for exactly one", () => {
    expect(countTransactions(0)).toBe("0 transactions");
    expect(countTransactions(1)).toBe("1 transaction");
    expect(countTransactions(2)).toBe("2 transactions");
  });
});

describe("describeImportResult", () => {
  it("reports a clean import as a success", () => {
    expect(describeImportResult({ imported: 3, skippedDuplicates: 0 })).toEqual({
      tone: "success",
      message: "Imported 3 transactions",
    });
  });

  it("mentions duplicates the server skipped", () => {
    expect(describeImportResult({ imported: 1, skippedDuplicates: 2 })).toEqual({
      tone: "success",
      message: "Imported 1 transaction · 2 duplicates skipped",
    });
  });

  it("reports an all-duplicate import as information, not success", () => {
    expect(describeImportResult({ imported: 0, skippedDuplicates: 1 })).toEqual({
      tone: "info",
      message: "Nothing new to import — 1 transaction already imported",
    });
  });

  it("handles an import that wrote and skipped nothing", () => {
    expect(describeImportResult({ imported: 0, skippedDuplicates: 0 })).toEqual({
      tone: "info",
      message: "Nothing to import",
    });
  });
});
