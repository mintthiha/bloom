"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { CollapsibleCard } from "@/components/collapsible-card";
import { buildGlanceStats } from "./glance-stats";

/**
 * Net-worth snapshots are stored one row per month with no backfill, and the history endpoint
 * caps its result at the months it is asked for — so the strip asks for a decade to count them all.
 */
const HISTORY_MONTHS_CEILING = 120;

type GlanceStatsStripProps = {
  /** The profile's signup timestamp, already loaded by the page, or null while it's in flight. */
  createdAt: string | null;
};

/**
 * Read-only summary of how much history Bloom is holding for the user, so the profile page opens
 * as a profile rather than as a stack of settings forms.
 */
export function GlanceStatsStrip({ createdAt }: GlanceStatsStripProps) {
  const [accountCount, setAccountCount] = useState<number | null>(null);
  const [transactionCount, setTransactionCount] = useState<number | null>(null);
  const [monthsOfHistory, setMonthsOfHistory] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /** Loads the three counts on mount, letting each one land or fail without blanking the others. */
  useEffect(() => {
    let cancelled = false;

    async function loadCounts() {
      const [accounts, transactions, history] = await Promise.allSettled([
        api.listAccounts(),
        // limit: 1 because only the envelope's filter-wide `total` is needed, not the rows.
        api.listTransactions({ limit: 1 }),
        api.getNetWorthHistory(HISTORY_MONTHS_CEILING),
      ]);
      if (cancelled) return;

      if (accounts.status === "fulfilled") setAccountCount(accounts.value.length);
      if (transactions.status === "fulfilled") setTransactionCount(transactions.value.total);
      if (history.status === "fulfilled") setMonthsOfHistory(history.value.length);
      setIsLoading(false);
    }

    loadCounts();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = buildGlanceStats({
    createdAt,
    accountCount,
    transactionCount,
    monthsOfHistory,
  });

  return (
    <CollapsibleCard
      className="fade-up"
      eyebrow="Your Bloom at a glance"
      title="How much you've tracked so far"
      description="A running count of everything Bloom is holding for you."
      style={{ marginBottom: "20px", opacity: isLoading ? 0.6 : 1 }}
    >
      <div
        style={{
          display: "grid",
          // Intrinsically responsive: four across on desktop, two across on a phone, with no
          // second viewport listener needed.
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "12px",
        }}
      >
        {stats.map((stat) => (
          <div
            key={stat.key}
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              padding: "14px 16px",
              minWidth: 0,
            }}
          >
            <p
              className="num"
              style={{
                fontSize: "22px",
                fontWeight: 800,
                letterSpacing: "-0.4px",
                // No mid-word breaking: a wrapped "Septembe/r" reads as a rendering bug.
                overflowWrap: "normal",
                wordBreak: "keep-all",
              }}
            >
              {stat.value}
            </p>
            <p style={{ fontSize: "13px", fontWeight: 600, marginTop: "4px" }}>{stat.label}</p>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
              {stat.hint}
            </p>
          </div>
        ))}
      </div>
    </CollapsibleCard>
  );
}
