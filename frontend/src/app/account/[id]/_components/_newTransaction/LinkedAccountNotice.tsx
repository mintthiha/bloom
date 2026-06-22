"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Account, api } from "@/lib/api";

interface LinkedAccountNoticeProps {
  account: Account;
  onResynced: () => Promise<void>;
}

/**
 * Read-only banner rendered on linked account detail pages in place of the new-transaction form.
 * Shows the source institution and a button to pull fresh data from Plaid.
 */
export function LinkedAccountNotice({ account, onResynced }: LinkedAccountNoticeProps) {
  const [resyncing, setResyncing] = useState(false);

  /** Triggers a full re-sync of the Plaid item and refreshes the account view. */
  async function handleResync() {
    if (!account.plaidItemId) return;
    setResyncing(true);
    try {
      const result = await api.resyncPlaidItem(account.plaidItemId);
      toast.success(
        `Re-synced ${result.accountsLinked} account${result.accountsLinked !== 1 ? "s" : ""}`
      );
      await onResynced();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Re-sync failed");
    } finally {
      setResyncing(false);
    }
  }

  return (
    <div
      className="fade-up fade-up-2"
      style={{
        border: "1px solid #f59e0b30",
        background: "#f59e0b06",
        borderRadius: "16px",
        padding: "24px",
        marginBottom: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <p
        style={{
          fontSize: "11px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "#f59e0b",
          margin: 0,
        }}
      >
        Linked Account
      </p>
      <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: 0 }}>
        Synced from{" "}
        <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
          {account.institutionName ?? "External Bank"}
        </span>
        . Transactions are read-only mirrors of your external account and cannot be added or edited
        here.
      </p>
      <button
        type="button"
        onClick={handleResync}
        disabled={resyncing || !account.plaidItemId}
        style={{
          alignSelf: "flex-start",
          padding: "10px 20px",
          background: "transparent",
          color: resyncing ? "var(--text-muted)" : "#f59e0b",
          fontWeight: 700,
          fontSize: "14px",
          border: `1px solid ${resyncing ? "var(--border)" : "#f59e0b55"}`,
          borderRadius: "8px",
          cursor: resyncing ? "not-allowed" : "pointer",
          opacity: resyncing ? 0.5 : 1,
          transition: "opacity 0.15s, border-color 0.15s",
        }}
        onMouseEnter={(e) => {
          if (!resyncing) e.currentTarget.style.borderColor = "#f59e0b";
        }}
        onMouseLeave={(e) => {
          if (!resyncing) e.currentTarget.style.borderColor = "#f59e0b55";
        }}
      >
        {resyncing ? "Syncing..." : "Re-sync"}
      </button>
    </div>
  );
}
