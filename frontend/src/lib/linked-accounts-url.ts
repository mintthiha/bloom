/** Query param on /accounts naming the Plaid item whose accounts were just linked. */
export const LINKED_ITEM_QUERY_PARAM = "linkedItem";

/** Builds the /accounts URL that highlights every account belonging to a freshly linked Plaid item. */
export function buildLinkedAccountsUrl(plaidItemId: string): string {
  return `/accounts?${LINKED_ITEM_QUERY_PARAM}=${encodeURIComponent(plaidItemId)}`;
}
