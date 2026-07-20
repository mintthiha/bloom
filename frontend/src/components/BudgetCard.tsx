"use client";
import Link from "next/link";
import { Budget } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { BudgetRolloverToggle } from "@/components/BudgetRolloverToggle";
import { MoveBudgetMoneyDialog } from "@/components/MoveBudgetMoneyDialog";

type Props = {
  budget: Budget;
  budgets: Budget[];
  deletingBudgetId: string | null;
  onRequestDelete: (budgetId: string) => void;
  onChanged: () => Promise<void>;
};

/** Signed currency, e.g. "+$40.00" / "-$12.00", for carry-in and rollover lines. */
function formatSigned(value: number): string {
  const sign = value < 0 ? "-" : "+";
  return `${sign}${formatCurrency(Math.abs(value))}`;
}

/**
 * One budget row: category, progress against the available amount, and — when
 * rollover is on — the carried-in and carried-out balances. Delete is owned by
 * the parent (controlled), while the rollover toggle and money move are
 * self-contained.
 */
export function BudgetCard({
  budget,
  budgets,
  deletingBudgetId,
  onRequestDelete,
  onChanged,
}: Props) {
  const progress = Math.min(budget.percentageUsed, 100);
  const isDeleting = deletingBudgetId === budget.id;

  return (
    <div className="budget-card" style={{ padding: "16px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          alignItems: "center",
          marginBottom: "10px",
        }}
      >
        <Link
          href={`/budgets/${budget.id}`}
          style={{ minWidth: 0, flex: 1, textDecoration: "none", color: "inherit" }}
        >
          <p style={{ fontSize: "15px", fontWeight: 700, marginBottom: "4px" }}>
            {budget.category}
          </p>
          <p className="num" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
            {formatCurrency(budget.currentSpending)} spent of {formatCurrency(budget.available)}{" "}
            available
          </p>
        </Link>
        <button
          type="button"
          onClick={() => onRequestDelete(budget.id)}
          disabled={isDeleting}
          className="budget-delete-button"
          style={{
            padding: "8px 12px",
            fontSize: "12px",
            cursor: isDeleting ? "not-allowed" : "pointer",
            opacity: isDeleting ? 0.45 : 1,
          }}
        >
          {isDeleting ? "Deleting..." : "Delete"}
        </button>
      </div>

      <Link
        href={`/budgets/${budget.id}`}
        style={{ display: "block", textDecoration: "none", color: "inherit" }}
      >
        <div
          style={{
            height: "10px",
            borderRadius: "999px",
            background: "#ffffff0a",
            overflow: "hidden",
            marginBottom: "10px",
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              background: budget.isOverBudget ? "#ef4444" : "#3b82f6",
              transition: "width 0.2s ease",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
            fontSize: "12px",
          }}
        >
          <span
            className="num"
            style={{ color: budget.isOverBudget ? "#f87171" : "var(--text-secondary)" }}
          >
            {budget.isOverBudget
              ? `${formatCurrency(Math.abs(budget.remaining))} over budget`
              : `${formatCurrency(budget.remaining)} remaining`}
          </span>
          <span className="num" style={{ color: "var(--text-muted)" }}>
            {budget.percentageUsed.toFixed(0)}% used
          </span>
        </div>
      </Link>

      {budget.rolloverEnabled && (budget.carryIn !== 0 || budget.adjustment !== 0) && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
            fontSize: "12px",
            marginTop: "8px",
            paddingTop: "8px",
            borderTop: "1px solid var(--border)",
            color: "var(--text-muted)",
          }}
        >
          <span className="num">
            {formatSigned(budget.carryIn)} rolled in
            {budget.adjustment !== 0 ? ` · ${formatSigned(budget.adjustment)} moved` : ""}
          </span>
          <span className="num" style={{ color: budget.carryOut < 0 ? "#f87171" : "#4ade80" }}>
            {formatSigned(budget.carryOut)} to next month
          </span>
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "12px" }}>
        <BudgetRolloverToggle budget={budget} onChanged={onChanged} />
        <MoveBudgetMoneyDialog sourceBudget={budget} budgets={budgets} onChanged={onChanged} />
      </div>
    </div>
  );
}
