import { Prisma, TransactionType } from "@prisma/client";
import prisma from "../lib/prisma";

/** One row of the cross-account transaction list, joined to the single account it affects. */
export type TransactionListItem = {
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

/** Sort orders the list endpoint accepts; mapped to a whitelisted ORDER BY clause. */
export type TransactionSortKey = "date_desc" | "date_asc" | "amount_desc" | "amount_asc";

/** Filters and paging options for {@link listTransactions}. */
export type TransactionListFilters = {
  accountId?: string;
  type?: TransactionType;
  category?: string;
  search?: string;
  start?: Date;
  end?: Date;
  sort?: TransactionSortKey;
  page?: number;
  limit?: number;
};

/** Paginated response: the current page of rows plus the total count for the active filter. */
export type TransactionListResult = {
  rows: TransactionListItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
};

type RawRow = Omit<TransactionListItem, "amount"> & { amount: number | string };

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

/** Maps each sort key to a safe, static ORDER BY fragment (never interpolates user input). */
const ORDER_BY_BY_SORT: Record<TransactionSortKey, Prisma.Sql> = {
  date_desc: Prisma.sql`t."effectiveAt" DESC, t."createdAt" DESC`,
  date_asc: Prisma.sql`t."effectiveAt" ASC, t."createdAt" ASC`,
  amount_desc: Prisma.sql`t."amount" DESC, t."effectiveAt" DESC`,
  amount_asc: Prisma.sql`t."amount" ASC, t."effectiveAt" DESC`,
};

/**
 * Lists transactions across every account owned by the user, with optional filtering by account,
 * type, category, free-text search, and date range, plus sorting and offset pagination.
 *
 * Each transaction is joined to exactly one account based on its type: outflow types
 * (WITHDRAWAL, TRANSFER_OUT) bind to fromAccountId; inflow types (DEPOSIT, TRANSFER_IN) bind to
 * toAccountId — matching the search endpoint so amounts always attach to the right account.
 */
export async function listTransactions(
  userId: string,
  filters: TransactionListFilters = {}
): Promise<TransactionListResult> {
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const limit = Math.min(Math.max(1, Math.floor(filters.limit ?? DEFAULT_LIMIT)), MAX_LIMIT);
  const offset = (page - 1) * limit;
  const sort = filters.sort ?? "date_desc";

  const conditions: Prisma.Sql[] = [Prisma.sql`a."userId" = ${userId}`];

  if (filters.accountId) {
    conditions.push(Prisma.sql`a."id" = ${filters.accountId}`);
  }
  if (filters.type) {
    conditions.push(Prisma.sql`t."type" = ${filters.type}::"TransactionType"`);
  }
  const category = filters.category?.trim();
  if (category) {
    if (category === "Uncategorized") {
      conditions.push(Prisma.sql`(t."category" IS NULL OR t."category" = '')`);
    } else {
      conditions.push(Prisma.sql`t."category" = ${category}`);
    }
  }
  const search = filters.search?.trim().toLowerCase();
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      Prisma.sql`(
        LOWER(t."description") LIKE ${pattern}
        OR LOWER(t."merchant") LIKE ${pattern}
        OR LOWER(t."category") LIKE ${pattern}
      )`
    );
  }
  if (filters.start && filters.end) {
    conditions.push(Prisma.sql`t."effectiveAt" >= ${filters.start}`);
    conditions.push(Prisma.sql`t."effectiveAt" < ${filters.end}`);
  }

  // Shared FROM/JOIN/WHERE reused by both the page query and the total count.
  const fromWhere = Prisma.sql`
    FROM "Transaction" t
    INNER JOIN "Account" a ON (
      (t."type" IN ('WITHDRAWAL', 'TRANSFER_OUT') AND a."id" = t."fromAccountId")
      OR
      (t."type" IN ('DEPOSIT', 'TRANSFER_IN') AND a."id" = t."toAccountId")
    )
    WHERE ${Prisma.join(conditions, " AND ")}
  `;

  const dataQuery = Prisma.sql`
    SELECT
      t."id",
      t."type"::text          AS type,
      t."amount",
      t."effectiveAt",
      t."description",
      t."merchant",
      t."category",
      a."id"                  AS "accountId",
      a."ownerName"           AS "accountName",
      a."nickname"            AS "accountNickname",
      a."accountType"::text    AS "accountType"
    ${fromWhere}
    ORDER BY ${ORDER_BY_BY_SORT[sort]}
    LIMIT ${limit} OFFSET ${offset}
  `;
  const countQuery = Prisma.sql`SELECT COUNT(*)::int AS count ${fromWhere}`;

  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<RawRow[]>(dataQuery),
    prisma.$queryRaw<{ count: number }[]>(countQuery),
  ]);

  const total = countRows[0]?.count ?? 0;

  return {
    rows: rows.map((row) => ({
      ...row,
      amount: Number(row.amount),
    })),
    total,
    page,
    limit,
    hasMore: page * limit < total,
  };
}
