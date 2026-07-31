"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Account } from "@/lib/api";
import { ACCOUNT_TYPE_META } from "@/lib/constants/account";
import { CollapsibleCard } from "@/components/collapsible-card";
import { formatCurrency } from "@/lib/format";
import { toSignedBalance, accountDisplayName } from "@/lib/account-view";
import {
  readPinnedAccountIds,
  writePinnedAccountIds,
  readHiddenAccountIds,
} from "@/lib/account-preferences";

type Props = {
  accounts: Account[];
  /** Id of the most recently created account — always shown and highlighted with a glow. */
  newlyCreatedId?: string;
};

const POSITIVE_COLOR = "#22c55e";
const NEGATIVE_COLOR = "#ef4444";

// How many top accounts to show when the user hasn't pinned any of their own.
const FALLBACK_COUNT = 3;

/** Header pill showing the combined total of the shown accounts, kept visible while the card is collapsed. */
function TotalBadge({ total }: { total: number }) {
  const color = total >= 0 ? POSITIVE_COLOR : NEGATIVE_COLOR;
  return (
    <span
      className="num"
      style={{
        fontSize: "15px",
        fontWeight: 800,
        padding: "2px 9px",
        borderRadius: "7px",
        background: `${color}18`,
        border: `1px solid ${color}44`,
        color,
      }}
    >
      {total < 0 ? "−" : ""}
      {formatCurrency(Math.abs(total))}
    </span>
  );
}

/** Link to the full Accounts page, shown in the card header next to the total. */
function ViewAllLink() {
  return (
    <Link
      href="/accounts"
      className="press"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        fontSize: "12px",
        fontWeight: 600,
        color: "#3b82f6",
        textDecoration: "none",
        whiteSpace: "nowrap",
      }}
    >
      View all
      <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

/**
 * Compact balances card for the dashboard — shows the accounts the user pinned on the Accounts page,
 * falling back to their top accounts by balance when nothing is pinned. Click a row to open the account.
 */
export function AccountBalancesCard({ accounts, newlyCreatedId }: Props) {
  const router = useRouter();
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);

  /** Load persisted preferences after mount to keep the initial render hydration-safe. */
  useEffect(() => {
    setPinnedIds(readPinnedAccountIds());
    setHiddenIds(readHiddenAccountIds());
  }, []);

  /** Auto-pins a newly created account so it persists on the dashboard after a refresh. */
  useEffect(() => {
    if (!newlyCreatedId) return;
    setPinnedIds((previous) => {
      if (previous.includes(newlyCreatedId)) return previous;
      const next = [...previous, newlyCreatedId];
      writePinnedAccountIds(next);
      return next;
    });
  }, [newlyCreatedId]);

  const { rows, isPinnedView } = useMemo(() => {
    const hiddenSet = new Set(hiddenIds);
    const visibleAccounts = accounts.filter((account) => !hiddenSet.has(account.id));

    const pinnedSet = new Set(pinnedIds);
    const pinned = visibleAccounts.filter((account) => pinnedSet.has(account.id));
    let source =
      pinned.length > 0
        ? pinned
        : [...visibleAccounts]
            .sort((first, second) => toSignedBalance(second) - toSignedBalance(first))
            .slice(0, FALLBACK_COUNT);

    // Always surface the newly created account even if it didn't make the top N.
    if (newlyCreatedId && !source.find((account) => account.id === newlyCreatedId)) {
      const newAccount = accounts.find((account) => account.id === newlyCreatedId);
      if (newAccount) source = [...source, newAccount];
    }

    const ranked = source
      .map((account) => ({
        id: account.id,
        name: accountDisplayName(account),
        type: account.accountType,
        balance: toSignedBalance(account),
      }))
      .sort((first, second) => second.balance - first.balance);
    return { rows: ranked, isPinnedView: pinned.length > 0 };
  }, [accounts, pinnedIds, hiddenIds, newlyCreatedId]);

  const total = rows.reduce((sum, row) => sum + row.balance, 0);
  // Scale every bar against the largest magnitude so a near-zero or negative account still reads at a glance.
  const maxMagnitude = Math.max(...rows.map((row) => Math.abs(row.balance)), 1);

  return (
    <CollapsibleCard
      eyebrow="Account Balances"
      title="Balances at a glance"
      forceExpanded={!!newlyCreatedId}
      description={
        isPinnedView
          ? "Your pinned accounts, with credit shown as what you owe. Newly created accounts are pinned here automatically — unpin them from the Accounts page."
          : "By default, your top 3 accounts by balance. New accounts are pinned here automatically. Hidden accounts won't appear. Manage pins and visibility from the Accounts page."
      }
      className="fade-up fade-up-1"
      headerRight={
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <TotalBadge total={total} />
          <ViewAllLink />
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {rows.map((row) => {
          const meta = ACCOUNT_TYPE_META[row.type];
          const isNegative = row.balance < 0;
          const fillWidth = `${(Math.abs(row.balance) / maxMagnitude) * 100}%`;
          return (
            <button
              key={row.id}
              type="button"
              className={`balance-row${row.id === newlyCreatedId ? " new-account-glow" : ""}`}
              onClick={() => router.push(`/account/${row.id}`)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: "transparent",
                border: "1px solid transparent",
                borderRadius: "10px",
                padding: "10px 12px",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  marginBottom: "8px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "9999px",
                      background: meta.color,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.name}
                  </span>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: meta.color,
                      background: meta.soft,
                      border: `1px solid ${meta.border}`,
                      borderRadius: "9999px",
                      padding: "1px 7px",
                      flexShrink: 0,
                    }}
                  >
                    {meta.label}
                  </span>
                </div>
                <span
                  className="num"
                  style={{
                    fontSize: "14px",
                    fontWeight: 500,
                    color: isNegative ? NEGATIVE_COLOR : "var(--text-primary)",
                    flexShrink: 0,
                  }}
                >
                  {formatCurrency(row.balance)}
                </span>
              </div>
              <div
                style={{
                  height: "6px",
                  borderRadius: "9999px",
                  background: "var(--surface-3)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: fillWidth,
                    height: "100%",
                    borderRadius: "9999px",
                    background: meta.color,
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </CollapsibleCard>
  );
}
