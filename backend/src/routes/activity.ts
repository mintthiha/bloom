import { Router, Request, Response, NextFunction } from "express";
import { AppError } from "../middleware/errorHandler";
import { parseDateRangeQuery } from "../lib/date-range";
import * as activityService from "../services/activityService";
import { ActivityAction, ActivityGroup, ActivitySortKey } from "../services/activityService";

const router = Router();

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/** Groups the ?group= query parameter is allowed to take. */
const VALID_GROUPS: ActivityGroup[] = [
  "ACCOUNT",
  "TRANSACTION",
  "GOAL",
  "BUDGET",
  "RECURRING",
  "MANUAL_ENTRY",
  "CATEGORIZATION_RULE",
  "PROFILE",
];

/** Lifecycle actions the ?action= query parameter is allowed to take. */
const VALID_ACTIONS: ActivityAction[] = [
  "CREATED",
  "UPDATED",
  "DELETED",
  "RESTORED",
  "RESYNCED",
  "PAUSED",
  "RESUMED",
  "DEPOSIT",
  "IMPORTED",
];

/** Sort keys the ?sort= query parameter is allowed to take. */
const VALID_SORT_KEYS: ActivitySortKey[] = ["date_desc", "date_asc"];

/**
 * GET /api/activity?limit=&offset=&search=&group=&action=&sort=&start=&end=
 * Returns a paginated, filterable page of activity logs for the authenticated user.
 */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers["x-user-id"] as string | undefined;
    if (!userId) throw new AppError(401, "Unauthorized");

    const limit = Math.min(
      Math.max(parseInt(String(req.query["limit"] ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1),
      MAX_LIMIT
    );
    const offset = Math.max(parseInt(String(req.query["offset"] ?? 0), 10) || 0, 0);

    const groupParam = req.query.group as string | undefined;
    if (groupParam && !VALID_GROUPS.includes(groupParam as ActivityGroup)) {
      throw new AppError(400, "group must be one of: " + VALID_GROUPS.join(", "));
    }

    const actionParam = req.query.action as string | undefined;
    if (actionParam && !VALID_ACTIONS.includes(actionParam as ActivityAction)) {
      throw new AppError(400, "action must be one of: " + VALID_ACTIONS.join(", "));
    }

    const sortParam = req.query.sort as string | undefined;
    if (sortParam && !VALID_SORT_KEYS.includes(sortParam as ActivitySortKey)) {
      throw new AppError(400, "sort must be one of: " + VALID_SORT_KEYS.join(", "));
    }

    const dateRange = parseDateRangeQuery({ start: req.query.start, end: req.query.end });

    res.json(
      await activityService.listActivityLogs(userId, {
        limit,
        offset,
        search: (req.query.search as string | undefined) || undefined,
        group: groupParam ? (groupParam as ActivityGroup) : undefined,
        action: actionParam ? (actionParam as ActivityAction) : undefined,
        sort: sortParam ? (sortParam as ActivitySortKey) : undefined,
        start: dateRange?.start,
        end: dateRange?.end,
      })
    );
  } catch (err) {
    next(err);
  }
});

export default router;
