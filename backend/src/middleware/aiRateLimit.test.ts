import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { AI_FEATURE_RATE_LIMITS, createAiRateLimiter } from "./aiRateLimit";

/** Builds a tiny app with one endpoint per AI feature, each behind its own fresh limiter. */
function buildLimitedApp() {
  const limitedApp = express();
  limitedApp.post("/chat", createAiRateLimiter("chat"), (_req, res) => res.json({ ok: true }));
  limitedApp.post("/categorization", createAiRateLimiter("categorization"), (_req, res) =>
    res.json({ ok: true })
  );
  return limitedApp;
}

/** Sends `count` requests to a feature as one user and returns the status of each, in order. */
async function sendRequests(
  limitedApp: express.Express,
  path: string,
  userId: string | undefined,
  count: number
): Promise<number[]> {
  const statuses: number[] = [];
  for (let requestNumber = 0; requestNumber < count; requestNumber++) {
    const pendingRequest = request(limitedApp).post(path);
    if (userId) pendingRequest.set("X-User-Id", userId);
    statuses.push((await pendingRequest).status);
  }
  return statuses;
}

describe("createAiRateLimiter", () => {
  it("allows a user exactly the feature's budget, then rejects with a 429 and a retry hint", async () => {
    const limitedApp = buildLimitedApp();
    const { maxRequests } = AI_FEATURE_RATE_LIMITS.chat;

    const statuses = await sendRequests(limitedApp, "/chat", "user-1", maxRequests);
    const rejectedResponse = await request(limitedApp).post("/chat").set("X-User-Id", "user-1");

    expect(statuses.every((status) => status === 200)).toBe(true);
    expect(rejectedResponse.status).toBe(429);
    expect(rejectedResponse.body).toEqual({
      error: "Too many AI requests, please try again later.",
    });
    expect(Number(rejectedResponse.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("counts each user separately", async () => {
    const limitedApp = buildLimitedApp();
    await sendRequests(limitedApp, "/chat", "user-1", AI_FEATURE_RATE_LIMITS.chat.maxRequests);

    const [exhaustedUserStatus] = await sendRequests(limitedApp, "/chat", "user-1", 1);
    const [otherUserStatus] = await sendRequests(limitedApp, "/chat", "user-2", 1);

    expect(exhaustedUserStatus).toBe(429);
    expect(otherUserStatus).toBe(200);
  });

  it("counts each feature separately for the same user", async () => {
    const limitedApp = buildLimitedApp();
    await sendRequests(limitedApp, "/chat", "user-1", AI_FEATURE_RATE_LIMITS.chat.maxRequests);

    const [chatStatus] = await sendRequests(limitedApp, "/chat", "user-1", 1);
    const [categorizationStatus] = await sendRequests(limitedApp, "/categorization", "user-1", 1);

    expect(chatStatus).toBe(429);
    expect(categorizationStatus).toBe(200);
  });

  it("leaves requests without a user id uncounted, for the route to reject as unauthorized", async () => {
    const limitedApp = buildLimitedApp();
    const requestCount = AI_FEATURE_RATE_LIMITS.chat.maxRequests + 5;

    const statuses = await sendRequests(limitedApp, "/chat", undefined, requestCount);

    expect(statuses.every((status) => status === 200)).toBe(true);
  });
});
