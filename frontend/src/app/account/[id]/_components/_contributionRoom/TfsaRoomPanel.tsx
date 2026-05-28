"use client";
import Link from "next/link";
import type { Profile, Transaction } from "@/lib/api";
import { CollapsibleCard } from "@/components/collapsible-card";
import { ACCOUNT_TYPE_META } from "@/lib/constants/account";
import {
  calculateTfsaLifetimeRoom,
  calculateNetContributions,
} from "@/lib/contribution-room";
import { formatCurrency } from "@/lib/format";

type TfsaRoomPanelProps = {
  transactions: Transaction[];
  accountIds: string[];
  profile: Profile | null;
};

/** Progress bar showing used vs total room for a registered account. */
function RoomProgressBar({
  used,
  total,
  color,
  isOver,
}: {
  used: number;
  total: number;
  color: string;
  isOver: boolean;
}) {
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
            background: isOver ? "#ef4444" : color,
            borderRadius: "4px",
            transition: "width 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}

/** Estimated TFSA contribution room panel, displayed on any TFSA account detail page. */
export function TfsaRoomPanel({ transactions, accountIds, profile }: TfsaRoomPanelProps) {
  const accentColor = ACCOUNT_TYPE_META.TFSA.color;
  const currentYear = new Date().getFullYear();

  const lifetimeRoom =
    profile?.tfsaBirthYear != null
      ? calculateTfsaLifetimeRoom(profile.tfsaBirthYear, currentYear)
      : null;

  const netContributions = calculateNetContributions(transactions, accountIds);
  const externalUsed = profile?.tfsaRoomUsedElsewhere ?? 0;
  const totalUsed = netContributions + externalUsed;
  const roomRemaining = lifetimeRoom != null ? lifetimeRoom - totalUsed : null;
  const isOverContributed = roomRemaining != null && roomRemaining < 0;

  return (
    <CollapsibleCard
      eyebrow="Contribution Room"
      title="TFSA"
      defaultCollapsed={false}
      style={{ borderTop: `3px solid ${accentColor}` }}
    >
      {lifetimeRoom == null ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
            <Link
              href="/profile"
              style={{ color: accentColor, textDecoration: "underline" }}
            >
              Enter your birth year on your profile to estimate your TFSA room →
            </Link>
          </p>
          {netContributions !== 0 && (
            <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              Bloom has tracked {formatCurrency(netContributions)} in net TFSA deposits so far.
            </p>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {isOverContributed && (
            <div
              style={{
                background: "#ef444422",
                border: "1px solid #ef4444",
                borderRadius: "10px",
                padding: "12px 16px",
                fontSize: "13px",
                color: "#f87171",
              }}
            >
              You may be at or over your TFSA limit. CRA penalizes over-contributions at 1%/month.
            </div>
          )}

          <div>
            <p style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.4px" }}>
              {formatCurrency(Math.max(roomRemaining!, 0))} remaining
            </p>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
              of {formatCurrency(lifetimeRoom)} estimated lifetime room
            </p>
          </div>

          <RoomProgressBar
            used={totalUsed}
            total={lifetimeRoom}
            color={accentColor}
            isOver={isOverContributed}
          />

          <div style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: "4px" }}>
            <span>Bloom deposits (net): {formatCurrency(netContributions)}</span>
            {externalUsed > 0 && (
              <span>
                Contributions outside Bloom:{" "}
                <Link href="/profile" style={{ color: accentColor }}>
                  {formatCurrency(externalUsed)}
                </Link>
              </span>
            )}
            {externalUsed === 0 && (
              <span>
                <Link href="/profile" style={{ color: accentColor }}>
                  Add contributions made outside Bloom →
                </Link>
              </span>
            )}
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
        <span>Based on deposits tracked in Bloom — does not include contributions made outside the app.</span>
        <Link href="/learn" style={{ color: accentColor, whiteSpace: "nowrap", marginLeft: "12px" }}>
          What is this?
        </Link>
      </div>
    </CollapsibleCard>
  );
}
