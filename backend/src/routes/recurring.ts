import { Router, Request, Response, NextFunction } from "express";
import * as recurringTransactionService from "../services/recurringTransactionService";
import { AppError } from "../middleware/errorHandler";
import { optionalString, requireObject, requirePositiveNumber, requireString } from "../lib/validation";

const router = Router();

function uid(req: Request): string {
  const id = req.headers["x-user-id"] as string | undefined;
  if (!id) throw new AppError(401, "Unauthorized");
  return id;
}

function parseRequiredIsoDate(value: unknown, field: string) {
  if (typeof value !== "string") {
    throw new AppError(400, `${field} must be an ISO date string`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, `${field} must be a valid ISO date`);
  }
  return date;
}

function parseOptionalIsoDate(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  return parseRequiredIsoDate(value, field);
}

/**
 * Lists recurring deposit and withdrawal rules for the current user.
 */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await recurringTransactionService.listRecurringTransactions(uid(req)));
  } catch (err) {
    next(err);
  }
});

/**
 * Creates a recurring deposit or withdrawal rule.
 */
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = requireObject(req.body);
    const accountId = requireString(body.accountId, "accountId", { max: 100 });
    const name = requireString(body.name, "name", { max: 80 });
    const type = body.type;
    if (type !== "DEPOSIT" && type !== "WITHDRAWAL") {
      throw new AppError(400, "type must be DEPOSIT or WITHDRAWAL");
    }
    const frequency = body.frequency;
    if (frequency !== "WEEKLY" && frequency !== "BIWEEKLY" && frequency !== "MONTHLY") {
      throw new AppError(400, "frequency must be WEEKLY, BIWEEKLY, or MONTHLY");
    }

    res.status(201).json(await recurringTransactionService.createRecurringTransaction(uid(req), {
      accountId,
      name,
      type,
      amount: requirePositiveNumber(body.amount, "amount"),
      category: optionalString(body.category, "category", { max: 50 }),
      description: optionalString(body.description, "description", { max: 240 }),
      frequency,
      startDate: parseRequiredIsoDate(body.startDate, "startDate"),
      endDate: parseOptionalIsoDate(body.endDate, "endDate"),
    }));
  } catch (err) {
    next(err);
  }
});

/**
 * Updates one recurring deposit or withdrawal rule.
 */
router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = requireObject(req.body);
    const accountId = requireString(body.accountId, "accountId", { max: 100 });
    const name = requireString(body.name, "name", { max: 80 });
    const type = body.type;
    if (type !== "DEPOSIT" && type !== "WITHDRAWAL") {
      throw new AppError(400, "type must be DEPOSIT or WITHDRAWAL");
    }
    const frequency = body.frequency;
    if (frequency !== "WEEKLY" && frequency !== "BIWEEKLY" && frequency !== "MONTHLY") {
      throw new AppError(400, "frequency must be WEEKLY, BIWEEKLY, or MONTHLY");
    }

    res.json(await recurringTransactionService.updateRecurringTransaction(uid(req), req.params["id"] as string, {
      accountId,
      name,
      type,
      amount: requirePositiveNumber(body.amount, "amount"),
      category: optionalString(body.category, "category", { max: 50 }),
      description: optionalString(body.description, "description", { max: 240 }),
      frequency,
      startDate: parseRequiredIsoDate(body.startDate, "startDate"),
      endDate: parseOptionalIsoDate(body.endDate, "endDate"),
    }));
  } catch (err) {
    next(err);
  }
});

/**
 * Applies all due recurring transactions for the current user.
 */
router.post("/apply-due", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await recurringTransactionService.applyDueRecurringTransactions(uid(req)));
  } catch (err) {
    next(err);
  }
});

/**
 * Activates or pauses one recurring rule.
 */
router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = requireObject(req.body);
    if (typeof body.active !== "boolean") {
      throw new AppError(400, "active must be a boolean");
    }
    res.json(await recurringTransactionService.setRecurringTransactionActive(uid(req), req.params["id"] as string, body.active));
  } catch (err) {
    next(err);
  }
});

/**
 * Deletes one recurring rule.
 */
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await recurringTransactionService.deleteRecurringTransaction(uid(req), req.params["id"] as string);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
