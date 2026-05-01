import { Router, Request, Response, NextFunction } from "express";
import * as accountService from "../services/accountService";
import { AccountType, TransactionType } from "@prisma/client";
import { AppError } from "../middleware/errorHandler";
import { parseDateRangeQuery } from "../lib/date-range";
import { optionalString, requireObject, requirePositiveNumber, requireString } from "../lib/validation";

const router = Router();

const pid = (req: Request): string => req.params["id"] as string;
const uid = (req: Request): string => {
  const id = req.headers["x-user-id"] as string;
  if (!id) throw new AppError(401, "Unauthorized");
  return id;
};

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await accountService.listAccounts(uid(req)));
  } catch (err) { next(err); }
});

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = requireObject(req.body);
    const ownerName = requireString(body.ownerName, "ownerName", { max: 100 });
    const nickname = optionalString(body.nickname, "nickname", { max: 60 });
    const rawAccountType = body.accountType;
    if (
      rawAccountType !== "CHEQUING" &&
      rawAccountType !== "SAVINGS" &&
      rawAccountType !== "TFSA" &&
      rawAccountType !== "RRSP" &&
      rawAccountType !== "FHSA" &&
      rawAccountType !== "CREDIT"
    ) {
      throw new AppError(400, "accountType must be CHEQUING, SAVINGS, TFSA, RRSP, FHSA, or CREDIT");
    }
    const account = await accountService.createAccount(uid(req), ownerName, rawAccountType as AccountType, nickname);
    res.status(201).json(account);
  } catch (err) { next(err); }
});

/**
 * Returns this month's income, spending, net cash flow, and category totals.
 */
router.get("/summary/monthly", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await accountService.getMonthlySummary(uid(req), parseDateRangeQuery({
      start: req.query["start"],
      end: req.query["end"],
    })));
  } catch (err) { next(err); }
});

router.get("/summary/trends", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const months = Math.min(Math.max(parseInt(String(req.query["months"] ?? "6"), 10) || 6, 1), 24);
    res.json(await accountService.getMonthlyTrends(uid(req), months));
  } catch (err) { next(err); }
});

router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await accountService.getAccount(uid(req), pid(req)));
  } catch (err) { next(err); }
});

router.post("/:id/deposit", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = requireObject(req.body);
    const amount = requirePositiveNumber(body.amount, "amount");
    const category = optionalString(body.category, "category", { max: 50 });
    const merchant = optionalString(body.merchant, "merchant", { max: 100 });
    const description = optionalString(body.description, "description", { max: 240 });
    const [account] = await accountService.deposit(uid(req), pid(req), amount, category, description, undefined, merchant);
    res.json(account);
  } catch (err) { next(err); }
});

router.post("/:id/withdraw", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = requireObject(req.body);
    const amount = requirePositiveNumber(body.amount, "amount");
    const category = optionalString(body.category, "category", { max: 50 });
    const merchant = optionalString(body.merchant, "merchant", { max: 100 });
    const description = optionalString(body.description, "description", { max: 240 });
    const [account] = await accountService.withdraw(uid(req), pid(req), amount, category, description, undefined, merchant);
    res.json(account);
  } catch (err) { next(err); }
});

router.post("/:id/transfer", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = requireObject(req.body);
    const toAccountId = requireString(body.toAccountId, "toAccountId", { max: 100 });
    const amount = requirePositiveNumber(body.amount, "amount");
    const description = optionalString(body.description, "description", { max: 240 });
    const category = optionalString(body.category, "category", { max: 50 });
    const [fromAccount] = await accountService.transfer(uid(req), pid(req), toAccountId, amount, description, category);
    res.json(fromAccount);
  } catch (err) { next(err); }
});

router.get("/:id/transactions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const type = req.query["type"];
    const category = req.query["category"];
    const search = req.query["search"];
    if (type !== undefined && type !== "DEPOSIT" && type !== "WITHDRAWAL" && type !== "TRANSFER_OUT" && type !== "TRANSFER_IN") {
      throw new AppError(400, "type must be DEPOSIT, WITHDRAWAL, TRANSFER_OUT, or TRANSFER_IN");
    }
    if (category !== undefined && typeof category !== "string") {
      throw new AppError(400, "category must be a string");
    }
    if (search !== undefined && typeof search !== "string") {
      throw new AppError(400, "search must be a string");
    }
    res.json(await accountService.getTransactions(uid(req), pid(req), {
      type: type as TransactionType | undefined,
      category: typeof category === "string" ? category : undefined,
      search: typeof search === "string" ? search : undefined,
      ...parseDateRangeQuery({
        start: req.query["start"],
        end: req.query["end"],
      }),
    }));
  } catch (err) { next(err); }
});

/**
 * Updates a manual deposit or withdrawal for the selected account.
 */
router.patch("/:id/transactions/:transactionId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = requireObject(req.body);
    const amount = requirePositiveNumber(body.amount, "amount");
    const category = optionalString(body.category, "category", { max: 50 });
    const merchant = optionalString(body.merchant, "merchant", { max: 100 });
    const description = optionalString(body.description, "description", { max: 240 });
    const effectiveAtValue = body.effectiveAt;
    if (effectiveAtValue !== undefined && typeof effectiveAtValue !== "string") {
      throw new AppError(400, "effectiveAt must be an ISO date string");
    }
    const effectiveAt = typeof effectiveAtValue === "string" ? new Date(effectiveAtValue) : undefined;
    if (effectiveAt && Number.isNaN(effectiveAt.getTime())) {
      throw new AppError(400, "effectiveAt must be a valid ISO date");
    }
    const account = await accountService.updateTransaction(uid(req), pid(req), req.params["transactionId"] as string, {
      amount,
      category,
      merchant,
      description,
      effectiveAt,
    });
    res.json(account);
  } catch (err) { next(err); }
});

/**
 * Deletes a manual deposit or withdrawal for the selected account.
 */
router.delete("/:id/transactions/:transactionId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await accountService.deleteTransaction(uid(req), pid(req), req.params["transactionId"] as string);
    res.status(204).send();
  } catch (err) { next(err); }
});

router.patch("/:id/freeze", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const account = await accountService.freezeAccount(uid(req), pid(req));
    res.json(account);
  } catch (err) { next(err); }
});

router.patch("/:id/unfreeze", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const account = await accountService.unfreezeAccount(uid(req), pid(req));
    res.json(account);
  } catch (err) { next(err); }
});

/**
 * Updates or clears the nickname for an existing account.
 */
router.patch("/:id/nickname", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = requireObject(req.body);
    const nickname = optionalString(body.nickname, "nickname", { max: 60 });
    const account = await accountService.updateNickname(uid(req), pid(req), nickname);
    res.json(account);
  } catch (err) { next(err); }
});

router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await accountService.deleteAccount(uid(req), pid(req));
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
