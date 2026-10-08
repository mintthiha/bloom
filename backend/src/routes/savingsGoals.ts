import { Router, Request, Response, NextFunction } from "express";
import * as savingsGoalService from "../services/savingsGoalService";
import { AppError } from "../middleware/errorHandler";
import {
  requireObject,
  requireString,
  requirePositiveNumber,
  optionalString,
} from "../lib/validation";
import { parseOptionalDateOnly } from "../services/profileOptions";
import {
  normalizeSavingsGoalColor,
  normalizeSavingsGoalIcon,
  SAVINGS_GOAL_NOTE_MAX_LENGTH,
} from "../services/savingsGoalOptions";

const router = Router();

/**
 * Parses the shared create/update payload of a savings goal. The appearance, deadline, and
 * note fields are all optional and normalize to null, so an omitted field clears it.
 */
function parseSavingsGoalBody(body: Record<string, unknown>) {
  return {
    accountId: requireString(body.accountId, "accountId"),
    name: requireString(body.name, "name", { max: 100 }),
    targetAmount: requirePositiveNumber(body.targetAmount, "targetAmount"),
    targetDate: parseOptionalDateOnly(body.targetDate, "targetDate"),
    icon: normalizeSavingsGoalIcon(body.icon),
    color: normalizeSavingsGoalColor(body.color),
    note: optionalString(body.note, "note", { max: SAVINGS_GOAL_NOTE_MAX_LENGTH }) ?? null,
  };
}

/** Extracts the authenticated user id from the request headers. */
function uid(req: Request): string {
  const id = req.headers["x-user-id"] as string | undefined;
  if (!id) throw new AppError(401, "Unauthorized");
  return id;
}

/** Returns all savings goals for the current user with live account balances. */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await savingsGoalService.listSavingsGoals(uid(req)));
  } catch (err) {
    next(err);
  }
});

/** Creates a new savings goal linked to the given account. */
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = parseSavingsGoalBody(requireObject(req.body));
    res.status(201).json(await savingsGoalService.createSavingsGoal(uid(req), input));
  } catch (err) {
    next(err);
  }
});

/** Replaces every user-editable field of an existing savings goal. */
router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = parseSavingsGoalBody(requireObject(req.body));
    res.json(
      await savingsGoalService.updateSavingsGoal(uid(req), req.params["id"] as string, input)
    );
  } catch (err) {
    next(err);
  }
});

/** Soft-deletes a savings goal by id (recoverable via the restore endpoint). */
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await savingsGoalService.deleteSavingsGoal(uid(req), req.params["id"] as string);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

/** Restores a previously soft-deleted savings goal (the "Undo" action after a delete). */
router.post("/:id/restore", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await savingsGoalService.restoreSavingsGoal(uid(req), req.params["id"] as string));
  } catch (err) {
    next(err);
  }
});

export default router;
