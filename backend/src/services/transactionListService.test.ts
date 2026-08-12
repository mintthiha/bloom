import { beforeEach, describe, expect, it, vi } from "vitest";
import { listTransactions } from "./transactionListService";

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

type ListRow = {
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

/** Builds a raw list row with Postgres-style string amounts by default. */
function makeRow(overrides?: Partial<ListRow>): ListRow {
  return {
    id: "t-1",
    type: "DEPOSIT",
    amount: "100.00",
    effectiveAt: new Date("2026-02-01"),
    description: "Paycheque",
    merchant: null,
    category: "Income",
    accountId: "a-1",
    accountName: "Chequing",
    accountNickname: null,
    accountType: "CHEQUING",
    ...overrides,
  };
}

/**
 * Queues the two $queryRaw responses the service makes per call — the page of rows and the
 * count row — in the order Promise.all invokes them (data query first, count query second).
 */
function mockQuery(rows: ListRow[], total: number): void {
  prismaMock.$queryRaw.mockResolvedValueOnce(rows).mockResolvedValueOnce([{ count: total }]);
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("listTransactions", () => {
  it("returns empty rows, a zero total, and hasMore false when nothing matches", async () => {
    mockQuery([], 0);

    const result = await listTransactions("u-1");

    expect(result.rows).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.hasMore).toBe(false);
  });

  it("coerces string amounts to numbers", async () => {
    mockQuery([makeRow({ amount: "100.00" })], 1);

    const result = await listTransactions("u-1");

    expect(typeof result.rows[0].amount).toBe("number");
    expect(result.rows[0].amount).toBe(100);
  });

  it("defaults to page 1 and a limit of 25", async () => {
    mockQuery([], 0);

    const result = await listTransactions("u-1");

    expect(result.page).toBe(1);
    expect(result.limit).toBe(25);
  });

  it("reports hasMore true when more rows exist beyond the current page", async () => {
    mockQuery([makeRow()], 100);

    const result = await listTransactions("u-1", { page: 1, limit: 25 });

    expect(result.hasMore).toBe(true);
  });

  it("reports hasMore false on the last page", async () => {
    mockQuery([makeRow()], 50);

    const result = await listTransactions("u-1", { page: 2, limit: 25 });

    expect(result.hasMore).toBe(false);
  });

  it("clamps a too-large limit down to the 100 maximum", async () => {
    mockQuery([], 0);

    const result = await listTransactions("u-1", { limit: 500 });

    expect(result.limit).toBe(100);
  });

  it("clamps a non-positive limit up to 1", async () => {
    mockQuery([], 0);

    const result = await listTransactions("u-1", { limit: 0 });

    expect(result.limit).toBe(1);
  });

  it("floors a fractional limit", async () => {
    mockQuery([], 0);

    const result = await listTransactions("u-1", { limit: 10.9 });

    expect(result.limit).toBe(10);
  });

  it("clamps a non-positive page up to 1", async () => {
    mockQuery([], 0);

    const result = await listTransactions("u-1", { page: 0 });

    expect(result.page).toBe(1);
  });

  it("falls back to total 0 when the count query returns no rows", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await listTransactions("u-1");

    expect(result.total).toBe(0);
    expect(result.hasMore).toBe(false);
  });

  it("accepts each non-default sort key without throwing", async () => {
    for (const sort of ["date_asc", "amount_desc", "amount_asc"] as const) {
      mockQuery([], 0);
      const result = await listTransactions("u-1", { sort });
      expect(result.rows).toEqual([]);
    }
  });
});
