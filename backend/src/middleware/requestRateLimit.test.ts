import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  REQUESTS_PER_CALLER_LIMIT,
  createRequestRateLimiter,
  readRequestRateLimitKey,
} from "./requestRateLimit";

/** Builds the minimal request shape the key reader looks at. */
function requestWithHeaders(headers: Record<string, unknown>) {
  return { headers } as never;
}

describe("readRequestRateLimitKey", () => {
  it("uses the signed-in user when the proxy attached one", () => {
    expect(
      readRequestRateLimitKey(
        requestWithHeaders({ "x-user-id": "user-1", "x-client-ip": "203.0.113.7" })
      )
    ).toBe("user:user-1");
  });

  it("falls back to the visitor's forwarded IP", () => {
    expect(readRequestRateLimitKey(requestWithHeaders({ "x-client-ip": "203.0.113.7" }))).toBe(
      "client:203.0.113.7"
    );
  });

  it("falls back to a shared key when neither is known", () => {
    expect(readRequestRateLimitKey(requestWithHeaders({ "x-user-id": "" }))).toBe(
      "client:unknown-client"
    );
  });
});

describe("createRequestRateLimiter", () => {
  /** Builds an app behind a limiter with the given per-caller budget. */
  function buildLimitedApp(maxRequests?: number) {
    const app = express();
    app.use(createRequestRateLimiter(maxRequests === undefined ? undefined : { maxRequests }));
    app.get("/", (_req, res) => {
      res.json({ ok: true });
    });
    return app;
  }

  it("gives each user their own budget, so one busy user can't lock out another", async () => {
    const app = buildLimitedApp(3);
    for (let attempt = 0; attempt < 3; attempt++) {
      expect((await request(app).get("/").set("X-User-Id", "busy-user")).status).toBe(200);
    }

    expect((await request(app).get("/").set("X-User-Id", "busy-user")).status).toBe(429);
    expect((await request(app).get("/").set("X-User-Id", "other-user")).status).toBe(200);
  });

  it("keys visitors without a user by their forwarded IP", async () => {
    const app = buildLimitedApp(2);
    for (let attempt = 0; attempt < 2; attempt++) {
      await request(app).get("/").set("X-Client-Ip", "203.0.113.7");
    }

    expect((await request(app).get("/").set("X-Client-Ip", "203.0.113.7")).status).toBe(429);
    expect((await request(app).get("/").set("X-Client-Ip", "198.51.100.4")).status).toBe(200);
  });

  it("allows 1000 requests per caller by default", async () => {
    const response = await request(buildLimitedApp()).get("/").set("X-User-Id", "user-1");

    expect(REQUESTS_PER_CALLER_LIMIT.maxRequests).toBe(1000);
    expect(response.headers["ratelimit-limit"]).toBe("1000");
  });
});
