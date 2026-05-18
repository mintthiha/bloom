"use client";

import { BudgetActivity } from "@/lib/api";

type NumCardsProps = {
  budget: BudgetActivity;
  formatCurrency: (n: number) => string;
};

export function NumCards({ budget, formatCurrency }: NumCardsProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "12px",
        marginBottom: "28px",
      }}
    >
      <div
        style={{
          background: "var(--surface-1)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          padding: "18px",
        }}
      >
        <p
          style={{
            fontSize: "10px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--text-muted)",
            marginBottom: "8px",
          }}
        >
          Limit
        </p>
        <p className="num" style={{ fontSize: "18px", fontWeight: 600 }}>
          {formatCurrency(budget.monthlyLimit)}
        </p>
      </div>
      <div
        style={{
          background: "var(--surface-1)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          padding: "18px",
        }}
      >
        <p
          style={{
            fontSize: "10px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--text-muted)",
            marginBottom: "8px",
          }}
        >
          Spent
        </p>
        <p
          className="num"
          style={{ fontSize: "18px", fontWeight: 600, color: "#f97316" }}
        >
          {formatCurrency(budget.currentSpending)}
        </p>
      </div>
      <div
        style={{
          background: "var(--surface-1)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          padding: "18px",
        }}
      >
        <p
          style={{
            fontSize: "10px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--text-muted)",
            marginBottom: "8px",
          }}
        >
          Remaining
        </p>
        <p
          className="num"
          style={{
            fontSize: "18px",
            fontWeight: 600,
            color: budget.isOverBudget ? "#ef4444" : "#22c55e",
          }}
        >
          {budget.isOverBudget
            ? `-${formatCurrency(Math.abs(budget.remaining))}`
            : formatCurrency(budget.remaining)}
        </p>
      </div>
      <div
        style={{
          background: "var(--surface-1)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          padding: "18px",
        }}
      >
        <p
          style={{
            fontSize: "10px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--text-muted)",
            marginBottom: "8px",
          }}
        >
          Usage
        </p>
        <p className="num" style={{ fontSize: "18px", fontWeight: 600 }}>
          {budget.percentageUsed.toFixed(0)}%
        </p>
      </div>
    </div>
  );
}
