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

    const result = await listBudgets("user-1", new Date("2026-04-08T00:00:00.000Z"));

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
});
