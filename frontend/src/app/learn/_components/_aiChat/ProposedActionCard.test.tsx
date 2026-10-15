import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatActionProposal } from "@/lib/api";
import { ProposedActionCard } from "./ProposedActionCard";

const { apiMock, toastMock } = vi.hoisted(() => ({
  apiMock: {
    confirmProposedChatAction: vi.fn(),
    dismissProposedChatAction: vi.fn(),
    restoreSavingsGoal: vi.fn(),
  },
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/api", () => ({ api: apiMock }));
vi.mock("sonner", () => ({ toast: toastMock }));
vi.mock("@/components/ConfirmDeleteDialog", () => ({
  ConfirmDeleteDialog: ({
    open,
    onOpenChange,
    title,
    description,
    onConfirm,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    onConfirm: () => void;
  }) =>
    open ? (
      <div role="alertdialog">
        <p>{title}</p>
        <p>{description}</p>
        <button type="button" onClick={() => onOpenChange(false)}>
          Cancel
        </button>
        <button type="button" onClick={onConfirm}>
          Delete
        </button>
      </div>
    ) : null,
}));

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

  it("shows a goal change with only what changes, and toasts the update once confirmed", async () => {
    renderCard({
      proposedAction: {
        kind: "SAVINGS_GOAL_CHANGE",
        goalId: "goal-japan",
        currentName: "Japan trip",
        name: null,
        targetAmount: 4000,
        currentTargetAmount: 3000,
        targetDate: null,
        currentTargetDate: "2027-06-30",
        accountId: null,
        accountLabel: null,
        currentAccountLabel: "Rainy day (Savings)",
      },
    });

    expect(
      screen.getByRole("region", { name: "Savings goal change: Japan trip" })
    ).toBeInTheDocument();
    expect(screen.getByText("$4,000.00")).toBeInTheDocument();
    expect(screen.queryByText("Deadline")).not.toBeInTheDocument();
    expect(
      screen.getByText("Currently: target $3,000.00. Nothing else about the goal changes.")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Update goal" }));

    await waitFor(() =>
      expect(toastMock.success).toHaveBeenCalledWith('Goal "Japan trip" updated')
    );
    expect(apiMock.confirmProposedChatAction).toHaveBeenCalledWith("m-2");
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

describe("ProposedActionCard — deletions", () => {
  const PENDING_GOAL_DELETION: Partial<ChatActionProposal> = {
    proposedAction: {
      kind: "SAVINGS_GOAL_DELETION",
      goalId: "goal-japan",
      name: "Japan trip",
      targetAmount: 3000,
      targetDate: "2027-06-30",
      accountLabel: "Rainy day (Savings)",
    },
  };

  /** Opens the confirm dialog from the card and returns the dialog's Delete button. */
  async function openDeleteDialog() {
    fireEvent.click(screen.getByRole("button", { name: "Delete goal" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent('Delete "Japan trip"?');
    expect(dialog).toHaveTextContent(
      "This removes the $3,000.00 goal tracking Rainy day (Savings). The account and its " +
        "balance aren't affected."
    );
    return screen.getByRole("button", { name: "Delete" });
  }

  it("shows what would be deleted and deletes nothing when the card button is clicked", async () => {
    renderCard(PENDING_GOAL_DELETION);

    expect(
      screen.getByRole("region", { name: "Delete savings goal: Japan trip" })
    ).toBeInTheDocument();
    expect(screen.getByText("Jun 30, 2027")).toBeInTheDocument();
    await openDeleteDialog();

    expect(apiMock.confirmProposedChatAction).not.toHaveBeenCalled();
  });

  it("leaves the draft pending when the user cancels the dialog", async () => {
    const { onStatusChange } = renderCard(PENDING_GOAL_DELETION);
    await openDeleteDialog();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(apiMock.confirmProposedChatAction).not.toHaveBeenCalled();
    expect(onStatusChange).not.toHaveBeenCalled();
  });

  it("deletes once confirmed in the dialog, and toasts with an Undo that restores the goal", async () => {
    apiMock.restoreSavingsGoal.mockResolvedValue({ id: "goal-japan" });
    const { onStatusChange } = renderCard(PENDING_GOAL_DELETION);

    fireEvent.click(await openDeleteDialog());

    await waitFor(() => expect(onStatusChange).toHaveBeenCalledWith("m-2", "CONFIRMED"));
    expect(apiMock.confirmProposedChatAction).toHaveBeenCalledWith("m-2");
    expect(toastMock.success).toHaveBeenCalledWith(
      "Goal deleted",
      expect.objectContaining({ action: expect.objectContaining({ label: "Undo" }) })
    );

    const undo = toastMock.success.mock.calls[0]![1].action.onClick;
    await undo();

    expect(apiMock.restoreSavingsGoal).toHaveBeenCalledWith("goal-japan");
    expect(toastMock.success).toHaveBeenLastCalledWith("Goal restored");
  });

  it("keeps the draft pending and shows the server's reason when the delete fails", async () => {
    apiMock.confirmProposedChatAction.mockRejectedValue(new Error("Savings goal not found"));
    const { onStatusChange } = renderCard(PENDING_GOAL_DELETION);

    fireEvent.click(await openDeleteDialog());

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith("Savings goal not found"));
    expect(onStatusChange).not.toHaveBeenCalled();
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it("records a confirmed deletion as deleted, with a link to the goals page", () => {
    renderCard({ ...PENDING_GOAL_DELETION, status: "CONFIRMED" });
    expect(screen.getByText("Deleted")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View goals" })).toHaveAttribute("href", "/goals");
  });

  it("says nothing was deleted when a deletion was dismissed", () => {
    renderCard({ ...PENDING_GOAL_DELETION, status: "DISMISSED" });

    expect(screen.getByText("Dismissed — nothing was deleted.")).toBeInTheDocument();
  });
});
