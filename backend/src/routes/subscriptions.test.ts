import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../app";
import { INTERNAL_SECRET } from "../test-setup";

const { serviceMock } = vi.hoisted(() => ({
  serviceMock: {
    getSubscriptionSummary: vi.fn(),
  },
}));

vi.mock("../services/subscriptionService", () => serviceMock);

describe("subscriptions routes", () => {
  beforeEach(() => {
    serviceMock.getSubscriptionSummary.mockReset();
  });

  it("returns 401 when x-user-id is missing", async () => {
    const response = await request(app)
      .get("/api/subscriptions")
      .set("X-Internal-Secret", INTERNAL_SECRET);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Unauthorized" });
    expect(serviceMock.getSubscriptionSummary).not.toHaveBeenCalled();
  });

  it("returns the subscription summary for the current user", async () => {
    const summary = {
      monthlyTotal: 26.98,
      annualTotal: 323.76,
      count: 2,
      subscriptions: [],
    };
    serviceMock.getSubscriptionSummary.mockResolvedValue(summary);

    const response = await request(app)
      .get("/api/subscriptions")
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .set("X-User-Id", "user-1");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(summary);
    expect(serviceMock.getSubscriptionSummary).toHaveBeenCalledWith("user-1");
  });
});
