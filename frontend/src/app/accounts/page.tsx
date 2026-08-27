"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Wallet } from "lucide-react";
import { api, Account, AccountType } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import {
  AccountSortKey,
  filterAccounts,
  sortAccounts,
  sumSignedBalances,
} from "@/lib/account-view";
import {
  readPinnedAccountIds,
  writePinnedAccountIds,
  readHiddenAccountIds,
  writeHiddenAccountIds,
} from "@/lib/account-preferences";
import { BackToHome } from "@/components/BackToHome";
import { EmptyState } from "@/components/EmptyState";
import { AccountFilters } from "./_components/_filters/AccountFilters";
import { SortControl } from "./_components/_filters/SortControl";
import { AccountsTreemap } from "./_components/_chart/AccountsTreemap";
import { AccountsTable } from "./_components/_list/AccountsTable";
import { RefreshLinkedAccountsButton } from "./_components/RefreshLinkedAccountsButton";

// Reuse the dashboard's manual-order key so a user's existing drag order carries over to this page.
const ORDER_KEY = "bloom-account-order";

const POSITIVE_COLOR = "#22c55e";
const NEGATIVE_COLOR = "#ef4444";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTypes, setActiveTypes] = useState<Set<AccountType>>(new Set());
  const [sortKey, setSortKey] = useState<AccountSortKey>("custom");
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  const [customOrder, setCustomOrder] = useState<string[]>([]);

  /** Loads every account for the signed-in user. */
  const loadAccounts = useCallback(async () => {
    try {
      const nextAccounts = await api.listAccounts();
      setAccounts(nextAccounts);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  /** Hydrate persisted preferences after mount to stay hydration-safe. */
  useEffect(() => {
    setPinnedIds(readPinnedAccountIds());
    setHiddenIds(readHiddenAccountIds());
    try {
      const saved = localStorage.getItem(ORDER_KEY);
      if (saved) setCustomOrder(JSON.parse(saved));
    } catch {
      // ignore parse errors — an empty manual order just falls back to load order
    }
  }, []);

  /** Adds or removes a type from the active filter set. */
  function handleToggleType(type: AccountType) {
    setActiveTypes((previous) => {
      const next = new Set(previous);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  /** Pins or unpins an account for the dashboard's compact balances card, persisting the change. */
  function handleTogglePin(id: string) {
    setPinnedIds((previous) => {
      const next = previous.includes(id)
        ? previous.filter((pinnedId) => pinnedId !== id)
        : [...previous, id];
      writePinnedAccountIds(next);
      return next;
    });
  }

  /** Hides or un-hides an account from this list, persisting the change. */
  function handleToggleHide(id: string) {
    setHiddenIds((previous) => {
      const next = previous.includes(id)
        ? previous.filter((hiddenId) => hiddenId !== id)
        : [...previous, id];
      writeHiddenAccountIds(next);
      return next;
    });
  }

  /** Moves draggedId to just before targetId across the full account order, then persists it. */
  function handleReorder(draggedId: string, targetId: string) {
    setCustomOrder((previous) => {
      const allIds = accounts.map((account) => account.id);
      const base = [
        ...previous.filter((id) => allIds.includes(id)),
        ...allIds.filter((id) => !previous.includes(id)),
      ];
      const from = base.indexOf(draggedId);
      const to = base.indexOf(targetId);
      if (from === -1 || to === -1 || from === to) return previous;
      const next = [...base];
      next.splice(from, 1);
      next.splice(to, 0, draggedId);
      localStorage.setItem(ORDER_KEY, JSON.stringify(next));
      return next;
    });
  }

  const pinnedSet = useMemo(() => new Set(pinnedIds), [pinnedIds]);
  const hiddenSet = useMemo(() => new Set(hiddenIds), [hiddenIds]);

  const visibleAccounts = useMemo(() => {
    const filtered = filterAccounts(accounts, {
      activeTypes,
      search,
      hiddenIds: hiddenSet,
      showHidden,
    });
    return sortAccounts(filtered, sortKey, customOrder);
  }, [accounts, activeTypes, search, hiddenSet, showHidden, sortKey, customOrder]);

  const netTotal = sumSignedBalances(visibleAccounts);
  const totalColor = netTotal >= 0 ? POSITIVE_COLOR : NEGATIVE_COLOR;

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 24px 48px" }}>
      <BackToHome />

      <div className="fade-up" style={{ marginBottom: "28px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "32px",
                fontWeight: 800,
                letterSpacing: "-0.5px",
                marginBottom: "6px",
              }}
            >
              Accounts
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "15px" }}>
              Filter, sort, and pin the accounts you want front and center on your dashboard.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "10px" }}>
            <div style={{ textAlign: "right" }}>
              <p
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--text-secondary)",
                  marginBottom: "6px",
                }}
              >
                Net Shown
              </p>
              <p className="num" style={{ fontSize: "24px", fontWeight: 600, color: totalColor }}>
                {formatCurrency(netTotal)}
              </p>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                {visibleAccounts.length} of {accounts.length} account
                {accounts.length !== 1 ? "s" : ""}
              </p>
            </div>
            <RefreshLinkedAccountsButton accounts={accounts} onRefreshed={loadAccounts} />
          </div>
        </div>
      </div>

      {!loading && accounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No accounts yet"
          description="Open your first account from the dashboard to start tracking balances here."
        />
      ) : (
        <div
          className="content-fade-in"
          style={{ display: "flex", flexDirection: "column", gap: "20px" }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              background: "var(--surface-1)",
              border: "1px solid var(--border)",
              borderRadius: "14px",
              padding: "18px",
            }}
          >
            <AccountFilters
              search={search}
              onSearchChange={setSearch}
              activeTypes={activeTypes}
              onToggleType={handleToggleType}
              onClearTypes={() => setActiveTypes(new Set())}
              hiddenCount={hiddenIds.length}
              showHidden={showHidden}
              onToggleShowHidden={() => setShowHidden((previous) => !previous)}
            />
            <SortControl value={sortKey} onChange={setSortKey} />
          </div>

          {!loading && <AccountsTreemap accounts={visibleAccounts} />}

          <AccountsTable
            accounts={visibleAccounts}
            loading={loading}
            draggable={sortKey === "custom"}
            pinnedIds={pinnedSet}
            hiddenIds={hiddenSet}
            onTogglePin={handleTogglePin}
            onToggleHide={handleToggleHide}
            onReorder={handleReorder}
          />
        </div>
      )}
    </div>
  );
}
