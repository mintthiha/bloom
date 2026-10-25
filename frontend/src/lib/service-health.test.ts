import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  UNCHECKED_SERVICE,
  formatDiagnosticsForCopy,
  isServiceHealthReport,
  requestServiceHealthReport,
  type ServiceHealthReport,
} from "./service-health";

const healthyReport: ServiceHealthReport = {
  frontend: { status: "ok", detail: "Next.js server is running." },
  backend: { status: "ok", detail: "Backend API is running." },
  database: { status: "ok", detail: "Connected." },
};

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isServiceHealthReport", () => {
  it("accepts a complete report", () => {
    expect(isServiceHealthReport(healthyReport)).toBe(true);
  });

  it("rejects a report missing a service", () => {
    const { database: _database, ...withoutDatabase } = healthyReport;
    expect(isServiceHealthReport(withoutDatabase)).toBe(false);
  });

  it("rejects an unknown status or a missing detail", () => {
    expect(
      isServiceHealthReport({ ...healthyReport, backend: { status: "degraded", detail: "x" } })
    ).toBe(false);
    expect(isServiceHealthReport({ ...healthyReport, backend: { status: "ok" } })).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(isServiceHealthReport(null)).toBe(false);
    expect(isServiceHealthReport("ok")).toBe(false);
  });
});

describe("requestServiceHealthReport", () => {
  it("returns the report from the health route", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(healthyReport), { status: 200 }));

    await expect(requestServiceHealthReport()).resolves.toEqual(healthyReport);
    expect(fetchMock).toHaveBeenCalledWith("/api/health", { cache: "no-store" });
  });

  it("reports the frontend as down when the Next.js server can't be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const report = await requestServiceHealthReport();

    expect(report.frontend.status).toBe("down");
    expect(report.frontend.detail).toMatch(/couldn't reach the next\.js server/i);
    expect(report.backend).toEqual(UNCHECKED_SERVICE);
    expect(report.database).toEqual(UNCHECKED_SERVICE);
  });

  it("reports the frontend as down when the health route answers with something else", async () => {
    fetchMock.mockResolvedValue(new Response("<h1>Bad Gateway</h1>", { status: 502 }));

    const report = await requestServiceHealthReport();

    expect(report.frontend).toEqual({
      status: "down",
      detail: "The health check answered with HTTP 502 instead of a report.",
    });
    expect(report.backend).toEqual(UNCHECKED_SERVICE);
  });
});

describe("formatDiagnosticsForCopy", () => {
  const checkedAt = new Date("2026-10-24T12:00:00.000Z");

  it("lists every service and the error with its reference", () => {
    const error = Object.assign(new Error("Cannot read properties of undefined"), {
      digest: "abc123",
    });

    expect(formatDiagnosticsForCopy(healthyReport, error, checkedAt)).toBe(
      [
        "Bloom diagnostics — 2026-10-24T12:00:00.000Z",
        "Frontend (Next.js): ok — Next.js server is running.",
        "Backend API: ok — Backend API is running.",
        "Database (Postgres): ok — Connected.",
        "Error: Cannot read properties of undefined",
        "Reference: abc123",
      ].join("\n")
    );
  });

  it("falls back to the error name when the message is empty and omits a missing reference", () => {
    const error = new TypeError("");

    expect(formatDiagnosticsForCopy(null, error, checkedAt)).toBe(
      "Bloom diagnostics — 2026-10-24T12:00:00.000Z\nError: TypeError"
    );
  });

  it("includes only the header when there is no report or error yet", () => {
    expect(formatDiagnosticsForCopy(null, undefined, checkedAt)).toBe(
      "Bloom diagnostics — 2026-10-24T12:00:00.000Z"
    );
  });
});
