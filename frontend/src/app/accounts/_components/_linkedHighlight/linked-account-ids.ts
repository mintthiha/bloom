import { Account } from "@/lib/api";

/** Ids of the accounts that came from the given Plaid item; empty when no item was just linked. */
export function selectLinkedAccountIds(
  accounts: Account[],
  linkedPlaidItemId: string | null
): Set<string> {
  if (!linkedPlaidItemId) return new Set();
  return new Set(
    accounts
      .filter((account) => account.isLinked && account.plaidItemId === linkedPlaidItemId)
      .map((account) => account.id)
  );
}
