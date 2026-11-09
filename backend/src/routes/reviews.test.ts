import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../app";
import { INTERNAL_SECRET } from "../test-setup";

const { serviceMock } = vi.hoisted(() => ({
  serviceMock: {
    getMonthlyReview: vi.fn(),
    completeMonthlyReview: vi.fn(),
    getYearInReview: vi.fn(),
    hasActivityInMonth: vi.fn(),
    hasCompletedMonthlyReview: vi.fn(),
  },
}));

vi.mock("../services/reviewService", () => serviceMock);

/** Sends an authenticated request as user-1. */
function authed(method: "get" | "post", path: string) {
  return request(app)
    [method](path)
    .set("X-Internal-Secret", INTERNAL_SECRET)
    .set("X-User-Id", "user-1");
}

describe("review routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without a user id", async () => {
    const response = await request(app)
      .get("/api/reviews/monthly?month=2026-10&timeZone=UTC")
      .set("X-Internal-Secret", INTERNAL_SECRET);
    expect(response.status).toBe(401);
    expect(serviceMock.getMonthlyReview).not.toHaveBeenCalled();
  });

  it("returns the monthly review for the month and time zone", async () => {
    serviceMock.getMonthlyReview.mockResolvedValue({ month: "2026-10" });

    const response = await authed(
      "get",
      "/api/reviews/monthly?month=2026-10&timeZone=America/Toronto"
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ month: "2026-10" });
    expect(serviceMock.getMonthlyReview).toHaveBeenCalledWith(
      "user-1",
      "2026-10",
      "America/Toronto"
    );
  });

  it("rejects a malformed month before calling the service", async () => {
    const response = await authed("get", "/api/reviews/monthly?month=2026-13&timeZone=UTC");
    expect(response.status).toBe(400);
    expect(serviceMock.getMonthlyReview).not.toHaveBeenCalled();
  });

  it("rejects a missing or unknown time zone before calling the service", async () => {
    const missing = await authed("get", "/api/reviews/monthly?month=2026-10");
    const unknown = await authed("get", "/api/reviews/monthly?month=2026-10&timeZone=Mars/Olympus");
    expect(missing.status).toBe(400);
    expect(unknown.status).toBe(400);
    expect(unknown.body.error).toBe("timeZone must be a valid IANA time zone");
    expect(serviceMock.getMonthlyReview).not.toHaveBeenCalled();
  });

  it("completes a review and returns 201", async () => {
    serviceMock.completeMonthlyReview.mockResolvedValue({ month: "2026-10", reviewStreak: 3 });

    const response = await authed("post", "/api/reviews/monthly/2026-10/complete");

    expect(response.status).toBe(201);
    expect(response.body.reviewStreak).toBe(3);
    expect(serviceMock.completeMonthlyReview).toHaveBeenCalledWith("user-1", "2026-10");
  });

  it("rejects completing a malformed month", async () => {
    const response = await authed("post", "/api/reviews/monthly/october/complete");
    expect(response.status).toBe(400);
    expect(serviceMock.completeMonthlyReview).not.toHaveBeenCalled();
  });

  it("returns the year in review", async () => {
    serviceMock.getYearInReview.mockResolvedValue({ year: 2026 });

    const response = await authed("get", "/api/reviews/year?year=2026&timeZone=America/Vancouver");

    expect(response.status).toBe(200);
    expect(serviceMock.getYearInReview).toHaveBeenCalledWith("user-1", 2026, "America/Vancouver");
  });

  it("rejects a non-numeric year before calling the service", async () => {
    const response = await authed("get", "/api/reviews/year?year=twenty&timeZone=UTC");
    expect(response.status).toBe(400);
    expect(serviceMock.getYearInReview).not.toHaveBeenCalled();
  });
});
