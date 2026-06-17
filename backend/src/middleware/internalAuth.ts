import { Request, Response, NextFunction } from "express";

/**
 * Rejects any request that doesn't carry the correct shared secret, preventing
 * direct callers from spoofing X-User-Id by bypassing the Next.js proxy.
 */
export function requireInternalSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    console.error("INTERNAL_API_SECRET is not set — all requests will be rejected");
    res.status(503).json({ error: "Server misconfiguration" });
    return;
  }
  if (req.headers["x-internal-secret"] !== secret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
