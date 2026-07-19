"use client";
import { useMemo } from "react";
import { Account, RecurringTransaction } from "@/lib/api";
import { CollapsibleCard } from "@/components/collapsible-card";
import { formatCurrency } from "@/lib/format";
import { computeSafeToSpend, SafeToSpendResult } from "@/lib/safe-to-spend";
import { formatRelativeDate } from "../_recurringCalendar/recurring-calendar-utils";

type Props = {
  accounts: Account[];
  recurringRules: RecurringTransaction[];
};

const POSITIVE_COLOR = "#22c55e";
const NEGATIVE_COLOR = "#ef4444";

// Cap the "still due" list so a busy month can't stretch the card; the rest collapse into a summary row.
const MAX_VISIBLE_BILLS = 5;

/** One line of the safe-to-spend ledger: a label on the left, a signed amount on the right. */
function LedgerRow({
  label,
  amount,
  sign,
  emphasis,
}: {
  label: string;
  amount: number;
  sign: "+" | "−";
  emphasis?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: "12px",
        padding: "8px 0",
      }}
    >
      <span
        style={{
          fontSize: emphasis ? "14px" : "13px",
          fontWeight: emphasis ? 700 : 500,
          color: emphasis ? "var(--text-primary)" : "var(--text-secondary)",
        }}
      >
        {label}
      </span>
      <span
        className="num"
        style={{
          fontSize: emphasis ? "15px" : "13px",
          fontWeight: emphasis ? 800 : 600,
          color: emphasis ? (amount >= 0 ? POSITIVE_COLOR : NEGATIVE_COLOR) : "var(--text-primary)",
          flexShrink: 0,
        }}
      >
        {sign}
        {formatCurrency(Math.abs(amount))}
      </span>
    </div>
  );
}

/** Header badge showing the headline safe-to-spend figure, kept visible while the card is collapsed. */
function SafeToSpendBadge({ result }: { result: SafeToSpendResult }) {
  const color = result.safeToSpend >= 0 ? POSITIVE_COLOR : NEGATIVE_COLOR;
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
      {result.safeToSpend < 0 ? "−" : ""}
      {formatCurrency(Math.abs(result.safeToSpend))}
    </span>
  );
}

/** Dashboard card showing how much cash is free to spend for the rest of the month, with a full breakdown. */
export function SafeToSpendCard({ accounts, recurringRules }: Props) {
  const result = useMemo(
    () => computeSafeToSpend(accounts, recurringRules),
    [accounts, recurringRules]
  );

  const isPositive = result.safeToSpend > 0;
  const headlineColor = result.safeToSpend >= 0 ? POSITIVE_COLOR : NEGATIVE_COLOR;
  const visibleBills = result.billItems.slice(0, MAX_VISIBLE_BILLS);
  const hiddenBillCount = result.billItems.length - visibleBills.length;

  return (
    <CollapsibleCard
      eyebrow="Safe to Spend"
      title="What's free to spend this month"
      description="Your cash plus expected income, minus the bills still due before month-end."
      headerRight={<SafeToSpendBadge result={result} />}
    >
      {/* Prominent headline figure */}
      <div
        style={{
          textAlign: "center",
          padding: "8px 0 22px",
          borderBottom: "1px solid var(--border)",
          marginBottom: "18px",
        }}
      >
        <div
          className="num"
          style={{
            fontSize: "44px",
            fontWeight: 800,
            color: headlineColor,
            lineHeight: 1,
            letterSpacing: "-1.5px",
          }}
        >
          {result.safeToSpend < 0 ? "−" : ""}
          {formatCurrency(Math.abs(result.safeToSpend))}
        </div>
        {isPositive ? (
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "8px" }}>
            ≈{" "}
            <span className="num" style={{ fontWeight: 700, color: "var(--text-primary)" }}>
              {formatCurrency(result.perDay)}
            </span>{" "}
            a day for the {result.daysRemaining} day{result.daysRemaining !== 1 ? "s" : ""} left
            this month
          </p>
        ) : (
          <p style={{ fontSize: "13px", color: NEGATIVE_COLOR, marginTop: "8px" }}>
            Your scheduled bills exceed your cash and expected income before month-end. Consider
            holding off on non-essentials.
          </p>
        )}
      </div>

      {/* Breakdown ledger */}
      <div style={{ marginBottom: result.billItems.length > 0 ? "18px" : 0 }}>
        <LedgerRow label="Available cash" amount={result.availableCash} sign="+" />
        {result.expectedIncome > 0 && (
          <LedgerRow
            label="Expected income (rest of month)"
            amount={result.expectedIncome}
            sign="+"
          />
        )}
        <LedgerRow label="Bills due before month-end" amount={result.upcomingBills} sign="−" />
        <div style={{ borderTop: "1px solid var(--border)", marginTop: "4px", paddingTop: "2px" }}>
          <LedgerRow label="Safe to spend" amount={result.safeToSpend} sign="" emphasis />
        </div>
      </div>

      {/* Upcoming bills list */}
      {result.billItems.length > 0 && (
        <div>
          <p
            style={{
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--text-muted)",
              marginBottom: "8px",
            }}
          >
            Still due this month
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {visibleBills.map((bill) => (
              <div
                key={bill.key}
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  padding: "10px 12px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {bill.label}
                  </p>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    {formatRelativeDate(bill.date)}
                  </span>
                </div>
                <span className="num" style={{ fontSize: "13px", fontWeight: 700, flexShrink: 0 }}>
                  −{formatCurrency(bill.amount)}
                </span>
              </div>
            ))}
            {hiddenBillCount > 0 && (
              <p style={{ fontSize: "12px", color: "var(--text-muted)", paddingLeft: "2px" }}>
                +{hiddenBillCount} more bill{hiddenBillCount !== 1 ? "s" : ""} due this month
              </p>
            )}
          </div>
        </div>
      )}
    </CollapsibleCard>
  );
}
