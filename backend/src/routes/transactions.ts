import { Router } from "express";
import { searchTransactions } from "../services/transactionSearchService";
import { AppError } from "../middleware/errorHandler";

const router = Router();

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
