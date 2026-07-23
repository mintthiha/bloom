import { Router, Request, Response, NextFunction } from "express";
import * as subscriptionService from "../services/subscriptionService";
import { AppError } from "../middleware/errorHandler";

const router = Router();

/** Extracts the authenticated user id from the internal x-user-id header. */
function uid(req: Request): string {
  const id = req.headers["x-user-id"] as string | undefined;
  if (!id) throw new AppError(401, "Unauthorized");
  return id;
}

/**
 * Returns the auto-detected subscription summary for the current user:
 * headline monthly/annual totals plus the per-subscription list.
 */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await subscriptionService.getSubscriptionSummary(uid(req)));
  } catch (err) {
    next(err);
  }
});

export default router;
