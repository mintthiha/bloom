"use client";
import Link from "next/link";
import type { Profile, Transaction } from "@/lib/api";
import { CollapsibleCard } from "@/components/collapsible-card";
import { ACCOUNT_TYPE_META } from "@/lib/constants/account";
import { calculateNetContributions } from "@/lib/contribution-room";
import { formatCurrency } from "@/lib/format";

type RrspRoomPanelProps = {
  transactions: Transaction[];
  accountIds: string[];
  profile: Profile | null;
};

/** Progress bar showing used vs available room. */
function RoomProgressBar({ used, total, color }: { used: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  return (
    <div style={{ marginTop: "8px" }}>
      <div
        style={{
          height: "8px",
          background: "var(--border)",
          borderRadius: "4px",
          overflow: "hidden",
        }}
      >
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

/** RRSP deduction room usage panel, displayed on any RRSP account detail page. */
export function RrspRoomPanel({ transactions, accountIds, profile }: RrspRoomPanelProps) {
  const accentColor = ACCOUNT_TYPE_META.RRSP.color;

  const deductionLimit = profile?.rrspContributionRoom ?? null;
  const netContributions = calculateNetContributions(transactions, accountIds);
  const pctUsed =
    deductionLimit != null && deductionLimit > 0
      ? Math.round((netContributions / deductionLimit) * 100)
      : null;
  const isOverContributed = deductionLimit != null && netContributions > deductionLimit;

  return (
    <CollapsibleCard
      eyebrow="Contribution Room"
      title="RRSP"
      defaultCollapsed={false}
      style={{ borderTop: `3px solid ${accentColor}` }}
    >
      {deductionLimit == null ? (
        <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
          <Link href="/profile" style={{ color: accentColor, textDecoration: "underline" }}>
            Enter your RRSP deduction limit from your CRA Notice of Assessment →
          </Link>
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {isOverContributed && (
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
              You may be over your estimated RRSP deduction limit. RRSP over-contributions above
              $2,000 are penalized at 1% per month.
            </div>
          )}
          <div>
            <p style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.4px" }}>
              {formatCurrency(netContributions)}{" "}
              <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-secondary)" }}>
                of {formatCurrency(deductionLimit)} used ({pctUsed}%)
              </span>
            </p>
          </div>

          <RoomProgressBar used={netContributions} total={deductionLimit} color={accentColor} />

          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            <Link href="/profile" style={{ color: accentColor }}>
              Update your deduction limit →
            </Link>
          </div>
        </div>
      )}

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
        <span>
          Based on deposits tracked in Bloom — does not include contributions made outside the app.
        </span>
        <Link
          href="/learn"
          style={{ color: accentColor, whiteSpace: "nowrap", marginLeft: "12px" }}
        >
          What is this?
        </Link>
      </div>
    </CollapsibleCard>
  );
}
