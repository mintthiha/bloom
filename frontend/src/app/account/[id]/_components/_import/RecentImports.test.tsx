import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecentImports } from "./RecentImports";
import type { ImportBatchSummary } from "@/lib/api";

const { apiMock, toastMock } = vi.hoisted(() => ({
  apiMock: { listImportBatches: vi.fn(), undoImportBatch: vi.fn() },
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { ...actual.api, ...apiMock } };
});

vi.mock("sonner", () => ({ toast: toastMock }));

const octoberImport: ImportBatchSummary = {
  importBatchId: "b-1",
  transactionCount: 42,
  importedAt: "2026-11-04T15:00:00.000Z",
  earliestEffectiveAt: "2026-10-01T00:00:00.000Z",
  latestEffectiveAt: "2026-10-31T00:00:00.000Z",
};

/** Renders the list for account a-1 and returns the undo callback spy. */
function renderRecentImports(refreshKey = 0) {
  const onImportUndone = vi.fn();
  const view = render(
    <RecentImports accountId="a-1" refreshKey={refreshKey} onImportUndone={onImportUndone} />
  );
  return { onImportUndone, ...view };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RecentImports", () => {
  it("renders nothing when the account has no imports", async () => {
    apiMock.listImportBatches.mockResolvedValue([]);
    renderRecentImports();

    await waitFor(() => expect(apiMock.listImportBatches).toHaveBeenCalledWith("a-1"));
    expect(screen.queryByText("Recent imports")).not.toBeInTheDocument();
  });

  it("lists each import with its size and date range", async () => {
    apiMock.listImportBatches.mockResolvedValue([octoberImport]);
    renderRecentImports();

    expect(await screen.findByText("42 transactions")).toBeInTheDocument();
    expect(screen.getByText(/Oct 1 – Oct 31, 2026/)).toBeInTheDocument();
  });

  it("asks for confirmation before undoing, then removes the import and notifies the parent", async () => {
    apiMock.listImportBatches.mockResolvedValue([octoberImport]);
    apiMock.undoImportBatch.mockResolvedValue({ removed: 42, account: {} });
    const { onImportUndone } = renderRecentImports();

    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));
    expect(screen.getByText("Undo import of 42 transactions?")).toBeInTheDocument();
    expect(apiMock.undoImportBatch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(apiMock.undoImportBatch).toHaveBeenCalledWith("a-1", "b-1"));
    expect(toastMock.success).toHaveBeenCalledWith("Import undone — 42 transactions removed");
    expect(onImportUndone).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText("42 transactions")).not.toBeInTheDocument());
  });

  it("shows an error toast and keeps the import listed when undo fails", async () => {
    apiMock.listImportBatches.mockResolvedValue([octoberImport]);
    apiMock.undoImportBatch.mockRejectedValue(new Error("Import not found"));
    const { onImportUndone } = renderRecentImports();

    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith("Import not found"));
    expect(onImportUndone).not.toHaveBeenCalled();
    expect(screen.getByText("42 transactions")).toBeInTheDocument();
  });

  it("reloads the list when the refresh key changes after a new import", async () => {
    apiMock.listImportBatches.mockResolvedValue([]);
    const { rerender } = renderRecentImports(0);
    await waitFor(() => expect(apiMock.listImportBatches).toHaveBeenCalledTimes(1));

    apiMock.listImportBatches.mockResolvedValue([octoberImport]);
    rerender(<RecentImports accountId="a-1" refreshKey={1} onImportUndone={vi.fn()} />);

    expect(await screen.findByText("42 transactions")).toBeInTheDocument();
    expect(apiMock.listImportBatches).toHaveBeenCalledTimes(2);
  });

  it("hides the list quietly when loading imports fails", async () => {
    apiMock.listImportBatches.mockRejectedValue(new Error("offline"));
    renderRecentImports();

    await waitFor(() => expect(apiMock.listImportBatches).toHaveBeenCalled());
    expect(screen.queryByText("Recent imports")).not.toBeInTheDocument();
  });
});
