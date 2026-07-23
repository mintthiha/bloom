"use client";

import { TrendingUp } from "lucide-react";
import type { Subscription, SubscriptionCadence } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

/** Human-readable label for each billing cadence. */
const CADENCE_LABEL: Record<SubscriptionCadence, string> = {
  WEEKLY: "Weekly",
  BIWEEKLY: "Every 2 weeks",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  ANNUAL: "Yearly",
};

/** Short suffix shown after the current price to convey its billing period. */
const CADENCE_SUFFIX: Record<SubscriptionCadence, string> = {
  WEEKLY: "/wk",
  BIWEEKLY: "/2wk",
  MONTHLY: "/mo",
  QUARTERLY: "/qtr",
  ANNUAL: "/yr",
};

/** Formats an ISO date string as a short, locale-friendly day (e.g. "Aug 5, 2026"). */
function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Renders one subscription: merchant, cadence, current price, next charge, and a price-increase flag. */
export function SubscriptionCard({ subscription }: { subscription: Subscription }) {
  const { merchant, cadence, currentPrice, monthlyCost, nextExpectedAt, source, priceChange } =
    subscription;

  return (
    <div
      className="lift"
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "14px",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "12px",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              fontSize: "15px",
              fontWeight: 700,
              letterSpacing: "-0.01em",
              marginBottom: "6px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {merchant}
          </p>
          <span
            style={{
              fontSize: "10px",
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: "999px",
              background: "#f59e0b1a",
              border: "1px solid #f59e0b40",
              color: "#f59e0b",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {CADENCE_LABEL[cadence]}
          </span>
        </div>

        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p
            className="num"
            style={{ fontSize: "18px", fontWeight: 800, letterSpacing: "-0.02em" }}
          >
            {formatCurrency(currentPrice)}
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>
              {CADENCE_SUFFIX[cadence]}
            </span>
          </p>
          {cadence !== "MONTHLY" && (
            <p className="num" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              {formatCurrency(monthlyCost)}/mo
            </p>
          )}
        </div>
      </div>

      {priceChange && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 10px",
            borderRadius: "8px",
            background: "#ef44441a",
            border: "1px solid #ef444440",
            color: "#ef4444",
            fontSize: "12px",
            fontWeight: 600,
          }}
        >
          <TrendingUp size={13} style={{ flexShrink: 0 }} />
          <span className="num">
            {formatCurrency(priceChange.from)} → {formatCurrency(priceChange.to)}
          </span>
          <span>(+{priceChange.pct}%)</span>
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "12px",
          color: "var(--text-secondary)",
        }}
      >
        <span>
          {nextExpectedAt ? `Next ~ ${formatShortDate(nextExpectedAt)}` : "From recurring rule"}
        </span>
        {source === "both" && (
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Matches rule</span>
        )}
      </div>
    </div>
  );
}
