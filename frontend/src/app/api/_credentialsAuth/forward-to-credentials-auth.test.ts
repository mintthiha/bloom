import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GENERIC_FAILURE_MESSAGE, SERVER_UNAVAILABLE_MESSAGE } from "@/lib/backend-errors";
import { forwardToCredentialsAuth, readJsonObjectBody } from "./forward-to-credentials-auth";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("INTERNAL_API_SECRET", "test-secret");
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("readJsonObjectBody", () => {
  /** Builds a POST request carrying the given raw body. */
  function requestWithBody(body: string) {
    return new Request("http://localhost/api/register", { method: "POST", body });
  }

  it("returns the parsed object for a JSON object body", async () => {
    await expect(readJsonObjectBody(requestWithBody('{"email":"a@b.ca"}'))).resolves.toEqual({
      email: "a@b.ca",
    });
  });

  it.each([
    ["malformed JSON", "{not json"],
    ["an empty body", ""],
    ["a JSON array", "[1,2]"],
    ["a JSON string", '"hello"'],
    ["JSON null", "null"],
  ])("returns null for %s", async (_description, body) => {
    await expect(readJsonObjectBody(requestWithBody(body))).resolves.toBeNull();
  });
});

describe("forwardToCredentialsAuth", () => {
  it("forwards the payload with the internal secret and relays the JSON reply", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "user-1" }), { status: 201 }));

    const response = await forwardToCredentialsAuth("/register", "POST", {
      email: "a@b.ca",
      password: "secret123",
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: "user-1" });
    const [url, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:3001/api/credentials-auth/register");
    expect(requestInit.method).toBe("POST");
    expect((requestInit.headers as Record<string, string>)["X-Internal-Secret"]).toBe(
      "test-secret"
    );
    expect(JSON.parse(requestInit.body as string)).toEqual({
      email: "a@b.ca",
      password: "secret123",
    });
  });

  it("sends no body when no payload is given", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ token: "t" }), { status: 200 }));

    await forwardToCredentialsAuth("/demo", "POST");

    expect((fetchMock.mock.calls[0][1] as RequestInit).body).toBeUndefined();
  });

  it("relays the backend's own JSON error and status", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "Email already registered" }), { status: 409 })
    );

    const response = await forwardToCredentialsAuth("/register", "POST", {});

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Email already registered" });
  });

  it("relays a 204 with no body", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    const response = await forwardToCredentialsAuth("/remember", "DELETE", { token: "t" });

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });

  it("returns a 503 JSON error when the backend can't be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    const response = await forwardToCredentialsAuth("/demo", "POST");

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: SERVER_UNAVAILABLE_MESSAGE });
  });

  it("turns an HTML gateway error into a JSON unavailable error", async () => {
    fetchMock.mockResolvedValue(new Response("<h1>502 Bad Gateway</h1>", { status: 502 }));

    const response = await forwardToCredentialsAuth("/demo", "POST");

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: SERVER_UNAVAILABLE_MESSAGE });
  });

  it("turns a non-JSON success reply into a 502 rather than relaying it as success", async () => {
    fetchMock.mockResolvedValue(new Response("OK", { status: 200 }));

    const response = await forwardToCredentialsAuth("/remember/issue", "POST", {});

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: SERVER_UNAVAILABLE_MESSAGE });
  });

  it("keeps a non-gateway status for a non-JSON error reply", async () => {
    fetchMock.mockResolvedValue(new Response("<h1>Not Found</h1>", { status: 404 }));

    const response = await forwardToCredentialsAuth("/register", "POST", {});

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: GENERIC_FAILURE_MESSAGE });
  });

  it("forwards the visitor's IP for per-visitor rate limits when given", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ token: "t" }), { status: 201 }));

    await forwardToCredentialsAuth("/demo", "POST", undefined, { clientIp: "203.0.113.7" });

    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers["X-Client-Ip"]).toBe("203.0.113.7");
  });

  it("omits the IP header when the visitor's IP is unknown", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ token: "t" }), { status: 201 }));

    await forwardToCredentialsAuth("/demo", "POST", undefined, { clientIp: null });

    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers).not.toHaveProperty("X-Client-Ip");
  });
});
