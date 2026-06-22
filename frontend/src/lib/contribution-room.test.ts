import { describe, expect, it } from "vitest";
import {
  calculateTfsaLifetimeRoom,
  calculateNetContributions,
  calculateNetContributionsForYear,
  FHSA_ANNUAL_LIMIT,
  FHSA_LIFETIME_LIMIT,
} from "./contribution-room";
import type { Transaction } from "./api";

/** Builds a minimal Transaction fixture with the given overrides. */
function txn(overrides: Partial<Transaction> & Pick<Transaction, "type" | "amount">): Transaction {
  return {
    id: "tx-default",
    balanceAfter: 0,
    transferGroupId: null,
    category: null,
    merchant: null,
    description: null,
    effectiveAt: "2026-06-01T00:00:00.000Z",
    createdAt: "2026-06-01T00:00:00.000Z",
    fromAccountId: null,
    toAccountId: null,
    ...overrides,
  };
}

describe("calculateTfsaLifetimeRoom", () => {
  it("returns full table total for a birth year before 1991 (turned 18 before 2009)", () => {
    // birthYear=1980 turns 18 in 1998, so accumulates from 2009 to 2026
    expect(calculateTfsaLifetimeRoom(1980, 2026)).toBe(109000);
  });

  it("returns only the current year's room when the person turns 18 this year", () => {
    // birthYear=2008 turns 18 in 2026
    expect(calculateTfsaLifetimeRoom(2008, 2026)).toBe(7000);
  });

  it("returns 0 when the person has not yet turned 18 by the current year", () => {
    // birthYear=2009 turns 18 in 2027
    expect(calculateTfsaLifetimeRoom(2009, 2026)).toBe(0);
  });

  it("returns full table total when turning 18 exactly in 2009 (boundary year)", () => {
    // birthYear=1991 turns 18 in 2009, accumulates all years from 2009 to 2026
    expect(calculateTfsaLifetimeRoom(1991, 2026)).toBe(109000);
  });

  it("accumulates correctly for a mid-table birth year", () => {
    // birthYear=2000 turns 18 in 2018, accumulates 2018 through 2026
    // 5500 + 6000 + 6000 + 6000 + 6000 + 6500 + 7000 + 7000 + 7000 = 57000
    expect(calculateTfsaLifetimeRoom(2000, 2026)).toBe(57000);
  });
});

describe("calculateNetContributions", () => {
  it("returns 0 for an empty transaction list", () => {
    expect(calculateNetContributions([], ["acc1"])).toBe(0);
  });

  it("sums DEPOSIT positively for accounts in accountIds", () => {
    const transactions = [
      txn({ type: "DEPOSIT", amount: 1000, toAccountId: "acc1" }),
      txn({ type: "DEPOSIT", amount: 500, toAccountId: "acc1" }),
    ];
    expect(calculateNetContributions(transactions, ["acc1"])).toBe(1500);
  });

  it("sums WITHDRAWAL negatively for accounts in accountIds", () => {
    const transactions = [txn({ type: "WITHDRAWAL", amount: 300, fromAccountId: "acc1" })];
    expect(calculateNetContributions(transactions, ["acc1"])).toBe(-300);
  });

  it("nets deposits and withdrawals", () => {
    const transactions = [
      txn({ type: "DEPOSIT", amount: 5000, toAccountId: "acc1" }),
      txn({ type: "WITHDRAWAL", amount: 1000, fromAccountId: "acc1" }),
    ];
    expect(calculateNetContributions(transactions, ["acc1"])).toBe(4000);
  });

  it("ignores TRANSFER_IN from a same-type account (both in accountIds)", () => {
    const transactions = [
      txn({ type: "TRANSFER_IN", amount: 2000, fromAccountId: "acc1", toAccountId: "acc2" }),
    ];
    expect(calculateNetContributions(transactions, ["acc1", "acc2"])).toBe(0);
  });

  it("ignores TRANSFER_OUT to a same-type account (both in accountIds)", () => {
    const transactions = [
      txn({ type: "TRANSFER_OUT", amount: 2000, fromAccountId: "acc1", toAccountId: "acc2" }),
    ];
    expect(calculateNetContributions(transactions, ["acc1", "acc2"])).toBe(0);
  });

  it("counts TRANSFER_IN from a different-type account as a contribution", () => {
    // chequing → TFSA cross-type inflow
    const transactions = [
      txn({ type: "TRANSFER_IN", amount: 3000, fromAccountId: "chq-1", toAccountId: "acc1" }),
    ];
    expect(calculateNetContributions(transactions, ["acc1"])).toBe(3000);
  });

  it("counts TRANSFER_OUT to a different-type account as a withdrawal", () => {
    // TFSA → chequing cross-type outflow
    const transactions = [
      txn({ type: "TRANSFER_OUT", amount: 500, fromAccountId: "acc1", toAccountId: "chq-1" }),
    ];
    expect(calculateNetContributions(transactions, ["acc1"])).toBe(-500);
  });

  it("only counts transactions whose account is in accountIds", () => {
    // DEPOSIT to acc2 should not count when accountIds = ["acc1"]
    const transactions = [txn({ type: "DEPOSIT", amount: 999, toAccountId: "acc2" })];
    expect(calculateNetContributions(transactions, ["acc1"])).toBe(0);
  });

  it("handles multiple accounts in accountIds correctly", () => {
    const transactions = [
      txn({ type: "DEPOSIT", amount: 3000, toAccountId: "acc1" }),
      txn({ type: "DEPOSIT", amount: 2000, toAccountId: "acc2" }),
      txn({ type: "WITHDRAWAL", amount: 500, fromAccountId: "acc2" }),
    ];
    expect(calculateNetContributions(transactions, ["acc1", "acc2"])).toBe(4500);
  });
});

describe("calculateNetContributionsForYear", () => {
  it("only counts transactions that occurred in the specified year", () => {
    const transactions = [
      txn({
        type: "DEPOSIT",
        amount: 1000,
        toAccountId: "acc1",
        effectiveAt: "2025-03-01T00:00:00.000Z",
      }),
      txn({
        type: "DEPOSIT",
        amount: 2000,
        toAccountId: "acc1",
        effectiveAt: "2026-01-15T00:00:00.000Z",
      }),
    ];
    expect(calculateNetContributionsForYear(transactions, ["acc1"], 2026)).toBe(2000);
  });

  it("returns 0 when no transactions fall in the specified year", () => {
    const transactions = [
      txn({
        type: "DEPOSIT",
        amount: 5000,
        toAccountId: "acc1",
        effectiveAt: "2025-12-31T00:00:00.000Z",
      }),
    ];
    expect(calculateNetContributionsForYear(transactions, ["acc1"], 2026)).toBe(0);
  });

  it("applies the same same-type transfer exclusion within the year", () => {
    const transactions = [
      txn({
        type: "TRANSFER_IN",
        amount: 1000,
        fromAccountId: "acc1",
        toAccountId: "acc2",
        effectiveAt: "2026-04-01T00:00:00.000Z",
      }),
      txn({
        type: "DEPOSIT",
        amount: 500,
        toAccountId: "acc1",
        effectiveAt: "2026-04-01T00:00:00.000Z",
      }),
    ];
    expect(calculateNetContributionsForYear(transactions, ["acc1", "acc2"], 2026)).toBe(500);
  });
});

describe("FHSA constants", () => {
  it("exports the correct FHSA annual limit", () => {
    expect(FHSA_ANNUAL_LIMIT).toBe(8000);
  });

  it("exports the correct FHSA lifetime limit", () => {
    expect(FHSA_LIFETIME_LIMIT).toBe(40000);
  });
});
