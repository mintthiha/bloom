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
    ).rejects.toMatchObject({ statusCode: 400, message: "Monthly limit must be a positive number" });
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
    prismaMock.$queryRaw.mockResolvedValueOnce([
      {
        id: "budget-1",
        userId: "user-1",
        category: "Groceries",
        monthlyLimit: 500,
        currentSpending: 620,
        createdAt: new Date("2026-04-08T00:00:00.000Z"),
        updatedAt: new Date("2026-04-08T00:00:00.000Z"),
      },
    ]);

    const result = await listBudgets("user-1", { now: new Date("2026-04-08T00:00:00.000Z") });

    expect(result).toEqual([
      expect.objectContaining({
        category: "Groceries",
        monthlyLimit: 500,
        currentSpending: 620,
        remaining: -120,
        percentageUsed: 124,
        isOverBudget: true,
      }),
    ]);
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
        { accountId: "account-1", accountNickname: "Main", accountOwnerName: "Jane Doe", total: "49" },
        { accountId: "account-2", accountNickname: null, accountOwnerName: "Spending Account", total: 20 },
      ]);

    const result = await getBudgetActivity("user-1", "budget-1", { now: new Date("2026-04-08T00:00:00.000Z") });

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
      expect.objectContaining({ accountId: "account-2", accountName: "Spending Account", total: 20 }),
    ]);
  });
});
