import { beforeEach, describe, expect, it, vi } from "vitest";
import { searchTransactions } from "./transactionSearchService";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@prisma/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@prisma/client")>();
  return {
    ...actual,
    PrismaClient: class {
      $queryRaw = prismaMock.$queryRaw;
    },
  };
});

type SearchRow = {
  id: string;
  type: string;
  amount: number | string;
  effectiveAt: Date;
  description: string | null;
  merchant: string | null;
  category: string | null;
  accountId: string;
  accountName: string;
  accountNickname: string | null;
  accountType: string;
};

/** Builds a raw search row with Postgres-style string amounts by default. */
function makeRow(overrides?: Partial<SearchRow>): SearchRow {
  return {
    id: "t-1",
    type: "WITHDRAWAL",
    amount: "42.50",
    effectiveAt: new Date("2026-02-01"),
    description: "Groceries",
    merchant: "Metro",
    category: "Food",
    accountId: "a-1",
    accountName: "Chequing",
    accountNickname: null,
    accountType: "CHEQUING",
    ...overrides,
  };
}

/** Returns the interpolated values (excluding the template strings) from the first $queryRaw call. */
function getQueryValues(): unknown[] {
  return prismaMock.$queryRaw.mock.calls[0].slice(1);
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("searchTransactions", () => {
  it("returns an empty array when no rows match", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]);

    const result = await searchTransactions("u-1", "coffee");

    expect(result).toEqual([]);
  });

  it("coerces string amounts to numbers and preserves other fields", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([makeRow({ amount: "42.50", merchant: "Metro" })]);

    const [row] = await searchTransactions("u-1", "metro");

    expect(typeof row.amount).toBe("number");
    expect(row.amount).toBe(42.5);
    expect(row.merchant).toBe("Metro");
  });

  it("passes through amounts that are already numbers", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([makeRow({ amount: 12 })]);

    const [row] = await searchTransactions("u-1", "x");

    expect(row.amount).toBe(12);
  });

  it("returns one result per row returned by the database", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([makeRow({ id: "t-1" }), makeRow({ id: "t-2" })]);

    const result = await searchTransactions("u-1", "x");

    expect(result.map((r) => r.id)).toEqual(["t-1", "t-2"]);
  });

  it("lowercases the query into a LIKE pattern and scopes to the user", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]);

    await searchTransactions("u-1", "COFFEE");

    const values = getQueryValues();
    expect(values[0]).toBe("u-1");
    expect(values[1]).toBe("%coffee%");
  });

  it("clamps a too-large limit down to 50", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]);

    await searchTransactions("u-1", "x", 999);

    const values = getQueryValues();
    expect(values[values.length - 1]).toBe(50);
  });

  it("clamps a non-positive limit up to 1", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]);

    await searchTransactions("u-1", "x", 0);

    const values = getQueryValues();
    expect(values[values.length - 1]).toBe(1);
  });

  it("floors fractional limits", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]);

    await searchTransactions("u-1", "x", 10.9);

    const values = getQueryValues();
    expect(values[values.length - 1]).toBe(10);
  });

  it("defaults to a limit of 20 when none is provided", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]);

    await searchTransactions("u-1", "x");

    const values = getQueryValues();
    expect(values[values.length - 1]).toBe(20);
  });
});
