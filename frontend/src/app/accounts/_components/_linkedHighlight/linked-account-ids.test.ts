import { describe, expect, it } from "vitest";
import { Account } from "@/lib/api";
import { selectLinkedAccountIds } from "./linked-account-ids";

/** Builds an Account with defaults so each test overrides only the fields it needs. */
function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "account-1",
    ownerName: "Jane Doe",
    nickname: null,
    accountType: "CHEQUING",
    balance: 0,
    frozen: false,
    isLinked: false,
    plaidAccountId: null,
    plaidItemId: null,
    institutionName: null,
    color: null,
    icon: null,
    createdAt: "2026-04-04T00:00:00.000Z",
    updatedAt: "2026-04-04T00:00:00.000Z",
    ...overrides,
  };
}

const ACCOUNTS: Account[] = [
  makeAccount({ id: "manual" }),
  makeAccount({ id: "old-td-chequing", isLinked: true, plaidItemId: "item-old" }),
  makeAccount({ id: "new-td-chequing", isLinked: true, plaidItemId: "item-new" }),
  makeAccount({ id: "new-td-savings", isLinked: true, plaidItemId: "item-new" }),
];

describe("selectLinkedAccountIds", () => {
  it("returns an empty set when no item was just linked", () => {
    expect(selectLinkedAccountIds(ACCOUNTS, null).size).toBe(0);
  });

  it("returns only the accounts from the just-linked item, not older links to the same bank", () => {
    expect(selectLinkedAccountIds(ACCOUNTS, "item-new")).toEqual(
      new Set(["new-td-chequing", "new-td-savings"])
    );
  });

  it("returns an empty set when the item id matches no account", () => {
    expect(selectLinkedAccountIds(ACCOUNTS, "item-missing").size).toBe(0);
  });

  it("ignores an unlinked account that still carries a stale item id", () => {
    const accounts = [makeAccount({ id: "unlinked", isLinked: false, plaidItemId: "item-new" })];
    expect(selectLinkedAccountIds(accounts, "item-new").size).toBe(0);
  });
});
