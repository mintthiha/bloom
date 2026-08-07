import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FinancialHealthScore } from "./FinancialHealthScore";
import type { Account, MonthlySummary } from "@/lib/api";

vi.mock("@/components/dashboard-visibility-provider", () => ({
  useDashboardVisibility: () => ({ allCollapsed: false }),
}));

const accounts = [
  { id: "a-1", accountType: "CHEQUING", balance: 5000 } as Account,
  { id: "a-2", accountType: "SAVINGS", balance: 12000 } as Account,
];

const monthlySummary: MonthlySummary = {
  month: "2026-08",
  income: 4000,
  spending: 2000,
  netCashFlow: 2000,
  topExpenseCategory: "Rent",
  categories: [],
};

describe("FinancialHealthScore", () => {
  it("renders the card header and the out-of-100 summary", () => {
    render(
      <FinancialHealthScore
        accounts={accounts}
        budgets={[]}
        monthlySummary={monthlySummary}
        netWorthHistory={[]}
      />
    );

    expect(screen.getByText("Financial Health")).toBeInTheDocument();
    expect(screen.getByText("How your finances are doing")).toBeInTheDocument();
    expect(screen.getByText(/out of 100/)).toBeInTheDocument();
  });

  it("renders all five scored factors", () => {
    render(
      <FinancialHealthScore
        accounts={accounts}
        budgets={[]}
        monthlySummary={monthlySummary}
        netWorthHistory={[]}
      />
    );

    expect(screen.getAllByText(/\/ 20$/)).toHaveLength(5);
  });

  it("shows a grade badge letter in the header", () => {
    render(
      <FinancialHealthScore
        accounts={accounts}
        budgets={[]}
        monthlySummary={monthlySummary}
        netWorthHistory={[]}
      />
    );

    expect(screen.getAllByText(/^[A-F]$/).length).toBeGreaterThan(0);
  });
});
