import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { ExportCsvButton } from "./ExportCsvButton";

const { apiMock } = vi.hoisted(() => ({ apiMock: { listTransactions: vi.fn() } }));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { ...actual.api, listTransactions: apiMock.listTransactions } };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { toast } from "sonner";

const baseProps = {
  total: 3,
  accountId: "a-1",
  type: "DEPOSIT",
  search: "coffee",
  sort: "date_desc" as const,
  start: undefined,
  end: undefined,
};

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.URL.createObjectURL = vi.fn(() => "blob:mock");
  globalThis.URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ExportCsvButton", () => {
  it("is disabled with a helpful title when there is nothing to export", () => {
    render(<ExportCsvButton {...baseProps} total={0} />);
    const button = screen.getByRole("button", { name: /export/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "No transactions to export");
  });

  it("fetches the full filtered set and triggers a CSV download", async () => {
    apiMock.listTransactions.mockResolvedValue({
      rows: [],
      total: 3,
      page: 1,
      limit: 3,
      hasMore: false,
    });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<ExportCsvButton {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));

    await waitFor(() =>
      expect(apiMock.listTransactions).toHaveBeenCalledWith(
        expect.objectContaining({ account: "a-1", type: "DEPOSIT", search: "coffee", limit: 3 })
      )
    );
    expect(globalThis.URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
  });

  it("shows an error toast when the export request fails", async () => {
    apiMock.listTransactions.mockRejectedValue(new Error("nope"));

    render(<ExportCsvButton {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Export failed"));
  });
});
