import { describe, it, expect } from "vitest";
import { Account, AccountType } from "@/lib/api";
import {
  toSignedBalance,
  accountDisplayName,
  filterAccounts,
  sortAccounts,
  sumSignedBalances,
} from "./account-view";

/** Builds an Account with sensible defaults so each test overrides only the fields it cares about. */
function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "id-1",
    ownerName: "Alex Kim",
    nickname: null,
    accountType: "CHEQUING",
    balance: 100,
    frozen: false,
    isLinked: false,
    plaidAccountId: null,
    plaidItemId: null,
    institutionName: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("toSignedBalance", () => {
  it("returns the balance unchanged for non-credit accounts", () => {
    expect(toSignedBalance(makeAccount({ accountType: "SAVINGS", balance: 250 }))).toBe(250);
  });

  it("negates credit balances so they subtract from totals", () => {
    expect(toSignedBalance(makeAccount({ accountType: "CREDIT", balance: 80 }))).toBe(-80);
  });
});

describe("accountDisplayName", () => {
  it("prefers the nickname when present", () => {
    expect(accountDisplayName(makeAccount({ nickname: "Rainy Day" }))).toBe("Rainy Day");
  });

  it("falls back to the owner name when there is no nickname", () => {
    expect(accountDisplayName(makeAccount({ nickname: null, ownerName: "Alex Kim" }))).toBe(
      "Alex Kim"
    );
  });
});

describe("filterAccounts", () => {
  const chequing = makeAccount({ id: "a", accountType: "CHEQUING", nickname: "Everyday" });
  const savings = makeAccount({ id: "b", accountType: "SAVINGS", nickname: "Vacation" });
  const credit = makeAccount({
    id: "c",
    accountType: "CREDIT",
    nickname: "Visa",
    institutionName: "RBC",
  });
  const all = [chequing, savings, credit];

  const baseFilters = {
    activeTypes: new Set<AccountType>(),
    search: "",
    hiddenIds: new Set<string>(),
    showHidden: false,
  };

  it("returns everything when no filters are active", () => {
    expect(filterAccounts(all, baseFilters)).toEqual(all);
  });

  it("keeps only the selected types", () => {
    const result = filterAccounts(all, { ...baseFilters, activeTypes: new Set(["CHEQUING"]) });
    expect(result).toEqual([chequing]);
  });

  it("matches search against name, owner, and institution", () => {
    expect(filterAccounts(all, { ...baseFilters, search: "vacation" })).toEqual([savings]);
    expect(filterAccounts(all, { ...baseFilters, search: "rbc" })).toEqual([credit]);
  });

  it("drops hidden accounts by default but shows them when showHidden is on", () => {
    const hiddenIds = new Set(["b"]);
    expect(filterAccounts(all, { ...baseFilters, hiddenIds })).toEqual([chequing, credit]);
    expect(filterAccounts(all, { ...baseFilters, hiddenIds, showHidden: true })).toEqual(all);
  });
});

describe("sortAccounts", () => {
  const cheq = makeAccount({
    id: "a",
    accountType: "CHEQUING",
    nickname: "Zeta",
    balance: 50,
    updatedAt: "2024-03-01T00:00:00.000Z",
  });
  const save = makeAccount({
    id: "b",
    accountType: "SAVINGS",
    nickname: "Alpha",
    balance: 900,
    updatedAt: "2024-01-01T00:00:00.000Z",
  });
  const credit = makeAccount({
    id: "c",
    accountType: "CREDIT",
    nickname: "Mint",
    balance: 300,
    updatedAt: "2024-02-01T00:00:00.000Z",
  });
  const all = [cheq, save, credit];

  it("sorts by signed balance descending, with credit ranking below cash", () => {
    expect(sortAccounts(all, "balance", []).map((a) => a.id)).toEqual(["b", "a", "c"]);
  });

  it("sorts by display name alphabetically", () => {
    expect(sortAccounts(all, "name", []).map((a) => a.id)).toEqual(["b", "c", "a"]);
  });

  it("sorts by type in cash → registered → credit order", () => {
    expect(sortAccounts(all, "type", []).map((a) => a.id)).toEqual(["a", "b", "c"]);
  });

  it("sorts by most recently updated first", () => {
    expect(sortAccounts(all, "recent", []).map((a) => a.id)).toEqual(["a", "c", "b"]);
  });

  it("honors the manual order and sinks ids missing from it to the end", () => {
    expect(sortAccounts(all, "custom", ["c", "a"]).map((a) => a.id)).toEqual(["c", "a", "b"]);
  });

  it("does not mutate the input array", () => {
    const input = [...all];
    sortAccounts(input, "balance", []);
    expect(input.map((a) => a.id)).toEqual(["a", "b", "c"]);
  });
});

describe("sumSignedBalances", () => {
  it("adds cash and subtracts credit", () => {
    const accounts = [
      makeAccount({ accountType: "CHEQUING", balance: 500 }),
      makeAccount({ accountType: "SAVINGS", balance: 1000 }),
      makeAccount({ accountType: "CREDIT", balance: 200 }),
    ];
    expect(sumSignedBalances(accounts)).toBe(1300);
  });

  it("returns 0 for an empty list", () => {
    expect(sumSignedBalances([])).toBe(0);
  });
});
