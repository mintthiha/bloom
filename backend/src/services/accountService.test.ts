import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountType } from "@prisma/client";
import {
  listAccounts,
  createAccount,
  getAccount,
  updateNickname,
  getMonthlySummary,
  deposit,
  withdraw,
  transfer,
  freezeAccount,
  unfreezeAccount,
  deleteAccount,
} from "./accountService";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
    account: { update: vi.fn(), delete: vi.fn() },
    transaction: { deleteMany: vi.fn(), update: vi.fn() },
  },
}));

// Keep the real Prisma namespace (Prisma.Decimal) and enums; only swap PrismaClient for the mock.
vi.mock("@prisma/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@prisma/client")>();
  return {
    ...actual,
    PrismaClient: class {
      $queryRaw = prismaMock.$queryRaw;
      $transaction = prismaMock.$transaction;
      account = prismaMock.account;
      transaction = prismaMock.transaction;
    },
  };
});

type AccountRow = {
  id: string;
  userId: string;
  ownerName: string;
  nickname: string | null;
  accountType: AccountType;
  balance: string;
  frozen: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/** Builds a raw account row as Postgres returns it (balance is a Decimal string). */
function makeAccountRow(overrides?: Partial<AccountRow>): AccountRow {
  return {
    id: "a-1",
    userId: "u-1",
    ownerName: "Test User",
    nickname: null,
    accountType: AccountType.CHEQUING,
    balance: "100.00",
    frozen: false,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

/** Minimal raw transaction row returned by the INSERT ... RETURNING in createTransaction. */
function makeTxnRow(overrides?: Record<string, unknown>) {
  return {
    id: "t-1",
    type: "DEPOSIT",
    amount: "50.00",
    balanceAfter: "150.00",
    transferGroupId: null,
    category: null,
    merchant: null,
    description: null,
    effectiveAt: new Date("2026-02-01"),
    createdAt: new Date("2026-02-01"),
    fromAccountId: null,
    toAccountId: "a-1",
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  // Default: run the callback form of $transaction with a fake tx that shares the query mock;
  // resolve the array form (used by deleteAccount) via Promise.all.
  prismaMock.$transaction.mockImplementation((arg: unknown) => {
    if (typeof arg === "function") {
      return (arg as (tx: unknown) => unknown)({
        account: { update: vi.fn().mockResolvedValue({}) },
        $queryRaw: prismaMock.$queryRaw,
      });
    }
    return Promise.all(arg as Promise<unknown>[]);
  });
});

describe("listAccounts", () => {
  it("coerces the Decimal balance to a number", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([makeAccountRow({ balance: "250.75" })]);
    const [account] = await listAccounts("u-1");
    expect(account.balance).toBe(250.75);
    expect(typeof account.balance).toBe("number");
  });
});

describe("createAccount", () => {
  it("throws 400 when ownerName is blank", async () => {
    await expect(createAccount("u-1", "   ")).rejects.toMatchObject({ statusCode: 400 });
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it("throws 400 for an invalid account type", async () => {
    await expect(
      createAccount("u-1", "Test User", "BROKERAGE" as AccountType)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("inserts and returns the normalized account on success", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([makeAccountRow({ balance: "0" })]);
    const account = await createAccount("u-1", "Test User", AccountType.SAVINGS);
    expect(account.balance).toBe(0);
  });
});

describe("getAccount", () => {
  it("throws 404 when the account does not belong to the user", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]);
    await expect(getAccount("u-1", "a-99")).rejects.toMatchObject({
      statusCode: 404,
      message: "Account a-99 not found",
    });
  });

  it("returns the normalized account when found", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([makeAccountRow()]);
    const account = await getAccount("u-1", "a-1");
    expect(account.id).toBe("a-1");
  });
});

describe("updateNickname", () => {
  it("propagates the 404 from the ownership check", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]);
    await expect(updateNickname("u-1", "a-1", "Everyday")).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("updates and returns the account when it exists", async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([makeAccountRow()]) // getAccount
      .mockResolvedValueOnce([makeAccountRow({ nickname: "Everyday" })]); // UPDATE RETURNING
    const account = await updateNickname("u-1", "a-1", "Everyday");
    expect(account.nickname).toBe("Everyday");
  });
});

describe("getMonthlySummary", () => {
  it("builds the monthly summary from income and spending categories", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      { category: "Groceries", income: 0, spending: 120.5 },
      { category: "Salary", income: "2500", spending: "0" },
      { category: "Dining", income: 0, spending: "75.25" },
    ]);

    const result = await getMonthlySummary("u-1", { now: new Date("2026-04-08T12:00:00.000Z") });

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

  it("returns an empty summary when there are no matching transactions", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]);

    const result = await getMonthlySummary("u-1", { now: new Date("2026-04-08T12:00:00.000Z") });

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

describe("deposit", () => {
  it("throws 400 for a non-positive amount", async () => {
    await expect(deposit("u-1", "a-1", 0)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 404 when the account is missing", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]);
    await expect(deposit("u-1", "a-1", 50)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("throws 403 when the account is frozen", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([makeAccountRow({ frozen: true })]);
    await expect(deposit("u-1", "a-1", 50)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("records the transaction and returns the updated account on success", async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([makeAccountRow({ balance: "100.00" })]) // select
      .mockResolvedValueOnce([makeTxnRow({ amount: "50.00", balanceAfter: "150.00" })]) // insert
      .mockResolvedValueOnce([makeAccountRow({ balance: "150.00" })]); // final getAccount
    const [account, txn] = await deposit("u-1", "a-1", 50);
    expect(account.balance).toBe(150);
    expect(txn.amount).toBe(50);
  });
});

describe("withdraw", () => {
  it("throws 400 for a non-positive amount", async () => {
    await expect(withdraw("u-1", "a-1", -5)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 403 when the account is frozen", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([makeAccountRow({ frozen: true })]);
    await expect(withdraw("u-1", "a-1", 10)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("throws 400 on insufficient funds", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([makeAccountRow({ balance: "5.00" })]);
    await expect(withdraw("u-1", "a-1", 10)).rejects.toMatchObject({
      statusCode: 400,
      message: "Insufficient funds",
    });
  });

  it("records the withdrawal and returns the updated account on success", async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([makeAccountRow({ balance: "100.00" })])
      .mockResolvedValueOnce([
        makeTxnRow({ type: "WITHDRAWAL", amount: "30.00", balanceAfter: "70.00" }),
      ])
      .mockResolvedValueOnce([makeAccountRow({ balance: "70.00" })]);
    const [account, txn] = await withdraw("u-1", "a-1", 30);
    expect(account.balance).toBe(70);
    expect(txn.amount).toBe(30);
  });
});

describe("transfer", () => {
  it("throws 400 for a non-positive amount", async () => {
    await expect(transfer("u-1", "a-1", "a-2", 0)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when source and destination are the same", async () => {
    await expect(transfer("u-1", "a-1", "a-1", 10)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 404 when the source account is missing", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]);
    await expect(transfer("u-1", "a-1", "a-2", 10)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("throws 403 when the source account is frozen", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([makeAccountRow({ id: "a-1", frozen: true })]);
    await expect(transfer("u-1", "a-1", "a-2", 10)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("throws 400 when the source has insufficient funds", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([makeAccountRow({ id: "a-1", balance: "5.00" })]);
    await expect(transfer("u-1", "a-1", "a-2", 10)).rejects.toMatchObject({
      statusCode: 400,
      message: "Insufficient funds",
    });
  });

  it("throws 404 when the destination account is missing", async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([makeAccountRow({ id: "a-1", balance: "100.00" })]) // source
      .mockResolvedValueOnce([]); // destination
    await expect(transfer("u-1", "a-1", "a-2", 10)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("throws 403 when the destination account is frozen", async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([makeAccountRow({ id: "a-1", balance: "100.00" })])
      .mockResolvedValueOnce([makeAccountRow({ id: "a-2", frozen: true })]);
    await expect(transfer("u-1", "a-1", "a-2", 10)).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe("freezeAccount / unfreezeAccount", () => {
  it("freezes an existing account", async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([makeAccountRow({ frozen: false })]) // getAccount (guard)
      .mockResolvedValueOnce([makeAccountRow({ frozen: true })]); // getAccount (return)
    prismaMock.account.update.mockResolvedValueOnce({});
    const account = await freezeAccount("u-1", "a-1");
    expect(account.frozen).toBe(true);
    expect(prismaMock.account.update).toHaveBeenCalledWith({
      where: { id: "a-1" },
      data: { frozen: true },
    });
  });

  it("throws 404 when unfreezing a missing account", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]);
    await expect(unfreezeAccount("u-1", "a-9")).rejects.toMatchObject({ statusCode: 404 });
    expect(prismaMock.account.update).not.toHaveBeenCalled();
  });
});

describe("deleteAccount", () => {
  it("throws 404 when the account is missing", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]);
    await expect(deleteAccount("u-1", "a-9")).rejects.toMatchObject({ statusCode: 404 });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("deletes the account and its transactions atomically", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([makeAccountRow()]);
    prismaMock.transaction.deleteMany.mockResolvedValueOnce({ count: 3 });
    prismaMock.account.delete.mockResolvedValueOnce({});
    await expect(deleteAccount("u-1", "a-1")).resolves.toBeUndefined();
    expect(prismaMock.transaction.deleteMany).toHaveBeenCalled();
    expect(prismaMock.account.delete).toHaveBeenCalledWith({ where: { id: "a-1" } });
  });
});
