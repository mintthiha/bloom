import { describe, expect, it } from "vitest";
import { Account, RecurringTransaction } from "@/lib/api";
import { computeSafeToSpend } from "./safe-to-spend";

/** Builds an Account with sensible defaults, overriding only the fields a test cares about. */
function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "acct-1",
    ownerName: "Test",
    nickname: null,
    accountType: "CHEQUING",
    balance: 0,
    frozen: false,
    isLinked: false,
    plaidAccountId: null,
    plaidItemId: null,
    institutionName: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Builds a recurring rule with sensible defaults, overriding only the fields a test cares about. */
function makeRule(overrides: Partial<RecurringTransaction> = {}): RecurringTransaction {
  return {
    id: "rule-1",
    userId: "user-1",
    accountId: "acct-1",
    name: "Rule",
    type: "WITHDRAWAL",
    amount: 100,
    category: null,
    merchant: null,
    description: null,
    frequency: "MONTHLY",
    startDate: "2026-01-01",
    endDate: null,
    nextRunAt: "2026-07-20",
    lastRunAt: null,
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    accountOwnerName: "Test",
    ...overrides,
  } as RecurringTransaction;
}

// Mid-month reference so there is a meaningful window of remaining days (July has 31 days).
const REFERENCE = new Date(2026, 6, 15);

describe("computeSafeToSpend", () => {
  it("sums only liquid (chequing + savings) balances as available cash", () => {
    const accounts = [
      makeAccount({ id: "a", accountType: "CHEQUING", balance: 2000 }),
      makeAccount({ id: "b", accountType: "SAVINGS", balance: 3000 }),
      makeAccount({ id: "c", accountType: "TFSA", balance: 10000 }),
      makeAccount({ id: "d", accountType: "CREDIT", balance: 500 }),
    ];
    const result = computeSafeToSpend(accounts, [], REFERENCE);
    expect(result.availableCash).toBe(5000);
    expect(result.safeToSpend).toBe(5000);
  });

  it("subtracts a bill due later this month and adds it to the bill list", () => {
    const accounts = [makeAccount({ balance: 1000 })];
    const rules = [makeRule({ amount: 250, nextRunAt: "2026-07-20", merchant: "Rent" })];
    const result = computeSafeToSpend(accounts, rules, REFERENCE);
    expect(result.upcomingBills).toBe(250);
    expect(result.safeToSpend).toBe(750);
    expect(result.billItems).toHaveLength(1);
    expect(result.billItems[0].label).toBe("Rent");
  });

  it("adds expected recurring income", () => {
    const accounts = [makeAccount({ balance: 1000 })];
    const rules = [makeRule({ type: "DEPOSIT", amount: 2000, nextRunAt: "2026-07-25" })];
    const result = computeSafeToSpend(accounts, rules, REFERENCE);
    expect(result.expectedIncome).toBe(2000);
    expect(result.safeToSpend).toBe(3000);
    expect(result.billItems).toHaveLength(0);
  });

  it("ignores occurrences that fall after month-end", () => {
    const accounts = [makeAccount({ balance: 1000 })];
    const rules = [makeRule({ amount: 300, nextRunAt: "2026-08-05" })];
    const result = computeSafeToSpend(accounts, rules, REFERENCE);
    expect(result.upcomingBills).toBe(0);
    expect(result.safeToSpend).toBe(1000);
  });

  it("skips stale overdue occurrences before today so a lapsed rule can't overcount", () => {
    const accounts = [makeAccount({ balance: 1000 })];
    // A weekly rule whose next run lapsed months ago would otherwise stack many past occurrences.
    const rules = [makeRule({ amount: 50, frequency: "WEEKLY", nextRunAt: "2026-01-05" })];
    const result = computeSafeToSpend(accounts, rules, REFERENCE);
    // A Monday cadence lands only on July 20 and 27 within the remaining window (2 × 50), never the
    // dozens of past occurrences back to January.
    expect(result.upcomingBills).toBe(100);
  });

  it("ignores paused (inactive) rules", () => {
    const accounts = [makeAccount({ balance: 1000 })];
    const rules = [makeRule({ amount: 400, nextRunAt: "2026-07-20", active: false })];
    const result = computeSafeToSpend(accounts, rules, REFERENCE);
    expect(result.upcomingBills).toBe(0);
    expect(result.safeToSpend).toBe(1000);
  });

  it("respects a rule's end date", () => {
    const accounts = [makeAccount({ balance: 1000 })];
    const rules = [makeRule({ amount: 200, nextRunAt: "2026-07-20", endDate: "2026-07-10" })];
    const result = computeSafeToSpend(accounts, rules, REFERENCE);
    expect(result.upcomingBills).toBe(0);
  });

  it("computes a per-day allowance across the remaining days including today", () => {
    const accounts = [makeAccount({ balance: 1700 })];
    // July 15 → 17 days remaining (15..31 inclusive). 1700 / 17 = 100.
    const result = computeSafeToSpend(accounts, [], REFERENCE);
    expect(result.daysRemaining).toBe(17);
    expect(result.perDay).toBe(100);
  });

  it("reports a negative figure and zero per-day allowance when bills exceed resources", () => {
    const accounts = [makeAccount({ balance: 100 })];
    const rules = [makeRule({ amount: 500, nextRunAt: "2026-07-20" })];
    const result = computeSafeToSpend(accounts, rules, REFERENCE);
    expect(result.safeToSpend).toBe(-400);
    expect(result.perDay).toBe(0);
  });

  it("sorts bill items by date ascending", () => {
    const accounts = [makeAccount({ balance: 5000 })];
    const rules = [
      makeRule({ id: "r1", amount: 100, nextRunAt: "2026-07-28", merchant: "Late" }),
      makeRule({ id: "r2", amount: 100, nextRunAt: "2026-07-18", merchant: "Early" }),
    ];
    const result = computeSafeToSpend(accounts, rules, REFERENCE);
    expect(result.billItems.map((bill) => bill.label)).toEqual(["Early", "Late"]);
  });
});
