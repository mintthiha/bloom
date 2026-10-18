import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuickAddBar } from "./QuickAddBar";
import { formatLocalDate } from "../transaction-date";
import type { QuickAddDraft } from "@/lib/api";

const { apiMock } = vi.hoisted(() => ({
  apiMock: { draftQuickAddTransaction: vi.fn() },
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { ...actual.api, ...apiMock } };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { toast } from "sonner";

const DRAFT: QuickAddDraft = {
  direction: "EXPENSE",
  amount: 4.5,
  merchant: "Tim Hortons",
  category: "Dining",
  date: "2026-10-16",
};

/** Types a note into the quick-add box. */
function typeNote(note: string) {
  fireEvent.change(screen.getByLabelText("Describe a transaction"), { target: { value: note } });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("QuickAddBar", () => {
  it("sends the trimmed note with the user's own date and hands the draft to the form", async () => {
    apiMock.draftQuickAddTransaction.mockResolvedValue({ draft: DRAFT });
    const onDraft = vi.fn().mockReturnValue("Filled in from your note. Check it, then save.");
    render(<QuickAddBar onDraft={onDraft} />);

    typeNote("  Coffee 4.50 at Tim's yesterday ");
    fireEvent.click(screen.getByRole("button", { name: "Fill in" }));

    await waitFor(() => expect(onDraft).toHaveBeenCalledWith(DRAFT));
    expect(apiMock.draftQuickAddTransaction).toHaveBeenCalledWith(
      "Coffee 4.50 at Tim's yesterday",
      formatLocalDate(new Date())
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Filled in from your note. Check it, then save."
    );
    expect(screen.getByLabelText("Describe a transaction")).toHaveValue("");
  });

  it("shows that it is reading while the request runs", async () => {
    let finishDrafting: (value: { draft: QuickAddDraft }) => void = () => {};
    apiMock.draftQuickAddTransaction.mockReturnValue(
      new Promise((resolve) => {
        finishDrafting = resolve;
      })
    );
    render(<QuickAddBar onDraft={vi.fn().mockReturnValue("Done.")} />);

    typeNote("coffee 4");
    fireEvent.click(screen.getByRole("button", { name: "Fill in" }));

    expect(await screen.findByRole("button", { name: "Reading…" })).toBeDisabled();
    expect(screen.getByLabelText("Describe a transaction")).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Reading your note");

    finishDrafting({ draft: DRAFT });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Done."));
  });

  it("keeps the note and says to fill the form by hand when reading fails", async () => {
    apiMock.draftQuickAddTransaction.mockRejectedValue(new Error("AI service unavailable"));
    const onDraft = vi.fn();
    render(<QuickAddBar onDraft={onDraft} />);

    typeNote("coffee 4");
    fireEvent.click(screen.getByRole("button", { name: "Fill in" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Bloom AI couldn't read that note just now. Fill in the form below instead."
      )
    );
    expect(onDraft).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Describe a transaction")).toHaveValue("coffee 4");
  });

  it("can't send an empty note", () => {
    render(<QuickAddBar onDraft={vi.fn()} />);

    typeNote("   ");

    expect(screen.getByRole("button", { name: "Fill in" })).toBeDisabled();
    expect(screen.getByLabelText("Describe a transaction")).toHaveAttribute("maxlength", "200");
  });
});
