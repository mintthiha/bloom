import { describe, expect, it } from "vitest";
import type { Account, AccountType, ManualEntry } from "@/lib/api";
import { summarizeAccounts } from "./account-summary";

/** Builds an account of the given type and balance. */
function makeAccount(id: string, accountType: AccountType, balance: number): Account {
  return {
    id,
    ownerName: id,
    nickname: null,
    color: null,
    icon: null,
    accountType,
    balance,
    frozen: false,
    isLinked: false,
    plaidAccountId: null,
    plaidItemId: null,
    institutionName: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

/** Builds a manual entry of the given type and amount. */
function makeEntry(type: ManualEntry["type"], amount: number): ManualEntry {
  return {
    id: `${type}-${amount}`,
    userId: "user-1",
    name: type,
    type,
    amount,
    date: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("summarizeAccounts", () => {
  const accounts = [
    makeAccount("chequing", "CHEQUING", 2000),
    makeAccount("savings", "SAVINGS", 5000),
    makeAccount("tfsa", "TFSA", 10000),
    makeAccount("rrsp", "RRSP", 3000),
    makeAccount("fhsa", "FHSA", 1000),
    makeAccount("visa", "CREDIT", 800),
  ];

  it("groups accounts by the summary row's categories", () => {
    const summary = summarizeAccounts(accounts, []);

    expect(summary.chequingAccounts.map((account) => account.id)).toEqual(["chequing"]);
    expect(summary.savingsAccounts.map((account) => account.id)).toEqual(["savings"]);
    expect(summary.registeredAccounts.map((account) => account.id)).toEqual([
      "tfsa",
      "rrsp",
      "fhsa",
    ]);
    expect(summary.creditAccounts.map((account) => account.id)).toEqual(["visa"]);
  });

  it("counts every non-credit account as cash", () => {
    const summary = summarizeAccounts(accounts, []);

    expect(summary.cashAccounts).toHaveLength(5);
    expect(summary.totalCash).toBe(21000);
    expect(summary.totalCredit).toBe(800);
  });

  it("nets cash and manual assets against credit owed and manual liabilities", () => {
    const summary = summarizeAccounts(accounts, [
      makeEntry("ASSET", 15000),
      makeEntry("LIABILITY", 30000),
    ]);

    // 21,000 cash + 15,000 assets − 800 credit − 30,000 liabilities
    expect(summary.netWorth).toBe(5200);
  });

  it("can go negative without special handling", () => {
    const summary = summarizeAccounts(
      [makeAccount("visa", "CREDIT", 500)],
      [makeEntry("LIABILITY", 20000)]
    );

    expect(summary.netWorth).toBe(-20500);
  });

  it("returns zeros and empty groups with no accounts", () => {
    const summary = summarizeAccounts([], []);

    expect(summary.netWorth).toBe(0);
    expect(summary.totalCash).toBe(0);
    expect(summary.cashAccounts).toEqual([]);
  });
});
