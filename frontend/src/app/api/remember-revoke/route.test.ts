import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "./route";

const fetchMock = vi.fn();

/** Calls the route with the given Cookie header, the way the browser would. */
function callRoute(cookieHeader?: string) {
  return DELETE(
    new NextRequest("http://localhost/api/remember-revoke", {
      method: "DELETE",
      headers: cookieHeader ? { cookie: cookieHeader } : {},
    })
  );
}

/** Whether the response tells the browser to drop the remember-me cookie. */
function clearsRememberCookie(response: Response) {
  const cookie = response.headers.get("set-cookie") ?? "";
  return cookie.includes("bloom_remember=;") && cookie.includes("Path=/api");
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

describe("DELETE /api/remember-revoke", () => {
  it("revokes the token from the cookie and clears the cookie", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    const response = await callRoute("theme=dark; bloom_remember=raw-token");

    expect(response.status).toBe(204);
    const [url, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:3001/api/credentials-auth/remember");
    expect(requestInit.method).toBe("DELETE");
    expect(JSON.parse(requestInit.body as string)).toEqual({ token: "raw-token" });
    expect(clearsRememberCookie(response)).toBe(true);
  });

  it("answers 204 without calling the backend when there is no cookie", async () => {
    const response = await callRoute();

    expect(response.status).toBe(204);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(clearsRememberCookie(response)).toBe(true);
  });

  it("still clears the cookie when the backend can't be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    const response = await callRoute("bloom_remember=raw-token");

    expect(response.status).toBe(503);
    expect(clearsRememberCookie(response)).toBe(true);
  });
});
