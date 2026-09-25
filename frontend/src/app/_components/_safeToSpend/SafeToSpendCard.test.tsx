import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SafeToSpendCard } from "./SafeToSpendCard";
import type { Account, Profile, RecurringTransaction } from "@/lib/api";

vi.mock("@/components/dashboard-visibility-provider", () => ({
  useDashboardVisibility: () => ({ allCollapsed: false }),
}));

/** Builds a profile carrying only the pay-cycle fields the payday line reads. */
function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return { payFrequency: "BIWEEKLY", nextPayday: "2026-09-25", ...overrides } as Profile;
}

/** Builds an active monthly bill rule due on the given date. */
function makeBill(id: string, amount: number, nextRunAt: string): RecurringTransaction {
  return {
    id,
    name: id,
    type: "WITHDRAWAL",
    amount,
    frequency: "MONTHLY",
    nextRunAt,
    endDate: null,
    active: true,
    merchant: null,
  } as RecurringTransaction;
}

afterEach(() => {
  vi.useRealTimers();
});

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

  it("omits the payday line when no pay cycle is set up", () => {
    render(
      <SafeToSpendCard
        accounts={[{ id: "a-1", accountType: "CHEQUING", balance: 5000 } as Account]}
        recurringRules={[]}
        profile={makeProfile({ payFrequency: null, nextPayday: null })}
      />
    );

    expect(screen.queryByText(/Payday/)).not.toBeInTheDocument();
  });

  it("splits this month's bills around the next payday", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 20));

    render(
      <SafeToSpendCard
        accounts={[{ id: "a-1", accountType: "CHEQUING", balance: 5000 } as Account]}
        recurringRules={[
          makeBill("before", 200, "2026-09-22T00:00:00.000Z"),
          makeBill("after", 800, "2026-09-28T00:00:00.000Z"),
        ]}
        profile={makeProfile()}
      />
    );

    expect(screen.getByText(/Payday Fri, Sep 25 · in 5 days/)).toBeInTheDocument();
    expect(screen.getByText(/due before then/)).toBeInTheDocument();
    // $200 lands before payday, $800 after — the split that Safe to Spend alone can't show.
    const paydayLine = screen.getByText(/due before then/);
    expect(paydayLine).toHaveTextContent("$200.00");
    expect(paydayLine).toHaveTextContent("$800.00");
  });

  it("says so when there are no bills due at all", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 20));

    render(
      <SafeToSpendCard
        accounts={[{ id: "a-1", accountType: "CHEQUING", balance: 5000 } as Account]}
        recurringRules={[]}
        profile={makeProfile()}
      />
    );

    expect(screen.getByText("No bills due this month")).toBeInTheDocument();
  });
});
