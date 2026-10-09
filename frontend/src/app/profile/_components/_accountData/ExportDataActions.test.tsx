import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { UserDataExport } from "@/lib/api";
import { ExportDataActions } from "./ExportDataActions";

const { apiMock } = vi.hoisted(() => ({ apiMock: { exportUserData: vi.fn() } }));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { ...actual.api, exportUserData: apiMock.exportUserData } };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { toast } from "sonner";

const exportBundle: UserDataExport = {
  exportVersion: 1,
  exportedAt: "2026-09-26T12:00:00.000Z",
  profile: null,
  accounts: [],
  transactions: [
    {
      id: "t-1",
      type: "WITHDRAWAL",
      amount: 19.99,
      effectiveAt: "2026-09-20T12:00:00.000Z",
      description: "Coffee",
      merchant: "Tim Hortons",
      category: "Dining",
      accountId: "a-1",
      accountName: "Alex Rivera",
      accountNickname: "Everyday Chequing",
      accountType: "CHEQUING",
    },
  ],
  budgets: [],
  savingsGoals: [],
  recurringTransactions: [],
  manualEntries: [],
  categorizationRules: [],
  customCategories: [],
  netWorthSnapshots: [],
  chatMessages: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.URL.createObjectURL = vi.fn(() => "blob:mock");
  globalThis.URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ExportDataActions", () => {
  it("downloads a .csv file of the transactions and reports what it contained", async () => {
    apiMock.exportUserData.mockResolvedValue(exportBundle);
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      downloads.push(this.download);
    });

    render(<ExportDataActions />);
    fireEvent.click(screen.getByRole("button", { name: /transactions csv/i }));

    await waitFor(() => expect(apiMock.exportUserData).toHaveBeenCalledTimes(1));
    expect(downloads[0]).toMatch(/^bloom-transactions-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(toast.success).toHaveBeenCalledWith("Data exported", {
      description: "1 transaction",
    });
  });

  it("downloads a .json file of the whole account", async () => {
    apiMock.exportUserData.mockResolvedValue(exportBundle);
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      downloads.push(this.download);
    });

    render(<ExportDataActions />);
    fireEvent.click(screen.getByRole("button", { name: /everything \(json\)/i }));

    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0]).toMatch(/^bloom-my-data-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it("shows an error toast and downloads nothing when the request fails", async () => {
    apiMock.exportUserData.mockRejectedValue(new Error("nope"));
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    render(<ExportDataActions />);
    fireEvent.click(screen.getByRole("button", { name: /transactions csv/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Couldn't export your data"));
    expect(clickSpy).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("re-enables the buttons after an export finishes so a second format can be downloaded", async () => {
    apiMock.exportUserData.mockResolvedValue(exportBundle);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    render(<ExportDataActions />);
    fireEvent.click(screen.getByRole("button", { name: /transactions csv/i }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());

    const jsonButton = screen.getByRole("button", { name: /everything \(json\)/i });
    expect(jsonButton).not.toBeDisabled();
    fireEvent.click(jsonButton);

    await waitFor(() => expect(apiMock.exportUserData).toHaveBeenCalledTimes(2));
  });
});
