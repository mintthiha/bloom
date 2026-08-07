import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BudgetCard } from "./BudgetCard";
import type { Budget } from "@/lib/api";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/components/BudgetRolloverToggle", () => ({ BudgetRolloverToggle: () => <div /> }));
vi.mock("@/components/MoveBudgetMoneyDialog", () => ({ MoveBudgetMoneyDialog: () => <div /> }));

/** Builds a Budget fixture. */
function makeBudget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: "b-1",
    userId: "u-1",
    category: "Groceries",
    monthlyLimit: 400,
    rolloverEnabled: false,
    month: "2026-08",
    limit: 400,
    carryIn: 0,
    adjustment: 0,
    available: 400,
    currentSpending: 120,
    remaining: 280,
    carryOut: 0,
    percentageUsed: 30,
    isOverBudget: false,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function renderCard(budget: Budget, deletingBudgetId: string | null = null) {
  const onRequestDelete = vi.fn();
  render(
    <BudgetCard
      budget={budget}
      budgets={[budget]}
      deletingBudgetId={deletingBudgetId}
      onRequestDelete={onRequestDelete}
      onChanged={vi.fn()}
    />
  );
  return { onRequestDelete };
}

describe("BudgetCard", () => {
  it("shows the category, spend line, and remaining amount when under budget", () => {
    renderCard(makeBudget());
    expect(screen.getByText("Groceries")).toBeInTheDocument();
    expect(screen.getByText(/\$120\.00 spent of \$400\.00 available/)).toBeInTheDocument();
    expect(screen.getByText(/\$280\.00 remaining/)).toBeInTheDocument();
    expect(screen.getByText("30% used")).toBeInTheDocument();
  });

  it("shows an over-budget message when spending exceeds the limit", () => {
    renderCard(makeBudget({ isOverBudget: true, remaining: -50, percentageUsed: 112 }));
    expect(screen.getByText(/\$50\.00 over budget/)).toBeInTheDocument();
    expect(screen.getByText("112% used")).toBeInTheDocument();
  });

  it("renders the rollover line only when rollover is on and there is carry activity", () => {
    renderCard(makeBudget({ rolloverEnabled: true, carryIn: 40, carryOut: 25 }));
    expect(screen.getByText(/\+\$40\.00 rolled in/)).toBeInTheDocument();
    expect(screen.getByText(/\+\$25\.00 to next month/)).toBeInTheDocument();
  });

  it("requests deletion and reflects the deleting state", () => {
    const { onRequestDelete } = renderCard(makeBudget());
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onRequestDelete).toHaveBeenCalledWith("b-1");
  });

  it("disables the delete button while deleting", () => {
    renderCard(makeBudget({ id: "b-1" }), "b-1");
    expect(screen.getByRole("button", { name: "Deleting..." })).toBeDisabled();
  });
});
