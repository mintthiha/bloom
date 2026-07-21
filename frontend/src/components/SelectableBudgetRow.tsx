"use client";
import { ReactNode } from "react";
import { Budget } from "@/lib/api";

type Props = {
  budget: Budget;
  shownOnDashboard: boolean;
  onToggle: () => void;
  children: ReactNode;
};

/**
 * Management row on the Budgets page: a checkbox chooses whether the budget appears on the
 * dashboard Budgets card. The full BudgetCard (children) always renders; it dims while excluded
 * so the choice is visible without hiding any detail.
 */
export function SelectableBudgetRow({ budget, shownOnDashboard, onToggle, children }: Props) {
  return (
    <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
      <input
        type="checkbox"
        checked={shownOnDashboard}
        onChange={onToggle}
        aria-label={`Show ${budget.category} on the dashboard card`}
        style={{
          marginTop: "18px",
          width: "16px",
          height: "16px",
          flexShrink: 0,
          cursor: "pointer",
        }}
      />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          opacity: shownOnDashboard ? 1 : 0.55,
          transition: "opacity 0.15s",
        }}
      >
        {children}
      </div>
    </div>
  );
}
