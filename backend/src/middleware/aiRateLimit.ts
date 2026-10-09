import { Request } from "express";
import { rateLimit, RateLimitRequestHandler } from "express-rate-limit";

export type AiFeature = "chat" | "categorization";

/**
 * How many requests one user may make to each AI feature per window. Each feature has its own
 * budget, so a burst of one (e.g. categorizing a large import) never locks the user out of another.
 */
export const AI_FEATURE_RATE_LIMITS: Record<AiFeature, { maxRequests: number; windowMs: number }> =
  {
    chat: { maxRequests: 30, windowMs: 60 * 60 * 1000 },
    categorization: { maxRequests: 30, windowMs: 15 * 60 * 1000 },
  };

/** Reads the signed-in user's id, which the Next.js server attaches to every backend request. */
function readUserId(req: Request): string | undefined {
  const userId = req.headers["x-user-id"];
  return typeof userId === "string" && userId ? userId : undefined;
}

/**
 * Builds the limiter for one AI feature. Requests are counted per user rather than per IP, because
 * every request reaches the backend from the same Next.js server and would otherwise share one
 * budget. Counts live in this process's memory, so they reset when the backend restarts.
 */
export function createAiRateLimiter(feature: AiFeature): RateLimitRequestHandler {
  const { maxRequests, windowMs } = AI_FEATURE_RATE_LIMITS[feature];
  return rateLimit({
    windowMs,
    limit: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => readUserId(req) ?? "",
    // A request without a user id is rejected as unauthorized by the route itself.
    skip: (req) => readUserId(req) === undefined,
    message: { error: "Too many AI requests, please try again later." },
  });
}
