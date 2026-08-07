import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NewTransactionForm } from "./NewTransactionForm";
import type { Account, AutoCategorizationRule } from "@/lib/api";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    listCategorizationRules: vi.fn(),
    deposit: vi.fn(),
    withdraw: vi.fn(),
    transfer: vi.fn(),
  },
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { ...actual.api, ...apiMock } };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("../_import/ImportTab", () => ({ ImportTab: () => <div data-testid="import-tab" /> }));

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
