import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TransactionsTable } from "./TransactionsTable";
import type { TransactionListItem } from "@/lib/api";

/** Builds a TransactionListItem fixture. */
function makeItem(overrides: Partial<TransactionListItem> = {}): TransactionListItem {
  return {
    id: "t-1",
    type: "DEPOSIT",
    amount: 1500,
    effectiveAt: "2026-01-15T00:00:00.000Z",
    description: "Payroll",
    merchant: "Acme Corp",
    category: "Salary",
    accountId: "a-1",
    accountName: "Chequing",
    accountNickname: null,
    accountType: "CHEQUING",
    ...overrides,
  };
}

describe("TransactionsTable", () => {
  it("renders skeletons and no table while loading", () => {
    render(<TransactionsTable rows={[]} loading hasActiveFilters={false} onRowClick={vi.fn()} />);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText("No transactions found")).not.toBeInTheDocument();
  });

  it("shows the default empty message with no active filters", () => {
    render(
      <TransactionsTable rows={[]} loading={false} hasActiveFilters={false} onRowClick={vi.fn()} />
    );
    expect(screen.getByText("No transactions found")).toBeInTheDocument();
    expect(screen.getByText(/they'll show up here/)).toBeInTheDocument();
  });

  it("shows a filter-specific empty message when filters are active", () => {
    render(<TransactionsTable rows={[]} loading={false} hasActiveFilters onRowClick={vi.fn()} />);
    expect(screen.getByText(/No transactions match the current filters/)).toBeInTheDocument();
  });

  it("renders a row with merchant, category, account, and amount", () => {
    render(
      <TransactionsTable
        rows={[makeItem({ merchant: "Acme Corp", category: "Salary" })]}
        loading={false}
        hasActiveFilters={false}
        onRowClick={vi.fn()}
      />
    );
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Salary")).toBeInTheDocument();
    expect(screen.getByText("Chequing")).toBeInTheDocument();
    expect(screen.getByText(/1,500/)).toBeInTheDocument();
  });

  it("falls back to the account name and an em-dash category", () => {
    render(
      <TransactionsTable
        rows={[
          makeItem({ merchant: null, description: null, category: null, accountNickname: null }),
        ]}
        loading={false}
        hasActiveFilters={false}
        onRowClick={vi.fn()}
      />
    );
    expect(screen.getByText("Transaction")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("invokes onRowClick with the clicked row", () => {
    const onRowClick = vi.fn();
    const row = makeItem({ merchant: "Acme Corp" });
    render(
      <TransactionsTable
        rows={[row]}
        loading={false}
        hasActiveFilters={false}
        onRowClick={onRowClick}
      />
    );
    fireEvent.click(screen.getByText("Acme Corp"));
    expect(onRowClick).toHaveBeenCalledWith(row);
  });
});
