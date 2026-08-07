import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SubscriptionCard } from "./SubscriptionCard";
import type { Subscription } from "@/lib/api";

/** Builds a Subscription fixture; override only the fields a test cares about. */
function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    merchant: "Netflix",
    cadence: "MONTHLY",
    currentPrice: 16.49,
    monthlyCost: 16.49,
    occurrences: 6,
    lastChargedAt: "2026-07-05T00:00:00.000Z",
    nextExpectedAt: "2026-08-05T00:00:00.000Z",
    source: "detected",
    priceChange: null,
    ...overrides,
  };
}

describe("SubscriptionCard", () => {
  it("renders merchant, cadence label, and price with suffix", () => {
    render(<SubscriptionCard subscription={makeSubscription()} />);
    expect(screen.getByText("Netflix")).toBeInTheDocument();
    expect(screen.getByText("Monthly")).toBeInTheDocument();
    expect(screen.getByText(/\$16\.49/)).toBeInTheDocument();
    expect(screen.getByText("/mo")).toBeInTheDocument();
  });

  it("shows the monthly-equivalent cost only for non-monthly cadences", () => {
    render(
      <SubscriptionCard
        subscription={makeSubscription({ cadence: "ANNUAL", currentPrice: 120, monthlyCost: 10 })}
      />
    );
    expect(screen.getByText("Yearly")).toBeInTheDocument();
    expect(screen.getByText("/yr")).toBeInTheDocument();
    expect(screen.getByText("$10.00/mo")).toBeInTheDocument();
  });

  it("omits the monthly-equivalent line for monthly subscriptions", () => {
    render(<SubscriptionCard subscription={makeSubscription({ cadence: "MONTHLY" })} />);
    expect(screen.queryByText(/\/mo$/)).toBeInTheDocument(); // the suffix span
    expect(screen.queryByText(/\$16\.49\/mo/)).not.toBeInTheDocument();
  });

  it("renders a price-increase flag when priceChange is present", () => {
    render(
      <SubscriptionCard
        subscription={makeSubscription({ priceChange: { from: 14.99, to: 16.49, pct: 10 } })}
      />
    );
    expect(screen.getByText(/\$14\.99 → \$16\.49/)).toBeInTheDocument();
    expect(screen.getByText("(+10%)")).toBeInTheDocument();
  });

  it("shows the next expected charge date when known", () => {
    const nextExpectedAt = "2026-08-05T00:00:00.000Z";
    // Match the component's own formatting so the assertion is timezone/locale independent.
    const formatted = new Date(nextExpectedAt).toLocaleDateString("en-CA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    render(<SubscriptionCard subscription={makeSubscription({ nextExpectedAt })} />);
    expect(screen.getByText(`Next ~ ${formatted}`)).toBeInTheDocument();
  });

  it("falls back to a recurring-rule label when no next date is known", () => {
    render(<SubscriptionCard subscription={makeSubscription({ nextExpectedAt: null })} />);
    expect(screen.getByText("From recurring rule")).toBeInTheDocument();
  });

  it("marks subscriptions that match a recurring rule", () => {
    render(<SubscriptionCard subscription={makeSubscription({ source: "both" })} />);
    expect(screen.getByText("Matches rule")).toBeInTheDocument();
  });

  it("does not show the rule match badge for detection-only subscriptions", () => {
    render(<SubscriptionCard subscription={makeSubscription({ source: "detected" })} />);
    expect(screen.queryByText("Matches rule")).not.toBeInTheDocument();
  });
});
