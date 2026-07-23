import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SubscriptionsView } from "./SubscriptionsView";
import type { Subscription, SubscriptionSummary } from "@/lib/api";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getSubscriptions: vi.fn(),
  },
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: { ...actual.api, getSubscriptions: apiMock.getSubscriptions },
  };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

/** Builds a Subscription with defaults so each test overrides only the fields it needs. */
function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    merchant: "Netflix",
    cadence: "MONTHLY",
    currentPrice: 15.99,
    monthlyCost: 15.99,
    occurrences: 6,
    lastChargedAt: "2026-06-05T00:00:00.000Z",
    nextExpectedAt: "2026-07-05T00:00:00.000Z",
    source: "detected",
    priceChange: null,
    ...overrides,
  };
}

/** Builds a SubscriptionSummary wrapping the given subscriptions with matching totals. */
function makeSummary(subscriptions: Subscription[]): SubscriptionSummary {
  const monthlyTotal = subscriptions.reduce((sum, sub) => sum + sub.monthlyCost, 0);
  return {
    monthlyTotal,
    annualTotal: monthlyTotal * 12,
    count: subscriptions.length,
    subscriptions,
  };
}

beforeEach(() => {
  apiMock.getSubscriptions.mockReset();
});

describe("SubscriptionsView", () => {
  it("renders the monthly-spend headline once loaded", async () => {
    apiMock.getSubscriptions.mockResolvedValue(makeSummary([makeSubscription()]));

    render(<SubscriptionsView />);

    await waitFor(() =>
      expect(screen.getByText(/You spend .* on subscriptions/)).toBeInTheDocument()
    );
    expect(screen.getByText("Netflix")).toBeInTheDocument();
  });

  it("shows a price-increase flag when a subscription's price rose", async () => {
    apiMock.getSubscriptions.mockResolvedValue(
      makeSummary([
        makeSubscription({
          currentPrice: 12.99,
          monthlyCost: 12.99,
          priceChange: { from: 9.99, to: 12.99, pct: 30 },
        }),
      ])
    );

    render(<SubscriptionsView />);

    await waitFor(() => expect(screen.getByText("Netflix")).toBeInTheDocument());
    expect(screen.getByText("(+30%)")).toBeInTheDocument();
  });

  it("shows an empty state when nothing is detected", async () => {
    apiMock.getSubscriptions.mockResolvedValue(makeSummary([]));

    render(<SubscriptionsView />);

    await waitFor(() =>
      expect(screen.getByText("No subscriptions detected yet")).toBeInTheDocument()
    );
  });
});
