import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TransactionsExplorer } from "./TransactionsExplorer";
import type { TransactionListItem } from "@/lib/api";

const { apiMock, pushMock } = vi.hoisted(() => ({
  apiMock: { listAccounts: vi.fn(), listTransactions: vi.fn() },
  pushMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: {
      ...actual.api,
      listAccounts: apiMock.listAccounts,
      listTransactions: apiMock.listTransactions,
    },
  };
});

// Stub children so the test targets the explorer's own fetching/paging/routing logic.
vi.mock("./TransactionFilterBar", () => ({
  TransactionFilterBar: (props: { onAccountChange: (v: string) => void; onClear: () => void }) => (
    <div>
      <button onClick={() => props.onAccountChange("a-2")}>set-account</button>
      <button onClick={props.onClear}>clear-filters</button>
    </div>
  ),
}));

vi.mock("./TransactionsTable", () => ({
  TransactionsTable: (props: {
    rows: TransactionListItem[];
    onRowClick: (r: TransactionListItem) => void;
  }) => (
    <div>
      <span>rows:{props.rows.length}</span>
      {props.rows[0] && <button onClick={() => props.onRowClick(props.rows[0])}>row-0</button>}
    </div>
  ),
}));

vi.mock("./ExportCsvButton", () => ({ ExportCsvButton: () => <div data-testid="export" /> }));

/** Builds a list result page. */
function makeResult(rows: number, total: number) {
  return {
    rows: Array.from({ length: rows }, (_, i) => ({
      id: `t-${i}`,
      accountId: "a-1",
    })) as TransactionListItem[],
    total,
    page: 1,
    limit: 25,
    hasMore: total > 25,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.listAccounts.mockResolvedValue([]);
  apiMock.listTransactions.mockResolvedValue(makeResult(2, 2));
});

describe("TransactionsExplorer", () => {
  it("shows the result range once a page has loaded", async () => {
    render(<TransactionsExplorer />);
    expect(await screen.findByText("Showing 1–2 of 2 transactions")).toBeInTheDocument();
    expect(screen.getByText("rows:2")).toBeInTheDocument();
  });

  it("shows the empty message when nothing matches", async () => {
    apiMock.listTransactions.mockResolvedValue(makeResult(0, 0));
    render(<TransactionsExplorer />);
    expect(await screen.findByText("No transactions")).toBeInTheDocument();
  });

  it("refetches with the account filter and resets to page one", async () => {
    render(<TransactionsExplorer />);
    await screen.findByText("Showing 1–2 of 2 transactions");

    fireEvent.click(screen.getByRole("button", { name: "set-account" }));

    await waitFor(() =>
      expect(apiMock.listTransactions).toHaveBeenLastCalledWith(
        expect.objectContaining({ account: "a-2", page: 1 })
      )
    );
  });

  it("paginates to the next page", async () => {
    apiMock.listTransactions.mockResolvedValue(makeResult(25, 60));
    render(<TransactionsExplorer />);
    expect(await screen.findByText("Page 1 of 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() =>
      expect(apiMock.listTransactions).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 })
      )
    );
  });

  it("navigates to the account page when a row is clicked", async () => {
    render(<TransactionsExplorer />);
    await screen.findByText("Showing 1–2 of 2 transactions");

    fireEvent.click(screen.getByRole("button", { name: "row-0" }));

    expect(pushMock).toHaveBeenCalledWith("/account/a-1");
  });
});
