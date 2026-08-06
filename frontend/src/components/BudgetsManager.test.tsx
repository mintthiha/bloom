import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BudgetsManager } from "./BudgetsManager";
import type { Budget } from "@/lib/api";

const { apiMock } = vi.hoisted(() => ({
  apiMock: { saveBudget: vi.fn(), deleteBudget: vi.fn() },
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: { ...actual.api, saveBudget: apiMock.saveBudget, deleteBudget: apiMock.deleteBudget },
  };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Stub children so tests exercise BudgetsManager's own form/list/delete logic only.
vi.mock("./BudgetCard", () => ({
  BudgetCard: ({
    budget,
    onRequestDelete,
  }: {
    budget: Budget;
    onRequestDelete: (id: string) => void;
  }) => (
    <div data-testid="budget-card">
      <span>{budget.category}</span>
      <button type="button" onClick={() => onRequestDelete(budget.id)}>
        request-delete
      </button>
    </div>
  ),
}));

vi.mock("./SelectableBudgetRow", () => ({
  SelectableBudgetRow: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="selectable-row">{children}</div>
  ),
}));

vi.mock("./RolloverInfoDialog", () => ({ RolloverInfoDialog: () => <div /> }));

import { toast } from "sonner";

/** Builds a Budget fixture; override only the fields a test needs. */
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BudgetsManager", () => {
  it("shows an empty state when there are no budgets", () => {
    render(<BudgetsManager budgets={[]} monthlySummary={null} onChanged={vi.fn()} />);
    expect(screen.getByText("No budgets yet")).toBeInTheDocument();
  });

  it("renders a card for each budget", () => {
    render(
      <BudgetsManager
        budgets={[
          makeBudget({ id: "b-1", category: "Groceries" }),
          makeBudget({ id: "b-2", category: "Rent" }),
        ]}
        monthlySummary={null}
        onChanged={vi.fn()}
      />
    );
    const cards = screen.getAllByTestId("budget-card");
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText("Groceries")).toBeInTheDocument();
    expect(within(cards[1]).getByText("Rent")).toBeInTheDocument();
  });

  it("hides budgets in the hidden set and links to the Budgets page (dashboard mode)", () => {
    render(
      <BudgetsManager
        budgets={[
          makeBudget({ id: "b-1", category: "Groceries" }),
          makeBudget({ id: "b-2", category: "Rent" }),
        ]}
        monthlySummary={null}
        onChanged={vi.fn()}
        hiddenBudgetIds={new Set(["b-2"])}
      />
    );
    expect(screen.getAllByTestId("budget-card")).toHaveLength(1);
    expect(screen.getByText(/1 hidden · manage on Budgets page/)).toBeInTheDocument();
  });

  it("renders selectable rows and the manage hint in manage mode", () => {
    render(
      <BudgetsManager
        budgets={[makeBudget()]}
        monthlySummary={null}
        onChanged={vi.fn()}
        onToggleBudgetVisibility={vi.fn()}
      />
    );
    expect(screen.getByTestId("selectable-row")).toBeInTheDocument();
    expect(
      screen.getByText("Checked budgets appear on your dashboard Budgets card.")
    ).toBeInTheDocument();
  });

  it("saves a budget and refreshes on submit", async () => {
    apiMock.saveBudget.mockResolvedValue(makeBudget());
    const onChanged = vi.fn().mockResolvedValue(undefined);

    render(<BudgetsManager budgets={[]} monthlySummary={null} onChanged={onChanged} />);

    fireEvent.change(screen.getByPlaceholderText("Monthly limit"), { target: { value: "250" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Budget" }));

    await waitFor(() => expect(apiMock.saveBudget).toHaveBeenCalledWith("Groceries", 250));
    expect(toast.success).toHaveBeenCalledWith("Budget created");
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("rejects a missing or invalid amount before calling the API", async () => {
    render(<BudgetsManager budgets={[]} monthlySummary={null} onChanged={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Save Budget" }));

    expect(await screen.findByText("Enter a valid monthly limit")).toBeInTheDocument();
    expect(apiMock.saveBudget).not.toHaveBeenCalled();
  });

  it("requires a name when the Custom category is chosen", async () => {
    render(<BudgetsManager budgets={[]} monthlySummary={null} onChanged={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Budget category"), { target: { value: "Custom..." } });
    fireEvent.change(screen.getByPlaceholderText("Monthly limit"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Budget" }));

    expect(await screen.findByText("Choose a category")).toBeInTheDocument();
    expect(apiMock.saveBudget).not.toHaveBeenCalled();
  });

  it("confirms then deletes a budget", async () => {
    apiMock.deleteBudget.mockResolvedValue(undefined);
    const onChanged = vi.fn().mockResolvedValue(undefined);

    render(
      <BudgetsManager
        budgets={[makeBudget({ id: "b-1", category: "Groceries" })]}
        monthlySummary={null}
        onChanged={onChanged}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "request-delete" }));
    expect(await screen.findByText("Delete budget?")).toBeInTheDocument();
    expect(screen.getByText(/"Groceries" budget will be permanently removed/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Delete$/ }));

    await waitFor(() => expect(apiMock.deleteBudget).toHaveBeenCalledWith("b-1"));
    expect(toast.success).toHaveBeenCalledWith("Budget deleted");
  });
});
