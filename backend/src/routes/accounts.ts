import { Router, Request, Response, NextFunction } from "express";
import * as accountService from "../services/accountService";

const router = Router();

// Express 5: req.params is typed as `string | string[]` — route params are always plain strings
const pid = (req: Request): string => req.params["id"] as string;

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ownerName } = req.body;
    const account = await accountService.createAccount(ownerName);
    res.status(201).json(account);
  } catch (err) { next(err); }
});

router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const account = await accountService.getAccount(pid(req));
    res.json(account);
  } catch (err) { next(err); }
});

router.post("/:id/deposit", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { amount } = req.body;
    const [account] = await accountService.deposit(pid(req), amount);
    res.json(account);
  } catch (err) { next(err); }
});

router.post("/:id/withdraw", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { amount } = req.body;
    const [account] = await accountService.withdraw(pid(req), amount);
    res.json(account);
  } catch (err) { next(err); }
});

router.post("/:id/transfer", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { toAccountId, amount } = req.body;
    await accountService.transfer(pid(req), toAccountId, amount);
    res.json({ message: "Transfer successful" });
  } catch (err) { next(err); }
});

router.get("/:id/transactions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transactions = await accountService.getTransactions(pid(req));
    res.json(transactions);
  } catch (err) { next(err); }
});

export default router;
