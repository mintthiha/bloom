import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AccountsPage from "./page";
import { Account } from "@/lib/api";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    listAccounts: vi.fn(),
  },
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: {
      ...actual.api,
      listAccounts: apiMock.listAccounts,
    },
  };
});

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

/** Builds an Account with defaults so each test overrides only the fields it needs. */
function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "account-1",
    ownerName: "Jane Doe",
    nickname: "Main",
    accountType: "CHEQUING",
    balance: 1200,
    frozen: false,
    isLinked: false,
    plaidAccountId: null,
    plaidItemId: null,
    institutionName: null,
    createdAt: "2026-04-04T00:00:00.000Z",
    updatedAt: "2026-04-04T00:00:00.000Z",
    ...overrides,
  };
}

const THREE_ACCOUNTS: Account[] = [
  makeAccount({ id: "account-1", nickname: "Main", accountType: "CHEQUING", balance: 1200 }),
  makeAccount({ id: "account-2", nickname: "Long Term", accountType: "TFSA", balance: 3200 }),
  makeAccount({ id: "account-3", nickname: "Visa", accountType: "CREDIT", balance: 450 }),
];

describe("accounts page", () => {
  beforeEach(() => {
    localStorage.clear();
    apiMock.listAccounts.mockReset();
    apiMock.listAccounts.mockResolvedValue(THREE_ACCOUNTS);
  });

  it("groups accounts into cash, registered, and credit sections", async () => {
    render(<AccountsPage />);

    expect(await screen.findByText("Cash Accounts")).toBeInTheDocument();
    expect(screen.getByText("Registered Accounts")).toBeInTheDocument();
    expect(screen.getByText("Credit Accounts")).toBeInTheDocument();
  });

  it("filters to a single type when its chip is selected", async () => {
    render(<AccountsPage />);
    await screen.findByText("Cash Accounts");

    fireEvent.click(screen.getByRole("button", { name: "Chequing" }));

    expect(screen.getByText("Cash Accounts")).toBeInTheDocument();
    expect(screen.queryByText("Registered Accounts")).not.toBeInTheDocument();
    expect(screen.queryByText("Credit Accounts")).not.toBeInTheDocument();
  });

  it("persists a pinned account to localStorage", async () => {
    render(<AccountsPage />);
    await screen.findByText("Cash Accounts");

    fireEvent.click(screen.getAllByLabelText("Pin to dashboard")[0]);

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem("bloom-pinned-accounts") ?? "[]")).toContain(
        "account-1"
      );
    });
  });

  it("hides an account and offers to reveal it again", async () => {
    render(<AccountsPage />);
    await screen.findByText("Cash Accounts");
    expect(screen.getByText("Main")).toBeInTheDocument();

    fireEvent.click(screen.getAllByLabelText("Hide account")[0]);

    await waitFor(() => expect(screen.queryByText("Main")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Show hidden \(1\)/ })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("bloom-hidden-accounts") ?? "[]")).toContain(
      "account-1"
    );
  });

  it("shows the empty state when there are no accounts", async () => {
    apiMock.listAccounts.mockResolvedValue([]);
    render(<AccountsPage />);

    expect(await screen.findByText("No accounts yet")).toBeInTheDocument();
  });
});
