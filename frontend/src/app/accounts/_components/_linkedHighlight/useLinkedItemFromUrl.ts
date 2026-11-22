import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LINKED_ITEM_QUERY_PARAM } from "@/lib/linked-accounts-url";

/**
 * Captures the just-linked Plaid item id from the URL once, then strips it so a refresh or a
 * shared link doesn't re-trigger the highlight. The id stays in state for the page's lifetime.
 */
export function useLinkedItemFromUrl(): string | null {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [linkedPlaidItemId, setLinkedPlaidItemId] = useState<string | null>(null);

  /** Moves the linked-item param from the URL into state, then cleans the URL. */
  useEffect(() => {
    const plaidItemIdFromUrl = searchParams.get(LINKED_ITEM_QUERY_PARAM);
    if (!plaidItemIdFromUrl) return;
    setLinkedPlaidItemId(plaidItemIdFromUrl);
    router.replace("/accounts", { scroll: false });
  }, [searchParams, router]);

  return linkedPlaidItemId;
}
