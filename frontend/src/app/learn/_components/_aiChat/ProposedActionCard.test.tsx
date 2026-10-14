import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatActionProposal } from "@/lib/api";
import { ProposedActionCard } from "./ProposedActionCard";

const { apiMock, toastMock } = vi.hoisted(() => ({
  apiMock: { confirmProposedChatAction: vi.fn(), dismissProposedChatAction: vi.fn() },
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/api", () => ({ api: apiMock }));
vi.mock("sonner", () => ({ toast: toastMock }));

const PENDING_BUDGET_PROPOSAL: ChatActionProposal = {
  messageId: "m-2",
  status: "PENDING",
  proposedAction: {
    kind: "BUDGET",
    category: "Groceries",
    monthlyLimit: 400,
    currentMonthlyLimit: null,
  },
};

/** Renders the card for a draft, pending by default, and returns the status-change spy. */
function renderCard(proposalOverrides: Partial<ChatActionProposal> = {}) {
  const onStatusChange = vi.fn();
  render(
    <ProposedActionCard
      proposal={{ ...PENDING_BUDGET_PROPOSAL, ...proposalOverrides }}
      onStatusChange={onStatusChange}
    />
  );
  return { onStatusChange };
}

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.confirmProposedChatAction.mockResolvedValue({
    id: "m-2",
    proposedActionStatus: "CONFIRMED",
  });
  apiMock.dismissProposedChatAction.mockResolvedValue({
    id: "m-2",
    proposedActionStatus: "DISMISSED",
  });
});

describe("ProposedActionCard", () => {
  it("shows what would be saved and saves nothing until the user confirms", () => {
    renderCard();

    expect(screen.getByRole("region", { name: "New budget: Groceries" })).toBeInTheDocument();
    expect(screen.getByText("Monthly limit")).toBeInTheDocument();
    expect(screen.getByText("$400.00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create budget" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeEnabled();
    expect(apiMock.confirmProposedChatAction).not.toHaveBeenCalled();
  });

  it("says what a draft would replace", () => {
    renderCard({
      proposedAction: {
        kind: "BUDGET",
        category: "Dining",
        monthlyLimit: 200,
        currentMonthlyLimit: 150,
      },
    });

    expect(screen.getByText("Replaces your current $150.00 limit.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update budget" })).toBeInTheDocument();
  });

  it("confirms the draft, reports the new status, and toasts what was created", async () => {
    const { onStatusChange } = renderCard();

    fireEvent.click(screen.getByRole("button", { name: "Create budget" }));

    await waitFor(() => expect(onStatusChange).toHaveBeenCalledWith("m-2", "CONFIRMED"));
    expect(apiMock.confirmProposedChatAction).toHaveBeenCalledWith("m-2");
    expect(toastMock.success).toHaveBeenCalledWith("Groceries budget created");
    expect(apiMock.dismissProposedChatAction).not.toHaveBeenCalled();
  });

  it("disables both actions while the draft is being saved", async () => {
    let finishSaving: (outcome: unknown) => void = () => {};
    apiMock.confirmProposedChatAction.mockReturnValue(
      new Promise((resolve) => {
        finishSaving = resolve;
      })
    );
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: "Create budget" }));

    expect(await screen.findByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeDisabled();

    finishSaving({ id: "m-2", proposedActionStatus: "CONFIRMED" });
    await waitFor(() => expect(toastMock.success).toHaveBeenCalled());
  });

  it("keeps the draft pending and shows the server's reason when saving fails", async () => {
    apiMock.confirmProposedChatAction.mockRejectedValue(new Error("Account not found"));
    const { onStatusChange } = renderCard();

    fireEvent.click(screen.getByRole("button", { name: "Create budget" }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith("Account not found"));
    expect(onStatusChange).not.toHaveBeenCalled();
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Create budget" })).toBeEnabled();
  });

  it("dismisses the draft without saving anything or toasting a success", async () => {
    const { onStatusChange } = renderCard();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    await waitFor(() => expect(onStatusChange).toHaveBeenCalledWith("m-2", "DISMISSED"));
    expect(apiMock.dismissProposedChatAction).toHaveBeenCalledWith("m-2");
    expect(apiMock.confirmProposedChatAction).not.toHaveBeenCalled();
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it("tells the user when the draft could not be dismissed", async () => {
    apiMock.dismissProposedChatAction.mockRejectedValue(
      new Error("This suggestion has already been saved")
    );
    const { onStatusChange } = renderCard();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith("This suggestion has already been saved")
    );
    expect(onStatusChange).not.toHaveBeenCalled();
  });

  it("shows a saved draft as a record with a link to where it now lives", () => {
    renderCard({ status: "CONFIRMED" });

    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View budgets" })).toHaveAttribute("href", "/budgets");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows a dismissed draft as a record that can no longer be saved", () => {
    renderCard({ status: "DISMISSED" });

    expect(screen.getByText("Dismissed — nothing was saved.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
