"use client";
import Link from "next/link";
import type { Transaction } from "@/lib/api";
import { CollapsibleCard } from "@/components/collapsible-card";
import { ACCOUNT_TYPE_META } from "@/lib/constants/account";
import {
  FHSA_ANNUAL_LIMIT,
  FHSA_LIFETIME_LIMIT,
  calculateNetContributions,
  calculateNetContributionsForYear,
} from "@/lib/contribution-room";
import { formatCurrency } from "@/lib/format";

type FhsaRoomPanelProps = {
  transactions: Transaction[];
  accountIds: string[];
};

/** A labeled progress bar with value/limit labels. */
function LabeledProgressBar({
  label,
  used,
  limit,
  color,
}: {
  label: string;
  used: number;
  limit: number;
  color: string;
}) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
        <span style={{ color: "var(--text-secondary)" }}>{label}</span>
        <span style={{ fontWeight: 600 }}>
          {formatCurrency(used)} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>of {formatCurrency(limit)}</span>
        </span>
      </div>
      <div style={{ height: "8px", background: "var(--border)", borderRadius: "4px", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: color,
            borderRadius: "4px",
            transition: "width 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}

/** FHSA annual and lifetime contribution limit tracker, displayed on any FHSA account detail page. */
export function FhsaRoomPanel({ transactions, accountIds }: FhsaRoomPanelProps) {
  const accentColor = ACCOUNT_TYPE_META.FHSA.color;
  const currentYear = new Date().getFullYear();

  const annualUsed = calculateNetContributionsForYear(transactions, accountIds, currentYear);
  const lifetimeUsed = calculateNetContributions(transactions, accountIds);
  const isAnnualOver = annualUsed > FHSA_ANNUAL_LIMIT;
  const isLifetimeOver = lifetimeUsed > FHSA_LIFETIME_LIMIT;

  return (
    <CollapsibleCard
      eyebrow="Contribution Room"
      title="FHSA"
      defaultCollapsed={false}
      style={{ borderTop: `3px solid ${accentColor}` }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {(isAnnualOver || isLifetimeOver) && (
          <div
            style={{
              background: "#ef444408",
              border: "1px solid #ef4444",
              borderRadius: "12px",
              padding: "16px 20px",
              fontSize: "13px",
              color: "#f87171",
            }}
          >
            {isAnnualOver && !isLifetimeOver &&
              `You may be over your $8,000 FHSA annual limit for ${currentYear}. CRA penalizes FHSA over-contributions at 1% per month.`}
            {isLifetimeOver && !isAnnualOver &&
              "You may be over your $40,000 FHSA lifetime limit. CRA penalizes FHSA over-contributions at 1% per month."}
            {isAnnualOver && isLifetimeOver &&
              `You may be over both your $8,000 FHSA annual limit for ${currentYear} and your $40,000 lifetime limit. CRA penalizes FHSA over-contributions at 1% per month.`}
          </div>
        )}
        <LabeledProgressBar
          label={`This year (${currentYear})`}
          used={annualUsed}
          limit={FHSA_ANNUAL_LIMIT}
          color={accentColor}
        />
        <LabeledProgressBar
          label="Lifetime"
          used={lifetimeUsed}
          limit={FHSA_LIFETIME_LIMIT}
          color={accentColor}
        />
      </div>

      <div
        style={{
          marginTop: "16px",
          paddingTop: "14px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "12px",
          color: "var(--text-muted)",
        }}
      >
        <span>Based on deposits tracked in Bloom — does not include contributions made outside the app.</span>
        <Link href="/learn" style={{ color: accentColor, whiteSpace: "nowrap", marginLeft: "12px" }}>
          What is this?
        </Link>
      </div>
    </CollapsibleCard>
  );
}
