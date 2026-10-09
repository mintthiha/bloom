import { Router, Request, Response, NextFunction } from "express";
import { AppError } from "../middleware/errorHandler";
import * as chatHistoryService from "../services/chatHistoryService";

const router = Router();

// How far back the chat window scrolls; older turns stay stored but are not sent to the browser.
const DISPLAYED_MESSAGE_LIMIT = 200;

/** Extracts the authenticated user id from the internal x-user-id header. */
function requireUserId(req: Request): string {
  const userId = req.headers["x-user-id"] as string | undefined;
  if (!userId) throw new AppError(401, "Unauthorized");
  return userId;
}

/** Returns the user's conversation with Bloom AI, oldest message first. */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const messages = await chatHistoryService.listRecentChatMessages(
      requireUserId(req),
      DISPLAYED_MESSAGE_LIMIT
    );
    res.json({ messages });
  } catch (err) {
    next(err);
  }
});

/** Permanently deletes the user's whole conversation with Bloom AI. */
router.delete("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await chatHistoryService.clearChatMessages(requireUserId(req));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
