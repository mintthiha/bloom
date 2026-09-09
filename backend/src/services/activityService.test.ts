import { beforeEach, describe, expect, it, vi } from "vitest";
import { listActivityLogs } from "./activityService";

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

type LogRow = {
  id: string;
  type: string;
  description: string;
  metadata: unknown;
  createdAt: Date;
};

/** Builds a raw activity log row. */
function makeRow(overrides?: Partial<LogRow>): LogRow {
  return {
    id: "log-1",
    type: "ACCOUNT_CREATED",
    description: "Created Chequing",
    metadata: null,
    createdAt: new Date("2026-02-01T12:00:00Z"),
    ...overrides,
  };
}

/**
 * Queues the two $queryRaw responses the service makes per call — the page of rows and the
 * count row — in the order Promise.all invokes them (data query first, count query second).
 */
function mockQuery(rows: LogRow[], total: number): void {
  prismaMock.$queryRaw
    .mockResolvedValueOnce(rows)
    .mockResolvedValueOnce([{ count: BigInt(total) }]);
}

/** Collects the interpolated values from every Prisma.Sql passed to the query mock. */
function allBoundValues(): unknown[] {
  return prismaMock.$queryRaw.mock.calls.flatMap((call) => call[0].values as unknown[]);
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("listActivityLogs", () => {
  it("returns the rows and coerces the bigint count to a number", async () => {
    mockQuery([makeRow()], 3);

    const result = await listActivityLogs("u-1");

    expect(result.logs).toHaveLength(1);
    expect(result.total).toBe(3);
    expect(typeof result.total).toBe("number");
  });

  it("falls back to total 0 when the count query returns no rows", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await listActivityLogs("u-1");

    expect(result.total).toBe(0);
  });

  it("always scopes the query to the requested user", async () => {
    mockQuery([], 0);

    await listActivityLogs("u-42");

    expect(allBoundValues()).toContain("u-42");
  });

  it("clamps a too-large limit down to the 100 maximum", async () => {
    mockQuery([], 0);

    await listActivityLogs("u-1", { limit: 500 });

    expect(allBoundValues()).toContain(100);
  });

  it("clamps a non-positive limit up to 1 and a negative offset up to 0", async () => {
    mockQuery([], 0);

    await listActivityLogs("u-1", { limit: 0, offset: -10 });

    const values = allBoundValues();
    expect(values).toContain(1);
    expect(values).toContain(0);
  });

  it("adds an escaped prefix LIKE pattern when filtering by group", async () => {
    mockQuery([], 0);

    await listActivityLogs("u-1", { group: "TRANSACTION" });

    expect(allBoundValues()).toContain("TRANSACTION\\_%");
  });

  it("adds a lowercased contains pattern when searching the description", async () => {
    mockQuery([], 0);

    await listActivityLogs("u-1", { search: "  Chequing  " });

    expect(allBoundValues()).toContain("%chequing%");
  });

  it("ignores a blank search term", async () => {
    mockQuery([], 0);

    await listActivityLogs("u-1", { search: "   " });

    expect(allBoundValues().some((v) => typeof v === "string" && v.includes("%"))).toBe(false);
  });

  it("binds both bounds only when a full date range is supplied", async () => {
    mockQuery([], 0);
    const start = new Date("2026-01-01T00:00:00Z");
    const end = new Date("2026-02-01T00:00:00Z");

    await listActivityLogs("u-1", { start, end });

    const values = allBoundValues();
    expect(values).toContain(start);
    expect(values).toContain(end);
  });

  it("does not bind a date bound when only one end of the range is supplied", async () => {
    mockQuery([], 0);
    const start = new Date("2026-01-01T00:00:00Z");

    await listActivityLogs("u-1", { start });

    expect(allBoundValues()).not.toContain(start);
  });

  it("accepts the ascending sort key without throwing", async () => {
    mockQuery([], 0);

    const result = await listActivityLogs("u-1", { sort: "date_asc" });

    expect(result.logs).toEqual([]);
  });
});
