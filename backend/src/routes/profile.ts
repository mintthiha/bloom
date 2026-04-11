import { Router, Request, Response, NextFunction } from "express";
import * as profileService from "../services/profileService";
import { AppError } from "../middleware/errorHandler";
import { requireObject, requireString } from "../lib/validation";

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
    const body = requireObject(req.body);
    const firstName = requireString(body.firstName, "firstName", { max: 50 });
    const lastName = requireString(body.lastName, "lastName", { max: 50 });
    const username = requireString(body.username, "username", {
      min: 3,
      max: 20,
      pattern: /^[a-z0-9_]+$/i,
      patternMessage: "username must contain only letters, numbers, or underscores",
    });
    const email = requireString(body.email, "email", { max: 254 });
    res.json(await profileService.upsertProfile(uid(req), { firstName, lastName, username, email }));
  } catch (err) {
    next(err);
  }
});

export default router;
