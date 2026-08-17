import { Router, Request, Response, NextFunction } from "express";
import { requireString } from "../lib/validation";
import { requireObject } from "../lib/validation";
import * as credentialsAuthService from "../services/credentialsAuthService";

const router = Router();

/**
 * Creates a new email/password account.
 * Body: { email: string; password: string }
 * Returns 201 { id, email } or 409 when the email is already taken.
 */
router.post("/register", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = requireObject(req.body);
    const email = requireString(body.email, "email", { max: 254 }).toLowerCase().trim();
    const password = requireString(body.password, "password", { min: 8, max: 128 });
    const user = await credentialsAuthService.registerUser(email, password);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

/**
 * Verifies an email and password, returning the user id on success.
 * Body: { email: string; password: string }
 * Returns 200 { id, email } or 401 when credentials are invalid.
 */
router.post("/verify", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = requireObject(req.body);
    const email = requireString(body.email, "email", { max: 254 }).toLowerCase().trim();
    const password = requireString(body.password, "password", { max: 128 });
    const user = await credentialsAuthService.verifyCredentials(email, password);
    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
});

export default router;
