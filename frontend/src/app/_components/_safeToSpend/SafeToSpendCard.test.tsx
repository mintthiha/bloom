import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SafeToSpendCard } from "./SafeToSpendCard";
import type { Account } from "@/lib/api";

vi.mock("@/components/dashboard-visibility-provider", () => ({
  useDashboardVisibility: () => ({ allCollapsed: false }),
}));

describe("SafeToSpendCard", () => {
  it("renders the card header and headline badge", () => {
    render(
      <SafeToSpendCard
        accounts={[{ id: "a-1", accountType: "CHEQUING", balance: 5000 } as Account]}
        recurringRules={[]}
      />
    );

    expect(screen.getByText("Safe to Spend")).toBeInTheDocument();
    expect(screen.getByText("What's free to spend this month")).toBeInTheDocument();
  });

  it("shows the per-day breakdown when there is money free to spend", () => {
    render(
      <SafeToSpendCard
        accounts={[{ id: "a-1", accountType: "CHEQUING", balance: 5000 } as Account]}
        recurringRules={[]}
      />
    );

    expect(screen.getByText(/a day for the/)).toBeInTheDocument();
    expect(screen.getByText(/left\s*this month/)).toBeInTheDocument();
  });
});
