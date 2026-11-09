import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MonthlyReview } from "@/lib/api";
import { MonthlyReviewView } from "./MonthlyReviewView";

const { apiMock, toastMock } = vi.hoisted(() => ({
  apiMock: {
    getMonthlyReview: vi.fn(),
    completeMonthlyReview: vi.fn(),
    setBudgetMonthLimit: vi.fn(),
    setBudgetRollover: vi.fn(),
  },
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { ...actual.api, ...apiMock } };
});
vi.mock("sonner", () => ({ toast: toastMock }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const novemberFourth = new Date(2026, 10, 4, 12);

/** A full October review with a budget and a goal; override what each test needs. */
function makeReview(overrides: Partial<MonthlyReview> = {}): MonthlyReview {
  return {
    month: "2026-10",
    previousMonth: "2026-09",
    nextMonth: "2026-11",
    hasActivity: true,
    completedAt: null,
    reviewStreak: 0,
    cashFlow: {
      income: 3000,
      spending: 2400,
      netCashFlow: 600,
      savingsRate: 0.2,
      transactionCount: 14,
      previousIncome: 3000,
      previousSpending: 2000,
      spendingChangePercent: 0.2,
    },
    topCategories: [
      {
        category: "Rent",
        spending: 1450,
        previousSpending: 1450,
        changePercent: 0,
        shareOfSpending: 0.6,
      },
    ],
    biggestExpense: {
      label: "RENT OCT",
      amount: 1450,
      category: "Rent",
      effectiveAt: "2026-10-02",
    },
    budgetResults: { total: 1, keptCount: 1, overCount: 0 },
    budgets: [
      {
        id: "b-groceries",
        category: "Groceries",
        limit: 400,
        available: 400,
        spent: 350,
        remaining: 50,
        isOverBudget: false,
        rolloverEnabled: true,
        carryOut: 50,
        nextMonthLimit: 400,
        templateLimit: 400,
      },
    ],
    goals: [
      {
        id: "g-1",
        name: "Emergency fund",
        targetAmount: 1000,
        balanceAtStart: 400,
        balanceAtEnd: 650,
        contributed: 250,
        percentAtEnd: 0.65,
        isReached: false,
        wasReachedThisMonth: false,
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MonthlyReviewView", () => {
  it("loads the month in the viewer's time zone and opens on the numbers", async () => {
    apiMock.getMonthlyReview.mockResolvedValue(makeReview());
    render(<MonthlyReviewView month="2026-10" now={novemberFourth} />);

    expect(await screen.findByRole("heading", { name: "How October went" })).toBeInTheDocument();
    expect(apiMock.getMonthlyReview).toHaveBeenCalledWith("2026-10", expect.any(String));
    expect(screen.getByText("You kept 20% of what came in.")).toBeInTheDocument();
    expect(screen.getByText("20% more than September")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 5")).toBeInTheDocument();
  });

  it("shows an empty state for a month with nothing recorded", async () => {
    apiMock.getMonthlyReview.mockResolvedValue(makeReview({ hasActivity: false }));
    render(<MonthlyReviewView month="2026-10" now={novemberFourth} />);

    expect(await screen.findByText("Nothing recorded in October")).toBeInTheDocument();
    expect(screen.queryByText(/Step 1 of/)).not.toBeInTheDocument();
  });

  it("skips steps with nothing to show", async () => {
    apiMock.getMonthlyReview.mockResolvedValue(makeReview({ budgets: [], goals: [] }));
    render(<MonthlyReviewView month="2026-10" now={novemberFourth} />);

    expect(await screen.findByText("Step 1 of 3")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Budgets" })).not.toBeInTheDocument();
  });

  it("walks forward and back through the steps", async () => {
    apiMock.getMonthlyReview.mockResolvedValue(makeReview());
    render(<MonthlyReviewView month="2026-10" now={novemberFourth} />);

    fireEvent.click(await screen.findByRole("button", { name: "Next: Where it went →" }));
    expect(
      screen.getByRole("heading", { name: "Rent was your biggest category" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next: Budgets →" }));
    expect(screen.getByText("You stayed within your budget.")).toBeInTheDocument();
    expect(screen.getByText("$50.00 rolls into November")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "← Back" }));
    expect(
      screen.getByRole("heading", { name: "Rent was your biggest category" })
    ).toBeInTheDocument();
  });

  it("jumps straight to a step from the progress row", async () => {
    apiMock.getMonthlyReview.mockResolvedValue(makeReview());
    render(<MonthlyReviewView month="2026-10" now={novemberFourth} />);

    fireEvent.click(await screen.findByRole("button", { name: "Goals" }));
    expect(
      screen.getByRole("heading", { name: "You put $250.00 toward your goals" })
    ).toBeInTheDocument();
    expect(screen.getByText("65% there · Added $250.00")).toBeInTheDocument();
  });

  it("sets next month's limit only and reloads the review", async () => {
    apiMock.getMonthlyReview
      .mockResolvedValueOnce(makeReview())
      .mockResolvedValueOnce(
        makeReview({ budgets: [{ ...makeReview().budgets[0]!, nextMonthLimit: 450 }] })
      );
    apiMock.setBudgetMonthLimit.mockResolvedValue({});
    render(<MonthlyReviewView month="2026-10" now={novemberFourth} />);

    fireEvent.click(await screen.findByRole("button", { name: "Budgets" }));
    fireEvent.click(screen.getByRole("button", { name: "Change Groceries limit for November" }));
    fireEvent.change(screen.getByLabelText("November limit"), { target: { value: "450" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(apiMock.setBudgetMonthLimit).toHaveBeenCalledWith("b-groceries", "2026-11", 450)
    );
    expect(toastMock.success).toHaveBeenCalledWith("Groceries set to $450.00 for November");
    expect(
      await screen.findByRole("button", { name: "Change Groceries limit for November" })
    ).toHaveTextContent("$450.00");
  });

  it("rejects a zero limit without calling the API", async () => {
    apiMock.getMonthlyReview.mockResolvedValue(makeReview());
    render(<MonthlyReviewView month="2026-10" now={novemberFourth} />);

    fireEvent.click(await screen.findByRole("button", { name: "Budgets" }));
    fireEvent.click(screen.getByRole("button", { name: "Change Groceries limit for November" }));
    fireEvent.change(screen.getByLabelText("November limit"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(toastMock.error).toHaveBeenCalledWith("Enter a limit greater than zero");
    expect(apiMock.setBudgetMonthLimit).not.toHaveBeenCalled();
  });

  it("finishes the review, confirms with a toast, and shows the streak", async () => {
    apiMock.getMonthlyReview.mockResolvedValue(makeReview());
    apiMock.completeMonthlyReview.mockResolvedValue({
      month: "2026-10",
      completedAt: "2026-11-04T12:00:00.000Z",
      reviewStreak: 3,
    });
    render(<MonthlyReviewView month="2026-10" now={novemberFourth} />);

    fireEvent.click(await screen.findByRole("button", { name: "Wrap up" }));
    fireEvent.click(screen.getByRole("button", { name: "Finish October review" }));

    await waitFor(() => expect(apiMock.completeMonthlyReview).toHaveBeenCalledWith("2026-10"));
    expect(toastMock.success).toHaveBeenCalledWith("October review complete");
    expect(await screen.findByRole("heading", { name: "October is reviewed" })).toBeInTheDocument();
    expect(screen.getAllByText("3-month review streak").length).toBeGreaterThan(0);
    expect(screen.getByText("✓ Reviewed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Finish October review" })).not.toBeInTheDocument();
  });

  it("keeps the finish button and shows an error toast when saving fails", async () => {
    apiMock.getMonthlyReview.mockResolvedValue(makeReview());
    apiMock.completeMonthlyReview.mockRejectedValue(new Error("server down"));
    render(<MonthlyReviewView month="2026-10" now={novemberFourth} />);

    fireEvent.click(await screen.findByRole("button", { name: "Wrap up" }));
    fireEvent.click(screen.getByRole("button", { name: "Finish October review" }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith("server down"));
    expect(screen.getByRole("button", { name: "Finish October review" })).toBeInTheDocument();
  });

  it("links to the neighbouring months but not past the current month", async () => {
    apiMock.getMonthlyReview.mockResolvedValue(makeReview({ month: "2026-11" }));
    render(<MonthlyReviewView month="2026-11" now={novemberFourth} />);

    expect(await screen.findByRole("link", { name: "← October" })).toHaveAttribute(
      "href",
      "/review?month=2026-10"
    );
    expect(screen.queryByRole("link", { name: "December →" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "2026 in Bloom ✦" })).toHaveAttribute(
      "href",
      "/review/year?year=2026"
    );
  });
});
