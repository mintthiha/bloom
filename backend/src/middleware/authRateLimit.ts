import { Request } from "express";
import { ipKeyGenerator, rateLimit, RateLimitRequestHandler } from "express-rate-limit";

/**
 * Limits for the unauthenticated credentials endpoints. Counts live in this process's memory, so
 * they reset when the backend restarts — enough to stop brute force and bulk sign-ups, not a quota.
 */
export const AUTH_RATE_LIMITS = {
  // Failed sign-ins per email: stops password guessing against one account from any number of IPs.
  failedSignInsPerEmail: { maxRequests: 10, windowMs: 15 * 60 * 1000 },
  registrationsPerClient: { maxRequests: 10, windowMs: 60 * 60 * 1000 },
  demoAccountsPerClient: { maxRequests: 5, windowMs: 60 * 60 * 1000 },
  // Backstop for demo accounts across all visitors, since each one seeds six months of rows.
  demoAccountsOverall: { maxRequests: 100, windowMs: 60 * 60 * 1000 },
} as const;

const SHARED_CLIENT_KEY = "unknown-client";

/**
 * Reads the visitor's IP, which the Next.js server forwards as `X-Client-Ip`. Every request
 * reaches the backend from the Next.js server, so `req.ip` would put all visitors in one bucket.
 * The header is trustworthy because only callers holding the internal secret get this far.
 */
export function readClientKey(req: Request): string {
  const clientIp = req.headers["x-client-ip"];
  // ipKeyGenerator groups an IPv6 address by its /56 subnet so one host can't rotate addresses.
  return typeof clientIp === "string" && clientIp ? ipKeyGenerator(clientIp) : SHARED_CLIENT_KEY;
}

/** Reads the normalized email a sign-in request is for, matching how the route looks it up. */
export function readSignInEmail(req: Request): string | undefined {
  const email = (req.body as Record<string, unknown> | undefined)?.email;
  return typeof email === "string" && email.trim() ? email.trim().toLowerCase() : undefined;
}

/**
 * Whether a sign-in reply should be left uncounted: anything but a rejection. A 5xx means the
 * server failed, not the password, so retries during an outage must not lock the user out.
 */
export function isUncountedSignInReply(statusCode: number): boolean {
  return statusCode < 400 || statusCode >= 500;
}

/**
 * Counts only rejected sign-ins (4xx replies) per email, so a user who signs in correctly is never
 * slowed down, but guessing passwords for one account stops after a handful of tries.
 */
export function createFailedSignInLimiter(): RateLimitRequestHandler {
  const { maxRequests, windowMs } = AUTH_RATE_LIMITS.failedSignInsPerEmail;
  return rateLimit({
    windowMs,
    limit: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => readSignInEmail(req) ?? "",
    // A request without an email is rejected by the route's own validation.
    skip: (req) => readSignInEmail(req) === undefined,
    skipSuccessfulRequests: true,
    requestWasSuccessful: (_req, res) => isUncountedSignInReply(res.statusCode),
    message: { error: "Too many sign-in attempts. Please wait 15 minutes and try again." },
  });
}

/** Limits new email/password accounts per visitor. */
export function createRegistrationLimiter(): RateLimitRequestHandler {
  const { maxRequests, windowMs } = AUTH_RATE_LIMITS.registrationsPerClient;
  return rateLimit({
    windowMs,
    limit: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: readClientKey,
    message: { error: "Too many accounts created from your network. Please try again later." },
  });
}

/** Limits demo accounts per visitor and, as a backstop, across everyone. */
export function createDemoAccountLimiters(): RateLimitRequestHandler[] {
  const perClient = AUTH_RATE_LIMITS.demoAccountsPerClient;
  const overall = AUTH_RATE_LIMITS.demoAccountsOverall;
  return [
    rateLimit({
      windowMs: perClient.windowMs,
      limit: perClient.maxRequests,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: readClientKey,
      message: { error: "You've started several demos recently. Please try again later." },
    }),
    rateLimit({
      windowMs: overall.windowMs,
      limit: overall.maxRequests,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: () => "all-demo-accounts",
      message: { error: "The demo is very busy right now. Please try again later." },
    }),
  ];
}
