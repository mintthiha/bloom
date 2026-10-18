import { Router, Request, Response, NextFunction } from "express";
import { AppError } from "../middleware/errorHandler";
import { requireObject, requireString } from "../lib/validation";
import { isDateOnly } from "../services/quickAddParsing";
import * as quickAddService from "../services/quickAddService";

const router = Router();

// A quick-add note is one line; anything longer is not what the feature is for.
const MAX_NOTE_LENGTH = 200;

/** Extracts the authenticated user id from the internal x-user-id header. */
function requireUserId(req: Request): string {
  const userId = req.headers["x-user-id"] as string | undefined;
  if (!userId) throw new AppError(401, "Unauthorized");
  return userId;
}

/**
 * Reads a one-line note into a draft transaction for the new-transaction form. The caller sends
 * the user's local date, so "yesterday" means the user's yesterday rather than the server's.
 */
router.post("/draft", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req);
    const body = requireObject(req.body);
    const note = requireString(body.note, "note", { max: MAX_NOTE_LENGTH });
    const today = requireString(body.today, "today", { max: 10 });
    if (!isDateOnly(today)) throw new AppError(400, "today must be a YYYY-MM-DD date");

    res.json({ draft: await quickAddService.draftTransactionFromNote(userId, note, today) });
  } catch (err) {
    next(err);
  }
});

export default router;
