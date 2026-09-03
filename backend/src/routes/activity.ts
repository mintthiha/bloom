import { Router, Request, Response, NextFunction } from "express";
import { AppError } from "../middleware/errorHandler";
import * as activityService from "../services/activityService";

const router = Router();

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/** Returns paginated activity logs for the authenticated user, newest first. */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers["x-user-id"] as string | undefined;
    if (!userId) throw new AppError(401, "Unauthorized");

    const limit = Math.min(
      Math.max(parseInt(String(req.query["limit"] ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1),
      MAX_LIMIT
    );
    const offset = Math.max(parseInt(String(req.query["offset"] ?? 0), 10) || 0, 0);

    res.json(await activityService.listActivityLogs(userId, limit, offset));
  } catch (err) {
    next(err);
  }
});

export default router;
