import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandPalette, openCommandPalette } from "./CommandPalette";
import type { TransactionSearchResult } from "@/lib/api";

const { apiMock, pushMock } = vi.hoisted(() => ({
  apiMock: { searchTransactions: vi.fn() },
  pushMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { ...actual.api, searchTransactions: apiMock.searchTransactions } };
});

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));

/** Builds a TransactionSearchResult fixture. */
function makeResult(overrides: Partial<TransactionSearchResult> = {}): TransactionSearchResult {
  return {
    id: "t-1",
    type: "WITHDRAWAL",
    amount: 42.5,
    effectiveAt: "2026-01-15T00:00:00.000Z",
    description: "Weekly groceries",
    merchant: "Loblaws",
    category: "Groceries",
    accountId: "a-1",
    accountName: "Chequing",
    accountNickname: null,
    accountType: "CHEQUING",
    ...overrides,
  };
}

/** Renders the palette and opens it via the global event. */
function renderOpen() {
  render(<CommandPalette />);
  act(() => openCommandPalette());
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CommandPalette", () => {
  it("renders nothing until opened", () => {
    const { container } = render(<CommandPalette />);
    expect(container).toBeEmptyDOMElement();
  });

  it("opens on the bloom:search event and shows the idle hint", () => {
    renderOpen();
    expect(screen.getByLabelText("Search transactions")).toBeInTheDocument();
    expect(screen.getByText("Type to search across all accounts")).toBeInTheDocument();
  });

  it("opens on Cmd/Ctrl+K", () => {
    render(<CommandPalette />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
    });
    expect(screen.getByLabelText("Search transactions")).toBeInTheDocument();
  });

  it("searches (debounced) and renders matching results", async () => {
    apiMock.searchTransactions.mockResolvedValue([makeResult({ merchant: "Loblaws" })]);
    renderOpen();

    fireEvent.change(screen.getByLabelText("Search transactions"), {
      target: { value: "lob" },
    });

    expect(await screen.findByText("Loblaws")).toBeInTheDocument();
    expect(apiMock.searchTransactions).toHaveBeenCalledWith("lob");
    expect(screen.getByText(/42\.50/)).toBeInTheDocument();
  });

  it("shows an empty message when nothing matches", async () => {
    apiMock.searchTransactions.mockResolvedValue([]);
    renderOpen();

    fireEvent.change(screen.getByLabelText("Search transactions"), {
      target: { value: "zzz" },
    });

    expect(await screen.findByText(/No transactions found for/)).toBeInTheDocument();
  });

  it("navigates to the account page on Enter and closes", async () => {
    apiMock.searchTransactions.mockResolvedValue([makeResult({ accountId: "a-42" })]);
    renderOpen();

    const input = screen.getByLabelText("Search transactions");
    fireEvent.change(input, { target: { value: "lob" } });
    await screen.findByText("Loblaws");

    fireEvent.keyDown(input, { key: "Enter" });

    expect(pushMock).toHaveBeenCalledWith("/account/a-42");
    await waitFor(() =>
      expect(screen.queryByLabelText("Search transactions")).not.toBeInTheDocument()
    );
  });
});
