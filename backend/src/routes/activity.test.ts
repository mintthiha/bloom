import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../app";
import { INTERNAL_SECRET } from "../test-setup";

const { serviceMock } = vi.hoisted(() => ({
  serviceMock: { listActivityLogs: vi.fn() },
}));

vi.mock("../services/activityService", () => serviceMock);

/** Sends GET /api/activity as user-1 with the given query string. */
function getActivity(query = "") {
  return request(app)
    .get(`/api/activity${query}`)
    .set("X-Internal-Secret", INTERNAL_SECRET)
    .set("X-User-Id", "user-1");
}

describe("activity routes", () => {
  beforeEach(() => {
    serviceMock.listActivityLogs.mockReset();
    serviceMock.listActivityLogs.mockResolvedValue({ logs: [], total: 0 });
  });

  it("returns 401 when x-user-id is missing", async () => {
    const response = await request(app)
      .get("/api/activity")
      .set("X-Internal-Secret", INTERNAL_SECRET);

    expect(response.status).toBe(401);
    expect(serviceMock.listActivityLogs).not.toHaveBeenCalled();
  });

  it("returns the service's page of logs using the default paging", async () => {
    const page = { logs: [{ id: "log-1" }], total: 1 };
    serviceMock.listActivityLogs.mockResolvedValue(page);

    const response = await getActivity();

    expect(response.status).toBe(200);
    expect(response.body).toEqual(page);
    expect(serviceMock.listActivityLogs).toHaveBeenCalledWith("user-1", {
      limit: 50,
      offset: 0,
      search: undefined,
      group: undefined,
      action: undefined,
      sort: undefined,
      start: undefined,
      end: undefined,
    });
  });

  it("passes every valid filter through to the service", async () => {
    const response = await getActivity(
      "?limit=25&offset=50&search=rent&group=BUDGET&action=UPDATED&sort=date_asc" +
        "&start=2026-01-01&end=2026-02-01"
    );

    expect(response.status).toBe(200);
    expect(serviceMock.listActivityLogs).toHaveBeenCalledWith("user-1", {
      limit: 25,
      offset: 50,
      search: "rent",
      group: "BUDGET",
      action: "UPDATED",
      sort: "date_asc",
      start: new Date("2026-01-01"),
      end: new Date("2026-02-01"),
    });
  });

  it.each([
    ["caps the limit at 100", "?limit=500", { limit: 100 }],
    ["raises a limit below 1 to 1", "?limit=-3", { limit: 1 }],
    ["falls back to 50 for a non-numeric limit", "?limit=lots", { limit: 50 }],
    ["floors a negative offset at 0", "?offset=-10", { offset: 0 }],
    ["falls back to 0 for a non-numeric offset", "?offset=abc", { offset: 0 }],
  ])("%s", async (_description, query, expected) => {
    await getActivity(query);

    expect(serviceMock.listActivityLogs).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining(expected)
    );
  });

  it("treats an empty search as no search", async () => {
    await getActivity("?search=");

    expect(serviceMock.listActivityLogs).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ search: undefined })
    );
  });

  it.each([
    ["an unknown group", "?group=SECRETS", "group must be one of"],
    ["an unknown action", "?action=EXPLODED", "action must be one of"],
    ["an unknown sort key", "?sort=amount_desc", "sort must be one of"],
    [
      "a start date without an end date",
      "?start=2026-01-01",
      "start and end must be ISO date strings",
    ],
    ["an unparseable date", "?start=yesterday&end=today", "start and end must be valid dates"],
  ])("rejects %s before calling the service", async (_description, query, message) => {
    const response = await getActivity(query);

    expect(response.status).toBe(400);
    expect(response.body.error).toContain(message);
    expect(serviceMock.listActivityLogs).not.toHaveBeenCalled();
  });
});
