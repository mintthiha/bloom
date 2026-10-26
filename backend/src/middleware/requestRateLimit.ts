import { Request } from "express";
import { rateLimit, RateLimitRequestHandler } from "express-rate-limit";
import { readClientKey } from "./authRateLimit";

export const REQUESTS_PER_CALLER_LIMIT = { maxRequests: 1000, windowMs: 15 * 60 * 1000 };

/**
 * Picks whose budget a request spends: the signed-in user's, else the visitor's forwarded IP.
 * Never `req.ip` alone — every request arrives from the Next.js server, so that would make one
 * budget shared by all users, and a single busy user could lock everyone out.
 */
export function readRequestRateLimitKey(req: Request): string {
  const userId = req.headers["x-user-id"];
  return typeof userId === "string" && userId ? `user:${userId}` : `client:${readClientKey(req)}`;
}

/** Broad per-caller cap on all backend traffic; feature-specific limits sit on top of it. */
export function createRequestRateLimiter(): RateLimitRequestHandler {
  return rateLimit({
    windowMs: REQUESTS_PER_CALLER_LIMIT.windowMs,
    limit: REQUESTS_PER_CALLER_LIMIT.maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: readRequestRateLimitKey,
    message: { error: "Too many requests, please try again later." },
  });
}
