import prisma from "../lib/prisma";

export type TransactionSearchResult = {
  id: string;
  type: string;
  amount: number;
  effectiveAt: Date;
  description: string | null;
  merchant: string | null;
  category: string | null;
  accountId: string;
  accountName: string;
  accountNickname: string | null;
  accountType: string;
};

type RawRow = TransactionSearchResult & { amount: number | string };

/**
 * Searches transactions across every account owned by the user, matching
 * against description, merchant, and category. Returns up to `limit` results
 * ordered by date descending.
 *
 * Each transaction is joined to exactly one account based on its type:
 * outflow types (WITHDRAWAL, TRANSFER_OUT) bind to fromAccountId;
 * inflow types (DEPOSIT, TRANSFER_IN) bind to toAccountId.
 */
export async function searchTransactions(
  userId: string,
  query: string,
  limit: number = 20,
): Promise<TransactionSearchResult[]> {
  const searchPattern = `%${query.toLowerCase()}%`;
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 50);

  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT
      t.id,
      t.type::text                AS type,
      t.amount,
      t."effectiveAt",
      t.description,
      t.merchant,
      t.category,
      a.id                        AS "accountId",
      a."ownerName"               AS "accountName",
      a.nickname                  AS "accountNickname",
      a."accountType"::text       AS "accountType"
    FROM "Transaction" t
    INNER JOIN "Account" a ON (
      (t.type IN ('WITHDRAWAL', 'TRANSFER_OUT') AND a.id = t."fromAccountId")
      OR
      (t.type IN ('DEPOSIT', 'TRANSFER_IN') AND a.id = t."toAccountId")
    )
    WHERE a."userId" = ${userId}
      AND (
        LOWER(t.description) LIKE ${searchPattern}
        OR LOWER(t.merchant)  LIKE ${searchPattern}
        OR LOWER(t.category)  LIKE ${searchPattern}
      )
    ORDER BY t."effectiveAt" DESC
    LIMIT ${safeLimit}
  `;

  return rows.map(r => ({
    ...r,
    amount: typeof r.amount === "string" ? parseFloat(r.amount) : r.amount,
  }));
}
