import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NewTransactionForm } from "./NewTransactionForm";
import { formatLocalDate } from "../transaction-date";
import type { Account, AutoCategorizationRule, Category } from "@/lib/api";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    listCategorizationRules: vi.fn(),
    listCategories: vi.fn(),
    deposit: vi.fn(),
    withdraw: vi.fn(),
    transfer: vi.fn(),
    draftQuickAddTransaction: vi.fn(),
  },
}));

/** Builds a Category fixture. */
function makeCategory(name: string, type: "INCOME" | "EXPENSE"): Category {
  return {
    id: `cat-${name}`,
    userId: "u-1",
    name,
    type,
    color: "#22c55e",
    icon: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const DEFAULT_TEST_CATEGORIES: Category[] = [
  makeCategory("Groceries", "EXPENSE"),
  makeCategory("Rent", "EXPENSE"),
  makeCategory("Utilities", "EXPENSE"),
  makeCategory("Transport", "EXPENSE"),
  makeCategory("Dining", "EXPENSE"),
  makeCategory("Shopping", "EXPENSE"),
  makeCategory("Healthcare", "EXPENSE"),
  makeCategory("Entertainment", "EXPENSE"),
  makeCategory("Other", "EXPENSE"),
  makeCategory("Salary", "INCOME"),
  makeCategory("Freelance", "INCOME"),
  makeCategory("Gift", "INCOME"),
  makeCategory("Investment", "INCOME"),
  makeCategory("Other Income", "INCOME"),
];

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { ...actual.api, ...apiMock } };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("../_import/ImportTab", () => ({ ImportTab: () => <div data-testid="import-tab" /> }));
vi.mock("../_receiptScan/ReceiptScanPanel", () => ({
  ReceiptScanPanel: ({ onCreated }: { onCreated: () => void }) => (
    <button data-testid="receipt-scan-panel" onClick={onCreated}>
      Finish scan
    </button>
  ),
}));

import { toast } from "sonner";

/** Builds an Account fixture. */
function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "a-1",
    ownerName: "Test User",
    nickname: null,
    accountType: "CHEQUING",
    balance: 500,
    frozen: false,
    isLinked: false,
    plaidAccountId: null,
    plaidItemId: null,
    institutionName: null,
    color: null,
    icon: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Renders the form with default props, overridable per test. */
function renderForm(overrides: Partial<React.ComponentProps<typeof NewTransactionForm>> = {}) {
  const onSuccess = vi.fn().mockResolvedValue(undefined);
  render(
    <NewTransactionForm
      account={makeAccount()}
      transferTargets={[]}
      onSuccess={onSuccess}
      onImportSuccess={vi.fn()}
      profile={null}
      transactionsForType={[]}
      sameTypeAccountIds={[]}
      {...overrides}
    />
  );
  return { onSuccess };
}

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.listCategorizationRules.mockResolvedValue([]);
  apiMock.listCategories.mockResolvedValue(DEFAULT_TEST_CATEGORIES);
});

describe("NewTransactionForm", () => {
  it("shows a frozen banner instead of the form for a frozen account", () => {
    renderForm({ account: makeAccount({ frozen: true }) });
    expect(screen.getByText(/This account is frozen/)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("0.00")).not.toBeInTheDocument();
  });

  it("deposits a valid amount and refreshes", async () => {
    apiMock.deposit.mockResolvedValue(makeAccount());
    const { onSuccess } = renderForm();

    fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "100" } });
    fireEvent.change(screen.getByPlaceholderText("Merchant (optional)"), {
      target: { value: "Store" },
    });
    fireEvent.submit(screen.getByPlaceholderText("0.00").closest("form")!);

    await waitFor(() =>
      expect(apiMock.deposit).toHaveBeenCalledWith("a-1", 100, {
        category: undefined,
        merchant: "Store",
      })
    );
    expect(toast.success).toHaveBeenCalledWith("Deposit successful");
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  it("rejects a non-positive amount", async () => {
    renderForm();
    fireEvent.submit(screen.getByPlaceholderText("0.00").closest("form")!);
    expect(toast.error).toHaveBeenCalledWith("Enter a valid positive amount");
    expect(apiMock.deposit).not.toHaveBeenCalled();
  });

  it("requires a destination for a transfer", async () => {
    renderForm({ transferTargets: [makeAccount({ id: "a-2", ownerName: "Savings" })] });
    fireEvent.click(screen.getByRole("button", { name: "Transfer" }));
    fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "20" } });
    fireEvent.submit(screen.getByPlaceholderText("0.00").closest("form")!);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Choose a destination account"));
    expect(apiMock.transfer).not.toHaveBeenCalled();
  });

  it("transfers to the chosen destination account", async () => {
    apiMock.transfer.mockResolvedValue(makeAccount());
    renderForm({ transferTargets: [makeAccount({ id: "a-2", ownerName: "Savings" })] });

    fireEvent.click(screen.getByRole("button", { name: "Transfer" }));
    fireEvent.change(screen.getByLabelText("Destination account"), { target: { value: "a-2" } });
    fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "20" } });
    fireEvent.submit(screen.getByPlaceholderText("0.00").closest("form")!);

    await waitFor(() => expect(apiMock.transfer).toHaveBeenCalledWith("a-1", "a-2", 20, undefined));
  });

  it("renders the import tab when Import is selected", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    expect(screen.getByTestId("import-tab")).toBeInTheDocument();
  });

  it("keeps the receipt scanner hidden until Scan receipt is chosen", () => {
    renderForm();
    expect(screen.getByTestId("receipt-scan-panel")).not.toBeVisible();
    expect(screen.getByRole("button", { name: "Scan receipt" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("swaps the amount form for the receipt scanner when Scan receipt is chosen", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Scan receipt" }));

    expect(screen.getByTestId("receipt-scan-panel")).toBeVisible();
    expect(screen.queryByPlaceholderText("0.00")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Scan receipt" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("leaves the scanner when Scan receipt is clicked again or a tab is chosen", () => {
    renderForm();
    const scanButton = screen.getByRole("button", { name: "Scan receipt" });

    fireEvent.click(scanButton);
    fireEvent.click(scanButton);
    expect(screen.getByTestId("receipt-scan-panel")).not.toBeVisible();
    expect(screen.getByPlaceholderText("0.00")).toBeInTheDocument();

    fireEvent.click(scanButton);
    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    expect(screen.getByTestId("receipt-scan-panel")).not.toBeVisible();
  });

  it("returns to the amount form and refreshes once a scanned receipt is saved", async () => {
    const { onSuccess } = renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Scan receipt" }));

    fireEvent.click(screen.getByTestId("receipt-scan-panel"));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(screen.getByTestId("receipt-scan-panel")).not.toBeVisible();
    expect(screen.getByPlaceholderText("0.00")).toBeInTheDocument();
  });

  it("labels the actions Charge/Payment for a credit account", () => {
    renderForm({ account: makeAccount({ accountType: "CREDIT" }) });
    // "Charge" appears on both the tab and the submit button; "Payment" only on the tab.
    expect(screen.getAllByRole("button", { name: "Charge" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Payment" })).toBeInTheDocument();
  });

  it("auto-fills the category from a matching merchant rule", async () => {
    apiMock.listCategorizationRules.mockResolvedValue([
      { id: "r-1", merchant: "Loblaws", category: "Groceries" } as AutoCategorizationRule,
    ]);
    renderForm();
    await waitFor(() => expect(apiMock.listCategorizationRules).toHaveBeenCalled());

    // Withdraw shows expense categories, so "Groceries" is a selectable option.
    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    fireEvent.change(screen.getByPlaceholderText("Merchant (optional)"), {
      target: { value: "loblaws" },
    });

    const categorySelect = screen.getByRole("combobox");
    await waitFor(() => expect(categorySelect).toHaveValue("Groceries"));
  });
});

describe("NewTransactionForm — the transaction date", () => {
  /** The local calendar day a number of days from today, as a date input holds it. */
  function localDayFromToday(dayOffset: number): string {
    const day = new Date();
    day.setDate(day.getDate() + dayOffset);
    return formatLocalDate(day);
  }

  it("starts on today and leaves today's transactions for the server to stamp", async () => {
    apiMock.withdraw.mockResolvedValue(makeAccount());
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    expect(screen.getByLabelText("Transaction date")).toHaveValue(localDayFromToday(0));
    fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "20" } });
    fireEvent.submit(screen.getByPlaceholderText("0.00").closest("form")!);

    await waitFor(() => expect(apiMock.withdraw).toHaveBeenCalled());
    expect(apiMock.withdraw.mock.calls[0]![2].effectiveAt).toBeUndefined();
  });

  it("records a transaction on an earlier day at local noon of that day", async () => {
    apiMock.withdraw.mockResolvedValue(makeAccount());
    renderForm();
    const yesterday = localDayFromToday(-1);

    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("Transaction date"), { target: { value: yesterday } });
    fireEvent.submit(screen.getByPlaceholderText("0.00").closest("form")!);

    const [year, month, day] = yesterday.split("-").map(Number);
    await waitFor(() =>
      expect(apiMock.withdraw).toHaveBeenCalledWith("a-1", 20, {
        category: undefined,
        merchant: undefined,
        effectiveAt: new Date(year!, month! - 1, day!, 12).toISOString(),
      })
    );
  });

  it("refuses a date in the future", () => {
    renderForm();

    fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("Transaction date"), {
      target: { value: localDayFromToday(1) },
    });
    fireEvent.submit(screen.getByPlaceholderText("0.00").closest("form")!);

    expect(toast.error).toHaveBeenCalledWith("Enter a date that isn't in the future");
    expect(apiMock.deposit).not.toHaveBeenCalled();
  });

  it("has no date for a transfer", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Transfer" }));
    expect(screen.queryByLabelText("Transaction date")).not.toBeInTheDocument();
  });
});

describe("NewTransactionForm — quick add", () => {
  it("fills the form from a note, ready to review and save", async () => {
    const dayBefore = new Date();
    dayBefore.setDate(dayBefore.getDate() - 1);
    const yesterday = formatLocalDate(dayBefore);
    apiMock.draftQuickAddTransaction.mockResolvedValue({
      draft: {
        direction: "EXPENSE",
        amount: 4.5,
        merchant: "Tim Hortons",
        category: "Dining",
        date: yesterday,
      },
    });
    apiMock.withdraw.mockResolvedValue(makeAccount());
    renderForm();
    // The user's categories have loaded, as they have long before a note is read.
    await screen.findByRole("option", { name: "Salary" });

    fireEvent.change(screen.getByLabelText("Describe a transaction"), {
      target: { value: "Coffee 4.50 at Tim's yesterday" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Fill in" }));

    await waitFor(() => expect(screen.getByPlaceholderText("0.00")).toHaveValue(4.5));
    expect(screen.getByPlaceholderText("Merchant (optional)")).toHaveValue("Tim Hortons");
    expect(screen.getByRole("combobox")).toHaveValue("Dining");
    expect(screen.getByLabelText("Transaction date")).toHaveValue(yesterday);
    expect(apiMock.withdraw).not.toHaveBeenCalled();

    fireEvent.submit(screen.getByPlaceholderText("0.00").closest("form")!);
    await waitFor(() =>
      expect(apiMock.withdraw).toHaveBeenCalledWith(
        "a-1",
        4.5,
        expect.objectContaining({ category: "Dining", merchant: "Tim Hortons" })
      )
    );
  });

  it("is hidden while importing", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    expect(screen.queryByLabelText("Describe a transaction")).not.toBeInTheDocument();
  });
});
