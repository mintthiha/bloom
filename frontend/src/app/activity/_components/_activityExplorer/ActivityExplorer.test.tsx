import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActivityExplorer } from "./ActivityExplorer";
import type { ActivityLogEntry } from "@/lib/api";

const { apiMock } = vi.hoisted(() => ({
  apiMock: { listActivityLogs: vi.fn() },
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: { ...actual.api, listActivityLogs: apiMock.listActivityLogs },
  };
});

// Stub children so the test targets the explorer's own fetching/paging/filter logic.
vi.mock("./ActivityFilterBar", () => ({
  ActivityFilterBar: (props: {
    onGroupChange: (v: string) => void;
    onActionChange: (v: string) => void;
    onClear: () => void;
  }) => (
    <div>
      <button onClick={() => props.onGroupChange("BUDGET")}>set-group</button>
      <button onClick={() => props.onActionChange("DELETED")}>set-action</button>
      <button onClick={props.onClear}>clear-filters</button>
    </div>
  ),
}));

vi.mock("./ActivityTable", () => ({
  ActivityTable: (props: { rows: ActivityLogEntry[] }) => <span>rows:{props.rows.length}</span>,
}));

/** Builds an activity log result page. */
function makeResult(rows: number, total: number) {
  return {
    logs: Array.from({ length: rows }, (_, i) => ({ id: `log-${i}` })) as ActivityLogEntry[],
    total,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.listActivityLogs.mockResolvedValue(makeResult(2, 2));
});

describe("ActivityExplorer", () => {
  it("shows the result range once a page has loaded", async () => {
    render(<ActivityExplorer />);
    expect(await screen.findByText("Showing 1–2 of 2 events")).toBeInTheDocument();
    expect(screen.getByText("rows:2")).toBeInTheDocument();
  });

  it("shows the empty message when nothing matches", async () => {
    apiMock.listActivityLogs.mockResolvedValue(makeResult(0, 0));
    render(<ActivityExplorer />);
    expect(await screen.findByText("No events")).toBeInTheDocument();
  });

  it("refetches with the group filter and resets to page one", async () => {
    render(<ActivityExplorer />);
    await screen.findByText("Showing 1–2 of 2 events");

    fireEvent.click(screen.getByRole("button", { name: "set-group" }));

    await waitFor(() =>
      expect(apiMock.listActivityLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({ group: "BUDGET", offset: 0 })
      )
    );
  });

  it("refetches with the action filter and resets to page one", async () => {
    render(<ActivityExplorer />);
    await screen.findByText("Showing 1–2 of 2 events");

    fireEvent.click(screen.getByRole("button", { name: "set-action" }));

    await waitFor(() =>
      expect(apiMock.listActivityLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: "DELETED", offset: 0 })
      )
    );
  });

  it("paginates to the next page", async () => {
    apiMock.listActivityLogs.mockResolvedValue(makeResult(25, 60));
    render(<ActivityExplorer />);
    expect(await screen.findByText("Page 1 of 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() =>
      expect(apiMock.listActivityLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({ offset: 25 })
      )
    );
  });

  it("clears filters back to the default query", async () => {
    apiMock.listActivityLogs.mockResolvedValue(makeResult(25, 60));
    render(<ActivityExplorer />);
    await screen.findByText("Page 1 of 3");

    fireEvent.click(screen.getByRole("button", { name: "set-group" }));
    await waitFor(() =>
      expect(apiMock.listActivityLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({ group: "BUDGET" })
      )
    );

    fireEvent.click(screen.getByRole("button", { name: "clear-filters" }));

    await waitFor(() =>
      expect(apiMock.listActivityLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({
          group: undefined,
          action: undefined,
          search: undefined,
          offset: 0,
        })
      )
    );
  });
});
