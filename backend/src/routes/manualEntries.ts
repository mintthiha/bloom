import { Router, Request, Response, NextFunction } from "express";
import { ManualEntryType } from "@prisma/client";
import * as manualEntryService from "../services/manualEntryService";
import { logActivity } from "../services/activityService";
import { AppError } from "../middleware/errorHandler";
import { requireObject, requireString, requirePositiveNumber } from "../lib/validation";

const router = Router();

/** Extracts the authenticated user id from the request headers. */
function uid(req: Request): string {
  const id = req.headers["x-user-id"] as string | undefined;
  if (!id) throw new AppError(401, "Unauthorized");
  return id;
}

/** Validates an optional date string (YYYY-MM-DD). Returns null if absent, throws 400 if malformed. */
function parseOptionalDate(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new AppError(400, "date must be a YYYY-MM-DD string");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new AppError(400, "date must be a YYYY-MM-DD string");
  return value;
}

/** Returns all manual entries (assets + liabilities) for the current user. */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await manualEntryService.listManualEntries(uid(req)));
  } catch (err) {
    next(err);
  }
});

/** Creates a new manual asset or liability. */
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = requireObject(req.body);
    const name = requireString(body.name, "name", { max: 100 });
    const rawType = body.type;
    if (rawType !== "ASSET" && rawType !== "LIABILITY") {
      throw new AppError(400, "type must be ASSET or LIABILITY");
    }
    const type = rawType as ManualEntryType;
    const amount = requirePositiveNumber(body.amount, "amount");
    const date = parseOptionalDate(body.date);
    const userId = uid(req);
    const created = await manualEntryService.createManualEntry(userId, {
      name,
      type,
      amount,
      date,
    });
    logActivity(
      userId,
      "MANUAL_ENTRY_CREATED",
      `Added ${type === "ASSET" ? "asset" : "liability"} "${name}"`,
      { entryId: created.id, type, amount }
    );
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

/** Updates the name, amount, and date of an existing manual entry. */
router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entryId = req.params["id"] as string;
    const body = requireObject(req.body);
    const name = requireString(body.name, "name", { max: 100 });
    const amount = requirePositiveNumber(body.amount, "amount");
    const date = parseOptionalDate(body.date);
    const userId = uid(req);
    const updated = await manualEntryService.updateManualEntry(userId, entryId, {
      name,
      amount,
      date,
    });
    logActivity(userId, "MANUAL_ENTRY_UPDATED", `Updated "${name}"`, { entryId, amount });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/** Soft-deletes a manual entry (recoverable via the restore endpoint). */
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entryId = req.params["id"] as string;
    const userId = uid(req);
    const { name, type } = await manualEntryService.deleteManualEntry(userId, entryId);
    logActivity(
      userId,
      "MANUAL_ENTRY_DELETED",
      `Removed ${type === "ASSET" ? "asset" : "liability"} "${name}"`,
      { entryId, type }
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

/** Restores a previously soft-deleted manual entry (the "Undo" action after a delete). */
router.post("/:id/restore", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entryId = req.params["id"] as string;
    const userId = uid(req);
    const { name, type } = await manualEntryService.restoreManualEntry(userId, entryId);
    logActivity(
      userId,
      "MANUAL_ENTRY_RESTORED",
      `Restored ${type === "ASSET" ? "asset" : "liability"} "${name}"`,
      { entryId, type }
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
