import crypto from "crypto";
import { Request, Response, NextFunction } from "express";

/**
 * Compares two secrets in constant time. Hashing first gives both sides the same length, which
 * `timingSafeEqual` requires, so neither the content nor the length leaks through response timing.
 */
function secretsMatch(provided: string, expected: string): boolean {
  const providedDigest = crypto.createHash("sha256").update(provided).digest();
  const expectedDigest = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(providedDigest, expectedDigest);
}

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
  const providedSecret = req.headers["x-internal-secret"];
  if (typeof providedSecret !== "string" || !secretsMatch(providedSecret, secret)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
