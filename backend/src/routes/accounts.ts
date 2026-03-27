import { Router, Request, Response, NextFunction } from "express";
import * as accountService from "../services/accountService";
import { AccountType } from "@prisma/client";

const router = Router();

const pid = (req: Request): string => req.params["id"] as string;

router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await accountService.listAccounts());
  } catch (err) { next(err); }
});

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ownerName, accountType } = req.body;
    const account = await accountService.createAccount(ownerName, accountType as AccountType);
    res.status(201).json(account);
  } catch (err) { next(err); }
});

router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await accountService.getAccount(pid(req)));
  } catch (err) { next(err); }
});

router.post("/:id/deposit", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { amount, description } = req.body;
    const [account] = await accountService.deposit(pid(req), amount, description);
    res.json(account);
  } catch (err) { next(err); }
});

router.post("/:id/withdraw", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { amount, description } = req.body;
    const [account] = await accountService.withdraw(pid(req), amount, description);
    res.json(account);
  } catch (err) { next(err); }
});

router.post("/:id/transfer", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { toAccountId, amount, description } = req.body;
    const [fromAccount] = await accountService.transfer(pid(req), toAccountId, amount, description);
    res.json(fromAccount);
  } catch (err) { next(err); }
});

router.get("/:id/transactions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await accountService.getTransactions(pid(req)));
  } catch (err) { next(err); }
});

router.patch("/:id/freeze", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const account = await accountService.freezeAccount(pid(req));
    res.json(account);
  } catch (err) { next(err); }
});

router.patch("/:id/unfreeze", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const account = await accountService.unfreezeAccount(pid(req));
    res.json(account);
  } catch (err) { next(err); }
});

router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await accountService.deleteAccount(pid(req));
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
