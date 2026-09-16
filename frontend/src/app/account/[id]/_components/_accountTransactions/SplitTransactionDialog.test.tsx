import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SplitTransactionDialog } from "./SplitTransactionDialog";
import type { Transaction } from "@/lib/api";

const { apiMock, toastMock } = vi.hoisted(() => ({
  apiMock: { setTransactionSplits: vi.fn(), clearTransactionSplits: vi.fn() },
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: {
      ...actual.api,
      setTransactionSplits: apiMock.setTransactionSplits,
      clearTransactionSplits: apiMock.clearTransactionSplits,
    },
  };
});

vi.mock("sonner", () => ({ toast: toastMock }));

/** Builds a WITHDRAWAL transaction fixture for split-dialog tests, overriding only what a test needs. */
function makeTxn(overrides?: Partial<Transaction>): Transaction {
  return {
    id: "t-1",
    type: "WITHDRAWAL",
    amount: 120,
    balanceAfter: 0,
    category: "Groceries",
    merchant: "Costco",
    description: null,
    effectiveAt: "2026-06-01T00:00:00.000Z",
    createdAt: "2026-06-01T00:00:00.000Z",
    fromAccountId: "a-1",
    toAccountId: null,
    splits: [],
    ...overrides,
  };
}

/** Renders SplitTransactionDialog with default props, overriding only what a test needs. */
function renderDialog(
  overrides: Partial<React.ComponentProps<typeof SplitTransactionDialog>> = {}
) {
  const props = {
    accountId: "a-1",
    transaction: makeTxn() as Transaction | null,
    onOpenChange: vi.fn(),
    onChange: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<SplitTransactionDialog {...props} />) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SplitTransactionDialog", () => {
  it("does not render when no transaction is open", () => {
    renderDialog({ transaction: null });
    expect(screen.queryByText("Split transaction")).not.toBeInTheDocument();
  });

  it("seeds two rows from the transaction's own category and amount", () => {
    renderDialog();
    expect(screen.getByLabelText("Split 1 amount")).toHaveValue(120);
    expect(screen.getByLabelText("Split 2 amount")).toHaveValue(null);
  });

  it("seeds rows from existing splits when the transaction already has some", () => {
    renderDialog({
      transaction: makeTxn({
        splits: [
          { id: "s-1", category: "Groceries", amount: 80, description: null },
          { id: "s-2", category: "Household", amount: 40, description: null },
        ],
      }),
    });
    expect(screen.getByLabelText("Split 1 amount")).toHaveValue(80);
    expect(screen.getByLabelText("Split 2 amount")).toHaveValue(40);
    expect(screen.getByRole("button", { name: "Remove split" })).toBeInTheDocument();
  });

  it("blocks saving when the split total doesn't match the transaction amount", async () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText("Split 1 category"), {
      target: { value: "Groceries" },
    });
    fireEvent.change(screen.getByLabelText("Split 2 category"), { target: { value: "Dining" } });
    fireEvent.change(screen.getByLabelText("Split 2 amount"), { target: { value: "10" } });

    fireEvent.click(screen.getByRole("button", { name: "Save split" }));

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith(expect.stringContaining("must add up to"))
    );
    expect(apiMock.setTransactionSplits).not.toHaveBeenCalled();
  });

  it("saves a valid split, toasts success, closes, and refreshes", async () => {
    apiMock.setTransactionSplits.mockResolvedValue({});
    const { props } = renderDialog();

    fireEvent.change(screen.getByLabelText("Split 2 category"), { target: { value: "Dining" } });
    fireEvent.change(screen.getByLabelText("Split 1 amount"), { target: { value: "80" } });
    fireEvent.change(screen.getByLabelText("Split 2 amount"), { target: { value: "40" } });

    fireEvent.click(screen.getByRole("button", { name: "Save split" }));

    await waitFor(() => expect(props.onChange).toHaveBeenCalledTimes(1));
    expect(apiMock.setTransactionSplits).toHaveBeenCalledWith("a-1", "t-1", [
      { category: "Groceries", amount: 80, description: undefined },
      { category: "Dining", amount: 40, description: undefined },
    ]);
    expect(toastMock.success).toHaveBeenCalledWith("Split into 2 categories");
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("removes an existing split, toasts success, closes, and refreshes", async () => {
    apiMock.clearTransactionSplits.mockResolvedValue({});
    const { props } = renderDialog({
      transaction: makeTxn({
        splits: [
          { id: "s-1", category: "Groceries", amount: 80, description: null },
          { id: "s-2", category: "Household", amount: 40, description: null },
        ],
      }),
    });

    fireEvent.click(screen.getByRole("button", { name: "Remove split" }));

    await waitFor(() => expect(props.onChange).toHaveBeenCalledTimes(1));
    expect(apiMock.clearTransactionSplits).toHaveBeenCalledWith("a-1", "t-1");
    expect(toastMock.success).toHaveBeenCalledWith("Split removed");
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not show an Auto-fix button while the split is already fully allocated", () => {
    renderDialog({
      transaction: makeTxn({
        splits: [
          { id: "s-1", category: "Groceries", amount: 80, description: null },
          { id: "s-2", category: "Household", amount: 40, description: null },
        ],
      }),
    });
    expect(screen.queryByRole("button", { name: "Auto-fix" })).not.toBeInTheDocument();
  });

  it("auto-fixes the other row to absorb the unallocated remainder", () => {
    renderDialog({
      transaction: makeTxn({
        amount: 100,
        splits: [
          { id: "s-1", category: "Groceries", amount: 50, description: null },
          { id: "s-2", category: "Household", amount: 50, description: null },
        ],
      }),
    });

    fireEvent.change(screen.getByLabelText("Split 1 amount"), { target: { value: "60" } });
    expect(screen.getByRole("button", { name: "Auto-fix" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Auto-fix" }));

    expect(screen.getByLabelText("Split 1 amount")).toHaveValue(60);
    expect(screen.getByLabelText("Split 2 amount")).toHaveValue(40);
    expect(screen.queryByRole("button", { name: "Auto-fix" })).not.toBeInTheDocument();
  });

  it("auto-fixes 3+ rows by distributing the remainder proportionally across the others", () => {
    renderDialog({
      transaction: makeTxn({
        amount: 100,
        splits: [
          { id: "s-1", category: "Groceries", amount: 40, description: null },
          { id: "s-2", category: "Dining", amount: 30, description: null },
          { id: "s-3", category: "Entertainment", amount: 30, description: null },
        ],
      }),
    });

    // Groceries goes to 50, putting the split $10 over. Dining and Entertainment
    // start equal (30/30), so they should each absorb half of the $10 overage.
    fireEvent.change(screen.getByLabelText("Split 1 amount"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "Auto-fix" }));

    expect(screen.getByLabelText("Split 1 amount")).toHaveValue(50);
    expect(screen.getByLabelText("Split 2 amount")).toHaveValue(25);
    expect(screen.getByLabelText("Split 3 amount")).toHaveValue(25);
    expect(screen.queryByRole("button", { name: "Auto-fix" })).not.toBeInTheDocument();
  });

  it("shows an info tooltip warning that a blank row will be skipped by Auto-fix", () => {
    renderDialog({
      transaction: makeTxn({
        amount: 100,
        splits: [
          { id: "s-1", category: "Dining", amount: 50, description: null },
          { id: "s-2", category: "Entertainment", amount: 50, description: null },
        ],
      }),
    });

    fireEvent.click(screen.getByRole("button", { name: "+ Add category" }));
    expect(screen.queryByText("ⓘ")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Split 1 amount"), { target: { value: "40" } });
    expect(screen.getByText("ⓘ")).toBeInTheDocument();
  });

  it("auto-fixes while a freshly added row is still blank, leaving that row untouched", () => {
    renderDialog({
      transaction: makeTxn({
        amount: 100,
        splits: [
          { id: "s-1", category: "Dining", amount: 50, description: null },
          { id: "s-2", category: "Entertainment", amount: 50, description: null },
        ],
      }),
    });

    fireEvent.click(screen.getByRole("button", { name: "+ Add category" }));
    fireEvent.change(screen.getByLabelText("Split 2 amount"), { target: { value: "2" } });

    fireEvent.click(screen.getByRole("button", { name: "Auto-fix" }));

    expect(screen.getByLabelText("Split 1 amount")).toHaveValue(98);
    expect(screen.getByLabelText("Split 2 amount")).toHaveValue(2);
    expect(screen.getByLabelText("Split 3 amount")).toHaveValue(null);
    expect(screen.queryByRole("button", { name: "Auto-fix" })).not.toBeInTheDocument();
  });

  it("stops adding rows once the maximum split count is reached", () => {
    renderDialog();

    for (let i = 0; i < 10; i++) {
      fireEvent.click(screen.getByRole("button", { name: /Add category|Limit of/ }));
    }

    expect(screen.queryByLabelText("Split 11 amount")).not.toBeInTheDocument();
    const addButton = screen.getByRole("button", { name: "Limit of 10 reached" });
    expect(addButton).toBeDisabled();
  });

  it("adds and removes split rows, keeping at least two", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "+ Add category" }));
    expect(screen.getByLabelText("Split 3 amount")).toBeInTheDocument();

    const removeButtons = screen.getAllByRole("button", { name: "Remove" });
    fireEvent.click(removeButtons[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    // Only two rows remain, so the last Remove button is disabled rather than dropping below two.
    const remainingRemoveButtons = screen.getAllByRole("button", { name: "Remove" });
    expect(remainingRemoveButtons).toHaveLength(2);
    expect(remainingRemoveButtons[0]).toBeDisabled();
  });
});
