"use client";

import { BudgetActivity } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

type TransactionsSummaryProps = { budget: BudgetActivity };

export function TransactionsSummary({ budget }: TransactionsSummaryProps) {
  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "14px",
        padding: "24px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "16px",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <p
          style={{
            fontSize: "11px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--text-secondary)",
          }}
        >
          Transactions
        </p>
        <span className="num" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
          {budget.activity.length}
        </span>
      </div>

      {budget.activity.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
          No matching withdrawals for this category this month.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {budget.activity.map((transaction) => (
            <div
              key={transaction.id}
              style={{
                display: "grid",
                gridTemplateColumns: "140px minmax(0, 1fr) 160px 120px",
                gap: "12px",
                alignItems: "center",
                padding: "14px 16px",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: "12px",
              }}
            >
              <div>
                <p className="num" style={{ fontSize: "12px", fontWeight: 600 }}>
                  {new Intl.DateTimeFormat("en-CA", {
                    month: "short",
                    day: "numeric",
                  }).format(new Date(transaction.effectiveAt))}
                </p>
                <p className="num" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  {new Intl.DateTimeFormat("en-CA", {
                    hour: "numeric",
                    minute: "2-digit",
                  }).format(new Date(transaction.effectiveAt))}
                </p>
              </div>
              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {transaction.description || transaction.category || "Withdrawal"}
                </p>
                <p
                  style={{
                    fontSize: "11px",
                    color: "var(--text-secondary)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {transaction.accountName}
                </p>
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                {transaction.description ? "Custom note" : "Categorized expense"}
              </div>
              <div
                className="num"
                style={{
                  textAlign: "right",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#f97316",
                }}
              >
                {formatCurrency(transaction.amount)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
