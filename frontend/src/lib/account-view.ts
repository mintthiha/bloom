import { Account, AccountType } from "@/lib/api";

/** Grouped account sections shown in the list, in display order — mirrors the dashboard's cash/registered/credit split. */
export const ACCOUNT_GROUPS: {
  id: string;
  title: string;
  description: string;
  types: AccountType[];
}[] = [
  {
    id: "cash",
    title: "Cash Accounts",
    description: "Daily banking and savings balances.",
    types: ["CHEQUING", "SAVINGS"],
  },
  {
    id: "registered",
    title: "Registered Accounts",
    description: "Tax-advantaged savings and investment accounts.",
    types: ["TFSA", "RRSP", "FHSA"],
  },
  {
    id: "credit",
    title: "Credit Accounts",
    description: "Debt balances tracked separately from cash.",
    types: ["CREDIT"],
  },
];

export type AccountSortKey = "custom" | "balance" | "name" | "type" | "recent";

/** Sort options in the order they appear in the control; "custom" is the manual drag order. */
export const ACCOUNT_SORT_OPTIONS: { key: AccountSortKey; label: string }[] = [
  { key: "custom", label: "Manual" },
  { key: "balance", label: "Balance" },
  { key: "name", label: "Name" },
  { key: "type", label: "Type" },
  { key: "recent", label: "Recent" },
];

export type AccountFilters = {
  /** Account types to keep; an empty set means "all types". */
  activeTypes: Set<AccountType>;
  /** Case-insensitive text matched against name, owner, and institution. */
  search: string;
  /** Ids the user has hidden from the list. */
  hiddenIds: Set<string>;
  /** When true, hidden accounts are still shown (so they can be un-hidden). */
  showHidden: boolean;
};

// Canonical type ordering used by the "Type" sort so groups stay in cash → registered → credit order.
const TYPE_ORDER: AccountType[] = ["CHEQUING", "SAVINGS", "TFSA", "RRSP", "FHSA", "CREDIT"];

/** Credit balances are stored as amounts owed; sign them negative so ranking and totals mirror net-worth math. */
export function toSignedBalance(account: Account): number {
  return account.accountType === "CREDIT" ? -account.balance : account.balance;
}

/** The name to display for an account: its nickname when set, otherwise the owner name. */
export function accountDisplayName(account: Account): string {
  return account.nickname ?? account.ownerName;
}

/** Keeps accounts matching the active type chips and search text, dropping hidden ones unless showHidden is on. */
export function filterAccounts(accounts: Account[], filters: AccountFilters): Account[] {
  const query = filters.search.trim().toLowerCase();
  return accounts.filter((account) => {
    if (!filters.showHidden && filters.hiddenIds.has(account.id)) return false;
    if (filters.activeTypes.size > 0 && !filters.activeTypes.has(account.accountType)) return false;
    if (query) {
      const haystack =
        `${accountDisplayName(account)} ${account.ownerName} ${account.institutionName ?? ""}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

/** Returns a new array sorted by the chosen key; "custom" honors the saved manual order with unknown ids sunk to the end. */
export function sortAccounts(
  accounts: Account[],
  sortKey: AccountSortKey,
  customOrder: string[]
): Account[] {
  const next = [...accounts];
  switch (sortKey) {
    case "balance":
      return next.sort((first, second) => toSignedBalance(second) - toSignedBalance(first));
    case "name":
      return next.sort((first, second) =>
        accountDisplayName(first).localeCompare(accountDisplayName(second))
      );
    case "type":
      return next.sort(
        (first, second) =>
          TYPE_ORDER.indexOf(first.accountType) - TYPE_ORDER.indexOf(second.accountType)
      );
    case "recent":
      return next.sort(
        (first, second) =>
          new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime()
      );
    case "custom":
    default: {
      const indexById = new Map(customOrder.map((id, index) => [id, index]));
      return next.sort(
        (first, second) =>
          (indexById.get(first.id) ?? Infinity) - (indexById.get(second.id) ?? Infinity)
      );
    }
  }
}

/** Sum of signed balances — used for each group subtotal and the grand total. */
export function sumSignedBalances(accounts: Account[]): number {
  return accounts.reduce((total, account) => total + toSignedBalance(account), 0);
}
