import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const fetchMock = vi.fn();

/** Calls the route the way the login page does. */
function callRoute(body: string) {
  return POST(new Request("http://localhost/api/remember-issue", { method: "POST", body }));
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("INTERNAL_API_SECRET", "test-secret");
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("POST /api/remember-issue", () => {
  it("puts the token in an httpOnly cookie and returns only the email", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "user-1",
          email: "jane@example.com",
          token: "raw-token",
          expiresAt: "2026-11-24T00:00:00.000Z",
        }),
        { status: 200 }
      )
    );

    const response = await callRoute('{"email":"jane@example.com","password":"secret123"}');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ email: "jane@example.com" });
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("bloom_remember=raw-token");
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toContain("Path=/api");
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({
      email: "jane@example.com",
      password: "secret123",
    });
  });

  it("relays a rejection without setting a cookie", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "Invalid email or password" }), { status: 401 })
    );

    const response = await callRoute('{"email":"jane@example.com","password":"wrong"}');

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("returns 502 without a cookie when the backend's reply is malformed", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ email: "j@x.ca" }), { status: 200 }));

    const response = await callRoute('{"email":"j@x.ca","password":"secret123"}');

    expect(response.status).toBe(502);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("rejects an unreadable body without calling the backend", async () => {
    const response = await callRoute("not json");

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
