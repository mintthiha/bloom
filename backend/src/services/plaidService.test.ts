import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountType, TransactionType } from "@prisma/client";
import { AppError } from "../middleware/errorHandler";
import { createLinkToken, exchangePublicToken, syncAccountsAndTransactions } from "./plaidService";

// Shared Plaid client method mocks — the same fns back every `new PlaidApi()` instance so the
// lazily-created singleton inside plaidService is fully controllable regardless of when it is built.
const { plaidMethods } = vi.hoisted(() => ({
  plaidMethods: {
    linkTokenCreate: vi.fn(),
    itemPublicTokenExchange: vi.fn(),
    accountsGet: vi.fn(),
    transactionsGet: vi.fn(),
  },
}));

vi.mock("plaid", () => ({
  Configuration: class {},
  PlaidApi: class {
    linkTokenCreate = plaidMethods.linkTokenCreate;
    itemPublicTokenExchange = plaidMethods.itemPublicTokenExchange;
    accountsGet = plaidMethods.accountsGet;
    transactionsGet = plaidMethods.transactionsGet;
  },
  PlaidEnvironments: { sandbox: "https://sandbox.plaid.com" },
  Products: { Auth: "auth", Transactions: "transactions" },
  CountryCode: { Us: "US", Ca: "CA" },
}));

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    plaidItem: { findUnique: vi.fn(), upsert: vi.fn() },
    account: { upsert: vi.fn() },
    transaction: { upsert: vi.fn() },
  },
}));

vi.mock("../lib/prisma", () => ({ default: prismaMock }));

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.PLAID_CLIENT_ID = "test-client";
  process.env.PLAID_SECRET = "test-secret";
});

afterAll(() => {
  process.env = originalEnv;
});

describe("getPlaidClient (via createLinkToken)", () => {
  // Must run before any successful call caches the singleton, so the missing-credential
  // branch is actually reachable.
  it("throws 503 when Plaid credentials are not configured", async () => {
    delete process.env.PLAID_CLIENT_ID;
    delete process.env.PLAID_SECRET;
    await expect(createLinkToken("u-1")).rejects.toBeInstanceOf(AppError);
    await expect(createLinkToken("u-1")).rejects.toMatchObject({ statusCode: 503 });
  });
});

describe("createLinkToken", () => {
  it("returns the link token from the Plaid response", async () => {
    plaidMethods.linkTokenCreate.mockResolvedValue({ data: { link_token: "link-abc" } });
    await expect(createLinkToken("user-1")).resolves.toBe("link-abc");
    expect(plaidMethods.linkTokenCreate).toHaveBeenCalledWith(
      expect.objectContaining({ user: { client_user_id: "user-1" } })
    );
  });
});

describe("exchangePublicToken", () => {
  it("exchanges the token, upserts the item, and syncs", async () => {
    plaidMethods.itemPublicTokenExchange.mockResolvedValue({
      data: { access_token: "access-1", item_id: "item-1" },
    });
    prismaMock.plaidItem.upsert.mockResolvedValue({});
    prismaMock.plaidItem.findUnique.mockResolvedValue({
      itemId: "item-1",
      userId: "user-1",
      accessToken: "access-1",
      institutionName: "Test Bank",
    });
    plaidMethods.accountsGet.mockResolvedValue({ data: { accounts: [] } });
    plaidMethods.transactionsGet.mockResolvedValue({
      data: { transactions: [], total_transactions: 0 },
    });

    const result = await exchangePublicToken("public-1", "user-1", "Test Bank");

    expect(result).toEqual({ itemId: "item-1", accountsLinked: 0 });
    expect(prismaMock.plaidItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { itemId: "item-1" },
        create: expect.objectContaining({ userId: "user-1", accessToken: "access-1" }),
      })
    );
  });
});

describe("syncAccountsAndTransactions", () => {
  /** Wires the item lookup to a valid, user-owned item for the happy-path sync tests. */
  function stubValidItem() {
    prismaMock.plaidItem.findUnique.mockResolvedValue({
      itemId: "item-1",
      userId: "user-1",
      accessToken: "access-1",
      institutionName: "Test Bank",
    });
  }

  it("throws 404 when the item does not exist", async () => {
    prismaMock.plaidItem.findUnique.mockResolvedValue(null);
    await expect(syncAccountsAndTransactions("item-x", "user-1")).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("throws 404 when the item belongs to a different user", async () => {
    prismaMock.plaidItem.findUnique.mockResolvedValue({
      itemId: "item-1",
      userId: "someone-else",
      accessToken: "access-1",
      institutionName: "Test Bank",
    });
    await expect(syncAccountsAndTransactions("item-1", "user-1")).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("maps account subtypes to Bloom account types", async () => {
    stubValidItem();
    plaidMethods.accountsGet.mockResolvedValue({
      data: {
        accounts: [
          { account_id: "p-chk", name: "Chq", subtype: "checking", balances: { current: 100 } },
          { account_id: "p-sav", name: "Sav", subtype: "savings", balances: { current: 200 } },
          { account_id: "p-mm", name: "MM", subtype: "money market", balances: { current: 300 } },
          { account_id: "p-cc", name: "CC", subtype: "credit card", balances: { current: 50 } },
          { account_id: "p-unk", name: "Unk", subtype: "brokerage", balances: { current: 0 } },
          { account_id: "p-null", name: "Null", subtype: null, balances: { current: null } },
        ],
      },
    });
    prismaMock.account.upsert.mockImplementation((args) =>
      Promise.resolve({ id: `bloom-${args.where.plaidAccountId}` })
    );
    plaidMethods.transactionsGet.mockResolvedValue({
      data: { transactions: [], total_transactions: 0 },
    });

    const linked = await syncAccountsAndTransactions("item-1", "user-1");

    expect(linked).toBe(6);
    const typesByAccount = Object.fromEntries(
      prismaMock.account.upsert.mock.calls.map((call) => [
        call[0].where.plaidAccountId,
        call[0].create.accountType,
      ])
    );
    expect(typesByAccount["p-chk"]).toBe(AccountType.CHEQUING);
    expect(typesByAccount["p-sav"]).toBe(AccountType.SAVINGS);
    expect(typesByAccount["p-mm"]).toBe(AccountType.SAVINGS);
    expect(typesByAccount["p-cc"]).toBe(AccountType.CREDIT);
    expect(typesByAccount["p-unk"]).toBe(AccountType.CHEQUING);
    expect(typesByAccount["p-null"]).toBe(AccountType.CHEQUING);
    // Null current balance falls back to 0.
    const nullCall = prismaMock.account.upsert.mock.calls.find(
      (call) => call[0].where.plaidAccountId === "p-null"
    );
    expect(nullCall?.[0].create.balance).toBe(0);
  });

  it("classifies Plaid sign convention into deposits and withdrawals", async () => {
    stubValidItem();
    plaidMethods.accountsGet.mockResolvedValue({
      data: {
        accounts: [
          { account_id: "p-1", name: "Chq", subtype: "checking", balances: { current: 100 } },
        ],
      },
    });
    prismaMock.account.upsert.mockResolvedValue({ id: "bloom-1" });
    plaidMethods.transactionsGet.mockResolvedValue({
      data: {
        transactions: [
          {
            transaction_id: "t-out",
            account_id: "p-1",
            amount: 40, // positive = outflow
            date: "2026-03-01",
            name: "Coffee Shop",
            merchant_name: "Coffee",
            category: ["Food and Drink", "Coffee"],
          },
          {
            transaction_id: "t-in",
            account_id: "p-1",
            amount: -1000, // negative = inflow
            date: "2026-03-02",
            name: "Payroll",
            merchant_name: null,
            category: null,
          },
          {
            transaction_id: "t-orphan",
            account_id: "p-unknown", // not in the account map → skipped
            amount: 5,
            date: "2026-03-03",
            name: "Ghost",
            merchant_name: null,
            category: null,
          },
        ],
        total_transactions: 3,
      },
    });
    prismaMock.transaction.upsert.mockResolvedValue({});

    await syncAccountsAndTransactions("item-1", "user-1");

    const upsertedIds = prismaMock.transaction.upsert.mock.calls.map(
      (call) => call[0].where.plaidTransactionId
    );
    expect(upsertedIds).toEqual(["t-out", "t-in"]); // orphan skipped

    const outflow = prismaMock.transaction.upsert.mock.calls.find(
      (call) => call[0].where.plaidTransactionId === "t-out"
    )?.[0];
    expect(outflow.create.type).toBe(TransactionType.WITHDRAWAL);
    expect(outflow.create.amount).toBe(40);
    expect(outflow.create.fromAccountId).toBe("bloom-1");
    expect(outflow.create.category).toBe("Food and Drink");
    expect(outflow.create.merchant).toBe("Coffee");

    const inflow = prismaMock.transaction.upsert.mock.calls.find(
      (call) => call[0].where.plaidTransactionId === "t-in"
    )?.[0];
    expect(inflow.create.type).toBe(TransactionType.DEPOSIT);
    expect(inflow.create.amount).toBe(1000);
    expect(inflow.create.toAccountId).toBe("bloom-1");
    expect(inflow.create.category).toBeNull();
    // Falls back to txn name when merchant_name is absent.
    expect(inflow.create.merchant).toBe("Payroll");
  });

  it("pages through transactions until the reported total is reached", async () => {
    stubValidItem();
    plaidMethods.accountsGet.mockResolvedValue({
      data: {
        accounts: [
          { account_id: "p-1", name: "Chq", subtype: "checking", balances: { current: 100 } },
        ],
      },
    });
    prismaMock.account.upsert.mockResolvedValue({ id: "bloom-1" });
    prismaMock.transaction.upsert.mockResolvedValue({});

    /** Builds a page of n transactions with unique ids for the given page index. */
    function page(count: number, startIndex: number) {
      return Array.from({ length: count }, (_, i) => ({
        transaction_id: `t-${startIndex + i}`,
        account_id: "p-1",
        amount: 10,
        date: "2026-03-01",
        name: "Txn",
        merchant_name: "M",
        category: ["Shops"],
      }));
    }

    plaidMethods.transactionsGet
      .mockResolvedValueOnce({ data: { transactions: page(500, 0), total_transactions: 750 } })
      .mockResolvedValueOnce({ data: { transactions: page(250, 500), total_transactions: 750 } });

    await syncAccountsAndTransactions("item-1", "user-1");

    expect(plaidMethods.transactionsGet).toHaveBeenCalledTimes(2);
    expect(prismaMock.transaction.upsert).toHaveBeenCalledTimes(750);
  });

  it("stops paging when a page returns zero transactions", async () => {
    stubValidItem();
    plaidMethods.accountsGet.mockResolvedValue({
      data: {
        accounts: [
          { account_id: "p-1", name: "Chq", subtype: "checking", balances: { current: 100 } },
        ],
      },
    });
    prismaMock.account.upsert.mockResolvedValue({ id: "bloom-1" });
    // Claims 100 total but immediately returns an empty page — loop must break, not spin.
    plaidMethods.transactionsGet.mockResolvedValue({
      data: { transactions: [], total_transactions: 100 },
    });

    await syncAccountsAndTransactions("item-1", "user-1");

    expect(plaidMethods.transactionsGet).toHaveBeenCalledTimes(1);
    expect(prismaMock.transaction.upsert).not.toHaveBeenCalled();
  });
});
