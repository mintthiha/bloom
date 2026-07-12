import { Router } from "express";
import { TransactionType } from "@prisma/client";
import { searchTransactions } from "../services/transactionSearchService";
import { listTransactions, TransactionSortKey } from "../services/transactionListService";
import { parseDateRangeQuery } from "../lib/date-range";
import { AppError } from "../middleware/errorHandler";

const router = Router();

/** Sort keys the list endpoint accepts, matched against the ?sort= query parameter. */
const VALID_SORT_KEYS: TransactionSortKey[] = [
  "date_desc",
  "date_asc",
  "amount_desc",
  "amount_asc",
];

/** Parses a positive integer query parameter, falling back to the default when absent or invalid. */
function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = parseInt((value as string | undefined) ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * GET /api/transactions?account=&type=&category=&search=&start=&end=&sort=&page=&limit=
 * Returns a paginated, filterable list of transactions across all of the user's accounts.
 */
router.get("/", async (req, res, next) => {
  try {
    const userId = req.headers["x-user-id"] as string | undefined;
    if (!userId) throw new AppError(401, "Unauthorized");

    const typeParam = req.query.type as string | undefined;
    if (typeParam && !(typeParam in TransactionType)) {
      throw new AppError(400, "type must be a valid transaction type");
    }

    const sortParam = req.query.sort as string | undefined;
    if (sortParam && !VALID_SORT_KEYS.includes(sortParam as TransactionSortKey)) {
      throw new AppError(400, "sort must be one of: " + VALID_SORT_KEYS.join(", "));
    }

    const dateRange = parseDateRangeQuery({ start: req.query.start, end: req.query.end });

    const result = await listTransactions(userId, {
      accountId: (req.query.account as string | undefined) || undefined,
      type: typeParam ? (typeParam as TransactionType) : undefined,
      category: (req.query.category as string | undefined) || undefined,
      search: (req.query.search as string | undefined) || undefined,
      start: dateRange?.start,
      end: dateRange?.end,
      sort: sortParam ? (sortParam as TransactionSortKey) : undefined,
      page: parsePositiveInt(req.query.page, 1),
      limit: parsePositiveInt(req.query.limit, 25),
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/transactions/search?q=&limit=
 * Returns transactions matching the query across all accounts for the authenticated user.
 */
router.get("/search", async (req, res, next) => {
  try {
    const userId = req.headers["x-user-id"] as string | undefined;
    if (!userId) throw new AppError(401, "Unauthorized");

    const q = (req.query.q as string | undefined)?.trim() ?? "";
    if (!q) return res.json([]);

    const limit = parseInt((req.query.limit as string | undefined) ?? "20", 10);
    const results = await searchTransactions(userId, q, limit);
    res.json(results);
  } catch (err) {
    next(err);
  }
});

export default router;
