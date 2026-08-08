import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountType, TransactionType } from "@prisma/client";
import {
  listAccounts,
  createAccount,
  getAccount,
  updateNickname,
  getMonthlySummary,
  getCategoryBreakdown,
  getMonthlyTrends,
  getNetWorthHistory,
  recordNetWorthSnapshot,
  deposit,
  withdraw,
  transfer,
  getTransactions,
  updateTransaction,
  deleteTransaction,
  freezeAccount,
  unfreezeAccount,
  deleteAccount,
  importTransactions,
} from "./accountService";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
    account: { update: vi.fn(), delete: vi.fn(), findMany: vi.fn() },
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
        transaction: {
          delete: vi.fn().mockResolvedValue({}),
          update: vi.fn().mockResolvedValue({}),
        },
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

describe("getTransactions", () => {
  it("throws 404 when the account does not exist", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]);
    await expect(getTransactions("u-1", "a-1")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("returns all transactions normalized when no filters are applied", async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([makeAccountRow()])
      .mockResolvedValueOnce([makeTxnRow({ amount: "75.00", balanceAfter: "175.00" })]);
    const txns = await getTransactions("u-1", "a-1");
    expect(txns).toHaveLength(1);
    expect(txns[0].amount).toBe(75);
    expect(txns[0].balanceAfter).toBe(175);
  });

  it("filters by transaction type", async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([makeAccountRow()])
      .mockResolvedValueOnce([
        makeTxnRow({ id: "t-1", type: "DEPOSIT" }),
        makeTxnRow({ id: "t-2", type: "WITHDRAWAL" }),
      ]);
    const txns = await getTransactions("u-1", "a-1", { type: TransactionType.WITHDRAWAL });
    expect(txns).toHaveLength(1);
    expect(txns[0].id).toBe("t-2");
  });

  it("filters by a specific category", async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([makeAccountRow()])
      .mockResolvedValueOnce([
        makeTxnRow({ id: "t-1", category: "Groceries" }),
        makeTxnRow({ id: "t-2", category: "Dining" }),
      ]);
    const txns = await getTransactions("u-1", "a-1", { category: "Groceries" });
    expect(txns).toHaveLength(1);
    expect(txns[0].id).toBe("t-1");
  });

  it("filters 'Uncategorized' to transactions with a null category", async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([makeAccountRow()])
      .mockResolvedValueOnce([
        makeTxnRow({ id: "t-1", category: null }),
        makeTxnRow({ id: "t-2", category: "Groceries" }),
      ]);
    const txns = await getTransactions("u-1", "a-1", { category: "Uncategorized" });
    expect(txns).toHaveLength(1);
    expect(txns[0].id).toBe("t-1");
  });

  it("filters by search text case-insensitively against description", async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([makeAccountRow()])
      .mockResolvedValueOnce([
        makeTxnRow({ id: "t-1", description: "Coffee Shop Run", merchant: null }),
        makeTxnRow({ id: "t-2", description: "Grocery Store", merchant: null }),
      ]);
    const txns = await getTransactions("u-1", "a-1", { search: "coffee" });
    expect(txns).toHaveLength(1);
    expect(txns[0].id).toBe("t-1");
  });

  it("filters by search text against merchant name", async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([makeAccountRow()])
      .mockResolvedValueOnce([
        makeTxnRow({ id: "t-1", description: null, merchant: "Starbucks" }),
        makeTxnRow({ id: "t-2", description: null, merchant: "Walmart" }),
      ]);
    const txns = await getTransactions("u-1", "a-1", { search: "starbucks" });
    expect(txns).toHaveLength(1);
    expect(txns[0].id).toBe("t-1");
  });

  it("excludes transactions outside the requested date range", async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([makeAccountRow()])
      .mockResolvedValueOnce([
        makeTxnRow({ id: "t-1", effectiveAt: new Date("2026-03-15T00:00:00.000Z") }),
        makeTxnRow({ id: "t-2", effectiveAt: new Date("2026-04-15T00:00:00.000Z") }),
      ]);
    const txns = await getTransactions("u-1", "a-1", {
      start: new Date("2026-03-01T00:00:00.000Z"),
      end: new Date("2026-04-01T00:00:00.000Z"),
    });
    expect(txns).toHaveLength(1);
    expect(txns[0].id).toBe("t-1");
  });
});

describe("updateTransaction", () => {
  it("throws 400 when the amount is zero or negative", async () => {
    await expect(updateTransaction("u-1", "a-1", "t-1", { amount: 0 })).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(updateTransaction("u-1", "a-1", "t-1", { amount: -10 })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("throws 404 when the transaction does not belong to the account", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([makeAccountRow()]).mockResolvedValueOnce([]);
    await expect(updateTransaction("u-1", "a-1", "t-99", { amount: 50 })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("updates a deposit and returns the refreshed account", async () => {
    prismaMock.$transaction.mockImplementationOnce((fn: (tx: unknown) => unknown) =>
      fn({
        $queryRaw: prismaMock.$queryRaw,
        account: { update: vi.fn().mockResolvedValue({}) },
        transaction: { update: vi.fn().mockResolvedValue({}) },
      })
    );
    prismaMock.$queryRaw
      .mockResolvedValueOnce([makeAccountRow()])
      .mockResolvedValueOnce([makeTxnRow({ type: "DEPOSIT" })])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeAccountRow({ balance: "75.00" })]);
    const account = await updateTransaction("u-1", "a-1", "t-1", { amount: 75 });
    expect(account.balance).toBe(75);
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });
});

describe("deleteTransaction", () => {
  it("throws 404 when the transaction does not belong to the account", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([makeAccountRow()]).mockResolvedValueOnce([]);
    await expect(deleteTransaction("u-1", "a-1", "t-99")).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("deletes a non-transfer transaction and replays balances", async () => {
    prismaMock.$transaction.mockImplementationOnce((fn: (tx: unknown) => unknown) =>
      fn({
        $queryRaw: prismaMock.$queryRaw,
        account: { update: vi.fn().mockResolvedValue({}) },
        transaction: { delete: vi.fn().mockResolvedValue({}) },
      })
    );
    prismaMock.$queryRaw
      .mockResolvedValueOnce([makeAccountRow()])
      .mockResolvedValueOnce([makeTxnRow({ type: "DEPOSIT" })])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeAccountRow({ balance: "50.00" })]);
    const account = await deleteTransaction("u-1", "a-1", "t-1");
    expect(account.balance).toBe(50);
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });
});

describe("getCategoryBreakdown", () => {
  it("coerces spending to numbers and returns category rows", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      {
        category: "Groceries",
        accountId: "a-1",
        accountOwnerName: "Test User",
        accountNickname: null,
        spending: "120.50",
      },
    ]);
    const rows = await getCategoryBreakdown("u-1");
    expect(rows).toHaveLength(1);
    expect(rows[0].spending).toBe(120.5);
    expect(typeof rows[0].spending).toBe("number");
  });

  it("returns an empty array when there are no spending rows", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]);
    expect(await getCategoryBreakdown("u-1")).toEqual([]);
  });
});

describe("getMonthlyTrends", () => {
  it("formats months as YYYY-MM and computes net cash flow", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      { month: new Date("2026-03-01T00:00:00.000Z"), income: "1000", spending: "400" },
      { month: new Date("2026-04-01T00:00:00.000Z"), income: "1200", spending: "350" },
    ]);
    const rows = await getMonthlyTrends("u-1", 6);
    expect(rows).toHaveLength(2);
    expect(rows[0].month).toBe("2026-03");
    expect(rows[0].net).toBe(600);
    expect(rows[1].month).toBe("2026-04");
    expect(rows[1].net).toBe(850);
  });

  it("returns an empty array when there are no rows", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]);
    expect(await getMonthlyTrends("u-1")).toEqual([]);
  });
});

describe("getNetWorthHistory", () => {
  it("returns rows oldest-first (reversed from DESC DB order)", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      { id: "s-2", month: "2026-02", netWorth: "8000", totalAssets: "8000", totalDebt: "0" },
      { id: "s-1", month: "2026-01", netWorth: "7000", totalAssets: "7000", totalDebt: "0" },
    ]);
    const rows = await getNetWorthHistory("u-1", 12);
    expect(rows[0].month).toBe("2026-01");
    expect(rows[1].month).toBe("2026-02");
  });

  it("coerces monetary values to numbers", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      {
        id: "s-1",
        month: "2026-01",
        netWorth: "5000.50",
        totalAssets: "6000",
        totalDebt: "999.50",
      },
    ]);
    const [row] = await getNetWorthHistory("u-1");
    expect(row.netWorth).toBe(5000.5);
    expect(row.totalAssets).toBe(6000);
    expect(row.totalDebt).toBe(999.5);
  });
});

describe("recordNetWorthSnapshot", () => {
  it("calculates net worth from non-credit assets minus credit debt", async () => {
    prismaMock.account.findMany.mockResolvedValueOnce([
      { accountType: "CHEQUING", balance: { toNumber: () => 3000 } },
      { accountType: "SAVINGS", balance: { toNumber: () => 2000 } },
      { accountType: "CREDIT", balance: { toNumber: () => 500 } },
    ]);
    prismaMock.$queryRaw.mockResolvedValueOnce([{ id: "snap-1" }]);
    const snap = await recordNetWorthSnapshot("u-1");
    expect(snap.totalAssets).toBe(5000);
    expect(snap.totalDebt).toBe(500);
    expect(snap.netWorth).toBe(4500);
    expect(snap.id).toBe("snap-1");
  });
});

describe("importTransactions", () => {
  it("throws 403 when the account is frozen", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([makeAccountRow({ frozen: true })]);
    await expect(
      importTransactions("u-1", "a-1", [{ type: "DEPOSIT", amount: 100, effectiveAt: new Date() }])
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("returns imported: 0 without touching the DB when rows is empty", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([makeAccountRow()]);
    const result = await importTransactions("u-1", "a-1", []);
    expect(result.imported).toBe(0);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("runs the transaction and returns the correct row count", async () => {
    prismaMock.$transaction.mockImplementationOnce((fn: (tx: unknown) => unknown) =>
      fn({
        $queryRaw: prismaMock.$queryRaw,
        account: { update: vi.fn().mockResolvedValue({}) },
        transaction: { update: vi.fn().mockResolvedValue({}) },
      })
    );
    prismaMock.$queryRaw
      .mockResolvedValueOnce([makeAccountRow()])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeAccountRow({ balance: "100.00" })]);
    const result = await importTransactions("u-1", "a-1", [
      { type: "DEPOSIT", amount: 100, effectiveAt: new Date() },
    ]);
    expect(result.imported).toBe(1);
    expect(result.account.balance).toBe(100);
  });
});
