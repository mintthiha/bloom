import { render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GoalWidget } from "./GoalWidget";
import type { SavingsGoal } from "@/lib/api";

const { routerMock } = vi.hoisted(() => ({ routerMock: { push: vi.fn() } }));

vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));

const STORAGE_KEY = "bloom_goal_widget_id";

/** Builds a SavingsGoal fixture; override only what a test needs. */
function makeGoal(overrides: Partial<SavingsGoal> = {}): SavingsGoal {
  return {
    id: "g-1",
    userId: "u-1",
    accountId: "a-1",
    name: "Emergency Fund",
    targetAmount: 5000,
    targetDate: null,
    icon: null,
    color: null,
    note: null,
    currentBalance: 2500,
    accountName: "Savings",
    accountNickname: null,
    accountOwnerName: "Alex",
    accountType: "TFSA",
    percentageReached: 50,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  localStorage.clear();
});

describe("GoalWidget", () => {
  it("shows an empty state and routes to /goals from 'Set a goal'", () => {
    render(<GoalWidget goals={[]} />);
    expect(screen.getByText("No goals yet")).toBeInTheDocument();
    expect(screen.getByText("0 saved")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Set a goal" }));
    expect(routerMock.push).toHaveBeenCalledWith("/goals");
  });

  it("renders the selected goal's name, progress, and balances", () => {
    render(<GoalWidget goals={[makeGoal()]} />);
    expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    // The two amounts are each wrapped in their own span (for privacy-mode blurring), so the
    // text is split across elements — match on the containing span's combined textContent.
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === "SPAN" && element.textContent === "$2,500.00 of $5,000.00"
      )
    ).toBeInTheDocument();
    expect(screen.getByText("1 saved")).toBeInTheDocument();
  });

  it("shows the pace needed to hit the target date, and the goal's emoji", () => {
    // The target date is far enough out to stay in the monthly branch whenever this runs; the
    // exact figure for a given day is covered in goal-pace.test.ts, which injects `today`.
    const targetDate = `${new Date().getUTCFullYear() + 3}-06-30`;
    render(
      <GoalWidget
        goals={[makeGoal({ currentBalance: 2000, targetAmount: 5000, targetDate, icon: "✈️" })]}
      />
    );

    expect(
      screen.getByText(/^Save \$[\d,]+\.\d{2}\/month to make it by Jun \d{4}\.$/)
    ).toBeInTheDocument();
    expect(screen.getByText("✈️")).toBeInTheDocument();
  });

  it("drops the pace line once the goal is reached", () => {
    render(<GoalWidget goals={[makeGoal({ percentageReached: 100, currentBalance: 5000 })]} />);

    expect(screen.queryByText(/nothing left to save/)).not.toBeInTheDocument();
  });

  it("marks a completed goal", () => {
    render(<GoalWidget goals={[makeGoal({ percentageReached: 100, currentBalance: 5000 })]} />);
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("Goal reached!")).toBeInTheDocument();
  });

  it("seeds the selection from localStorage when the stored goal still exists", () => {
    localStorage.setItem(STORAGE_KEY, "g-2");
    const goals = [
      makeGoal({ id: "g-1", name: "Emergency Fund" }),
      makeGoal({ id: "g-2", name: "Vacation" }),
    ];
    render(<GoalWidget goals={goals} />);
    expect(screen.getByLabelText("Pinned savings goal")).toHaveValue("g-2");
  });

  it("falls back to the first goal when the stored id is stale", () => {
    localStorage.setItem(STORAGE_KEY, "g-999");
    const goals = [makeGoal({ id: "g-1", name: "Emergency Fund" }), makeGoal({ id: "g-2" })];
    render(<GoalWidget goals={goals} />);
    expect(screen.getByLabelText("Pinned savings goal")).toHaveValue("g-1");
  });

  it("persists a new selection and updates the preview", () => {
    const goals = [
      makeGoal({ id: "g-1", name: "Emergency Fund", percentageReached: 50 }),
      makeGoal({ id: "g-2", name: "Vacation", percentageReached: 80 }),
    ];
    render(<GoalWidget goals={goals} />);

    fireEvent.change(screen.getByLabelText("Pinned savings goal"), { target: { value: "g-2" } });

    expect(localStorage.getItem(STORAGE_KEY)).toBe("g-2");
    expect(screen.getByText("80%")).toBeInTheDocument();
  });

  it("does not render the selector for a single goal", () => {
    render(<GoalWidget goals={[makeGoal()]} />);
    expect(screen.queryByLabelText("Pinned savings goal")).not.toBeInTheDocument();
  });
});
