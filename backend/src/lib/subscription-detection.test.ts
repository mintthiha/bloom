import { describe, expect, it } from "vitest";
import {
  detectSubscriptions,
  type SubscriptionCharge,
  type SubscriptionRule,
} from "./subscription-detection";

/** Builds a charge fixture, defaulting merchant/amount so tests state only what matters. */
function charge(date: string, amount = 15.99, merchant = "Netflix"): SubscriptionCharge {
  return { merchant, amount, date: new Date(date) };
}

/** Builds a list of monthly charges on the same day-of-month for `count` months from a start date. */
function monthlyCharges(
  startIso: string,
  count: number,
  amount = 15.99,
  merchant = "Netflix"
): SubscriptionCharge[] {
  const charges: SubscriptionCharge[] = [];
  const start = new Date(startIso);
  for (let index = 0; index < count; index += 1) {
    const date = new Date(start);
    date.setUTCMonth(start.getUTCMonth() + index);
    charges.push({ merchant, amount, date });
  }
  return charges;
}

describe("detectSubscriptions — cadence detection", () => {
  it("detects a clean monthly subscription", () => {
    const summary = detectSubscriptions(monthlyCharges("2026-01-05T00:00:00Z", 6), []);

    expect(summary.count).toBe(1);
    expect(summary.subscriptions[0].cadence).toBe("MONTHLY");
    expect(summary.subscriptions[0].currentPrice).toBe(15.99);
    expect(summary.subscriptions[0].monthlyCost).toBe(15.99);
    expect(summary.subscriptions[0].occurrences).toBe(6);
    expect(summary.subscriptions[0].source).toBe("detected");
  });

  it("detects a weekly subscription and normalizes it to a monthly cost", () => {
    const charges: SubscriptionCharge[] = [
      charge("2026-01-01T00:00:00Z", 5, "Coffee Club"),
      charge("2026-01-08T00:00:00Z", 5, "Coffee Club"),
      charge("2026-01-15T00:00:00Z", 5, "Coffee Club"),
      charge("2026-01-22T00:00:00Z", 5, "Coffee Club"),
    ];

    const summary = detectSubscriptions(charges, []);

    expect(summary.subscriptions[0].cadence).toBe("WEEKLY");
    // 5 * (52/12) ≈ 21.67
    expect(summary.subscriptions[0].monthlyCost).toBe(21.67);
  });

  it("detects an annual subscription", () => {
    const charges: SubscriptionCharge[] = [
      charge("2024-02-01T00:00:00Z", 99, "Amazon Prime"),
      charge("2025-02-01T00:00:00Z", 99, "Amazon Prime"),
      charge("2026-02-01T00:00:00Z", 99, "Amazon Prime"),
    ];

    const summary = detectSubscriptions(charges, []);

    expect(summary.subscriptions[0].cadence).toBe("ANNUAL");
    expect(summary.subscriptions[0].monthlyCost).toBe(8.25);
  });

  it("projects the next expected charge from the last charge plus the cadence interval", () => {
    const summary = detectSubscriptions(monthlyCharges("2026-01-05T00:00:00Z", 4), []);

    const next = summary.subscriptions[0].nextExpectedAt;
    const last = summary.subscriptions[0].lastChargedAt;
    expect(next).not.toBeNull();
    expect(last).not.toBeNull();
    // MONTHLY interval is 30 days after the last charge.
    expect((next as Date).getTime() - (last as Date).getTime()).toBe(30 * 24 * 60 * 60 * 1000);
  });
});

describe("detectSubscriptions — rejection rules", () => {
  it("rejects merchants with fewer than three charges", () => {
    const charges = monthlyCharges("2026-01-05T00:00:00Z", 2);

    expect(detectSubscriptions(charges, []).count).toBe(0);
  });

  it("rejects irregular intervals that fit no cadence band", () => {
    const charges: SubscriptionCharge[] = [
      charge("2026-01-01T00:00:00Z", 15.99, "Random Store"),
      charge("2026-01-03T00:00:00Z", 15.99, "Random Store"),
      charge("2026-03-20T00:00:00Z", 15.99, "Random Store"),
    ];

    expect(detectSubscriptions(charges, []).count).toBe(0);
  });

  it("rejects merchants whose amounts vary too widely to be a subscription", () => {
    const charges: SubscriptionCharge[] = [
      charge("2026-01-05T00:00:00Z", 20, "Grocers"),
      charge("2026-02-05T00:00:00Z", 80, "Grocers"),
      charge("2026-03-05T00:00:00Z", 150, "Grocers"),
    ];

    expect(detectSubscriptions(charges, []).count).toBe(0);
  });

  it("ignores charges with blank merchant names", () => {
    const charges: SubscriptionCharge[] = [
      charge("2026-01-05T00:00:00Z", 15.99, "   "),
      charge("2026-02-05T00:00:00Z", 15.99, "   "),
      charge("2026-03-05T00:00:00Z", 15.99, "   "),
    ];

    expect(detectSubscriptions(charges, []).count).toBe(0);
  });

  it("groups merchant names case- and whitespace-insensitively", () => {
    const charges: SubscriptionCharge[] = [
      charge("2026-01-05T00:00:00Z", 15.99, "Netflix"),
      charge("2026-02-05T00:00:00Z", 15.99, "  netflix "),
      charge("2026-03-05T00:00:00Z", 15.99, "NETFLIX"),
    ];

    const summary = detectSubscriptions(charges, []);

    expect(summary.count).toBe(1);
    expect(summary.subscriptions[0].occurrences).toBe(3);
  });
});

describe("detectSubscriptions — price increases", () => {
  it("flags a price increase between the two most recent distinct amounts", () => {
    const charges: SubscriptionCharge[] = [
      charge("2026-01-05T00:00:00Z", 9.99),
      charge("2026-02-05T00:00:00Z", 9.99),
      charge("2026-03-05T00:00:00Z", 12.99),
    ];

    const summary = detectSubscriptions(charges, []);
    const priceChange = summary.subscriptions[0].priceChange;

    expect(priceChange).not.toBeNull();
    expect(priceChange).toMatchObject({ from: 9.99, to: 12.99 });
    expect(priceChange?.pct).toBeCloseTo(30, 0);
    // The current price reflects the most recent (higher) charge.
    expect(summary.subscriptions[0].currentPrice).toBe(12.99);
  });

  it("does not flag a stable price", () => {
    const summary = detectSubscriptions(monthlyCharges("2026-01-05T00:00:00Z", 4, 9.99), []);

    expect(summary.subscriptions[0].priceChange).toBeNull();
  });

  it("does not flag a price decrease", () => {
    const charges: SubscriptionCharge[] = [
      charge("2026-01-05T00:00:00Z", 12.99),
      charge("2026-02-05T00:00:00Z", 12.99),
      charge("2026-03-05T00:00:00Z", 9.99),
    ];

    expect(detectSubscriptions(charges, []).subscriptions[0].priceChange).toBeNull();
  });
});

describe("detectSubscriptions — rule merging", () => {
  const netflixRule: SubscriptionRule = {
    merchant: "Netflix",
    name: "Netflix subscription",
    amount: 15.99,
    frequency: "MONTHLY",
  };

  it("marks a detected merchant confirmed by a rule as source 'both'", () => {
    const summary = detectSubscriptions(monthlyCharges("2026-01-05T00:00:00Z", 4), [netflixRule]);

    expect(summary.count).toBe(1);
    expect(summary.subscriptions[0].source).toBe("both");
  });

  it("surfaces an unmatched rule as its own 'rule'-sourced subscription", () => {
    const summary = detectSubscriptions([], [netflixRule]);

    expect(summary.count).toBe(1);
    expect(summary.subscriptions[0].source).toBe("rule");
    expect(summary.subscriptions[0].occurrences).toBe(0);
    expect(summary.subscriptions[0].monthlyCost).toBe(15.99);
    expect(summary.subscriptions[0].lastChargedAt).toBeNull();
  });

  it("skips rules without a merchant", () => {
    const summary = detectSubscriptions([], [{ ...netflixRule, merchant: null }]);

    expect(summary.count).toBe(0);
  });

  it("does not double-count when multiple rules share a merchant", () => {
    const summary = detectSubscriptions([], [netflixRule, { ...netflixRule, amount: 20 }]);

    expect(summary.count).toBe(1);
  });
});

describe("detectSubscriptions — totals and ordering", () => {
  it("sums monthly and annual totals and sorts by monthly cost descending", () => {
    const netflix = monthlyCharges("2026-01-05T00:00:00Z", 4, 15.99, "Netflix");
    const spotify = monthlyCharges("2026-01-10T00:00:00Z", 4, 10.99, "Spotify");

    const summary = detectSubscriptions([...spotify, ...netflix], []);

    expect(summary.count).toBe(2);
    expect(summary.subscriptions[0].merchant).toBe("Netflix");
    expect(summary.subscriptions[1].merchant).toBe("Spotify");
    expect(summary.monthlyTotal).toBe(26.98);
    expect(summary.annualTotal).toBe(323.76);
  });

  it("returns zeroed totals when there is nothing to detect", () => {
    const summary = detectSubscriptions([], []);

    expect(summary).toEqual({ monthlyTotal: 0, annualTotal: 0, count: 0, subscriptions: [] });
  });
});

describe("detectSubscriptions — additional cadences", () => {
  it("detects a biweekly subscription", () => {
    const charges: SubscriptionCharge[] = [
      charge("2026-01-01T00:00:00Z", 7.99, "Gym"),
      charge("2026-01-15T00:00:00Z", 7.99, "Gym"),
      charge("2026-01-29T00:00:00Z", 7.99, "Gym"),
    ];

    const summary = detectSubscriptions(charges, []);

    expect(summary.subscriptions[0].cadence).toBe("BIWEEKLY");
    // 7.99 * (26/12) ≈ 17.31
    expect(summary.subscriptions[0].monthlyCost).toBe(17.31);
  });

  it("detects a quarterly subscription", () => {
    const charges: SubscriptionCharge[] = [
      charge("2025-04-01T00:00:00Z", 30, "Cloud Storage"),
      charge("2025-07-01T00:00:00Z", 30, "Cloud Storage"),
      charge("2025-10-01T00:00:00Z", 30, "Cloud Storage"),
    ];

    const summary = detectSubscriptions(charges, []);

    expect(summary.subscriptions[0].cadence).toBe("QUARTERLY");
    // 30 * (1/3) = 10
    expect(summary.subscriptions[0].monthlyCost).toBe(10);
  });
});

describe("detectSubscriptions — price change threshold", () => {
  it("does not flag a sub-1% amount change as a price increase", () => {
    const charges: SubscriptionCharge[] = [
      charge("2026-01-05T00:00:00Z", 10.0),
      charge("2026-02-05T00:00:00Z", 10.0),
      charge("2026-03-05T00:00:00Z", 10.09),
    ];

    const summary = detectSubscriptions(charges, []);

    expect(summary.subscriptions[0].priceChange).toBeNull();
  });
});

describe("detectSubscriptions — rule-sourced cadences", () => {
  it("surfaces a BIWEEKLY rule with the correct monthly cost", () => {
    const rule: SubscriptionRule = {
      merchant: "Gym",
      name: "Gym membership",
      amount: 7.99,
      frequency: "BIWEEKLY",
    };

    const summary = detectSubscriptions([], [rule]);

    expect(summary.subscriptions[0].cadence).toBe("BIWEEKLY");
    expect(summary.subscriptions[0].monthlyCost).toBe(17.31);
    expect(summary.subscriptions[0].source).toBe("rule");
  });

  it("surfaces a WEEKLY rule with the correct monthly cost", () => {
    const rule: SubscriptionRule = {
      merchant: "Coffee Club",
      name: "Weekly coffee delivery",
      amount: 5,
      frequency: "WEEKLY",
    };

    const summary = detectSubscriptions([], [rule]);

    expect(summary.subscriptions[0].cadence).toBe("WEEKLY");
    expect(summary.subscriptions[0].monthlyCost).toBe(21.67);
    expect(summary.subscriptions[0].source).toBe("rule");
  });
});
