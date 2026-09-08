import { Router, Request, Response, NextFunction } from "express";
import { ManualEntryType } from "@prisma/client";
import * as manualEntryService from "../services/manualEntryService";
import { AppError } from "../middleware/errorHandler";
import { requireObject, requireString, requirePositiveNumber } from "../lib/validation";

const router = Router();

/** Extracts the authenticated user id from the request headers. */
function uid(req: Request): string {
  const id = req.headers["x-user-id"] as string | undefined;
  if (!id) throw new AppError(401, "Unauthorized");
  return id;
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
    res
      .status(201)
      .json(await manualEntryService.createManualEntry(uid(req), { name, type, amount }));
  } catch (err) {
    next(err);
  }
});

/** Updates the name and amount of an existing manual entry. */
router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entryId = req.params["id"] as string;
    const body = requireObject(req.body);
    const name = requireString(body.name, "name", { max: 100 });
    const amount = requirePositiveNumber(body.amount, "amount");
    res.json(await manualEntryService.updateManualEntry(uid(req), entryId, { name, amount }));
  } catch (err) {
    next(err);
  }
});

/** Deletes a manual entry. */
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entryId = req.params["id"] as string;
    await manualEntryService.deleteManualEntry(uid(req), entryId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
