import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TransactionsTable } from "./TransactionsTable";
import type { Category, TransactionListItem } from "@/lib/api";
import { buildCategoryAppearanceLookup } from "@/lib/category-appearance";

/** Builds a Category fixture for the appearance lookup the table needs. */
function makeCategory(name: string, color: string): Category {
  return {
    id: `c-${name}`,
    userId: "u-1",
    name,
    type: "INCOME",
    color,
    icon: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const categoryAppearanceLookup = buildCategoryAppearanceLookup([makeCategory("Salary", "#22c55e")]);

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

/** Renders the table with the required props, overriding only what a test cares about. */
function renderTable(overrides: Partial<React.ComponentProps<typeof TransactionsTable>> = {}) {
  return render(
    <TransactionsTable
      rows={[]}
      loading={false}
      hasActiveFilters={false}
      onRowClick={vi.fn()}
      categoryAppearanceLookup={categoryAppearanceLookup}
      {...overrides}
    />
  );
}

describe("TransactionsTable", () => {
  it("renders skeletons and no table while loading", () => {
    renderTable({ loading: true });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText("No transactions found")).not.toBeInTheDocument();
  });

  it("shows the default empty message with no active filters", () => {
    renderTable();
    expect(screen.getByText("No transactions found")).toBeInTheDocument();
    expect(screen.getByText(/they'll show up here/)).toBeInTheDocument();
  });

  it("shows a filter-specific empty message when filters are active", () => {
    renderTable({ hasActiveFilters: true });
    expect(screen.getByText(/No transactions match the current filters/)).toBeInTheDocument();
  });

  it("renders a row with merchant, category, account, and amount", () => {
    renderTable({ rows: [makeItem({ merchant: "Acme Corp", category: "Salary" })] });
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Salary")).toBeInTheDocument();
    expect(screen.getByText("Chequing")).toBeInTheDocument();
    expect(screen.getByText(/1,500/)).toBeInTheDocument();
  });

  it("falls back to the account name and an em-dash category", () => {
    renderTable({
      rows: [
        makeItem({ merchant: null, description: null, category: null, accountNickname: null }),
      ],
    });
    expect(screen.getByText("Transaction")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("still shows the category name for a category the user has not defined", () => {
    renderTable({ rows: [makeItem({ category: "Hockey" })] });
    expect(screen.getByText("Hockey")).toBeInTheDocument();
  });

  it("invokes onRowClick with the clicked row", () => {
    const onRowClick = vi.fn();
    const row = makeItem({ merchant: "Acme Corp" });
    renderTable({ rows: [row], onRowClick });
    fireEvent.click(screen.getByText("Acme Corp"));
    expect(onRowClick).toHaveBeenCalledWith(row);
  });
});
