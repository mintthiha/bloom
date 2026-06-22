import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingChecklist } from "./OnboardingChecklist";
import type { Account, Budget, MonthlySummary, SavingsGoal } from "@/lib/api";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    onClick,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

const sampleAccount: Account = {
  id: "account-1",
  ownerName: "Jane Doe",
  nickname: "Main",
  accountType: "CHEQUING",
  balance: 1200,
  frozen: false,
  isLinked: false,
  plaidAccountId: null,
  plaidItemId: null,
  institutionName: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const sampleBudget: Budget = {
  id: "budget-1",
  userId: "user-1",
  category: "Dining",
  monthlyLimit: 300,
  currentSpending: 100,
  remaining: 200,
  percentageUsed: 33,
  isOverBudget: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const sampleGoal: SavingsGoal = {
  id: "goal-1",
  userId: "user-1",
  accountId: "account-1",
  name: "Emergency Fund",
  targetAmount: 5000,
  currentBalance: 1000,
  accountName: "Savings",
  accountNickname: null,
  accountOwnerName: "Jane Doe",
  accountType: "SAVINGS",
  percentageReached: 20,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const sampleMonthlySummary: MonthlySummary = {
  month: "2026-05",
  income: 3000,
  spending: 500,
  netCashFlow: 2500,
  topExpenseCategory: "Dining",
  categories: [{ category: "Dining", income: 0, spending: 500 }],
};

const emptyMonthlySummary: MonthlySummary = {
  month: "2026-05",
  income: 0,
  spending: 0,
  netCashFlow: 0,
  topExpenseCategory: null,
  categories: [],
};

describe("OnboardingChecklist", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the checklist heading and progress indicator for a brand-new user", () => {
    render(<OnboardingChecklist accounts={[]} budgets={[]} goals={[]} monthlySummary={null} />);

    expect(screen.getByText("Get started with Bloom")).toBeInTheDocument();
    // Only profile-setup is complete for a user with no data
    expect(screen.getByText("1 of 6 done")).toBeInTheDocument();
    expect(screen.getByText("Add your first account")).toBeInTheDocument();
    expect(screen.getByText("Set up a budget")).toBeInTheDocument();
    expect(screen.getByText("Explore the Learn page")).toBeInTheDocument();
  });

  it("counts completed steps correctly from prop data", () => {
    render(
      <OnboardingChecklist
        accounts={[sampleAccount]}
        budgets={[sampleBudget]}
        goals={[]}
        monthlySummary={sampleMonthlySummary}
      />
    );

    // profile + account + transaction + budget = 4 complete; goal and learn still pending
    expect(screen.getByText("4 of 6 done")).toBeInTheDocument();
    expect(screen.getByText("Create a savings goal")).toBeInTheDocument();
    expect(screen.getByText("Explore the Learn page")).toBeInTheDocument();
  });

  it("marks the transaction step complete when monthlySummary has spending", () => {
    render(
      <OnboardingChecklist
        accounts={[sampleAccount]}
        budgets={[]}
        goals={[]}
        monthlySummary={sampleMonthlySummary}
      />
    );

    // profile + account + transaction = 3 done; budget, goal, learn still pending
    expect(screen.getByText("3 of 6 done")).toBeInTheDocument();
  });

  it("does not mark the transaction step complete when monthlySummary has no income or spending", () => {
    render(
      <OnboardingChecklist
        accounts={[sampleAccount]}
        budgets={[]}
        goals={[]}
        monthlySummary={emptyMonthlySummary}
      />
    );

    // profile + account = 2 done
    expect(screen.getByText("2 of 6 done")).toBeInTheDocument();
  });

  it("does not render when all six steps are complete", () => {
    localStorage.setItem("bloom_onboarding_learn_explored", "true");

    render(
      <OnboardingChecklist
        accounts={[sampleAccount]}
        budgets={[sampleBudget]}
        goals={[sampleGoal]}
        monthlySummary={sampleMonthlySummary}
      />
    );

    expect(screen.queryByText("Get started with Bloom")).not.toBeInTheDocument();
  });

  it("hides the checklist and persists the dismissal flag to localStorage when dismissed", () => {
    render(<OnboardingChecklist accounts={[]} budgets={[]} goals={[]} monthlySummary={null} />);

    expect(screen.getByText("Get started with Bloom")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss onboarding checklist" }));

    expect(screen.queryByText("Get started with Bloom")).not.toBeInTheDocument();
    expect(localStorage.getItem("bloom_onboarding_dismissed")).toBe("true");
  });

  it("does not render when the dismissal flag is already set in localStorage", () => {
    localStorage.setItem("bloom_onboarding_dismissed", "true");

    render(<OnboardingChecklist accounts={[]} budgets={[]} goals={[]} monthlySummary={null} />);

    expect(screen.queryByText("Get started with Bloom")).not.toBeInTheDocument();
  });

  it("counts the Learn page step as complete when the explored flag is set in localStorage", () => {
    localStorage.setItem("bloom_onboarding_learn_explored", "true");

    render(
      <OnboardingChecklist
        accounts={[sampleAccount]}
        budgets={[sampleBudget]}
        goals={[]}
        monthlySummary={sampleMonthlySummary}
      />
    );

    // profile + account + transaction + budget + learn = 5 done; only goal remaining
    expect(screen.getByText("5 of 6 done")).toBeInTheDocument();
  });

  it("sets the Learn-explored flag in localStorage when the Learn page step link is clicked", () => {
    render(<OnboardingChecklist accounts={[]} budgets={[]} goals={[]} monthlySummary={null} />);

    fireEvent.click(screen.getByText("Explore the Learn page"));

    expect(localStorage.getItem("bloom_onboarding_learn_explored")).toBe("true");
  });
});
