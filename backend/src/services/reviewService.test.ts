import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, accountMock, budgetMock, goalMock, activityMock } = vi.hoisted(() => ({
  prismaMock: { $queryRaw: vi.fn() },
  accountMock: { getMonthlySummary: vi.fn() },
  budgetMock: { listBudgets: vi.fn() },
  goalMock: { listSavingsGoals: vi.fn() },
  activityMock: { logActivity: vi.fn() },
}));

vi.mock("@prisma/client", () => ({
  PrismaClient: class {
    $queryRaw = prismaMock.$queryRaw;
  },
}));
vi.mock("./accountService", () => accountMock);
vi.mock("./budgetService", () => budgetMock);
vi.mock("./savingsGoalService", () => goalMock);
vi.mock("./activityService", () => activityMock);

import {
  completeMonthlyReview,
  getMonthlyReview,
  getYearInReview,
  hasActivityInMonth,
  hasCompletedMonthlyReview,
} from "./reviewService";

/** Canned answers for each query the service issues, keyed by a fragment of its SQL. */
type QueryAnswers = {
  transactionCount?: number;
  biggestExpense?: unknown[];
  goalBalances?: unknown[];
  completedReviews?: { month: string; completedAt: Date }[];
  insertedReview?: { month: string; completedAt: Date };
  yearMonths?: unknown[];
  topMerchant?: unknown[];
  reviewCount?: number;
};

const octoberStart = new Date("2026-10-01T04:00:00.000Z");
const novemberStart = new Date("2026-11-01T04:00:00.000Z");
const yearBoundary = {
  start: new Date("2026-01-01T05:00:00.000Z"),
  end: new Date("2027-01-01T05:00:00.000Z"),
};

/** Answers $queryRaw by inspecting the SQL text, so tests don't depend on query order. */
function answerQueries(answers: QueryAnswers = {}) {
  prismaMock.$queryRaw.mockImplementation((sql: unknown, ...values: unknown[]) => {
    const text = String(sql);
    if (text.includes("make_interval")) {
      return Promise.resolve(
        values.includes(12) ? [yearBoundary] : [{ start: octoberStart, end: novemberStart }]
      );
    }
    if (text.includes('COUNT(DISTINCT t."id")'))
      return Promise.resolve([{ transactionCount: answers.transactionCount ?? 0 }]);
    if (text.includes('ORDER BY t."amount" DESC'))
      return Promise.resolve(answers.biggestExpense ?? []);
    if (text.includes('"balanceAtStart"')) return Promise.resolve(answers.goalBalances ?? []);
    if (text.includes('INSERT INTO "MonthlyReview"'))
      return Promise.resolve([
        answers.insertedReview ?? { month: "2026-10", completedAt: new Date() },
      ]);
    if (text.includes('"reviewCount"'))
      return Promise.resolve([{ reviewCount: answers.reviewCount ?? 0 }]);
    if (text.includes('FROM "MonthlyReview"') && text.includes('ORDER BY "month" DESC'))
      return Promise.resolve(answers.completedReviews ?? []);
    if (text.includes('FROM "MonthlyReview"'))
      return Promise.resolve(answers.completedReviews ?? []);
    if (text.includes('"visitCount"')) return Promise.resolve(answers.topMerchant ?? []);
    if (text.includes("AT TIME ZONE")) return Promise.resolve(answers.yearMonths ?? []);
    return Promise.resolve([]);
  });
}

/** Builds a monthly summary as getMonthlySummary returns it. */
function summary(
  income: number,
  spending: number,
  categories: { category: string; spending: number }[] = []
) {
  return {
    month: "2026-10",
    income,
    spending,
    netCashFlow: income - spending,
    topExpenseCategory: categories[0]?.category ?? null,
    categories: categories.map((row) => ({ ...row, income: 0 })),
  };
}

/** Builds a budget as listBudgets returns it. */
function budget(overrides: Record<string, unknown> = {}) {
  return {
    id: "b-groceries",
    category: "Groceries",
    monthlyLimit: 400,
    rolloverEnabled: true,
    month: "2026-10",
    limit: 400,
    carryIn: 0,
    adjustment: 0,
    available: 400,
    currentSpending: 350,
    remaining: 50,
    carryOut: 50,
    percentageUsed: 87.5,
    isOverBudget: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  accountMock.getMonthlySummary.mockResolvedValue(summary(0, 0));
  budgetMock.listBudgets.mockResolvedValue([]);
  goalMock.listSavingsGoals.mockResolvedValue([]);
});

describe("getMonthlyReview", () => {
  it("rejects a malformed month before querying", async () => {
    await expect(getMonthlyReview("u-1", "2026-13", "America/Toronto")).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it("resolves the month's boundaries in the user's time zone", async () => {
    answerQueries();
    await getMonthlyReview("u-1", "2026-10", "America/Toronto");

    const boundaryCalls = prismaMock.$queryRaw.mock.calls.filter(([sql]) =>
      String(sql).includes("make_interval")
    );
    // Prisma binds numbers as bigint; make_interval only accepts int, so the cast must stay.
    expect(String(boundaryCalls[0]![0])).toContain("::int)");
    expect(boundaryCalls.map((call) => call.slice(1))).toEqual(
      expect.arrayContaining([
        ["2026-10-01", "America/Toronto", "2026-10-01", 1, "America/Toronto"],
        ["2026-09-01", "America/Toronto", "2026-09-01", 1, "America/Toronto"],
      ])
    );
    expect(accountMock.getMonthlySummary).toHaveBeenCalledWith("u-1", {
      start: octoberStart,
      end: novemberStart,
    });
  });

  it("compares cash flow with the month before", async () => {
    answerQueries({ transactionCount: 14 });
    accountMock.getMonthlySummary
      .mockResolvedValueOnce(summary(3000, 2400, [{ category: "Rent", spending: 1450 }]))
      .mockResolvedValueOnce(summary(3000, 2000, [{ category: "Rent", spending: 1450 }]));

    const review = await getMonthlyReview("u-1", "2026-10", "America/Toronto");

    expect(review.cashFlow).toEqual({
      income: 3000,
      spending: 2400,
      netCashFlow: 600,
      savingsRate: 0.2,
      transactionCount: 14,
      previousIncome: 3000,
      previousSpending: 2000,
      spendingChangePercent: 0.2,
    });
    expect(review.hasActivity).toBe(true);
    expect(review.topCategories[0]).toMatchObject({ category: "Rent", previousSpending: 1450 });
    expect(review).toMatchObject({
      month: "2026-10",
      previousMonth: "2026-09",
      nextMonth: "2026-11",
    });
  });

  it("reports an empty month as having no activity", async () => {
    answerQueries({ transactionCount: 0 });
    const review = await getMonthlyReview("u-1", "2026-10", "America/Toronto");
    expect(review.hasActivity).toBe(false);
    expect(review.cashFlow.savingsRate).toBeNull();
    expect(review.biggestExpense).toBeNull();
  });

  it("asks budgets for this month and next month by their UTC month keys", async () => {
    answerQueries();
    await getMonthlyReview("u-1", "2026-12", "America/Toronto");
    expect(budgetMock.listBudgets).toHaveBeenCalledWith("u-1", {
      start: new Date("2026-12-01T00:00:00.000Z"),
      end: new Date("2027-01-01T00:00:00.000Z"),
    });
    expect(budgetMock.listBudgets).toHaveBeenCalledWith("u-1", {
      start: new Date("2027-01-01T00:00:00.000Z"),
      end: new Date("2027-02-01T00:00:00.000Z"),
    });
  });

  it("shows each envelope's result, carry-out, and next month's limit", async () => {
    answerQueries();
    budgetMock.listBudgets
      .mockResolvedValueOnce([
        budget(),
        budget({
          id: "b-dining",
          category: "Dining",
          rolloverEnabled: false,
          currentSpending: 260,
          remaining: -60,
          carryOut: -60,
          isOverBudget: true,
          limit: 200,
          available: 200,
          monthlyLimit: 200,
        }),
      ])
      .mockResolvedValueOnce([budget({ limit: 450 }), budget({ id: "b-dining", limit: 200 })]);

    const review = await getMonthlyReview("u-1", "2026-10", "America/Toronto");

    expect(review.budgetResults).toEqual({ total: 2, keptCount: 1, overCount: 1 });
    expect(review.budgets[0]).toEqual({
      id: "b-groceries",
      category: "Groceries",
      limit: 400,
      available: 400,
      spent: 350,
      remaining: 50,
      isOverBudget: false,
      rolloverEnabled: true,
      carryOut: 50,
      nextMonthLimit: 450,
      templateLimit: 400,
    });
    expect(review.budgets[1]).toMatchObject({
      category: "Dining",
      isOverBudget: true,
      nextMonthLimit: 200,
    });
  });

  it("falls back to the template limit when next month has no entry for a budget", async () => {
    answerQueries();
    budgetMock.listBudgets.mockResolvedValueOnce([budget()]).mockResolvedValueOnce([]);
    const review = await getMonthlyReview("u-1", "2026-10", "America/Toronto");
    expect(review.budgets[0]!.nextMonthLimit).toBe(400);
  });

  it("reports each goal's contribution across the month", async () => {
    answerQueries({
      goalBalances: [
        {
          id: "g-1",
          name: "Emergency fund",
          targetAmount: "1000.0000",
          balanceAtStart: "400.0000",
          balanceAtEnd: "650.0000",
        },
      ],
    });
    const review = await getMonthlyReview("u-1", "2026-10", "America/Toronto");
    expect(review.goals).toEqual([
      {
        id: "g-1",
        name: "Emergency fund",
        targetAmount: 1000,
        balanceAtStart: 400,
        balanceAtEnd: 650,
        contributed: 250,
        percentAtEnd: 0.65,
        isReached: false,
        wasReachedThisMonth: false,
      },
    ]);
  });

  it("labels the biggest purchase by merchant, then description", async () => {
    answerQueries({
      biggestExpense: [
        {
          amount: "1450.0000",
          merchant: null,
          description: "RENT OCT",
          category: "Rent",
          effectiveAt: octoberStart,
        },
      ],
    });
    const review = await getMonthlyReview("u-1", "2026-10", "America/Toronto");
    expect(review.biggestExpense).toEqual({
      label: "RENT OCT",
      amount: 1450,
      category: "Rent",
      effectiveAt: octoberStart,
    });
  });

  it("includes completion and the streak", async () => {
    const completedAt = new Date("2026-11-02T14:00:00.000Z");
    answerQueries({
      completedReviews: [
        { month: "2026-10", completedAt },
        { month: "2026-09", completedAt },
        { month: "2026-07", completedAt },
      ],
    });
    const review = await getMonthlyReview("u-1", "2026-10", "America/Toronto");
    expect(review.completedAt).toBe(completedAt);
    expect(review.reviewStreak).toBe(2);
  });
});

describe("completeMonthlyReview", () => {
  const now = new Date("2026-11-04T12:00:00.000Z");

  it("records the review and returns the updated streak", async () => {
    const completedAt = new Date("2026-11-04T12:00:00.000Z");
    answerQueries({
      insertedReview: { month: "2026-10", completedAt },
      completedReviews: [
        { month: "2026-10", completedAt },
        { month: "2026-09", completedAt },
      ],
    });

    const result = await completeMonthlyReview("u-1", "2026-10", now);

    expect(result).toEqual({ month: "2026-10", completedAt, reviewStreak: 2 });
    const insertCall = prismaMock.$queryRaw.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO "MonthlyReview"')
    )!;
    expect(String(insertCall[0])).toContain("ON CONFLICT");
    expect(insertCall.slice(1)).toEqual(expect.arrayContaining(["u-1", "2026-10"]));
    const dismissCall = prismaMock.$queryRaw.mock.calls.find(([sql]) =>
      String(sql).includes('UPDATE "Notification"')
    )!;
    expect(String(dismissCall[0])).toContain("'DISMISSED'");
    expect(dismissCall.slice(1)).toEqual(["u-1", "MONTHLY_REVIEW:2026-10"]);
    expect(activityMock.logActivity).toHaveBeenCalledWith(
      "u-1",
      "PROFILE_REVIEW_COMPLETED",
      "Completed the 2026-10 monthly review",
      { month: "2026-10" }
    );
  });

  it("allows reviewing the current month early", async () => {
    answerQueries({ insertedReview: { month: "2026-11", completedAt: now } });
    await expect(completeMonthlyReview("u-1", "2026-11", now)).resolves.toMatchObject({
      month: "2026-11",
    });
  });

  it("rejects a future month without writing", async () => {
    answerQueries();
    await expect(completeMonthlyReview("u-1", "2026-12", now)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it("rejects a malformed month", async () => {
    await expect(completeMonthlyReview("u-1", "Oct", now)).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

describe("hasCompletedMonthlyReview / hasActivityInMonth", () => {
  it("is true only when a review row exists", async () => {
    answerQueries({ completedReviews: [{ month: "2026-10", completedAt: new Date() }] });
    await expect(hasCompletedMonthlyReview("u-1", "2026-10")).resolves.toBe(true);
    answerQueries({ completedReviews: [] });
    await expect(hasCompletedMonthlyReview("u-1", "2026-10")).resolves.toBe(false);
  });

  it("checks the whole UTC month for activity", async () => {
    answerQueries({ transactionCount: 3 });
    await expect(hasActivityInMonth("u-1", "2026-10")).resolves.toBe(true);
    const countCall = prismaMock.$queryRaw.mock.calls.find(([sql]) =>
      String(sql).includes('COUNT(DISTINCT t."id")')
    )!;
    expect(countCall.slice(1)).toEqual(
      expect.arrayContaining([
        new Date("2026-10-01T00:00:00.000Z"),
        new Date("2026-11-01T00:00:00.000Z"),
      ])
    );
    answerQueries({ transactionCount: 0 });
    await expect(hasActivityInMonth("u-1", "2026-10")).resolves.toBe(false);
  });
});

describe("getYearInReview", () => {
  it("rejects an implausible year", async () => {
    await expect(getYearInReview("u-1", 1999, "UTC")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("builds the recap from the year's data", async () => {
    answerQueries({
      transactionCount: 120,
      yearMonths: [
        { month: "2026-01", income: "3000", spending: "1000" },
        { month: "2026-03", income: "3000", spending: "3200" },
      ],
      topMerchant: [{ label: "Tim Hortons", visitCount: 41, spending: "184.50" }],
      reviewCount: 4,
    });
    accountMock.getMonthlySummary.mockResolvedValue(
      summary(6000, 4200, [
        { category: "Rent", spending: 2900 },
        { category: "Dining", spending: 1300 },
      ])
    );
    goalMock.listSavingsGoals.mockResolvedValue([
      { name: "Emergency fund", targetAmount: 1000, currentBalance: 1200 },
      { name: "Trip", targetAmount: 3000, currentBalance: 500 },
    ]);

    const recap = await getYearInReview(
      "u-1",
      2026,
      "America/Toronto",
      new Date("2026-11-04T12:00:00Z")
    );

    expect(recap.isYearComplete).toBe(false);
    expect(recap.totals).toEqual({
      income: 6000,
      spending: 4200,
      netSaved: 1800,
      savingsRate: 0.3,
      transactionCount: 120,
    });
    expect(recap.months).toHaveLength(12);
    expect(recap.bestSavingMonth).toEqual({ month: "2026-01", netSaved: 2000 });
    expect(recap.highestSpendingMonth).toEqual({ month: "2026-03", spending: 3200 });
    expect(recap.topCategories.map((row) => row.category)).toEqual(["Rent", "Dining"]);
    expect(recap.topMerchant).toEqual({ label: "Tim Hortons", visitCount: 41, spending: 184.5 });
    expect(recap.reviewsCompleted).toBe(4);
    expect(recap.goalsReached).toEqual(["Emergency fund"]);
    expect(recap).not.toHaveProperty("netWorth");
    expect(
      prismaMock.$queryRaw.mock.calls.some(([sql]) => String(sql).includes("NetWorthSnapshot"))
    ).toBe(false);
  });

  it("marks the year complete once it has ended", async () => {
    answerQueries();
    const recap = await getYearInReview("u-1", 2026, "UTC", new Date("2027-01-01T06:00:00Z"));
    expect(recap.isYearComplete).toBe(true);
    expect(recap.hasActivity).toBe(false);
    expect(recap.topMerchant).toBeNull();
  });
});
