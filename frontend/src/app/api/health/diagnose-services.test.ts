import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UNCHECKED_SERVICE } from "@/lib/service-health";
import { describeUnreachableBackend, diagnoseServices } from "./diagnose-services";

const fetchMock = vi.fn();

/** Builds the error undici throws for a refused or unresolvable connection. */
function networkError(code: string) {
  return Object.assign(new TypeError("fetch failed"), { cause: { code } });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("describeUnreachableBackend", () => {
  it("explains a refused connection as the backend not running", () => {
    expect(describeUnreachableBackend(networkError("ECONNREFUSED"))).toMatch(
      /connection refused — the backend container or process isn't running/i
    );
  });

  it("reads the code from a dual-stack AggregateError", () => {
    const error = Object.assign(new TypeError("fetch failed"), {
      cause: { errors: [{ code: "ECONNREFUSED" }, { code: "ECONNREFUSED" }] },
    });

    expect(describeUnreachableBackend(error)).toMatch(/connection refused/i);
  });

  it.each(["ENOTFOUND", "EAI_AGAIN"])("explains %s as a host lookup problem", (code) => {
    expect(describeUnreachableBackend(networkError(code))).toMatch(
      /host not found — check NEXT_PUBLIC_API_URL/
    );
  });

  it("explains a reset connection as a crash or restart", () => {
    expect(describeUnreachableBackend(networkError("ECONNRESET"))).toMatch(/connection dropped/i);
  });

  it.each(["TimeoutError", "AbortError"])("explains a %s as no response in time", (name) => {
    const error = Object.assign(new Error("timed out"), { name });

    expect(describeUnreachableBackend(error)).toBe(
      "No response within 5s — the backend may be starting up or stuck."
    );
  });

  it("shows an unrecognized code as-is", () => {
    expect(describeUnreachableBackend(networkError("EHOSTUNREACH"))).toBe(
      "Unreachable (EHOSTUNREACH)."
    );
  });

  it("falls back to a bare message when there is no code", () => {
    expect(describeUnreachableBackend(new Error("boom"))).toBe("Unreachable.");
    expect(describeUnreachableBackend("not an error")).toBe("Unreachable.");
  });
});

describe("diagnoseServices", () => {
  it("reports everything healthy when the backend and database are up", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: "ok", service: "bloom-api", db: "ok" }))
    );

    const report = await diagnoseServices();

    expect(report).toEqual({
      frontend: { status: "ok", detail: "Next.js server is running." },
      backend: { status: "ok", detail: "Backend API is running." },
      database: { status: "ok", detail: "Connected." },
    });
    const [url, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:3001/health");
    expect(requestInit.signal).toBeInstanceOf(AbortSignal);
  });

  it("reports the database as down when the backend can't reach Postgres", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: "error", service: "bloom-api", db: "unreachable" }), {
        status: 503,
      })
    );

    const report = await diagnoseServices();

    expect(report.backend.status).toBe("ok");
    expect(report.database).toEqual({
      status: "down",
      detail: "The backend can't reach Postgres — the database container may be down.",
    });
  });

  it("reports the backend as down and skips the database when it can't be reached", async () => {
    fetchMock.mockRejectedValue(networkError("ECONNREFUSED"));

    const report = await diagnoseServices();

    expect(report.frontend.status).toBe("ok");
    expect(report.backend.status).toBe("down");
    expect(report.backend.detail).toMatch(/connection refused/i);
    expect(report.database).toEqual(UNCHECKED_SERVICE);
  });

  it("points at the backend logs for a 5xx that isn't the health reply", async () => {
    fetchMock.mockResolvedValue(new Response("<h1>Internal Server Error</h1>", { status: 500 }));

    const report = await diagnoseServices();

    expect(report.backend).toEqual({
      status: "down",
      detail: "Backend answered with HTTP 500 — check the backend logs.",
    });
    expect(report.database).toEqual(UNCHECKED_SERVICE);
  });

  it("flags a wrong backend URL when some other service answers", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ hello: "world" }), { status: 200 }));

    const report = await diagnoseServices();

    expect(report.backend.status).toBe("down");
    expect(report.backend.detail).toMatch(/isn't Bloom's backend — NEXT_PUBLIC_API_URL/);
  });
});
