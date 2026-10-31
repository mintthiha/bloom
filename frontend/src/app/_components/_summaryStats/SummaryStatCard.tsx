"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Account } from "@/lib/api";
import { FlashOnChange } from "@/components/flash-on-change";

interface SummaryStatCardProps {
  title: string;
  value: ReactNode;
  /** Changes in this value trigger the brief highlight flash. */
  flashKey?: unknown;
  color?: string;
  /** When set, the tile links to this account's page. */
  targetAccount?: Account;
  /** Position in the row, used to stagger the entrance animation. */
  staggerIndex?: number;
}

/** A small stat tile in the dashboard's summary row; links to an account when one is given. */
export function SummaryStatCard({
  title,
  value,
  flashKey,
  color,
  targetAccount,
  staggerIndex = 0,
}: SummaryStatCardProps) {
  const router = useRouter();
  const isClickable = Boolean(targetAccount);

  return (
    <button
      type="button"
      className="fade-up summary-stat-card"
      onClick={() => {
        if (targetAccount) router.push(`/account/${targetAccount.id}`);
      }}
      disabled={!isClickable}
      style={{
        background: "var(--surface-1)",
        borderRadius: "12px",
        padding: "20px",
        textAlign: "left",
        cursor: isClickable ? "pointer" : "default",
        opacity: isClickable ? 1 : 0.9,
        animationDelay: `${staggerIndex * 50}ms`,
      }}
    >
      <p
        style={{
          fontSize: "11px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--text-secondary)",
          marginBottom: "10px",
        }}
      >
        {title}
      </p>
      <div
        className="num"
        style={{
          fontSize: "22px",
          fontWeight: 500,
          color: color ?? "var(--text-primary)",
        }}
      >
        <FlashOnChange watchKey={flashKey}>{value}</FlashOnChange>
      </div>
    </button>
  );
}
