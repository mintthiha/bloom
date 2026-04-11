import { Router, Request, Response, NextFunction } from "express";
import * as budgetService from "../services/budgetService";
import { AppError } from "../middleware/errorHandler";
import { requireObject, requirePositiveNumber, requireString } from "../lib/validation";

const router = Router();

/**
 * Extracts the authenticated user id from the request headers.
 * Throws 401 when the frontend proxy did not attach an `X-User-Id`.
 */
function uid(req: Request): string {
  const id = req.headers["x-user-id"] as string | undefined;
  if (!id) throw new AppError(401, "Unauthorized");
  return id;
}

/**
 * Returns the current user's saved category budgets with live monthly spending.
 */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await budgetService.listBudgets(uid(req)));
  } catch (err) {
    next(err);
  }
});

/**
 * Returns one budget plus its current month's activity breakdown.
 */
router.get("/:id/activity", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await budgetService.getBudgetActivity(uid(req), req.params["id"] as string));
  } catch (err) {
    next(err);
  }
});

/**
 * Creates or updates the current user's budget for a category.
 */
router.put("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = requireObject(req.body);
    const category = requireString(body.category, "category", { max: 50 });
    const monthlyLimit = requirePositiveNumber(body.monthlyLimit, "monthlyLimit");
    res.json(await budgetService.upsertBudget(uid(req), { category, monthlyLimit }));
  } catch (err) {
    next(err);
  }
});

/**
 * Deletes one saved budget by id for the current user.
 */
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await budgetService.deleteBudget(uid(req), req.params["id"] as string);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
