"use client";

import { BudgetActivity } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

type NumCardsProps = {
  budget: BudgetActivity;
};

type StatCardProps = {
  label: string;
  value: string;
  valueColor?: string;
};

/** Signed currency, e.g. "+$40.00" / "-$12.00", for carry-in and rollover figures. */
function formatSigned(value: number): string {
  const sign = value < 0 ? "-" : "+";
  return `${sign}${formatCurrency(Math.abs(value))}`;
}

/** A single labelled figure tile used across the budget summary grids. */
function StatCard({ label, value, valueColor }: StatCardProps) {
  return (
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
        {label}
      </p>
      <p className="num" style={{ fontSize: "18px", fontWeight: 600, color: valueColor }}>
        {value}
      </p>
    </div>
  );
}

export function NumCards({ budget }: NumCardsProps) {
  const remainingValue = budget.isOverBudget
    ? `-${formatCurrency(Math.abs(budget.remaining))}`
    : formatCurrency(budget.remaining);

  return (
    <div style={{ marginBottom: "28px" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "12px",
        }}
      >
        <StatCard label="Limit" value={formatCurrency(budget.monthlyLimit)} />
        <StatCard
          label="Spent"
          value={formatCurrency(budget.currentSpending)}
          valueColor="#f97316"
        />
        <StatCard
          label="Remaining"
          value={remainingValue}
          valueColor={budget.isOverBudget ? "#ef4444" : "#22c55e"}
        />
        <StatCard label="Usage" value={`${budget.percentageUsed.toFixed(0)}%`} />
      </div>

      {budget.rolloverEnabled && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "12px",
            marginTop: "12px",
          }}
        >
          <StatCard label="Rolled in" value={formatSigned(budget.carryIn)} />
          <StatCard label="Available" value={formatCurrency(budget.available)} />
          <StatCard
            label="Rolls over"
            value={formatSigned(budget.carryOut)}
            valueColor={budget.carryOut < 0 ? "#ef4444" : "#22c55e"}
          />
        </div>
      )}
    </div>
  );
}
