import { Router, Request, Response, NextFunction } from "express";
import { AppError } from "../middleware/errorHandler";
import * as reviewService from "../services/reviewService";

const router = Router();

/** Extracts the authenticated user id from the internal header, throwing 401 if absent. */
function extractUserId(req: Request): string {
  const id = req.headers["x-user-id"] as string;
  if (!id) throw new AppError(401, "Unauthorized");
  return id;
}

/**
 * Reads the required `timeZone` query param and checks it is a real IANA zone, so month
 * boundaries are computed in the user's own time and a bad value never reaches SQL.
 */
function parseTimeZone(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 64) {
    throw new AppError(400, "timeZone is required");
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
  } catch {
    throw new AppError(400, "timeZone must be a valid IANA time zone");
  }
  return value;
}

/** Reads a required `YYYY-MM` month from the query or path. */
function parseMonth(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new AppError(400, "month must be in YYYY-MM format");
  }
  return value;
}

router.get("/monthly", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const month = parseMonth(req.query["month"]);
    const timeZone = parseTimeZone(req.query["timeZone"]);
    res.json(await reviewService.getMonthlyReview(extractUserId(req), month, timeZone));
  } catch (err) {
    next(err);
  }
});

router.post("/monthly/:month/complete", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const month = parseMonth(req.params["month"]);
    res.status(201).json(await reviewService.completeMonthlyReview(extractUserId(req), month));
  } catch (err) {
    next(err);
  }
});

router.get("/year", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawYear = req.query["year"];
    const year = typeof rawYear === "string" && /^\d{4}$/.test(rawYear) ? Number(rawYear) : NaN;
    if (Number.isNaN(year)) throw new AppError(400, "year must be a four-digit year");
    const timeZone = parseTimeZone(req.query["timeZone"]);
    res.json(await reviewService.getYearInReview(extractUserId(req), year, timeZone));
  } catch (err) {
    next(err);
  }
});

export default router;
