import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@prisma/client", () => ({
  PrismaClient: class {
    $queryRaw = prismaMock.$queryRaw;
  },
}));

describe("budgetService", () => {
  beforeEach(() => {
    prismaMock.$queryRaw.mockReset();
  });

  it("rejects when category is missing", async () => {
    const { upsertBudget } = await import("./budgetService");

    await expect(
      upsertBudget("user-1", {
        category: "",
        monthlyLimit: 200,
      })
    ).rejects.toMatchObject({ statusCode: 400, message: "Category is required" });
  });

  it("rejects when monthly limit is invalid", async () => {
    const { upsertBudget } = await import("./budgetService");

    await expect(
      upsertBudget("user-1", {
        category: "Dining",
        monthlyLimit: 0,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Monthly limit must be a positive number",
    });
  });

  it("normalizes category names when saving budgets", async () => {
    const { upsertBudget } = await import("./budgetService");
    prismaMock.$queryRaw.mockResolvedValueOnce([
      {
        id: "budget-1",
        userId: "user-1",
        category: "Dining Out",
        monthlyLimit: 250,
        createdAt: new Date("2026-04-08T00:00:00.000Z"),
        updatedAt: new Date("2026-04-08T00:00:00.000Z"),
      },
    ]);

    const result = await upsertBudget("user-1", {
      category: "  dining   out ",
      monthlyLimit: 250,
    });

    expect(result).toMatchObject({
      userId: "user-1",
      category: "Dining Out",
      monthlyLimit: 250,
    });
  });

  it("computes budget progress values from monthly spending", async () => {
    const { listBudgets } = await import("./budgetService");
    prismaMock.$queryRaw
      .mockResolvedValueOnce([
        {
          id: "budget-1",
          userId: "user-1",
          category: "Groceries",
          monthlyLimit: 500,
          rolloverEnabled: false,
          createdAt: new Date("2026-04-08T00:00:00.000Z"),
          updatedAt: new Date("2026-04-08T00:00:00.000Z"),
        },
      ])
      .mockResolvedValueOnce([{ budgetId: "budget-1", month: "2026-04", total: 620 }])
      .mockResolvedValueOnce([]);

    const result = await listBudgets("user-1", { now: new Date("2026-04-08T00:00:00.000Z") });

    expect(result).toEqual([
      expect.objectContaining({
        category: "Groceries",
        monthlyLimit: 500,
        rolloverEnabled: false,
        carryIn: 0,
        available: 500,
        currentSpending: 620,
        remaining: -120,
        carryOut: -120,
        percentageUsed: 124,
        isOverBudget: true,
      }),
    ]);
  });

  it("accrues carry-in across months for a rollover-enabled budget", async () => {
    const { listBudgets } = await import("./budgetService");
    prismaMock.$queryRaw
      .mockResolvedValueOnce([
        {
          id: "budget-1",
          userId: "user-1",
          category: "Groceries",
          monthlyLimit: 200,
          rolloverEnabled: true,
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z"),
        },
      ])
      .mockResolvedValueOnce([
        { budgetId: "budget-1", month: "2026-05", total: 150 },
        { budgetId: "budget-1", month: "2026-06", total: 120 },
        { budgetId: "budget-1", month: "2026-07", total: 100 },
      ])
      .mockResolvedValueOnce([]);

    const result = await listBudgets("user-1", { now: new Date("2026-07-15T00:00:00.000Z") });

    expect(result[0]).toMatchObject({
      rolloverEnabled: true,
      carryIn: 130,
      available: 330,
      currentSpending: 100,
      carryOut: 230,
      remaining: 230,
      isOverBudget: false,
    });
  });

  it("carries overspend debt into the next month when rollover is enabled", async () => {
    const { listBudgets } = await import("./budgetService");
    prismaMock.$queryRaw
      .mockResolvedValueOnce([
        {
          id: "budget-1",
          userId: "user-1",
          category: "Dining",
          monthlyLimit: 100,
          rolloverEnabled: true,
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z"),
        },
      ])
      .mockResolvedValueOnce([
        { budgetId: "budget-1", month: "2026-05", total: 180 },
        { budgetId: "budget-1", month: "2026-06", total: 50 },
      ])
      .mockResolvedValueOnce([]);

    const result = await listBudgets("user-1", { now: new Date("2026-06-10T00:00:00.000Z") });

    expect(result[0]).toMatchObject({
      carryIn: -80,
      available: 20,
      carryOut: -30,
      remaining: -30,
      isOverBudget: true,
    });
  });

  it("returns monthly budget activity with transactions, daily totals, and account totals", async () => {
    const { getBudgetActivity } = await import("./budgetService");
    prismaMock.$queryRaw
      .mockResolvedValueOnce([
        {
          id: "budget-1",
          userId: "user-1",
          category: "Entertainment",
          monthlyLimit: 300,
          rolloverEnabled: false,
          createdAt: new Date("2026-04-08T00:00:00.000Z"),
          updatedAt: new Date("2026-04-08T00:00:00.000Z"),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "txn-2",
          amount: 49,
          category: "Entertainment",
          description: "Movie tickets",
          createdAt: new Date("2026-04-08T00:00:00.000Z"),
          accountId: "account-1",
          accountNickname: "Main",
          accountOwnerName: "Jane Doe",
        },
        {
          id: "txn-1",
          amount: "20",
          category: "Entertainment",
          description: null,
          createdAt: new Date("2026-04-02T00:00:00.000Z"),
          accountId: "account-2",
          accountNickname: null,
          accountOwnerName: "Spending Account",
        },
      ])
      .mockResolvedValueOnce([
        { day: new Date("2026-04-02T00:00:00.000Z"), total: "20" },
        { day: new Date("2026-04-08T00:00:00.000Z"), total: 49 },
      ])
      .mockResolvedValueOnce([
        {
          accountId: "account-1",
          accountNickname: "Main",
          accountOwnerName: "Jane Doe",
          total: "49",
        },
        {
          accountId: "account-2",
          accountNickname: null,
          accountOwnerName: "Spending Account",
          total: 20,
        },
      ])
      // loadBudgetRolloverInputs: monthly spending history, then stored overrides
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await getBudgetActivity("user-1", "budget-1", {
      now: new Date("2026-04-08T00:00:00.000Z"),
    });

    expect(result).toMatchObject({
      id: "budget-1",
      category: "Entertainment",
      month: "2026-04",
      monthlyLimit: 300,
      currentSpending: 69,
      remaining: 231,
      percentageUsed: 23,
      isOverBudget: false,
    });
    expect(result.activity).toEqual([
      expect.objectContaining({ id: "txn-2", amount: 49, accountName: "Main" }),
      expect.objectContaining({ id: "txn-1", amount: 20, accountName: "Spending Account" }),
    ]);
    expect(result.dailySpending).toEqual([
      { day: new Date("2026-04-02T00:00:00.000Z"), total: 20 },
      { day: new Date("2026-04-08T00:00:00.000Z"), total: 49 },
    ]);
    expect(result.accountTotals).toEqual([
      expect.objectContaining({ accountId: "account-1", accountName: "Main", total: 49 }),
      expect.objectContaining({
        accountId: "account-2",
        accountName: "Spending Account",
        total: 20,
      }),
    ]);
  });

  it("toggles rollover and returns 404 for an unknown budget", async () => {
    const { setRolloverEnabled } = await import("./budgetService");
    prismaMock.$queryRaw.mockResolvedValueOnce([]);

    await expect(setRolloverEnabled("user-1", "missing", true)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("moves money between envelopes with offsetting adjustments", async () => {
    const { moveBudgetMoney } = await import("./budgetService");
    const source = {
      id: "from",
      userId: "user-1",
      category: "Dining",
      monthlyLimit: 200,
      rolloverEnabled: true,
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
      updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    };
    const destination = { ...source, id: "to", category: "Groceries" };
    prismaMock.$queryRaw
      .mockResolvedValueOnce([source]) // getBudgetRecord(from)
      .mockResolvedValueOnce([destination]) // getBudgetRecord(to)
      .mockResolvedValueOnce([{ budgetId: "from", month: "2026-07", total: 50 }]) // history
      .mockResolvedValueOnce([]) // overrides
      .mockResolvedValueOnce([]) // upsert source adjustment
      .mockResolvedValueOnce([]); // upsert destination adjustment

    const result = await moveBudgetMoney("user-1", {
      fromBudgetId: "from",
      toBudgetId: "to",
      month: "2026-07",
      amount: 120,
    });

    expect(result).toEqual({
      fromBudgetId: "from",
      toBudgetId: "to",
      month: "2026-07",
      amount: 120,
    });
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(6);
  });

  it("rejects a move larger than the source envelope's available balance", async () => {
    const { moveBudgetMoney } = await import("./budgetService");
    const source = {
      id: "from",
      userId: "user-1",
      category: "Dining",
      monthlyLimit: 200,
      rolloverEnabled: true,
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
      updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    };
    prismaMock.$queryRaw
      .mockResolvedValueOnce([source]) // getBudgetRecord(from)
      .mockResolvedValueOnce([{ ...source, id: "to", category: "Groceries" }]) // getBudgetRecord(to)
      .mockResolvedValueOnce([{ budgetId: "from", month: "2026-07", total: 50 }]) // history
      .mockResolvedValueOnce([]); // overrides

    await expect(
      moveBudgetMoney("user-1", {
        fromBudgetId: "from",
        toBudgetId: "to",
        month: "2026-07",
        amount: 500,
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects moving money to the same envelope", async () => {
    const { moveBudgetMoney } = await import("./budgetService");

    await expect(
      moveBudgetMoney("user-1", {
        fromBudgetId: "same",
        toBudgetId: "same",
        month: "2026-07",
        amount: 10,
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
