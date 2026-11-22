import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Account, Budget, MonthlySummary } from "@/lib/api";
import { InsightsCard } from "./InsightsCard";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

/** Builds an Account of the given type and balance. */
function makeAccount(
  id: string,
  accountType: Account["accountType"],
  balance: number,
  nickname: string
): Account {
  return {
    id,
    ownerName: "Test Owner",
    nickname,
    accountType,
    balance,
    frozen: false,
    isLinked: false,
    plaidAccountId: null,
    plaidItemId: null,
    institutionName: null,
    color: null,
    icon: null,
    createdAt: "",
    updatedAt: "",
  };
}

/** Builds a MonthlySummary with the given income and spending. */
function makeSummary(income: number, spending: number): MonthlySummary {
  return {
    month: "2026-11",
    income,
    spending,
    netCashFlow: income - spending,
    topExpenseCategory: null,
    categories: [],
  };
}

/**
 * Renders the card with $1,500 cash, a Visa balance, and $1,000 of spending: the starter buffer is
 * done, card debt is the focus, and the emergency fund ($3,000 target) is still to come.
 */
function renderWithCardDebt(budgets: Budget[] = []) {
  render(
    <InsightsCard
      accounts={[
        makeAccount("chequing", "CHEQUING", 1500, "Everyday"),
        makeAccount("visa", "CREDIT", 1840, "Visa"),
      ]}
      budgets={budgets}
      monthlySummary={makeSummary(0, 1000)}
      previousMonthlySummary={null}
      recurringRules={[]}
      profile={null}
      goals={[]}
    />
  );
}

describe("InsightsCard", () => {
  it("shows the current ladder step with its numbers and a link to act on it", () => {
    renderWithCardDebt();

    expect(screen.getByText("Step 2 of 5")).toBeInTheDocument();
    expect(screen.getByText("Pay off $1,840 on Visa")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open Visa/ })).toHaveAttribute(
      "href",
      "/account/visa"
    );
    expect(screen.getByText("Then: Emergency fund")).toBeInTheDocument();
  });

  it("lists every ladder step with its status for screen readers", () => {
    renderWithCardDebt();

    expect(screen.getByText("Starter buffer: done")).toBeInTheDocument();
    expect(screen.getByText("Clear card debt: you are here")).toBeInTheDocument();
    expect(screen.getByText("Beyond the basics: up next")).toBeInTheDocument();
  });

  it("keeps this month's action items below the ladder", () => {
    renderWithCardDebt();

    expect(screen.getByText("This month")).toBeInTheDocument();
    // Spending with no budgets set → the no-budgets nudge.
    expect(screen.getByText("No budgets set yet")).toBeInTheDocument();
  });

  it("shows the all-clear state for this month when nothing needs attention", () => {
    render(
      <InsightsCard
        accounts={[makeAccount("chequing", "CHEQUING", 1500, "Everyday")]}
        budgets={[]}
        monthlySummary={makeSummary(0, 0)}
        previousMonthlySummary={null}
        recurringRules={[]}
        profile={null}
        goals={[]}
      />
    );

    expect(screen.getByText("All clear")).toBeInTheDocument();
  });
});
