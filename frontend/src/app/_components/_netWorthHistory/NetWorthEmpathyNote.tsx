"use client";
import { NetWorthSnapshot } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

type Props = {
  history: NetWorthSnapshot[];
};

/** Renders a contextual empathy note below the net worth chart when the user's net worth is negative. */
export function NetWorthEmpathyNote({ history }: Props) {
  if (history.length === 0) return null;

  const currentSnapshot = history[history.length - 1]!;
  const previousSnapshot = history.length >= 2 ? history[history.length - 2]! : null;

  if (currentSnapshot.netWorth >= 0) return null;

  const isImprovingMonthOverMonth =
    previousSnapshot !== null && currentSnapshot.netWorth > previousSnapshot.netWorth;
  const monthlyDelta =
    previousSnapshot !== null ? currentSnapshot.netWorth - previousSnapshot.netWorth : 0;

  return (
    <div
      style={{
        marginTop: "16px",
        padding: "12px 16px",
        borderLeft: "3px solid #f59e0b",
        background: "#f59e0b0d",
        borderRadius: "0 6px 6px 0",
      }}
    >
      <p
        style={{
          fontSize: "13px",
          color: "var(--text-muted)",
          lineHeight: 1.6,
          margin: 0,
        }}
      >
        Having a negative net worth early in life is completely normal — student loans, a car, or a
        credit card balance affect most people&apos;s starting point. What matters is the direction,
        not the number.
      </p>
      {isImprovingMonthOverMonth && (
        <p
          style={{
            fontSize: "13px",
            color: "#22c55e",
            marginTop: "8px",
            marginBottom: 0,
            fontWeight: 600,
          }}
        >
          ↑ Up {formatCurrency(monthlyDelta)} from last month. You&apos;re moving in the right
          direction.
        </p>
      )}
    </div>
  );
}
