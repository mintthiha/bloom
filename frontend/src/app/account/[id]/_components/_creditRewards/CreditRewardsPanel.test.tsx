import { render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreditRewardsPanel } from "./CreditRewardsPanel";
import type { Transaction } from "@/lib/api";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

// Stub the custom-program form so these tests exercise the panel, not the form.
vi.mock("./CustomProgramForm", () => ({
  CustomProgramForm: () => <div data-testid="custom-program-form" />,
}));

// recharts renders nothing meaningful in jsdom; stub the pieces the panel uses.
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
  Cell: () => null,
}));

/** Builds a charge (DEPOSIT) transaction with a category and amount. */
function makeCharge(amount: number, category: string | null): Transaction {
  return { id: `t-${Math.random()}`, type: "DEPOSIT", amount, category } as Transaction;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("CreditRewardsPanel", () => {
  it("shows an empty message when there are no charges", () => {
    render(<CreditRewardsPanel txns={[]} />);
    expect(screen.getByText(/No charges in the current view/)).toBeInTheDocument();
  });

  it("ignores non-charge transactions when computing rewards", () => {
    const withdrawal = {
      id: "w-1",
      type: "WITHDRAWAL",
      amount: 100,
      category: "Groceries",
    } as Transaction;
    render(<CreditRewardsPanel txns={[withdrawal]} />);
    expect(screen.getByText(/No charges in the current view/)).toBeInTheDocument();
  });

  it("estimates total points for the default points program", () => {
    render(<CreditRewardsPanel txns={[makeCharge(100, "Groceries"), makeCharge(50, "Dining")]} />);
    // Default program "Basic Rewards" earns 1 pt/$ → 150 pts across $150 of charges.
    expect(screen.getByText("150 pts")).toBeInTheDocument();
    expect(screen.getByText(/2 charges · \$150\.00 spent/)).toBeInTheDocument();
  });

  it("switches to a dollar total when a cashback program is selected", () => {
    render(<CreditRewardsPanel txns={[makeCharge(200, "Groceries")]} />);

    fireEvent.change(screen.getByLabelText("Card Program"), { target: { value: "flat-cashback" } });

    // Flat 1.5% cash back on $200 = $3.00.
    expect(screen.getByText("$3.00")).toBeInTheDocument();
    expect(screen.getByText(/Cash Back by Category/)).toBeInTheDocument();
  });

  it("uses the singular noun for a single charge", () => {
    render(<CreditRewardsPanel txns={[makeCharge(40, "Transport")]} />);
    expect(screen.getByText(/1 charge · \$40\.00 spent/)).toBeInTheDocument();
  });
});
