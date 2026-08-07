import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LinkedAccountNotice } from "./LinkedAccountNotice";
import type { Account } from "@/lib/api";

const { apiMock } = vi.hoisted(() => ({
  apiMock: { resyncPlaidItem: vi.fn() },
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: { ...actual.api, resyncPlaidItem: apiMock.resyncPlaidItem },
  };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { toast } from "sonner";

/** Builds a linked Account fixture; override only what a test needs. */
function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "a-1",
    ownerName: "Test",
    nickname: null,
    accountType: "CHEQUING",
    balance: 0,
    frozen: false,
    isLinked: true,
    plaidAccountId: "plaid-acct",
    plaidItemId: "item-1",
    institutionName: "RBC",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LinkedAccountNotice", () => {
  it("names the source institution", () => {
    render(<LinkedAccountNotice account={makeAccount()} onResynced={vi.fn()} />);
    expect(screen.getByText("RBC")).toBeInTheDocument();
  });

  it("falls back to 'External Bank' when the institution is unknown", () => {
    render(
      <LinkedAccountNotice account={makeAccount({ institutionName: null })} onResynced={vi.fn()} />
    );
    expect(screen.getByText("External Bank")).toBeInTheDocument();
  });

  it("re-syncs, shows a success toast, and refreshes on success", async () => {
    apiMock.resyncPlaidItem.mockResolvedValue({ accountsLinked: 2 });
    const onResynced = vi.fn().mockResolvedValue(undefined);
    render(<LinkedAccountNotice account={makeAccount()} onResynced={onResynced} />);

    fireEvent.click(screen.getByRole("button", { name: "Re-sync" }));

    await waitFor(() => expect(onResynced).toHaveBeenCalledTimes(1));
    expect(apiMock.resyncPlaidItem).toHaveBeenCalledWith("item-1");
    expect(toast.success).toHaveBeenCalledWith("Re-synced 2 accounts");
  });

  it("uses the singular noun when exactly one account is linked", async () => {
    apiMock.resyncPlaidItem.mockResolvedValue({ accountsLinked: 1 });
    render(
      <LinkedAccountNotice
        account={makeAccount()}
        onResynced={vi.fn().mockResolvedValue(undefined)}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Re-sync" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Re-synced 1 account"));
  });

  it("shows an error toast and does not refresh when the re-sync fails", async () => {
    apiMock.resyncPlaidItem.mockRejectedValue(new Error("Plaid down"));
    const onResynced = vi.fn();
    render(<LinkedAccountNotice account={makeAccount()} onResynced={onResynced} />);

    fireEvent.click(screen.getByRole("button", { name: "Re-sync" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Plaid down"));
    expect(onResynced).not.toHaveBeenCalled();
  });

  it("disables the button when the account has no Plaid item", () => {
    render(
      <LinkedAccountNotice account={makeAccount({ plaidItemId: null })} onResynced={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: "Re-sync" })).toBeDisabled();
  });
});
