import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ManualEntry } from "@/lib/api";
import { TestErrorBoundary } from "@/test-utils/TestErrorBoundary";
import ManualEntriesPage from "./page";

const { apiMock, toastMock } = vi.hoisted(() => ({
  apiMock: {
    listManualEntries: vi.fn(),
    recordNetWorthSnapshot: vi.fn(),
    createManualEntry: vi.fn(),
    deleteManualEntry: vi.fn(),
    restoreManualEntry: vi.fn(),
    updateManualEntry: vi.fn(),
  },
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { ...actual.api, ...apiMock } };
});

vi.mock("sonner", () => ({ toast: toastMock }));

/** Builds a manual entry fixture. */
function makeEntry(overrides: Partial<ManualEntry> = {}): ManualEntry {
  return {
    id: "entry-1",
    userId: "user-1",
    name: "Student Loan",
    type: "LIABILITY",
    amount: 12000,
    date: "2026-01-15",
    createdAt: "2026-01-15T00:00:00.000Z",
    updatedAt: "2026-01-15T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  apiMock.recordNetWorthSnapshot.mockResolvedValue(undefined);
  apiMock.listManualEntries.mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ManualEntriesPage", () => {
  it("invites the user to add an entry when there are none", async () => {
    render(<ManualEntriesPage />);

    expect(await screen.findByText(/No entries yet/)).toBeInTheDocument();
    expect(apiMock.recordNetWorthSnapshot).toHaveBeenCalled();
  });

  it("lists assets and liabilities with their totals and the net", async () => {
    apiMock.listManualEntries.mockResolvedValue([
      makeEntry({ id: "loan", name: "Student Loan", type: "LIABILITY", amount: 12000 }),
      makeEntry({ id: "car", name: "Vehicle", type: "ASSET", amount: 15000 }),
    ]);

    render(<ManualEntriesPage />);

    expect(await screen.findByText("Student Loan")).toBeInTheDocument();
    expect(screen.getByText("Vehicle")).toBeInTheDocument();
    expect(screen.getAllByText("$15,000.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$12,000.00").length).toBeGreaterThan(0);
    expect(screen.getByText("+$3,000.00")).toBeInTheDocument();
  });

  it("adds an entry, shows it, and confirms with a toast", async () => {
    apiMock.createManualEntry.mockResolvedValue(
      makeEntry({ id: "mortgage", name: "Mortgage", amount: 250000 })
    );
    render(<ManualEntriesPage />);
    await screen.findByText(/No entries yet/);

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Mortgage" } });
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "250000" } });
    fireEvent.change(screen.getByLabelText("As of date"), { target: { value: "2026-05-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Add entry" }));

    expect(await screen.findByText("Mortgage")).toBeInTheDocument();
    expect(apiMock.createManualEntry).toHaveBeenCalledWith({
      name: "Mortgage",
      type: "LIABILITY",
      amount: 250000,
      date: "2026-05-01",
    });
    expect(toastMock.success).toHaveBeenCalledWith("Mortgage added");
  });

  it("asks for a name and a positive amount instead of saving an incomplete entry", async () => {
    render(<ManualEntriesPage />);
    await screen.findByText(/No entries yet/);

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Mortgage" } });
    fireEvent.click(screen.getByRole("button", { name: "Add entry" }));

    expect(toastMock.error).toHaveBeenCalledWith("Name and a positive amount are required.");
    expect(apiMock.createManualEntry).not.toHaveBeenCalled();
  });

  it("deletes the selected entries after confirmation", async () => {
    apiMock.listManualEntries
      .mockResolvedValueOnce([makeEntry({ id: "loan", name: "Student Loan" })])
      .mockResolvedValue([]);
    apiMock.deleteManualEntry.mockResolvedValue(undefined);
    render(<ManualEntriesPage />);

    fireEvent.click(await screen.findByRole("checkbox", { name: "Select Student Loan" }));
    expect(screen.getByText("1 entry selected")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete 1" }));
    // The dialog's confirm button shares the toolbar button's label; it is the last one rendered.
    await screen.findByText("Delete 1 entry?");
    const deleteButtons = screen.getAllByRole("button", { name: "Delete 1" });
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);

    await waitFor(() => expect(apiMock.deleteManualEntry).toHaveBeenCalledWith("loan"));
    await waitFor(() =>
      expect(toastMock.success).toHaveBeenCalledWith(
        "1 entry deleted",
        expect.objectContaining({ action: expect.objectContaining({ label: "Undo" }) })
      )
    );
  });

  it("selects a whole section at once", async () => {
    apiMock.listManualEntries.mockResolvedValue([
      makeEntry({ id: "loan", name: "Student Loan" }),
      makeEntry({ id: "card", name: "Line of Credit" }),
    ]);
    render(<ManualEntriesPage />);

    fireEvent.click(await screen.findByRole("checkbox", { name: "Select all liabilities" }));

    expect(screen.getByText("2 entries selected")).toBeInTheDocument();
  });

  it("shows the error page instead of the empty state when loading fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    apiMock.listManualEntries.mockRejectedValue(new Error("Bloom can't reach its server"));

    render(
      <TestErrorBoundary>
        <ManualEntriesPage />
      </TestErrorBoundary>
    );

    expect(await screen.findByText("Caught: Bloom can't reach its server")).toBeInTheDocument();
    expect(screen.queryByText(/No entries yet/)).not.toBeInTheDocument();
    vi.mocked(console.error).mockRestore();
  });
});
