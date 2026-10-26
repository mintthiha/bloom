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
  it("gives each user their own budget, so one busy user can't lock out another", async () => {
    const app = express();
    app.use(createRequestRateLimiter());
    app.get("/", (_req, res) => {
      res.json({ ok: true });
    });

    for (let attempt = 0; attempt < REQUESTS_PER_CALLER_LIMIT.maxRequests; attempt++) {
      await request(app).get("/").set("X-User-Id", "busy-user");
    }

    expect((await request(app).get("/").set("X-User-Id", "busy-user")).status).toBe(429);
    expect((await request(app).get("/").set("X-User-Id", "other-user")).status).toBe(200);
  });
});
