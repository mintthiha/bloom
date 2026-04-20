import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, accountServiceMock } = vi.hoisted(() => ({
  prismaMock: {
    $queryRaw: vi.fn(),
  },
  accountServiceMock: {
    getAccount: vi.fn(),
    deposit: vi.fn(),
    withdraw: vi.fn(),
  },
}));

vi.mock("@prisma/client", () => ({
  PrismaClient: class {
    $queryRaw = prismaMock.$queryRaw;
  },
}));

vi.mock("./accountService", () => accountServiceMock);

describe("recurringTransactionService", () => {
  beforeEach(() => {
    prismaMock.$queryRaw.mockReset();
    accountServiceMock.getAccount.mockReset();
    accountServiceMock.deposit.mockReset();
    accountServiceMock.withdraw.mockReset();
  });

  it("rejects when endDate is before startDate", async () => {
    const { createRecurringTransaction } = await import("./recurringTransactionService");

    await expect(
      createRecurringTransaction("user-1", {
        accountId: "account-1",
        type: "WITHDRAWAL",
        amount: 100,
        frequency: "MONTHLY",
        startDate: new Date("2026-05-10T12:00:00.000Z"),
        endDate: new Date("2026-05-01T12:00:00.000Z"),
      })
    ).rejects.toMatchObject({ statusCode: 400, message: "endDate must be on or after startDate" });
  });

  it("creates a recurring rule after validating the account", async () => {
    const { createRecurringTransaction } = await import("./recurringTransactionService");
    accountServiceMock.getAccount.mockResolvedValue({
      id: "account-1",
      ownerName: "Jane Doe",
      nickname: "Main",
      accountType: "CHEQUING",
    });
    prismaMock.$queryRaw.mockResolvedValueOnce([
      {
        id: "rule-1",
        userId: "user-1",
        accountId: "account-1",
        type: "WITHDRAWAL",
        amount: 1200,
        category: "Rent",
        description: "Monthly payment",
        frequency: "MONTHLY",
        startDate: new Date("2026-05-01T12:00:00.000Z"),
        endDate: null,
        nextRunAt: new Date("2026-05-01T12:00:00.000Z"),
        lastRunAt: null,
        active: true,
        createdAt: new Date("2026-04-19T00:00:00.000Z"),
        updatedAt: new Date("2026-04-19T00:00:00.000Z"),
        accountOwnerName: "Jane Doe",
        accountNickname: "Main",
        accountType: "CHEQUING",
      },
    ]);

    const result = await createRecurringTransaction("user-1", {
      accountId: "account-1",
      type: "WITHDRAWAL",
      amount: 1200,
      category: " Rent ",
      description: " Monthly payment ",
      frequency: "MONTHLY",
      startDate: new Date("2026-05-01T12:00:00.000Z"),
    });

    expect(accountServiceMock.getAccount).toHaveBeenCalledWith("user-1", "account-1");
    expect(result).toMatchObject({
      id: "rule-1",
      category: "Rent",
      description: "Monthly payment",
    });
  });

  it("applies due recurring deposits and advances the next run date", async () => {
    const { applyDueRecurringTransactions } = await import("./recurringTransactionService");
    prismaMock.$queryRaw
      .mockResolvedValueOnce([
        {
          id: "rule-1",
          userId: "user-1",
          accountId: "account-1",
          type: "DEPOSIT",
          amount: 2500,
          category: "Salary",
          description: "Pay cheque",
          frequency: "MONTHLY",
          startDate: new Date("2026-04-01T12:00:00.000Z"),
          endDate: null,
          nextRunAt: new Date("2026-04-01T12:00:00.000Z"),
          lastRunAt: null,
          active: true,
          createdAt: new Date("2026-03-01T12:00:00.000Z"),
          updatedAt: new Date("2026-03-01T12:00:00.000Z"),
          accountOwnerName: "Jane Doe",
          accountNickname: "Main",
          accountType: "CHEQUING",
        },
      ])
      .mockResolvedValueOnce([]);
    accountServiceMock.deposit.mockResolvedValue([{ id: "account-1" }, { id: "txn-1" }]);

    const result = await applyDueRecurringTransactions("user-1", new Date("2026-04-19T12:00:00.000Z"));

    expect(accountServiceMock.deposit).toHaveBeenCalledWith(
      "user-1",
      "account-1",
      2500,
      "Salary",
      "Pay cheque",
      new Date("2026-04-01T12:00:00.000Z")
    );
    expect(result.appliedCount).toBe(1);
    expect(result.failedCount).toBe(0);
  });

  it("reports failures when a due recurring withdrawal cannot be applied", async () => {
    const { applyDueRecurringTransactions } = await import("./recurringTransactionService");
    prismaMock.$queryRaw
      .mockResolvedValueOnce([
        {
          id: "rule-1",
          userId: "user-1",
          accountId: "account-1",
          type: "WITHDRAWAL",
          amount: 1500,
          category: "Rent",
          description: "Monthly rent",
          frequency: "MONTHLY",
          startDate: new Date("2026-04-01T12:00:00.000Z"),
          endDate: null,
          nextRunAt: new Date("2026-04-01T12:00:00.000Z"),
          lastRunAt: null,
          active: true,
          createdAt: new Date("2026-03-01T12:00:00.000Z"),
          updatedAt: new Date("2026-03-01T12:00:00.000Z"),
          accountOwnerName: "Jane Doe",
          accountNickname: "Main",
          accountType: "CHEQUING",
        },
      ])
      .mockResolvedValueOnce([]);
    accountServiceMock.withdraw.mockRejectedValue(new Error("Insufficient funds"));

    const result = await applyDueRecurringTransactions("user-1", new Date("2026-04-19T12:00:00.000Z"));

    expect(result.appliedCount).toBe(0);
    expect(result.failedCount).toBe(1);
    expect(result.failures[0]).toMatchObject({ message: "Insufficient funds" });
  });
});
