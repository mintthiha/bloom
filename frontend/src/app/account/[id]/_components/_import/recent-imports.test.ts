import { describe, expect, it } from "vitest";
import type { ImportBatchSummary } from "@/lib/api";
import { describeUndoImport, formatImportDateRange, formatImportedOn } from "./recent-imports";

/** Builds an import batch summary; dates default to an October 2026 statement imported Nov 4. */
function makeBatch(overrides: Partial<ImportBatchSummary> = {}): ImportBatchSummary {
  return {
    importBatchId: "b-1",
    transactionCount: 42,
    importedAt: "2026-11-04T15:00:00.000Z",
    earliestEffectiveAt: "2026-10-01T00:00:00.000Z",
    latestEffectiveAt: "2026-10-31T00:00:00.000Z",
    ...overrides,
  };
}

describe("formatImportDateRange", () => {
  it("shows the year once when the range stays within one year", () => {
    expect(formatImportDateRange(makeBatch())).toBe("Oct 1 – Oct 31, 2026");
  });

  it("shows both years when the range crosses New Year", () => {
    const batch = makeBatch({
      earliestEffectiveAt: "2025-12-15T00:00:00.000Z",
      latestEffectiveAt: "2026-01-10T00:00:00.000Z",
    });
    expect(formatImportDateRange(batch)).toBe("Dec 15, 2025 – Jan 10, 2026");
  });

  it("shows a single day when every transaction shares one date", () => {
    const batch = makeBatch({
      earliestEffectiveAt: "2026-10-03T00:00:00.000Z",
      latestEffectiveAt: "2026-10-03T00:00:00.000Z",
    });
    expect(formatImportDateRange(batch)).toBe("Oct 3, 2026");
  });

  it("keeps a UTC-midnight date on its own day instead of shifting it back a day", () => {
    const batch = makeBatch({
      earliestEffectiveAt: "2026-10-01T00:00:00.000Z",
      latestEffectiveAt: "2026-10-01T00:00:00.000Z",
    });
    expect(formatImportDateRange(batch)).toBe("Oct 1, 2026");
  });
});

describe("formatImportedOn", () => {
  it("prefixes the import day", () => {
    expect(formatImportedOn(makeBatch({ importedAt: "2026-11-04T15:00:00.000Z" }))).toMatch(
      /^Imported Nov \d{1,2}, 2026$/
    );
  });
});

describe("describeUndoImport", () => {
  it("names the count in the title and the dates in the description", () => {
    const { title, description } = describeUndoImport(makeBatch());
    expect(title).toBe("Undo import of 42 transactions?");
    expect(description).toContain("42 transactions dated Oct 1 – Oct 31, 2026");
    expect(description).toMatch(/that were imported Nov \d{1,2}, 2026\./);
    expect(description).toContain("not affected");
  });

  it("uses the singular for a one-row import", () => {
    expect(describeUndoImport(makeBatch({ transactionCount: 1 })).title).toBe(
      "Undo import of 1 transaction?"
    );
  });
});
