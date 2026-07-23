import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSubscriptionSummary } from "./subscriptionService";

const { prismaMock, recurringMock } = vi.hoisted(() => ({
  prismaMock: {
    $queryRaw: vi.fn(),
  },
  recurringMock: {
    listRecurringTransactions: vi.fn(),
  },
}));

vi.mock("@prisma/client", () => ({
  PrismaClient: class {
    $queryRaw = prismaMock.$queryRaw;
  },
}));

vi.mock("./recurringTransactionService", () => recurringMock);

beforeEach(() => {
  vi.resetAllMocks();
});

/** Builds twelve consecutive monthly WITHDRAWAL charge rows (as Postgres returns them, amount as string). */
function monthlyChargeRows(merchant: string, amount: string, months: number) {
  const rows: { merchant: string; amount: string; effectiveAt: Date }[] = [];
  const start = new Date("2026-01-05T00:00:00Z");
  for (let index = 0; index < months; index += 1) {
    const date = new Date(start);
    date.setUTCMonth(start.getUTCMonth() + index);
    rows.push({ merchant, amount, effectiveAt: date });
  }
  return rows;
}

describe("getSubscriptionSummary", () => {
  it("coerces string amounts and detects a subscription from history", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce(monthlyChargeRows("Netflix", "15.99", 4));
    recurringMock.listRecurringTransactions.mockResolvedValueOnce([]);

    const summary = await getSubscriptionSummary("user-1");

    expect(summary.count).toBe(1);
    expect(summary.subscriptions[0].merchant).toBe("Netflix");
    expect(summary.subscriptions[0].monthlyCost).toBe(15.99);
    expect(summary.subscriptions[0].source).toBe("detected");
  });

  it("merges only active WITHDRAWAL recurring rules into the detection", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]);
    recurringMock.listRecurringTransactions.mockResolvedValueOnce([
      {
        type: "WITHDRAWAL",
        active: true,
        merchant: "Spotify",
        name: "Spotify",
        amount: 10.99,
        frequency: "MONTHLY",
      },
      {
        type: "DEPOSIT",
        active: true,
        merchant: "Payroll",
        name: "Payroll",
        amount: 2500,
        frequency: "BIWEEKLY",
      },
      {
        type: "WITHDRAWAL",
        active: false,
        merchant: "Old Gym",
        name: "Old Gym",
        amount: 40,
        frequency: "MONTHLY",
      },
    ]);

    const summary = await getSubscriptionSummary("user-1");

    expect(summary.count).toBe(1);
    expect(summary.subscriptions[0].merchant).toBe("Spotify");
    expect(summary.subscriptions[0].source).toBe("rule");
  });

  it("returns an empty summary when there is no history or rules", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]);
    recurringMock.listRecurringTransactions.mockResolvedValueOnce([]);

    const summary = await getSubscriptionSummary("user-1");

    expect(summary).toEqual({ monthlyTotal: 0, annualTotal: 0, count: 0, subscriptions: [] });
  });
});
