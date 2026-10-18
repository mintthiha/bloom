import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import type { SpendingLookupQuery, SpendingLookupResult } from "./chatSpendingLookup";

type SpendingTotalRow = { total: string | null; purchaseCount: bigint | number };

type LargestPurchaseRow = {
  amount: string;
  effectiveAt: Date;
  merchant: string | null;
  description: string | null;
};

/** Escapes LIKE wildcards so a merchant name is matched as typed. */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/**
 * Adds up the user's spending for a query. "Spending" means what Bloom's monthly summary counts:
 * withdrawals from their non-credit accounts plus purchases charged to their credit cards, with
 * transfers left out. A split purchase counts by its split lines, so a category total only gets
 * that category's share; it still counts as one purchase. A merchant matches the transaction's
 * merchant or its description, ignoring case, since imported statements often only have the
 * latter.
 */
export async function lookUpSpending(
  userId: string,
  query: SpendingLookupQuery
): Promise<SpendingLookupResult> {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`a."userId" = ${userId}`,
    Prisma.sql`a."deletedAt" IS NULL`,
    Prisma.sql`li."deletedAt" IS NULL`,
    Prisma.sql`li."effectiveAt" >= ${query.start}`,
    Prisma.sql`li."effectiveAt" < ${query.end}`,
  ];
  if (query.merchant) {
    const merchantPattern = `%${escapeLikePattern(query.merchant.toLowerCase())}%`;
    conditions.push(
      Prisma.sql`(LOWER(t."merchant") LIKE ${merchantPattern} OR LOWER(li."description") LIKE ${merchantPattern})`
    );
  }
  if (query.category) {
    conditions.push(Prisma.sql`LOWER(li."category") = LOWER(${query.category})`);
  }

  const fromWhere = Prisma.sql`
    FROM "TransactionLineItem" li
    JOIN "Transaction" t ON t."id" = li."id"
    JOIN "Account" a ON (
      (li."type" = 'WITHDRAWAL'::"TransactionType" AND a."id" = li."fromAccountId"
        AND a."accountType" != 'CREDIT'::"AccountType")
      OR
      (li."type" = 'DEPOSIT'::"TransactionType" AND a."id" = li."toAccountId"
        AND a."accountType" = 'CREDIT'::"AccountType")
    )
    WHERE ${Prisma.join(conditions, " AND ")}
  `;

  const [totals, largestPurchases] = await Promise.all([
    prisma.$queryRaw<SpendingTotalRow[]>`
      SELECT SUM(li."amount") AS "total", COUNT(DISTINCT li."id") AS "purchaseCount"
      ${fromWhere}
    `,
    prisma.$queryRaw<LargestPurchaseRow[]>`
      SELECT li."amount", li."effectiveAt", t."merchant", li."description"
      ${fromWhere}
      ORDER BY li."amount" DESC, li."effectiveAt" DESC
      LIMIT 1
    `,
  ]);

  const largestPurchase = largestPurchases[0];
  return {
    total: Number(totals[0]?.total ?? 0),
    purchaseCount: Number(totals[0]?.purchaseCount ?? 0),
    largestPurchase: largestPurchase
      ? {
          amount: Number(largestPurchase.amount),
          effectiveAt: largestPurchase.effectiveAt,
          label: largestPurchase.merchant ?? largestPurchase.description,
        }
      : null,
  };
}
