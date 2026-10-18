import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SpendingLookupQuery } from "./chatSpendingLookup";
import { lookUpSpending } from "./spendingLookupService";

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

const SEPTEMBER: Pick<SpendingLookupQuery, "start" | "end" | "periodLabel"> = {
  start: new Date("2026-09-01T00:00:00.000Z"),
  end: new Date("2026-10-01T00:00:00.000Z"),
  periodLabel: "in September 2026",
};

/** Rebuilds each SQL query the service ran, with its bound values, from the mocked tagged calls. */
function executedQueries(): { sql: string; values: unknown[] }[] {
  return prismaMock.$queryRaw.mock.calls.map(([templateStrings, ...templateValues]) => {
    const query = Prisma.sql(templateStrings as TemplateStringsArray, ...templateValues);
    return { sql: query.text, values: query.values };
  });
}

/** Has the totals query, then the largest-purchase query, return the given rows. */
function mockLookupRows(totalRow: unknown, largestPurchaseRows: unknown[]) {
  prismaMock.$queryRaw.mockResolvedValueOnce([totalRow]).mockResolvedValueOnce(largestPurchaseRows);
}

beforeEach(() => {
  prismaMock.$queryRaw.mockReset();
});

describe("lookUpSpending", () => {
  it("returns the total, the purchase count, and the largest purchase as numbers", async () => {
    mockLookupRows({ total: "19.0000", purchaseCount: BigInt(2) }, [
      {
        amount: "14.5000",
        effectiveAt: new Date("2026-09-12T00:00:00.000Z"),
        merchant: "Tim Hortons",
        description: "TIM HORTONS #1234",
      },
    ]);

    await expect(
      lookUpSpending("u-1", { merchant: "Tim Hortons", category: null, ...SEPTEMBER })
    ).resolves.toEqual({
      total: 19,
      purchaseCount: 2,
      largestPurchase: {
        amount: 14.5,
        effectiveAt: new Date("2026-09-12T00:00:00.000Z"),
        label: "Tim Hortons",
      },
    });
  });

  it("labels the largest purchase by its description when it has no merchant", async () => {
    mockLookupRows({ total: "88.0000", purchaseCount: 1 }, [
      {
        amount: "88.0000",
        effectiveAt: new Date("2026-09-14T00:00:00.000Z"),
        merchant: null,
        description: "THE KEG STEAKHOUSE",
      },
    ]);

    const result = await lookUpSpending("u-1", { merchant: null, category: null, ...SEPTEMBER });

    expect(result.largestPurchase?.label).toBe("THE KEG STEAKHOUSE");
  });

  it("reports nothing spent when no purchase matches", async () => {
    mockLookupRows({ total: null, purchaseCount: BigInt(0) }, []);

    await expect(
      lookUpSpending("u-1", { merchant: "Starbucks", category: null, ...SEPTEMBER })
    ).resolves.toEqual({ total: 0, purchaseCount: 0, largestPurchase: null });
  });

  it("counts only the user's spending in the period, the way the monthly summary does", async () => {
    mockLookupRows({ total: null, purchaseCount: 0 }, []);

    await lookUpSpending("u-1", { merchant: null, category: null, ...SEPTEMBER });

    const [totalsQuery, largestQuery] = executedQueries();
    for (const { sql, values } of [totalsQuery!, largestQuery!]) {
      expect(sql).toContain(`FROM "TransactionLineItem" li`);
      expect(sql).toMatch(/li\."type" = 'WITHDRAWAL'.*a\."accountType" != 'CREDIT'/s);
      expect(sql).toMatch(/li\."type" = 'DEPOSIT'.*a\."accountType" = 'CREDIT'/s);
      expect(sql).toContain(`a."deletedAt" IS NULL`);
      expect(sql).toContain(`li."deletedAt" IS NULL`);
      expect(sql).not.toContain("LIKE");
      expect(values).toEqual(["u-1", SEPTEMBER.start, SEPTEMBER.end]);
    }
    expect(totalsQuery!.sql).toContain(`COUNT(DISTINCT li."id")`);
    expect(largestQuery!.sql).toMatch(/ORDER BY li\."amount" DESC.*LIMIT 1/s);
  });

  it("matches a merchant in the merchant or description, ignoring case and escaping wildcards", async () => {
    mockLookupRows({ total: null, purchaseCount: 0 }, []);

    await lookUpSpending("u-1", { merchant: "A&W_100%", category: null, ...SEPTEMBER });

    const [totalsQuery] = executedQueries();
    expect(totalsQuery!.sql).toMatch(
      /LOWER\(t\."merchant"\) LIKE \$\d+ OR LOWER\(li\."description"\) LIKE \$\d+/
    );
    expect(totalsQuery!.values).toContain("%a&w\\_100\\%%");
  });

  it("filters to one category, ignoring case", async () => {
    mockLookupRows({ total: null, purchaseCount: 0 }, []);

    await lookUpSpending("u-1", { merchant: null, category: "Dining", ...SEPTEMBER });

    const [totalsQuery] = executedQueries();
    expect(totalsQuery!.sql).toMatch(/LOWER\(li\."category"\) = LOWER\(\$\d+\)/);
    expect(totalsQuery!.values).toContain("Dining");
  });
});
