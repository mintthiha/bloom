import express, { RequestHandler } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  AUTH_RATE_LIMITS,
  createDemoAccountLimiters,
  createFailedSignInLimiter,
  createRegistrationLimiter,
  isUncountedSignInReply,
  readClientKey,
  readSignInEmail,
} from "./authRateLimit";

describe("isUncountedSignInReply", () => {
  it.each([200, 201, 204, 302, 500, 502, 503])("leaves a %i uncounted", (statusCode) => {
    expect(isUncountedSignInReply(statusCode)).toBe(true);
  });

  it.each([400, 401, 403, 404, 429, 499])("counts a %i as a rejection", (statusCode) => {
    expect(isUncountedSignInReply(statusCode)).toBe(false);
  });
});

/** Builds an app whose one route answers with the status in the body, behind the given limiters. */
function buildApp(...limiters: RequestHandler[]) {
  const app = express();
  app.use(express.json());
  app.post("/", ...limiters, (req, res) => {
    res.status((req.body as { status?: number }).status ?? 200).json({ ok: true });
  });
  return app;
}

/** Sends one request as the given client IP with the given body. */
function send(app: express.Express, body: Record<string, unknown>, clientIp?: string) {
  const pending = request(app).post("/").send(body);
  return clientIp ? pending.set("X-Client-Ip", clientIp) : pending;
}

describe("readClientKey", () => {
  /** Builds the minimal request shape the key reader looks at. */
  function requestWithHeaders(headers: Record<string, unknown>) {
    return { headers } as never;
  }

  it("uses the forwarded IPv4 address as is", () => {
    expect(readClientKey(requestWithHeaders({ "x-client-ip": "203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("groups IPv6 addresses from the same /56 subnet", () => {
    const firstKey = readClientKey(requestWithHeaders({ "x-client-ip": "2001:db8:1:100::1" }));
    const secondKey = readClientKey(requestWithHeaders({ "x-client-ip": "2001:db8:1:1ff::9" }));
    expect(firstKey).toBe(secondKey);
  });

  it("falls back to a shared key when no client IP was forwarded", () => {
    expect(readClientKey(requestWithHeaders({}))).toBe("unknown-client");
    expect(readClientKey(requestWithHeaders({ "x-client-ip": "" }))).toBe("unknown-client");
  });
});

describe("readSignInEmail", () => {
  it("normalizes case and surrounding whitespace", () => {
    expect(readSignInEmail({ body: { email: "  Jane@Example.COM " } } as never)).toBe(
      "jane@example.com"
    );
  });

  it("returns undefined for a missing, blank, or non-string email", () => {
    expect(readSignInEmail({ body: {} } as never)).toBeUndefined();
    expect(readSignInEmail({ body: { email: "  " } } as never)).toBeUndefined();
    expect(readSignInEmail({ body: { email: 42 } } as never)).toBeUndefined();
    expect(readSignInEmail({} as never)).toBeUndefined();
  });
});

describe("createFailedSignInLimiter", () => {
  const { maxRequests } = AUTH_RATE_LIMITS.failedSignInsPerEmail;

  it("blocks an email after too many failed sign-ins", async () => {
    const app = buildApp(createFailedSignInLimiter());
    for (let attempt = 0; attempt < maxRequests; attempt++) {
      const response = await send(app, { email: "jane@example.com", status: 401 });
      expect(response.status).toBe(401);
    }

    const blockedResponse = await send(app, { email: "jane@example.com", status: 200 });

    expect(blockedResponse.status).toBe(429);
    expect(blockedResponse.body).toEqual({
      error: "Too many sign-in attempts. Please wait 15 minutes and try again.",
    });
  });

  it("never counts successful sign-ins", async () => {
    const app = buildApp(createFailedSignInLimiter());
    for (let attempt = 0; attempt < maxRequests + 5; attempt++) {
      const response = await send(app, { email: "jane@example.com", status: 200 });
      expect(response.status).toBe(200);
    }
  });

  it("does not count retries during a server outage against the user", async () => {
    const app = buildApp(createFailedSignInLimiter());
    for (let attempt = 0; attempt < maxRequests + 5; attempt++) {
      const response = await send(app, { email: "jane@example.com", status: 503 });
      expect(response.status).toBe(503);
    }

    expect((await send(app, { email: "jane@example.com" })).status).toBe(200);
  });

  it("counts the same email regardless of case or spacing", async () => {
    const app = buildApp(createFailedSignInLimiter());
    for (let attempt = 0; attempt < maxRequests; attempt++) {
      await send(app, {
        email: attempt % 2 ? "JANE@example.com" : " jane@example.com",
        status: 401,
      });
    }

    expect((await send(app, { email: "Jane@Example.com" })).status).toBe(429);
  });

  it("keeps each email's failures separate", async () => {
    const app = buildApp(createFailedSignInLimiter());
    for (let attempt = 0; attempt < maxRequests; attempt++) {
      await send(app, { email: "jane@example.com", status: 401 });
    }

    expect((await send(app, { email: "sam@example.com" })).status).toBe(200);
  });

  it("lets requests without an email through to the route's own validation", async () => {
    const app = buildApp(createFailedSignInLimiter());
    for (let attempt = 0; attempt < maxRequests + 2; attempt++) {
      expect((await send(app, { status: 400 })).status).toBe(400);
    }
  });
});

describe("createRegistrationLimiter", () => {
  const { maxRequests } = AUTH_RATE_LIMITS.registrationsPerClient;

  it("blocks a client after too many registrations and leaves other clients alone", async () => {
    const app = buildApp(createRegistrationLimiter());
    for (let attempt = 0; attempt < maxRequests; attempt++) {
      expect((await send(app, { status: 201 }, "203.0.113.7")).status).toBe(201);
    }

    const blockedResponse = await send(app, {}, "203.0.113.7");

    expect(blockedResponse.status).toBe(429);
    expect(blockedResponse.body.error).toMatch(/too many accounts created/i);
    expect((await send(app, {}, "198.51.100.4")).status).toBe(200);
  });
});

describe("createDemoAccountLimiters", () => {
  const perClient = AUTH_RATE_LIMITS.demoAccountsPerClient;
  const overall = AUTH_RATE_LIMITS.demoAccountsOverall;

  it("blocks a client after a few demo accounts", async () => {
    const app = buildApp(...createDemoAccountLimiters());
    for (let attempt = 0; attempt < perClient.maxRequests; attempt++) {
      expect((await send(app, {}, "203.0.113.7")).status).toBe(200);
    }

    const blockedResponse = await send(app, {}, "203.0.113.7");

    expect(blockedResponse.status).toBe(429);
    expect(blockedResponse.body.error).toMatch(/started several demos/i);
  });

  it("caps demo accounts across all clients", async () => {
    const app = buildApp(...createDemoAccountLimiters());
    for (let attempt = 0; attempt < overall.maxRequests; attempt++) {
      expect((await send(app, {}, `203.0.113.${attempt}`)).status).toBe(200);
    }

    const blockedResponse = await send(app, {}, "198.51.100.4");

    expect(blockedResponse.status).toBe(429);
    expect(blockedResponse.body.error).toMatch(/demo is very busy/i);
  });
});
