"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Account, api } from "@/lib/api";

interface RefreshLinkedAccountsButtonProps {
  accounts: Account[];
  onRefreshed: () => Promise<void>;
}

/**
 * Syncs all distinct Plaid items found in the account list. Only renders when at least one
 * linked account exists. Re-fetches the account list after all syncs complete.
 */
export function RefreshLinkedAccountsButton({
  accounts,
  onRefreshed,
}: RefreshLinkedAccountsButtonProps) {
  const [syncing, setSyncing] = useState(false);

  const linkedItemIds = [
    ...new Set(
      accounts.flatMap((account) =>
        account.isLinked && account.plaidItemId ? [account.plaidItemId] : []
      )
    ),
  ];

  if (linkedItemIds.length === 0) return null;

  /** Syncs every linked Plaid item in parallel, then refreshes the account list. */
  async function handleSync() {
    setSyncing(true);
    try {
      const results = await Promise.all(linkedItemIds.map((itemId) => api.resyncPlaidItem(itemId)));
      const totalAccounts = results.reduce((sum, result) => sum + result.accountsLinked, 0);
      toast.success(
        `Synced ${totalAccounts} account${totalAccounts !== 1 ? "s" : ""} from ${linkedItemIds.length} linked institution${linkedItemIds.length !== 1 ? "s" : ""}`
      );
      await onRefreshed();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSync}
      className="accent-outline-button"
      disabled={syncing}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "8px 16px",
        background: "transparent",
        color: syncing ? "var(--text-muted)" : "var(--brand-accent-text)",
        fontWeight: 700,
        fontSize: "13px",
        borderRadius: "8px",
        cursor: syncing ? "not-allowed" : "pointer",
        opacity: syncing ? 0.5 : 1,
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      <RefreshCw size={13} className={syncing ? "spin" : undefined} />
      {syncing ? "Syncing..." : "Sync linked accounts"}
    </button>
  );
}
