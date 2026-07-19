"use client";

import { BudgetActivity } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

type SpendingPerAccountChartProps = { budget: BudgetActivity };

export function SpendingPerAccountChart({ budget }: SpendingPerAccountChartProps) {
  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "14px",
        padding: "24px",
      }}
    >
      <p
        style={{
          fontSize: "11px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--text-secondary)",
          marginBottom: "16px",
        }}
      >
        By Account
      </p>
      {budget.accountTotals.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {budget.accountTotals.map((account, index) => (
            <div key={account.accountId}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "12px",
                  marginBottom: "6px",
                }}
              >
                <span style={{ fontSize: "13px", fontWeight: 600 }}>{account.accountName}</span>
                <span className="num" style={{ fontSize: "13px", color: "#3b82f6" }}>
                  {formatCurrency(account.total)}
                </span>
              </div>
              <div
                style={{
                  height: "8px",
                  borderRadius: "999px",
                  background: "#ffffff0a",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${budget.currentSpending > 0 ? (account.total / budget.currentSpending) * 100 : 0}%`,
                    height: "100%",
                    background: index % 2 === 0 ? "#3b82f6" : "#22c55e",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
          No account activity to break down yet.
        </p>
      )}
    </div>
  );
}
