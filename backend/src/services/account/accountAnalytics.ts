// Read-side summaries: monthly summary, category breakdown, trends, and net-worth snapshots/history.
// Split out of accountService.ts, which re-exports its public API.
import { randomUUID } from "crypto";
import { resolveDateRange } from "../../lib/date-range";
import prisma from "../../lib/prisma";
import type { MonthlySummaryRow } from "./accountRecords";

/**
 * Builds a monthly cash-flow summary for a user's accounts.
 * Includes deposits as income and withdrawals as spending; transfers are excluded
 * because they move money between accounts instead of changing total cash flow.
 */
export async function getMonthlySummary(
  userId: string,
  input?: { start?: Date; end?: Date; now?: Date }
) {
  const dateRange = input ? resolveDateRange(input) : null;

  const rows = dateRange
    ? await prisma.$queryRaw<MonthlySummaryRow[]>`
        SELECT
          COALESCE(t."category", 'Uncategorized') AS "category",
          SUM(CASE WHEN t."type" = 'DEPOSIT'::"TransactionType" AND a."accountType" != 'CREDIT'::"AccountType" THEN t."amount" ELSE 0 END) AS "income",
          SUM(CASE
            WHEN t."type" = 'WITHDRAWAL'::"TransactionType" AND a."accountType" != 'CREDIT'::"AccountType" THEN t."amount"
            WHEN t."type" = 'DEPOSIT'::"TransactionType" AND a."accountType" = 'CREDIT'::"AccountType" THEN t."amount"
            ELSE 0
          END) AS "spending"
        FROM "TransactionLineItem" t
        JOIN "Account" a ON t."toAccountId" = a."id" OR t."fromAccountId" = a."id"
        WHERE a."userId" = ${userId}
          AND a."deletedAt" IS NULL
          AND t."deletedAt" IS NULL
          AND t."effectiveAt" >= ${dateRange.start}
          AND t."effectiveAt" < ${dateRange.end}
          AND t."type" IN ('DEPOSIT'::"TransactionType", 'WITHDRAWAL'::"TransactionType")
        GROUP BY COALESCE(t."category", 'Uncategorized')
        ORDER BY "spending" DESC, "income" DESC
      `
    : await prisma.$queryRaw<MonthlySummaryRow[]>`
        SELECT
          COALESCE(t."category", 'Uncategorized') AS "category",
          SUM(CASE WHEN t."type" = 'DEPOSIT'::"TransactionType" AND a."accountType" != 'CREDIT'::"AccountType" THEN t."amount" ELSE 0 END) AS "income",
          SUM(CASE
            WHEN t."type" = 'WITHDRAWAL'::"TransactionType" AND a."accountType" != 'CREDIT'::"AccountType" THEN t."amount"
            WHEN t."type" = 'DEPOSIT'::"TransactionType" AND a."accountType" = 'CREDIT'::"AccountType" THEN t."amount"
            ELSE 0
          END) AS "spending"
        FROM "TransactionLineItem" t
        JOIN "Account" a ON t."toAccountId" = a."id" OR t."fromAccountId" = a."id"
        WHERE a."userId" = ${userId}
          AND a."deletedAt" IS NULL
          AND t."deletedAt" IS NULL
          AND t."type" IN ('DEPOSIT'::"TransactionType", 'WITHDRAWAL'::"TransactionType")
        GROUP BY COALESCE(t."category", 'Uncategorized')
        ORDER BY "spending" DESC, "income" DESC
      `;

  const categories = rows.map((row) => ({
    category: row.category,
    income: Number(row.income ?? 0),
    spending: Number(row.spending ?? 0),
  }));
  const income = categories.reduce((sum, category) => sum + category.income, 0);
  const spending = categories.reduce((sum, category) => sum + category.spending, 0);
  const topExpenseCategory = categories.find((category) => category.spending > 0)?.category ?? null;

  return {
    month: dateRange ? dateRange.start.toISOString().slice(0, 7) : "all-time",
    income,
    spending,
    netCashFlow: income - spending,
    topExpenseCategory,
    categories,
  };
}

type CategoryBreakdownRow = {
  category: string;
  accountId: string;
  accountOwnerName: string;
  accountNickname: string | null;
  spending: number | string | null;
};

/**
 * Returns spending grouped by (category, account) for use in the 50/30/20 breakdown drilldown.
 * Only rows with spending > 0 are returned.
 */
export async function getCategoryBreakdown(userId: string, input?: { start?: Date; end?: Date }) {
  const dateRange = input ? resolveDateRange(input) : null;

  const rows = dateRange
    ? await prisma.$queryRaw<CategoryBreakdownRow[]>`
        SELECT
          COALESCE(t."category", 'Uncategorized') AS "category",
          a."id"        AS "accountId",
          a."ownerName" AS "accountOwnerName",
          a."nickname"  AS "accountNickname",
          SUM(CASE
            WHEN t."type" = 'WITHDRAWAL'::"TransactionType" AND a."accountType" != 'CREDIT'::"AccountType" THEN t."amount"
            WHEN t."type" = 'DEPOSIT'::"TransactionType"    AND a."accountType" = 'CREDIT'::"AccountType"  THEN t."amount"
            ELSE 0
          END) AS "spending"
        FROM "TransactionLineItem" t
        JOIN "Account" a ON t."toAccountId" = a."id" OR t."fromAccountId" = a."id"
        WHERE a."userId" = ${userId}
          AND a."deletedAt" IS NULL
          AND t."deletedAt" IS NULL
          AND t."effectiveAt" >= ${dateRange.start}
          AND t."effectiveAt" <  ${dateRange.end}
          AND t."type" IN ('DEPOSIT'::"TransactionType", 'WITHDRAWAL'::"TransactionType")
        GROUP BY COALESCE(t."category", 'Uncategorized'), a."id", a."ownerName", a."nickname"
        HAVING SUM(CASE
          WHEN t."type" = 'WITHDRAWAL'::"TransactionType" AND a."accountType" != 'CREDIT'::"AccountType" THEN t."amount"
          WHEN t."type" = 'DEPOSIT'::"TransactionType"    AND a."accountType" = 'CREDIT'::"AccountType"  THEN t."amount"
          ELSE 0
        END) > 0
        ORDER BY "category", "spending" DESC
      `
    : await prisma.$queryRaw<CategoryBreakdownRow[]>`
        SELECT
          COALESCE(t."category", 'Uncategorized') AS "category",
          a."id"        AS "accountId",
          a."ownerName" AS "accountOwnerName",
          a."nickname"  AS "accountNickname",
          SUM(CASE
            WHEN t."type" = 'WITHDRAWAL'::"TransactionType" AND a."accountType" != 'CREDIT'::"AccountType" THEN t."amount"
            WHEN t."type" = 'DEPOSIT'::"TransactionType"    AND a."accountType" = 'CREDIT'::"AccountType"  THEN t."amount"
            ELSE 0
          END) AS "spending"
        FROM "TransactionLineItem" t
        JOIN "Account" a ON t."toAccountId" = a."id" OR t."fromAccountId" = a."id"
        WHERE a."userId" = ${userId}
          AND a."deletedAt" IS NULL
          AND t."deletedAt" IS NULL
          AND t."type" IN ('DEPOSIT'::"TransactionType", 'WITHDRAWAL'::"TransactionType")
        GROUP BY COALESCE(t."category", 'Uncategorized'), a."id", a."ownerName", a."nickname"
        HAVING SUM(CASE
          WHEN t."type" = 'WITHDRAWAL'::"TransactionType" AND a."accountType" != 'CREDIT'::"AccountType" THEN t."amount"
          WHEN t."type" = 'DEPOSIT'::"TransactionType"    AND a."accountType" = 'CREDIT'::"AccountType"  THEN t."amount"
          ELSE 0
        END) > 0
        ORDER BY "category", "spending" DESC
      `;

  return rows.map((row) => ({
    category: row.category,
    accountId: row.accountId,
    accountOwnerName: row.accountOwnerName,
    accountNickname: row.accountNickname ?? null,
    spending: Number(row.spending ?? 0),
  }));
}

type MonthlyTrendRow = {
  month: Date;
  income: number | string | null;
  spending: number | string | null;
};

/**
 * Returns month-by-month income and spending totals for the last N calendar months,
 * using the same credit-aware logic as getMonthlySummary.
 */
export async function getMonthlyTrends(userId: string, months: number = 6) {
  const rows = await prisma.$queryRaw<MonthlyTrendRow[]>`
    SELECT
      DATE_TRUNC('month', t."effectiveAt") AS "month",
      SUM(CASE WHEN t."type" = 'DEPOSIT'::"TransactionType" AND a."accountType" != 'CREDIT'::"AccountType" THEN t."amount" ELSE 0 END) AS "income",
      SUM(CASE
        WHEN t."type" = 'WITHDRAWAL'::"TransactionType" AND a."accountType" != 'CREDIT'::"AccountType" THEN t."amount"
        WHEN t."type" = 'DEPOSIT'::"TransactionType" AND a."accountType" = 'CREDIT'::"AccountType" THEN t."amount"
        ELSE 0
      END) AS "spending"
    FROM "TransactionLineItem" t
    JOIN "Account" a ON t."toAccountId" = a."id" OR t."fromAccountId" = a."id"
    WHERE a."userId" = ${userId}
      AND a."deletedAt" IS NULL
      AND t."deletedAt" IS NULL
      AND t."type" IN ('DEPOSIT'::"TransactionType", 'WITHDRAWAL'::"TransactionType")
      AND t."effectiveAt" >= DATE_TRUNC('month', NOW()) - ${months - 1} * INTERVAL '1 month'
    GROUP BY DATE_TRUNC('month', t."effectiveAt")
    ORDER BY "month" ASC
  `;

  return rows.map((row) => {
    const income = Number(row.income ?? 0);
    const spending = Number(row.spending ?? 0);
    return {
      month: (row.month as Date).toISOString().slice(0, 7),
      income,
      spending,
      net: income - spending,
    };
  });
}

/**
 * Returns manual entry totals (assets + liabilities) for a given snapshot month.
 * When includeUndated is true, entries without a date are included (used for the current month).
 * Historical months only include entries with an explicit date on or before the last day of that month.
 */
async function computeManualTotalsForMonth(
  userId: string,
  month: string,
  includeUndated: boolean
): Promise<{ manualAssets: number; manualLiabilities: number }> {
  const firstDay = `${month}-01`;
  const rows = includeUndated
    ? await prisma.$queryRaw<{ manualAssets: string; manualLiabilities: string }[]>`
        SELECT
          COALESCE(SUM(CASE WHEN "type" = 'ASSET'::"ManualEntryType" THEN "amount" ELSE 0 END), 0) AS "manualAssets",
          COALESCE(SUM(CASE WHEN "type" = 'LIABILITY'::"ManualEntryType" THEN "amount" ELSE 0 END), 0) AS "manualLiabilities"
        FROM "ManualEntry"
        WHERE "userId" = ${userId}
          AND "deletedAt" IS NULL
          AND ("date" IS NULL OR "date" <= (${firstDay}::date + INTERVAL '1 month' - INTERVAL '1 day'))
      `
    : await prisma.$queryRaw<{ manualAssets: string; manualLiabilities: string }[]>`
        SELECT
          COALESCE(SUM(CASE WHEN "type" = 'ASSET'::"ManualEntryType" THEN "amount" ELSE 0 END), 0) AS "manualAssets",
          COALESCE(SUM(CASE WHEN "type" = 'LIABILITY'::"ManualEntryType" THEN "amount" ELSE 0 END), 0) AS "manualLiabilities"
        FROM "ManualEntry"
        WHERE "userId" = ${userId}
          AND "deletedAt" IS NULL
          AND "date" IS NOT NULL
          AND "date" <= (${firstDay}::date + INTERVAL '1 month' - INTERVAL '1 day')
      `;
  return {
    manualAssets: Number(rows[0]?.manualAssets ?? 0),
    manualLiabilities: Number(rows[0]?.manualLiabilities ?? 0),
  };
}

/**
 * Upserts a net worth snapshot for the current month, then retroactively updates
 * all existing historical snapshots to reflect manual entries whose date falls in or before each month.
 * This ensures a July-dated student loan appears on the July chart point, not just the current month.
 */
export async function recordNetWorthSnapshot(userId: string) {
  const accounts = await prisma.account.findMany({ where: { userId, deletedAt: null } });
  const accountAssets = accounts
    .filter((a) => a.accountType !== "CREDIT")
    .reduce((sum, a) => sum + a.balance.toNumber(), 0);
  const accountDebt = accounts
    .filter((a) => a.accountType === "CREDIT")
    .reduce((sum, a) => sum + a.balance.toNumber(), 0);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const { manualAssets, manualLiabilities } = await computeManualTotalsForMonth(
    userId,
    currentMonth,
    true
  );

  const totalAssets = accountAssets + manualAssets;
  const totalDebt = accountDebt + manualLiabilities;
  const netWorth = totalAssets - totalDebt;

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    INSERT INTO "NetWorthSnapshot" (
      "id", "userId", "month", "netWorth", "totalAssets", "totalDebt",
      "manualAssets", "manualLiabilities", "createdAt", "updatedAt"
    )
    VALUES (
      ${randomUUID()}, ${userId}, ${currentMonth}, ${netWorth}, ${totalAssets}, ${totalDebt},
      ${manualAssets}, ${manualLiabilities}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT ("userId", "month")
    DO UPDATE SET
      "netWorth"          = EXCLUDED."netWorth",
      "totalAssets"       = EXCLUDED."totalAssets",
      "totalDebt"         = EXCLUDED."totalDebt",
      "manualAssets"      = EXCLUDED."manualAssets",
      "manualLiabilities" = EXCLUDED."manualLiabilities",
      "updatedAt"         = CURRENT_TIMESTAMP
    RETURNING "id"
  `;

  // Retroactively patch all historical snapshots so dated manual entries appear in the right months.
  // We recompute only the manual portion; the account-derived portion is preserved by adjusting the delta.
  const historicalMonths = await prisma.$queryRaw<{ month: string }[]>`
    SELECT "month" FROM "NetWorthSnapshot"
    WHERE "userId" = ${userId} AND "month" < ${currentMonth}
    ORDER BY "month" ASC
  `;

  for (const { month } of historicalMonths) {
    const hist = await computeManualTotalsForMonth(userId, month, false);
    await prisma.$queryRaw`
      UPDATE "NetWorthSnapshot"
      SET
        "totalAssets"       = "totalAssets" - "manualAssets" + ${hist.manualAssets},
        "totalDebt"         = "totalDebt" - "manualLiabilities" + ${hist.manualLiabilities},
        "netWorth"          = "netWorth" - "manualAssets" + ${hist.manualAssets}
                                        + "manualLiabilities" - ${hist.manualLiabilities},
        "manualAssets"      = ${hist.manualAssets},
        "manualLiabilities" = ${hist.manualLiabilities},
        "updatedAt"         = CURRENT_TIMESTAMP
      WHERE "userId" = ${userId} AND "month" = ${month}
    `;
  }

  return { month: currentMonth, netWorth, totalAssets, totalDebt, id: rows[0]!.id };
}

/**
 * Returns the last N months of net worth snapshots for a user, oldest first.
 */
export async function getNetWorthHistory(userId: string, months: number = 12) {
  const rows = await prisma.$queryRaw<
    {
      id: string;
      month: string;
      netWorth: number | string;
      totalAssets: number | string;
      totalDebt: number | string;
    }[]
  >`
    SELECT "id", "month", "netWorth", "totalAssets", "totalDebt"
    FROM "NetWorthSnapshot"
    WHERE "userId" = ${userId}
    ORDER BY "month" DESC
    LIMIT ${months}
  `;

  return rows
    .map((r) => ({
      id: r.id,
      month: r.month,
      netWorth: Number(r.netWorth),
      totalAssets: Number(r.totalAssets),
      totalDebt: Number(r.totalDebt),
    }))
    .reverse();
}
