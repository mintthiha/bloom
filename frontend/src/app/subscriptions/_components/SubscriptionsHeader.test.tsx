import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SubscriptionsHeader } from "./SubscriptionsHeader";
import type { SubscriptionSummary } from "@/lib/api";

// Render the animated figure as its final value so assertions don't race the count-up animation.
vi.mock("@/components/animated-currency", () => ({
  AnimatedCurrency: ({ value }: { value: number }) => <>{`$${value.toFixed(2)}`}</>,
}));

/** Builds a SubscriptionSummary fixture. */
function makeSummary(overrides: Partial<SubscriptionSummary> = {}): SubscriptionSummary {
  return { monthlyTotal: 42.5, annualTotal: 510, count: 3, subscriptions: [], ...overrides };
}

describe("SubscriptionsHeader", () => {
  it("headlines the monthly total", () => {
    render(<SubscriptionsHeader summary={makeSummary()} />);
    expect(screen.getByText(/You spend \$42\.50\/mo on subscriptions/)).toBeInTheDocument();
  });

  it("shows the annual total and count", () => {
    render(<SubscriptionsHeader summary={makeSummary()} />);
    expect(screen.getByText("$510.00")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("subscriptions")).toBeInTheDocument();
  });

  it("uses the singular noun for a single subscription", () => {
    render(<SubscriptionsHeader summary={makeSummary({ count: 1 })} />);
    expect(screen.getByText("subscription")).toBeInTheDocument();
    expect(screen.queryByText("subscriptions")).not.toBeInTheDocument();
  });
});
