import { Router, Request, Response, NextFunction } from "express";
import * as savingsGoalService from "../services/savingsGoalService";
import { AppError } from "../middleware/errorHandler";
import { requireObject, requireString, requirePositiveNumber } from "../lib/validation";

const router = Router();

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
    const body = requireObject(req.body);
    const accountId = requireString(body.accountId, "accountId");
    const name = requireString(body.name, "name", { max: 100 });
    const targetAmount = requirePositiveNumber(body.targetAmount, "targetAmount");
    res
      .status(201)
      .json(
        await savingsGoalService.createSavingsGoal(uid(req), { accountId, name, targetAmount })
      );
  } catch (err) {
    next(err);
  }
});

/** Replaces the name, account, and target amount of an existing savings goal. */
router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = requireObject(req.body);
    const accountId = requireString(body.accountId, "accountId");
    const name = requireString(body.name, "name", { max: 100 });
    const targetAmount = requirePositiveNumber(body.targetAmount, "targetAmount");
    res.json(
      await savingsGoalService.updateSavingsGoal(uid(req), req.params["id"] as string, {
        accountId,
        name,
        targetAmount,
      })
    );
  } catch (err) {
    next(err);
  }
});

/** Deletes a savings goal by id. */
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await savingsGoalService.deleteSavingsGoal(uid(req), req.params["id"] as string);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
