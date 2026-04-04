import { Router, Request, Response, NextFunction } from "express";
import * as profileService from "../services/profileService";
import { AppError } from "../middleware/errorHandler";

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
 * Returns the current user's saved profile, or `null` when none exists yet.
 */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await profileService.getProfile(uid(req)));
  } catch (err) {
    next(err);
  }
});

/**
 * Creates or updates the current user's profile record.
 * Validates required fields and enforces globally unique usernames.
 */
router.put("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fullName, username, email } = req.body as {
      fullName?: string;
      username?: string;
      email?: string;
    };
    res.json(await profileService.upsertProfile(uid(req), { fullName, username, email }));
  } catch (err) {
    next(err);
  }
});

export default router;
