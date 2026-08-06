import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AccountPage from "./page";
import type { Account } from "@/lib/api";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getAccount: vi.fn(),
    getTransactions: vi.fn(),
    listAccounts: vi.fn(),
    getProfile: vi.fn(),
    updateTransaction: vi.fn(),
  },
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { ...actual.api, ...apiMock } };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock("@/components/dashboard-view-provider", () => ({
  useDashboardView: () => ({ effectiveView: "single" }),
}));

// Stub navigation helpers (they use next/link) and every heavy child panel.
vi.mock("@/components/BackToHome", () => ({ BackToHome: () => <div /> }));
vi.mock("@/components/BackToAccounts", () => ({ BackToAccounts: () => <div /> }));
vi.mock("./_components/_accountCard/AccountCard", () => ({
  AccountCard: () => <div data-testid="account-card" />,
}));
vi.mock("./_components/_accountActions/NicknameEditor", () => ({
  NicknameEditor: () => <div data-testid="nickname-editor" />,
}));
vi.mock("./_components/_accountTransactions/DeleteTransaction", () => ({
  DeleteTransaction: () => <div data-testid="delete-transaction" />,
}));
vi.mock("./_components/_accountAnalytics/AccountAnalytics", () => ({
  AccountAnalytics: () => <div data-testid="analytics" />,
}));
vi.mock("./_components/_newTransaction/NewTransactionForm", () => ({
  NewTransactionForm: () => <div data-testid="new-transaction-form" />,
}));
vi.mock("./_components/_newTransaction/LinkedAccountNotice", () => ({
  LinkedAccountNotice: () => <div data-testid="linked-notice" />,
}));
vi.mock("./_components/_contributionRoom/ContributionRoomPanel", () => ({
  ContributionRoomPanel: () => <div data-testid="contribution-room" />,
}));
vi.mock("./_components/_creditCardPanels/CreditCardPanels", () => ({
  CreditCardPanels: () => <div data-testid="credit-panels" />,
}));
vi.mock("./_components/_accountTransactions/TransactionHistory", () => ({
  TransactionHistory: (props: {
    onEditingTransactionAmountChange: (v: string) => void;
    onSaveTransaction: (id: string) => void;
  }) => (
    <div data-testid="transaction-history">
      <button onClick={() => props.onEditingTransactionAmountChange("50")}>set-amount</button>
      <button onClick={() => props.onSaveTransaction("t-1")}>save-txn</button>
    </div>
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
    balance: 100,
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

/**
 * Builds an already-fulfilled thenable so React's `use()` reads it synchronously and never
 * suspends (a plain resolved promise leaves the test stuck on the Suspense fallback).
 */
function fulfilledParams(id: string): Promise<{ id: string }> {
  const value = { id };
  const promise = Promise.resolve(value) as Promise<{ id: string }> & {
    status?: string;
    value?: { id: string };
  };
  promise.status = "fulfilled";
  promise.value = value;
  return promise;
}

/** Renders the page inside a Suspense boundary (it unwraps a params promise via `use`). */
function renderPage(id = "a-1") {
  return render(
    <Suspense fallback={<div>suspense-fallback</div>}>
      <AccountPage params={fulfilledParams(id)} />
    </Suspense>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.getAccount.mockResolvedValue(makeAccount());
  apiMock.getTransactions.mockResolvedValue([]);
  apiMock.listAccounts.mockResolvedValue([makeAccount()]);
  apiMock.getProfile.mockResolvedValue(null);
});

describe("AccountPage", () => {
  it("shows an error state when the account fails to load", async () => {
    apiMock.getAccount.mockRejectedValue(new Error("Account not found"));
    renderPage();
    expect(await screen.findByText("Account not found")).toBeInTheDocument();
  });

  it("renders the summary and the new-transaction form for an unlinked chequing account", async () => {
    renderPage();
    expect(await screen.findByTestId("account-card")).toBeInTheDocument();
    expect(screen.getByTestId("transaction-history")).toBeInTheDocument();
    expect(screen.getByTestId("new-transaction-form")).toBeInTheDocument();
    expect(screen.queryByTestId("contribution-room")).not.toBeInTheDocument();
    expect(screen.queryByTestId("credit-panels")).not.toBeInTheDocument();
  });

  it("shows the contribution-room panel for a registered account", async () => {
    apiMock.getAccount.mockResolvedValue(makeAccount({ accountType: "TFSA" }));
    apiMock.listAccounts.mockResolvedValue([makeAccount({ accountType: "TFSA" })]);
    renderPage();
    expect(await screen.findByTestId("contribution-room")).toBeInTheDocument();
  });

  it("shows the credit-card panels for a credit account", async () => {
    apiMock.getAccount.mockResolvedValue(makeAccount({ accountType: "CREDIT" }));
    renderPage();
    expect(await screen.findByTestId("credit-panels")).toBeInTheDocument();
  });

  it("shows the linked-account notice instead of the form for a linked account", async () => {
    apiMock.getAccount.mockResolvedValue(makeAccount({ isLinked: true }));
    renderPage();
    expect(await screen.findByTestId("linked-notice")).toBeInTheDocument();
    expect(screen.queryByTestId("new-transaction-form")).not.toBeInTheDocument();
  });

  it("rejects a transaction edit with a non-positive amount", async () => {
    renderPage();
    await screen.findByTestId("transaction-history");

    fireEvent.click(screen.getByRole("button", { name: "save-txn" }));

    expect(toast.error).toHaveBeenCalledWith("Enter a valid positive amount");
    expect(apiMock.updateTransaction).not.toHaveBeenCalled();
  });

  it("saves a valid transaction edit and refreshes", async () => {
    apiMock.updateTransaction.mockResolvedValue(makeAccount());
    renderPage();
    await screen.findByTestId("transaction-history");

    fireEvent.click(screen.getByRole("button", { name: "set-amount" }));
    fireEvent.click(screen.getByRole("button", { name: "save-txn" }));

    await waitFor(() =>
      expect(apiMock.updateTransaction).toHaveBeenCalledWith(
        "a-1",
        "t-1",
        expect.objectContaining({ amount: 50 })
      )
    );
    expect(toast.success).toHaveBeenCalledWith("Transaction updated");
  });
});
