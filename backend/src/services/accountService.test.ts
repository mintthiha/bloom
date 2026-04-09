import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@prisma/client", () => ({
  AccountType: {
    CHEQUING: "CHEQUING",
    SAVINGS: "SAVINGS",
  },
  TransactionType: {
    DEPOSIT: "DEPOSIT",
    WITHDRAWAL: "WITHDRAWAL",
    TRANSFER_OUT: "TRANSFER_OUT",
    TRANSFER_IN: "TRANSFER_IN",
  },
  PrismaClient: class {
    $queryRaw = prismaMock.$queryRaw;
  },
}));

describe("accountService", () => {
  beforeEach(() => {
    prismaMock.$queryRaw.mockReset();
  });

  it("builds the monthly summary from income and spending categories", async () => {
    const { getMonthlySummary } = await import("./accountService");
    prismaMock.$queryRaw.mockResolvedValueOnce([
      { category: "Groceries", income: 0, spending: 120.5 },
      { category: "Salary", income: "2500", spending: "0" },
      { category: "Dining", income: 0, spending: "75.25" },
    ]);

    const result = await getMonthlySummary("user-1", new Date("2026-04-08T12:00:00.000Z"));

    expect(result).toEqual({
      month: "2026-04",
      income: 2500,
      spending: 195.75,
      netCashFlow: 2304.25,
      topExpenseCategory: "Groceries",
      categories: [
        { category: "Groceries", income: 0, spending: 120.5 },
        { category: "Salary", income: 2500, spending: 0 },
        { category: "Dining", income: 0, spending: 75.25 },
      ],
    });
  });

  it("returns an empty monthly summary when there are no matching transactions", async () => {
    const { getMonthlySummary } = await import("./accountService");
    prismaMock.$queryRaw.mockResolvedValueOnce([]);

    const result = await getMonthlySummary("user-1", new Date("2026-04-08T12:00:00.000Z"));

    expect(result).toMatchObject({
      month: "2026-04",
      income: 0,
      spending: 0,
      netCashFlow: 0,
      topExpenseCategory: null,
      categories: [],
    });
  });
});
