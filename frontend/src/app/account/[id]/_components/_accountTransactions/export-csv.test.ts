import { describe, it, expect } from "vitest";
import type { Transaction } from "@/lib/api";
import { transactionsToCsv, buildExportFilename } from "./export-csv";

/** Builds a Transaction fixture with sensible defaults. */
function makeTxn(overrides?: Partial<Transaction>): Transaction {
  return {
    id: "t-1",
    type: "WITHDRAWAL",
    amount: 85.5,
    balanceAfter: 0,
    category: "Groceries",
    merchant: "Loblaws",
    description: "Weekly groceries",
    effectiveAt: "2026-01-18T14:30:00.000Z",
    createdAt: "2026-01-18T14:30:00.000Z",
    fromAccountId: "a-1",
    toAccountId: null,
    ...overrides,
  };
}

describe("transactionsToCsv", () => {
  it("starts with the Bloom import header row", () => {
    const csv = transactionsToCsv([]);
    expect(csv).toBe("date,type,amount,description,merchant,category");
  });

  it("formats date (YYYY-MM-DD), lowercased type, and 2-decimal amount", () => {
    const [, row] = transactionsToCsv([makeTxn()]).split("\n");
    expect(row).toBe("2026-01-18,withdrawal,85.50,Weekly groceries,Loblaws,Groceries");
  });

  it("lowercases and de-underscores transfer types", () => {
    const [, row] = transactionsToCsv([makeTxn({ type: "TRANSFER_OUT" })]).split("\n");
    expect(row.split(",")[1]).toBe("transfer out");
  });

  it("renders null description/merchant/category as empty cells", () => {
    const [, row] = transactionsToCsv([
      makeTxn({ description: null, merchant: null, category: null }),
    ]).split("\n");
    expect(row).toBe("2026-01-18,withdrawal,85.50,,,");
  });

  it("quotes and escapes cells containing commas or quotes", () => {
    const [, row] = transactionsToCsv([
      makeTxn({ description: 'Coffee, "large"', merchant: null, category: null }),
    ]).split("\n");
    expect(row).toContain('"Coffee, ""large"""');
  });
});

describe("buildExportFilename", () => {
  it("slugifies the account name and appends today's date", () => {
    const name = buildExportFilename("My Chequing #1");
    expect(name).toMatch(/^bloom-my-chequing--1-transactions-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
