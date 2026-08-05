import { describe, it, expect } from "vitest";
import type { TransactionListItem } from "@/lib/api";
import { transactionListItemsToCsv, buildTransactionsExportFilename } from "./export-csv";

/** Builds a TransactionListItem fixture with sensible defaults. */
function makeItem(overrides?: Partial<TransactionListItem>): TransactionListItem {
  return {
    id: "t-1",
    type: "DEPOSIT",
    amount: 1500,
    effectiveAt: "2026-01-15T09:00:00.000Z",
    description: "Payroll",
    merchant: null,
    category: "Salary",
    accountId: "a-1",
    accountName: "Chequing",
    accountNickname: null,
    accountType: "CHEQUING",
    ...overrides,
  };
}

describe("transactionListItemsToCsv", () => {
  it("includes an account column in the header", () => {
    expect(transactionListItemsToCsv([])).toBe(
      "date,type,amount,account,description,merchant,category"
    );
  });

  it("prefers the account nickname over the owner name", () => {
    const [, row] = transactionListItemsToCsv([
      makeItem({ accountNickname: "Everyday", accountName: "Chequing" }),
    ]).split("\n");
    expect(row.split(",")[3]).toBe("Everyday");
  });

  it("falls back to the account name when there is no nickname", () => {
    const [, row] = transactionListItemsToCsv([
      makeItem({ accountNickname: null, accountName: "Chequing" }),
    ]).split("\n");
    expect(row.split(",")[3]).toBe("Chequing");
  });

  it("coerces a string amount to a 2-decimal number", () => {
    const [, row] = transactionListItemsToCsv([
      makeItem({ amount: "1500" as unknown as number }),
    ]).split("\n");
    expect(row.split(",")[2]).toBe("1500.00");
  });
});

describe("buildTransactionsExportFilename", () => {
  it("returns a dated cross-account filename", () => {
    expect(buildTransactionsExportFilename()).toMatch(
      /^bloom-transactions-\d{4}-\d{2}-\d{2}\.csv$/
    );
  });
});
