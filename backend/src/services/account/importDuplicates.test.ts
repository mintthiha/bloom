import { describe, expect, it } from "vitest";
import {
  buildDuplicateKey,
  findDuplicateRowIndexes,
  getImportDayWindow,
  type DuplicateComparable,
} from "./importDuplicates";

/** Builds a comparable transaction with sensible defaults so each test states only what matters. */
function makeTransaction(overrides: Partial<DuplicateComparable> = {}): DuplicateComparable {
  return {
    type: "WITHDRAWAL",
    amount: 4.5,
    effectiveAt: new Date("2026-01-15T00:00:00.000Z"),
    description: "TIM HORTONS #1234",
    merchant: "Tim Hortons",
    ...overrides,
  };
}

describe("buildDuplicateKey", () => {
  it("treats a stored decimal string and an incoming number as the same amount", () => {
    expect(buildDuplicateKey(makeTransaction({ amount: "4.5000" }))).toBe(
      buildDuplicateKey(makeTransaction({ amount: 4.5 }))
    );
  });

  it("ignores case and extra whitespace in the description", () => {
    expect(buildDuplicateKey(makeTransaction({ description: "  tim   hortons #1234 " }))).toBe(
      buildDuplicateKey(makeTransaction())
    );
  });

  it("ignores the time of day but not the calendar day", () => {
    const morning = makeTransaction({ effectiveAt: new Date("2026-01-15T08:00:00.000Z") });
    const night = makeTransaction({ effectiveAt: new Date("2026-01-15T23:59:00.000Z") });
    const nextDay = makeTransaction({ effectiveAt: new Date("2026-01-16T00:00:00.000Z") });
    expect(buildDuplicateKey(morning)).toBe(buildDuplicateKey(night));
    expect(buildDuplicateKey(morning)).not.toBe(buildDuplicateKey(nextDay));
  });

  it("distinguishes a deposit from a withdrawal of the same amount", () => {
    expect(buildDuplicateKey(makeTransaction({ type: "DEPOSIT" }))).not.toBe(
      buildDuplicateKey(makeTransaction({ type: "WITHDRAWAL" }))
    );
  });

  it("distinguishes amounts that differ by a single cent", () => {
    expect(buildDuplicateKey(makeTransaction({ amount: 4.51 }))).not.toBe(
      buildDuplicateKey(makeTransaction({ amount: 4.5 }))
    );
  });

  it("falls back to the merchant when there is no description", () => {
    const withoutDescription = makeTransaction({ description: null, merchant: "Loblaws" });
    expect(buildDuplicateKey(withoutDescription)).toBe(
      buildDuplicateKey(makeTransaction({ description: "", merchant: "loblaws" }))
    );
    expect(buildDuplicateKey(withoutDescription)).not.toBe(
      buildDuplicateKey(makeTransaction({ description: null, merchant: "Metro" }))
    );
  });
});

describe("findDuplicateRowIndexes", () => {
  it("returns nothing when the account has no overlapping history", () => {
    expect(findDuplicateRowIndexes([makeTransaction()], [])).toEqual([]);
  });

  it("flags a row that matches an existing transaction", () => {
    const rows = [makeTransaction({ description: "Salary", type: "DEPOSIT" }), makeTransaction()];
    expect(findDuplicateRowIndexes(rows, [makeTransaction()])).toEqual([1]);
  });

  it("matches one-to-one, so a second identical purchase in the file is still new", () => {
    const rows = [makeTransaction(), makeTransaction()];
    expect(findDuplicateRowIndexes(rows, [makeTransaction()])).toEqual([0]);
  });

  it("flags every copy when the account already holds as many as the file", () => {
    const rows = [makeTransaction(), makeTransaction()];
    expect(findDuplicateRowIndexes(rows, [makeTransaction(), makeTransaction()])).toEqual([0, 1]);
  });

  it("never flags rows that only repeat each other within the file", () => {
    expect(findDuplicateRowIndexes([makeTransaction(), makeTransaction()], [])).toEqual([]);
  });

  it("flags a full re-import of the same file", () => {
    const fileRows = [
      makeTransaction({ type: "DEPOSIT", amount: 1500, description: "Payroll" }),
      makeTransaction(),
      makeTransaction({ amount: 85.5, description: "LOBLAWS 1029" }),
    ];
    expect(findDuplicateRowIndexes(fileRows, fileRows)).toEqual([0, 1, 2]);
  });
});

describe("getImportDayWindow", () => {
  it("returns null for no rows", () => {
    expect(getImportDayWindow([])).toBeNull();
  });

  it("spans from the start of the earliest day to the start of the day after the latest", () => {
    const window = getImportDayWindow([
      { effectiveAt: new Date("2026-01-20T15:30:00.000Z") },
      { effectiveAt: new Date("2026-01-05T09:00:00.000Z") },
    ]);
    expect(window?.start.toISOString()).toBe("2026-01-05T00:00:00.000Z");
    expect(window?.end.toISOString()).toBe("2026-01-21T00:00:00.000Z");
  });

  it("covers a whole single day when every row shares one date", () => {
    const window = getImportDayWindow([{ effectiveAt: new Date("2026-02-28T00:00:00.000Z") }]);
    expect(window?.start.toISOString()).toBe("2026-02-28T00:00:00.000Z");
    expect(window?.end.toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });
});
