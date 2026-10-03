import { Router, Request, Response, NextFunction } from "express";
import * as exchangeRateService from "../services/exchangeRateService";

const router = Router();

/**
 * Returns the cached CAD-to-USD/EUR exchange rates used to display amounts in a non-CAD
 * currency. Not user-specific: every user shares the same cached rates.
 */
router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await exchangeRateService.getExchangeRates());
  } catch (err) {
    next(err);
  }
});

export default router;
