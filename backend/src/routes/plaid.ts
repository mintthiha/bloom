import { Router, Request, Response, NextFunction } from "express";
import * as plaidService from "../services/plaidService";
import { AppError } from "../middleware/errorHandler";
import { requireObject, requireString } from "../lib/validation";

const router = Router();

/** Extracts and validates the x-user-id header, throwing 401 if absent. */
const uid = (req: Request): string => {
  const id = req.headers["x-user-id"] as string;
  if (!id) throw new AppError(401, "Unauthorized");
  return id;
};

/** Returns a short-lived Plaid Link token for the authenticated user. */
router.post("/link-token", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const linkToken = await plaidService.createLinkToken(uid(req));
    res.json({ linkToken });
  } catch (err) {
    next(err);
  }
});

/** Exchanges a Plaid public token for an access token and immediately syncs the linked accounts. */
router.post("/exchange-token", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = requireObject(req.body);
    const publicToken = requireString(body.publicToken, "publicToken");
    const institutionName = requireString(body.institutionName, "institutionName", { max: 200 });
    const result = await plaidService.exchangePublicToken(publicToken, uid(req), institutionName);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** Re-syncs all accounts and transactions for a previously linked Plaid item. */
router.post("/sync/:itemId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const itemId = req.params["itemId"] as string;
    const accountsLinked = await plaidService.syncAccountsAndTransactions(itemId, uid(req));
    res.json({ accountsLinked });
  } catch (err) {
    next(err);
  }
});

export default router;
