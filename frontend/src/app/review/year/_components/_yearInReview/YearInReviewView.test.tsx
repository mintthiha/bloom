import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { YearInReview } from "@/lib/api";
import { YearInReviewView } from "./YearInReviewView";

const { apiMock, toastMock } = vi.hoisted(() => ({
  apiMock: { getYearInReview: vi.fn() },
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { ...actual.api, ...apiMock } };
});
vi.mock("sonner", () => ({ toast: toastMock }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}));

/** A year-to-date recap with every highlight present. */
function makeRecap(overrides: Partial<YearInReview> = {}): YearInReview {
  return {
    year: 2026,
    isYearComplete: false,
    hasActivity: true,
    totals: {
      income: 30000,
      spending: 24000,
      netSaved: 6000,
      savingsRate: 0.2,
      transactionCount: 450,
    },
    months: Array.from({ length: 12 }, (_, index) => ({
      month: `2026-${String(index + 1).padStart(2, "0")}`,
      income: 3000,
      spending: 2400,
    })),
    bestSavingMonth: { month: "2026-03", netSaved: 1200 },
    highestSpendingMonth: { month: "2026-08", spending: 3100 },
    activeMonthCount: 10,
    topCategories: [{ category: "Rent", spending: 14500, shareOfSpending: 0.6 }],
    biggestExpense: null,
    topMerchant: { label: "Tim Hortons", visitCount: 41, spending: 184 },
    reviewsCompleted: 2,
    goalsReached: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("YearInReviewView", () => {
  it("shows the year-to-date title, totals, and highlights", async () => {
    apiMock.getYearInReview.mockResolvedValue(makeRecap());
    render(<YearInReviewView year={2026} />);

    expect(await screen.findByRole("heading", { name: "2026 so far" })).toBeInTheDocument();
    expect(apiMock.getYearInReview).toHaveBeenCalledWith(2026, expect.any(String));
    expect(screen.getByText("20% of income")).toBeInTheDocument();
    expect(screen.getByText("Tim Hortons")).toBeInTheDocument();
    expect(screen.getByText("Most visited")).toBeInTheDocument();
    expect(screen.queryByText("Net worth")).not.toBeInTheDocument();
    expect(screen.getByText(/Year to date/)).toBeInTheDocument();
  });

  it("titles a finished year 'in Bloom'", async () => {
    apiMock.getYearInReview.mockResolvedValue(makeRecap({ isYearComplete: true }));
    render(<YearInReviewView year={2026} />);
    expect(await screen.findByRole("heading", { name: "2026 in Bloom" })).toBeInTheDocument();
  });

  it("includes a table view of the monthly chart", async () => {
    apiMock.getYearInReview.mockResolvedValue(makeRecap());
    render(<YearInReviewView year={2026} />);
    const table = await screen.findByRole("table", { name: "Spending by month" });
    expect(table.querySelectorAll("tbody tr")).toHaveLength(12);
  });

  it("shows an empty state for a year with no activity", async () => {
    apiMock.getYearInReview.mockResolvedValue(makeRecap({ hasActivity: false }));
    render(<YearInReviewView year={2026} />);
    expect(await screen.findByText("Nothing recorded in 2026 yet")).toBeInTheDocument();
  });

  it("copies the recap text and confirms with a toast", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    apiMock.getYearInReview.mockResolvedValue(makeRecap());
    render(<YearInReviewView year={2026} />);

    fireEvent.click(await screen.findByRole("button", { name: "Copy recap" }));

    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Recap copied"));
    expect(writeText.mock.calls[0]![0]).toMatch(/^2026 so far/);
  });

  it("explains when the clipboard is blocked", async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    apiMock.getYearInReview.mockResolvedValue(makeRecap());
    render(<YearInReviewView year={2026} />);

    fireEvent.click(await screen.findByRole("button", { name: "Copy recap" }));

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith(
        "Couldn't copy — your browser blocked clipboard access"
      )
    );
  });
});
