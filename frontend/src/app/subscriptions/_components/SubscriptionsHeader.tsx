"use client";

import type { SubscriptionSummary } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { AnimatedCurrency } from "@/components/animated-currency";

/** The headline insight: total monthly spend on subscriptions, with annual total and count. */
export function SubscriptionsHeader({ summary }: { summary: SubscriptionSummary }) {
  return (
    <div
      style={{
        background: "var(--snapshot-gradient)",
        border: "1px solid var(--border)",
        borderRadius: "14px",
        padding: "24px",
      }}
    >
      <p
        style={{
          fontSize: "13px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "#3b82f6",
          marginBottom: "8px",
        }}
      >
        Subscriptions
      </p>
      <h2
        style={{
          fontSize: "20px",
          fontWeight: 800,
          letterSpacing: "-0.3px",
          marginBottom: "6px",
        }}
      >
        You spend {formatCurrency(summary.monthlyTotal)}/mo on subscriptions
      </h2>
      <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginBottom: "20px" }}>
        Auto-detected from recurring merchant charges and your recurring rules.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "32px", alignItems: "flex-end" }}>
        <div>
          <p
            className="num"
            style={{ fontSize: "40px", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}
          >
            <AnimatedCurrency value={summary.monthlyTotal} />
          </p>
          <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "6px" }}>
            per month
          </p>
        </div>

        <div style={{ display: "flex", gap: "28px" }}>
          <div>
            <p className="num" style={{ fontSize: "20px", fontWeight: 700, color: "#f59e0b" }}>
              {formatCurrency(summary.annualTotal)}
            </p>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
              per year
            </p>
          </div>
          <div>
            <p className="num" style={{ fontSize: "20px", fontWeight: 700 }}>
              {summary.count}
            </p>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
              {summary.count === 1 ? "subscription" : "subscriptions"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
