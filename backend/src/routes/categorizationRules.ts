import { Router, Request, Response, NextFunction } from "express";
import * as categorizationRuleService from "../services/categorizationRuleService";
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

/** Returns all auto-categorization rules for the current user. */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await categorizationRuleService.listRules(uid(req)));
  } catch (err) {
    next(err);
  }
});

/** Creates or updates the categorization rule for a merchant (unique per user). */
router.put("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = requireObject(req.body);
    const merchant = requireString(body.merchant, "merchant", { max: 100 });
    const category = requireString(body.category, "category", { max: 50 });
    res.json(await categorizationRuleService.upsertRule(uid(req), merchant, category));
  } catch (err) {
    next(err);
  }
});

/** Updates the merchant and/or category of a rule by id. */
router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = requireObject(req.body);
    const merchant = requireString(body.merchant, "merchant", { max: 100 });
    const category = requireString(body.category, "category", { max: 50 });
    res.json(
      await categorizationRuleService.updateRule(
        uid(req),
        req.params["id"] as string,
        merchant,
        category
      )
    );
  } catch (err) {
    next(err);
  }
});

/** Deletes one categorization rule by id. */
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await categorizationRuleService.deleteRule(uid(req), req.params["id"] as string);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
