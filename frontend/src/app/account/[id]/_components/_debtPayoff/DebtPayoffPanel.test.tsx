import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DebtPayoffPanel } from "./DebtPayoffPanel";
import type { Account } from "@/lib/api";

// The chart wraps recharts; stub it so the panel's own logic is what's under test.
vi.mock("./DebtPayoffChart", () => ({ DebtPayoffChart: () => <div data-testid="payoff-chart" /> }));

/** Builds a CREDIT Account fixture with the given balance. */
function makeAccount(balance: number): Account {
  return {
    id: "a-1",
    ownerName: "Test",
    nickname: null,
    accountType: "CREDIT",
    balance,
    frozen: false,
    isLinked: false,
    plaidAccountId: null,
    plaidItemId: null,
    institutionName: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("DebtPayoffPanel", () => {
  it("shows a paid-off message when there is no balance", () => {
    render(<DebtPayoffPanel account={makeAccount(0)} />);
    expect(screen.getByText(/No outstanding balance/)).toBeInTheDocument();
    expect(screen.queryByText("Payoff Scenarios")).not.toBeInTheDocument();
  });

  it("shows the balance and minimum-payment scenario for an outstanding balance", () => {
    render(<DebtPayoffPanel account={makeAccount(3000)} />);
    expect(screen.getByText("$3,000.00")).toBeInTheDocument();
    expect(screen.getByText("Minimum payment")).toBeInTheDocument();
    // Before a payment is entered, the comparison rows are replaced by a prompt.
    expect(screen.getByText(/Enter your monthly payment above/)).toBeInTheDocument();
    expect(screen.queryByText("Your payment")).not.toBeInTheDocument();
  });

  it("adds the user and boosted scenarios once a valid payment is entered", () => {
    render(<DebtPayoffPanel account={makeAccount(3000)} />);

    fireEvent.change(screen.getByLabelText("Monthly Payment"), { target: { value: "300" } });

    expect(screen.getByText("Your payment")).toBeInTheDocument();
    expect(screen.getByText("+$50/month")).toBeInTheDocument();
    expect(screen.queryByText(/Enter your monthly payment above/)).not.toBeInTheDocument();
  });

  it("surfaces a savings callout when paying more than the minimum", () => {
    render(<DebtPayoffPanel account={makeAccount(3000)} />);

    // Minimum on $3,000 is $60; paying $500 saves both months and interest.
    fireEvent.change(screen.getByLabelText("Monthly Payment"), { target: { value: "500" } });

    expect(screen.getByText(/saves/)).toBeInTheDocument();
    expect(screen.getByText(/sooner/)).toBeInTheDocument();
  });

  it("labels the infeasible case when the payment cannot cover interest", () => {
    render(<DebtPayoffPanel account={makeAccount(3000)} />);

    fireEvent.change(screen.getByLabelText("Interest Rate (APR)"), { target: { value: "24" } });
    // $3,000 at 24% APR accrues $60/mo interest; a $10 payment can never reduce principal.
    // (The $60 minimum payment is exactly the interest, so it is infeasible too.)
    fireEvent.change(screen.getByLabelText("Monthly Payment"), { target: { value: "10" } });

    expect(screen.getAllByText(/debt will grow, not shrink/).length).toBeGreaterThan(0);
  });
});
