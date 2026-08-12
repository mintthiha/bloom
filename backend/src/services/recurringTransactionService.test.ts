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
        name: "Rent",
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
        name: "Monthly rent",
        type: "WITHDRAWAL",
        amount: 1200,
        category: "Rent",
        merchant: "Landlord Inc.",
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
      name: "Monthly rent",
      type: "WITHDRAWAL",
      amount: 1200,
      category: " Rent ",
      merchant: " Landlord Inc. ",
      description: " Monthly payment ",
      frequency: "MONTHLY",
      startDate: new Date("2026-05-01T12:00:00.000Z"),
    });

    expect(accountServiceMock.getAccount).toHaveBeenCalledWith("user-1", "account-1");
    expect(result).toMatchObject({
      id: "rule-1",
      category: "Rent",
      merchant: "Landlord Inc.",
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
          name: "Payroll",
          type: "DEPOSIT",
          amount: 2500,
          category: "Salary",
          merchant: "Acme Payroll",
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

    const result = await applyDueRecurringTransactions(
      "user-1",
      new Date("2026-04-19T12:00:00.000Z")
    );

    expect(accountServiceMock.deposit).toHaveBeenCalledWith(
      "user-1",
      "account-1",
      2500,
      "Salary",
      "Pay cheque",
      new Date("2026-04-01T12:00:00.000Z"),
      "Acme Payroll"
    );
    expect(result.appliedCount).toBe(1);
    expect(result.failedCount).toBe(0);
  });

  it("updates a recurring rule and recalculates the next run date from the last run", async () => {
    const { updateRecurringTransaction } = await import("./recurringTransactionService");
    prismaMock.$queryRaw
      .mockResolvedValueOnce([
        {
          id: "rule-1",
          userId: "user-1",
          accountId: "account-1",
          name: "Rent",
          type: "WITHDRAWAL",
          amount: 1200,
          category: "Rent",
          merchant: "Landlord Inc.",
          description: "Monthly rent",
          frequency: "MONTHLY",
          startDate: new Date("2026-04-01T12:00:00.000Z"),
          endDate: null,
          nextRunAt: new Date("2026-05-01T12:00:00.000Z"),
          lastRunAt: new Date("2026-04-01T12:00:00.000Z"),
          active: true,
          createdAt: new Date("2026-03-01T12:00:00.000Z"),
          updatedAt: new Date("2026-04-01T12:00:00.000Z"),
          accountOwnerName: "Jane Doe",
          accountNickname: "Main",
          accountType: "CHEQUING",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "rule-1",
          userId: "user-1",
          accountId: "account-1",
          name: "Housing payment",
          type: "WITHDRAWAL",
          amount: 1250,
          category: "Housing",
          merchant: "Landlord Inc.",
          description: "Updated rent",
          frequency: "BIWEEKLY",
          startDate: new Date("2026-04-10T12:00:00.000Z"),
          endDate: null,
          nextRunAt: new Date("2026-04-15T12:00:00.000Z"),
          lastRunAt: new Date("2026-04-01T12:00:00.000Z"),
          active: true,
          createdAt: new Date("2026-03-01T12:00:00.000Z"),
          updatedAt: new Date("2026-04-19T12:00:00.000Z"),
          accountOwnerName: "Jane Doe",
          accountNickname: "Main",
          accountType: "CHEQUING",
        },
      ]);
    accountServiceMock.getAccount.mockResolvedValue({
      id: "account-1",
      ownerName: "Jane Doe",
      nickname: "Main",
      accountType: "CHEQUING",
    });

    const result = await updateRecurringTransaction("user-1", "rule-1", {
      accountId: "account-1",
      name: "Housing payment",
      type: "WITHDRAWAL",
      amount: 1250,
      category: "Housing",
      merchant: "Landlord Inc.",
      description: "Updated rent",
      frequency: "BIWEEKLY",
      startDate: new Date("2026-04-10T12:00:00.000Z"),
    });

    expect(accountServiceMock.getAccount).toHaveBeenCalledWith("user-1", "account-1");
    expect(result).toMatchObject({
      id: "rule-1",
      amount: 1250,
      frequency: "BIWEEKLY",
    });
  });

  it("reports failures when a due recurring withdrawal cannot be applied", async () => {
    const { applyDueRecurringTransactions } = await import("./recurringTransactionService");
    prismaMock.$queryRaw
      .mockResolvedValueOnce([
        {
          id: "rule-1",
          userId: "user-1",
          accountId: "account-1",
          name: "Rent",
          type: "WITHDRAWAL",
          amount: 1500,
          category: "Rent",
          merchant: "Landlord Inc.",
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

    const result = await applyDueRecurringTransactions(
      "user-1",
      new Date("2026-04-19T12:00:00.000Z")
    );

    expect(result.appliedCount).toBe(0);
    expect(result.failedCount).toBe(1);
    expect(result.failures[0]).toMatchObject({ message: "Insufficient funds" });
  });
});

/** Builds a minimal RecurringTransactionRecord fixture. */
function makeRuleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "rule-1",
    userId: "user-1",
    accountId: "account-1",
    name: "Rent",
    type: "WITHDRAWAL",
    amount: "1200",
    category: "Rent",
    merchant: null,
    description: null,
    frequency: "MONTHLY",
    startDate: new Date("2026-04-01T00:00:00.000Z"),
    endDate: null,
    nextRunAt: new Date("2026-05-01T00:00:00.000Z"),
    lastRunAt: new Date("2026-04-01T00:00:00.000Z"),
    active: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    accountOwnerName: "Jane Doe",
    accountNickname: null,
    accountType: "CHEQUING",
    ...overrides,
  };
}

describe("createRecurringTransaction — input validation", () => {
  it("throws 400 when amount is zero", async () => {
    const { createRecurringTransaction } = await import("./recurringTransactionService");

    await expect(
      createRecurringTransaction("user-1", {
        accountId: "account-1",
        name: "Rent",
        type: "WITHDRAWAL",
        amount: 0,
        frequency: "MONTHLY",
        startDate: new Date("2026-05-01T00:00:00.000Z"),
      })
    ).rejects.toMatchObject({ statusCode: 400, message: "amount must be positive" });
  });

  it("throws 400 when amount is negative", async () => {
    const { createRecurringTransaction } = await import("./recurringTransactionService");

    await expect(
      createRecurringTransaction("user-1", {
        accountId: "account-1",
        name: "Rent",
        type: "WITHDRAWAL",
        amount: -50,
        frequency: "MONTHLY",
        startDate: new Date("2026-05-01T00:00:00.000Z"),
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when name is blank", async () => {
    const { createRecurringTransaction } = await import("./recurringTransactionService");

    await expect(
      createRecurringTransaction("user-1", {
        accountId: "account-1",
        name: "   ",
        type: "WITHDRAWAL",
        amount: 100,
        frequency: "MONTHLY",
        startDate: new Date("2026-05-01T00:00:00.000Z"),
      })
    ).rejects.toMatchObject({ statusCode: 400, message: "name is required" });
  });
});

describe("deleteRecurringTransaction", () => {
  it("throws 404 when the rule does not exist", async () => {
    const { deleteRecurringTransaction } = await import("./recurringTransactionService");
    prismaMock.$queryRaw.mockResolvedValueOnce([]);

    await expect(deleteRecurringTransaction("user-1", "missing")).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("deletes the rule when it exists and resolves without error", async () => {
    const { deleteRecurringTransaction } = await import("./recurringTransactionService");
    prismaMock.$queryRaw
      .mockResolvedValueOnce([makeRuleRow()]) // selectRecurringTransactionById
      .mockResolvedValueOnce([]); // DELETE

    await expect(deleteRecurringTransaction("user-1", "rule-1")).resolves.toBeUndefined();
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
  });
});

describe("setRecurringTransactionActive", () => {
  it("throws 404 when the rule does not exist", async () => {
    const { setRecurringTransactionActive } = await import("./recurringTransactionService");
    prismaMock.$queryRaw.mockResolvedValueOnce([]);

    await expect(setRecurringTransactionActive("user-1", "missing", false)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("returns the updated rule on success", async () => {
    const { setRecurringTransactionActive } = await import("./recurringTransactionService");
    prismaMock.$queryRaw
      .mockResolvedValueOnce([makeRuleRow()]) // selectRecurringTransactionById
      .mockResolvedValueOnce([makeRuleRow({ active: false, amount: "1200" })]); // UPDATE RETURNING

    const result = await setRecurringTransactionActive("user-1", "rule-1", false);

    expect(result.active).toBe(false);
    expect(result.amount).toBe(1200);
  });
});

describe("applyDueRecurringTransactions — endDate deactivation", () => {
  it("deactivates a rule whose nextRunAt has already passed endDate without applying it", async () => {
    const { applyDueRecurringTransactions } = await import("./recurringTransactionService");
    prismaMock.$queryRaw
      .mockResolvedValueOnce([
        makeRuleRow({
          endDate: new Date("2026-03-31T00:00:00.000Z"),
          nextRunAt: new Date("2026-04-01T00:00:00.000Z"),
          lastRunAt: new Date("2026-03-01T00:00:00.000Z"),
        }),
      ])
      .mockResolvedValueOnce([]); // UPDATE to set active = false

    const result = await applyDueRecurringTransactions(
      "user-1",
      new Date("2026-04-19T00:00:00.000Z")
    );

    expect(result.appliedCount).toBe(0);
    expect(result.failedCount).toBe(0);
    expect(accountServiceMock.deposit).not.toHaveBeenCalled();
    expect(accountServiceMock.withdraw).not.toHaveBeenCalled();
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
  });
});
