import { Router, Request, Response, NextFunction } from "express";
import * as reminderService from "../services/reminderService";
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
 * Regenerates due bill reminders, then returns the user's notifications and
 * unread count. Generating on read keeps reminders fresh without a scheduler.
 */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = uid(req);
    await reminderService.generateBillReminders(userId);
    res.json(await reminderService.listNotifications(userId));
  } catch (err) {
    next(err);
  }
});

/**
 * Marks every unread notification for the current user as read.
 */
router.post("/read-all", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await reminderService.markAllNotificationsRead(uid(req)));
  } catch (err) {
    next(err);
  }
});

/**
 * Marks a single notification as read.
 */
router.patch("/:id/read", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await reminderService.markNotificationRead(uid(req), req.params["id"] as string));
  } catch (err) {
    next(err);
  }
});

/**
 * Dismisses a notification so it no longer appears.
 */
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await reminderService.dismissNotification(uid(req), req.params["id"] as string);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
