import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GoalList } from "./GoalList";
import type { SavingsGoal } from "@/lib/api";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    listSavingsGoals: vi.fn(),
    deleteSavingsGoal: vi.fn(),
  },
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: {
      ...actual.api,
      listSavingsGoals: apiMock.listSavingsGoals,
      deleteSavingsGoal: apiMock.deleteSavingsGoal,
    },
  };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

// Stub the child dialog so these tests exercise GoalList's own logic, not the form.
vi.mock("./GoalFormDialog", () => ({
  GoalFormDialog: ({
    goal,
    onClose,
  }: {
    goal: SavingsGoal | null;
    onClose: () => void;
    onSaved: (g: SavingsGoal) => void;
  }) => (
    <div data-testid="goal-form-dialog">
      <span>{goal ? "editing" : "creating"}</span>
      <button type="button" onClick={onClose}>
        close-form
      </button>
    </div>
  ),
}));

import { toast } from "sonner";

/** Builds a SavingsGoal fixture; override only what a test needs. */
function makeGoal(overrides: Partial<SavingsGoal> = {}): SavingsGoal {
  return {
    id: "g-1",
    userId: "u-1",
    accountId: "a-1",
    name: "Emergency Fund",
    targetAmount: 5000,
    currentBalance: 2500,
    accountName: "Rainy Day",
    accountNickname: null,
    accountOwnerName: "Test User",
    accountType: "SAVINGS",
    percentageReached: 50,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GoalList", () => {
  it("shows an empty state when there are no goals", async () => {
    apiMock.listSavingsGoals.mockResolvedValue([]);

    render(<GoalList />);

    expect(await screen.findByText("No savings goals yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add your first goal" })).toBeInTheDocument();
  });

  it("renders a card per goal with progress and a reached badge", async () => {
    apiMock.listSavingsGoals.mockResolvedValue([
      makeGoal({ id: "g-1", name: "Emergency Fund", percentageReached: 50 }),
      makeGoal({ id: "g-2", name: "New Car", percentageReached: 100, currentBalance: 5000 }),
    ]);

    render(<GoalList />);

    expect(await screen.findByText("Emergency Fund")).toBeInTheDocument();
    expect(screen.getByText("New Car")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("Goal reached!")).toBeInTheDocument();
  });

  it("surfaces a toast when loading fails", async () => {
    apiMock.listSavingsGoals.mockRejectedValue(new Error("boom"));

    render(<GoalList />);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("boom"));
  });

  it("opens the form in create mode from the header button", async () => {
    apiMock.listSavingsGoals.mockResolvedValue([]);

    render(<GoalList />);
    await screen.findByText("No savings goals yet");

    fireEvent.click(screen.getByRole("button", { name: "+ New goal" }));

    const dialog = screen.getByTestId("goal-form-dialog");
    expect(within(dialog).getByText("creating")).toBeInTheDocument();
  });

  it("opens the form in edit mode from a card's Edit button", async () => {
    apiMock.listSavingsGoals.mockResolvedValue([makeGoal()]);

    render(<GoalList />);
    await screen.findByText("Emergency Fund");

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const dialog = screen.getByTestId("goal-form-dialog");
    expect(within(dialog).getByText("editing")).toBeInTheDocument();
  });

  it("confirms and deletes a goal, then removes it and toasts success", async () => {
    apiMock.listSavingsGoals.mockResolvedValue([makeGoal({ name: "Emergency Fund" })]);
    apiMock.deleteSavingsGoal.mockResolvedValue(undefined);

    render(<GoalList />);
    await screen.findByText("Emergency Fund");

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    // The AlertDialog opens with its own "Delete" action; both the card and dialog buttons
    // match, and the dialog action is the last one rendered.
    await screen.findByText("Delete goal?");
    const deleteButtons = screen.getAllByRole("button", { name: /^Delete$/ });
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);

    await waitFor(() => expect(apiMock.deleteSavingsGoal).toHaveBeenCalledWith("g-1"));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Goal deleted."));
    await waitFor(() => expect(screen.queryByText("Emergency Fund")).not.toBeInTheDocument());
  });
});
