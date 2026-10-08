import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../app";
import { INTERNAL_SECRET } from "../test-setup";

const { serviceMock } = vi.hoisted(() => ({
  serviceMock: {
    listSavingsGoals: vi.fn(),
    createSavingsGoal: vi.fn(),
    updateSavingsGoal: vi.fn(),
    deleteSavingsGoal: vi.fn(),
    restoreSavingsGoal: vi.fn(),
  },
}));

vi.mock("../services/savingsGoalService", () => serviceMock);

/** Minimal savings goal shape returned by the service. */
const GOAL_FIXTURE = {
  id: "g-1",
  userId: "u-1",
  accountId: "a-1",
  name: "Emergency Fund",
  targetAmount: 5000,
  targetDate: "2027-06-30",
  icon: "🛟",
  color: "BLUE",
  note: "Three months of expenses.",
  currentBalance: 1000,
  accountName: "Savings",
  accountNickname: null,
  accountOwnerName: "Test User",
  accountType: "SAVINGS",
  percentageReached: 20,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const VALID_BODY = { accountId: "a-1", name: "Emergency Fund", targetAmount: 5000 };

/** What the route hands the service for {@link VALID_BODY}: the optional fields normalize to null. */
const VALID_BODY_AS_INPUT = {
  ...VALID_BODY,
  targetDate: null,
  icon: null,
  color: null,
  note: null,
};

describe("savings goal routes", () => {
  beforeEach(() => {
    serviceMock.listSavingsGoals.mockReset();
    serviceMock.createSavingsGoal.mockReset();
    serviceMock.updateSavingsGoal.mockReset();
    serviceMock.deleteSavingsGoal.mockReset();
    serviceMock.restoreSavingsGoal.mockReset();
  });

  // -------------------------------------------------------------------------
  // GET /api/savings-goals
  // -------------------------------------------------------------------------

  describe("GET /api/savings-goals", () => {
    it("returns 401 when x-user-id header is missing", async () => {
      const response = await request(app)
        .get("/api/savings-goals")
        .set("X-Internal-Secret", INTERNAL_SECRET);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: "Unauthorized" });
    });

    it("returns 200 with the user's savings goals", async () => {
      serviceMock.listSavingsGoals.mockResolvedValue([GOAL_FIXTURE]);

      const response = await request(app)
        .get("/api/savings-goals")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .set("X-User-Id", "u-1");

      expect(response.status).toBe(200);
      expect(serviceMock.listSavingsGoals).toHaveBeenCalledWith("u-1");
      expect(response.body[0]).toMatchObject({ name: "Emergency Fund", targetAmount: 5000 });
    });

    it("returns an empty array when the user has no savings goals", async () => {
      serviceMock.listSavingsGoals.mockResolvedValue([]);

      const response = await request(app)
        .get("/api/savings-goals")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .set("X-User-Id", "u-1");

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/savings-goals
  // -------------------------------------------------------------------------

  describe("POST /api/savings-goals", () => {
    it("returns 401 when x-user-id header is missing", async () => {
      const response = await request(app)
        .post("/api/savings-goals")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .send(VALID_BODY);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: "Unauthorized" });
    });

    it("returns 400 when accountId is missing", async () => {
      const response = await request(app)
        .post("/api/savings-goals")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .set("X-User-Id", "u-1")
        .send({ name: "Emergency Fund", targetAmount: 5000 });

      expect(response.status).toBe(400);
      expect(serviceMock.createSavingsGoal).not.toHaveBeenCalled();
    });

    it("returns 400 when name is missing", async () => {
      const response = await request(app)
        .post("/api/savings-goals")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .set("X-User-Id", "u-1")
        .send({ accountId: "a-1", targetAmount: 5000 });

      expect(response.status).toBe(400);
      expect(serviceMock.createSavingsGoal).not.toHaveBeenCalled();
    });

    it("returns 400 when targetAmount is not a positive number", async () => {
      const response = await request(app)
        .post("/api/savings-goals")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .set("X-User-Id", "u-1")
        .send({ accountId: "a-1", name: "Emergency Fund", targetAmount: -100 });

      expect(response.status).toBe(400);
      expect(serviceMock.createSavingsGoal).not.toHaveBeenCalled();
    });

    it("returns 400 when targetAmount is zero", async () => {
      const response = await request(app)
        .post("/api/savings-goals")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .set("X-User-Id", "u-1")
        .send({ accountId: "a-1", name: "Emergency Fund", targetAmount: 0 });

      expect(response.status).toBe(400);
      expect(serviceMock.createSavingsGoal).not.toHaveBeenCalled();
    });

    it("returns 201 with the created goal on a valid request", async () => {
      serviceMock.createSavingsGoal.mockResolvedValue(GOAL_FIXTURE);

      const response = await request(app)
        .post("/api/savings-goals")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .set("X-User-Id", "u-1")
        .send(VALID_BODY);

      expect(response.status).toBe(201);
      expect(serviceMock.createSavingsGoal).toHaveBeenCalledWith("u-1", VALID_BODY_AS_INPUT);
      expect(response.body).toMatchObject({ name: "Emergency Fund", targetAmount: 5000 });
    });

    it("passes the target date through as a UTC date and keeps the appearance fields", async () => {
      serviceMock.createSavingsGoal.mockResolvedValue(GOAL_FIXTURE);

      const response = await request(app)
        .post("/api/savings-goals")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .set("X-User-Id", "u-1")
        .send({
          ...VALID_BODY,
          targetDate: "2027-06-30",
          icon: "🛟",
          color: "blue",
          note: "  Three months of expenses.  ",
        });

      expect(response.status).toBe(201);
      expect(serviceMock.createSavingsGoal).toHaveBeenCalledWith("u-1", {
        ...VALID_BODY,
        targetDate: new Date("2027-06-30T00:00:00.000Z"),
        icon: "🛟",
        color: "BLUE",
        note: "Three months of expenses.",
      });
    });

    it("returns 400 when targetDate is not a YYYY-MM-DD string", async () => {
      const response = await request(app)
        .post("/api/savings-goals")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .set("X-User-Id", "u-1")
        .send({ ...VALID_BODY, targetDate: "30/06/2027" });

      expect(response.status).toBe(400);
      expect(serviceMock.createSavingsGoal).not.toHaveBeenCalled();
    });

    it("returns 400 when targetDate is not a real calendar date", async () => {
      const response = await request(app)
        .post("/api/savings-goals")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .set("X-User-Id", "u-1")
        .send({ ...VALID_BODY, targetDate: "2027-02-31" });

      expect(response.status).toBe(400);
      expect(serviceMock.createSavingsGoal).not.toHaveBeenCalled();
    });

    it("returns 400 when the icon is not from the curated set", async () => {
      const response = await request(app)
        .post("/api/savings-goals")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .set("X-User-Id", "u-1")
        .send({ ...VALID_BODY, icon: "🦖" });

      expect(response.status).toBe(400);
      expect(serviceMock.createSavingsGoal).not.toHaveBeenCalled();
    });

    it("returns 400 when the colour is not from the shared palette", async () => {
      const response = await request(app)
        .post("/api/savings-goals")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .set("X-User-Id", "u-1")
        .send({ ...VALID_BODY, color: "CHARTREUSE" });

      expect(response.status).toBe(400);
      expect(serviceMock.createSavingsGoal).not.toHaveBeenCalled();
    });

    it("returns 400 when the note is longer than 280 characters", async () => {
      const response = await request(app)
        .post("/api/savings-goals")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .set("X-User-Id", "u-1")
        .send({ ...VALID_BODY, note: "a".repeat(281) });

      expect(response.status).toBe(400);
      expect(serviceMock.createSavingsGoal).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // PUT /api/savings-goals/:id
  // -------------------------------------------------------------------------

  describe("PUT /api/savings-goals/:id", () => {
    it("returns 401 when x-user-id header is missing", async () => {
      const response = await request(app)
        .put("/api/savings-goals/g-1")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .send(VALID_BODY);

      expect(response.status).toBe(401);
    });

    it("returns 400 when the request body is invalid", async () => {
      const response = await request(app)
        .put("/api/savings-goals/g-1")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .set("X-User-Id", "u-1")
        .send({ name: "Updated", targetAmount: "not-a-number" });

      expect(response.status).toBe(400);
      expect(serviceMock.updateSavingsGoal).not.toHaveBeenCalled();
    });

    it("returns 200 with the updated goal on a valid request", async () => {
      const updated = { ...GOAL_FIXTURE, name: "Updated Fund", targetAmount: 8000 };
      serviceMock.updateSavingsGoal.mockResolvedValue(updated);

      const response = await request(app)
        .put("/api/savings-goals/g-1")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .set("X-User-Id", "u-1")
        .send({ accountId: "a-1", name: "Updated Fund", targetAmount: 8000 });

      expect(response.status).toBe(200);
      expect(serviceMock.updateSavingsGoal).toHaveBeenCalledWith("u-1", "g-1", {
        accountId: "a-1",
        name: "Updated Fund",
        targetAmount: 8000,
        targetDate: null,
        icon: null,
        color: null,
        note: null,
      });
      expect(response.body).toMatchObject({ name: "Updated Fund", targetAmount: 8000 });
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /api/savings-goals/:id
  // -------------------------------------------------------------------------

  describe("DELETE /api/savings-goals/:id", () => {
    it("returns 401 when x-user-id header is missing", async () => {
      const response = await request(app)
        .delete("/api/savings-goals/g-1")
        .set("X-Internal-Secret", INTERNAL_SECRET);

      expect(response.status).toBe(401);
    });

    it("returns 204 on successful deletion", async () => {
      serviceMock.deleteSavingsGoal.mockResolvedValue(undefined);

      const response = await request(app)
        .delete("/api/savings-goals/g-1")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .set("X-User-Id", "u-1");

      expect(response.status).toBe(204);
      expect(serviceMock.deleteSavingsGoal).toHaveBeenCalledWith("u-1", "g-1");
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/savings-goals/:id/restore
  // -------------------------------------------------------------------------

  describe("POST /api/savings-goals/:id/restore", () => {
    it("returns 401 when x-user-id header is missing", async () => {
      const response = await request(app)
        .post("/api/savings-goals/g-1/restore")
        .set("X-Internal-Secret", INTERNAL_SECRET);

      expect(response.status).toBe(401);
    });

    it("returns 200 with the restored goal", async () => {
      serviceMock.restoreSavingsGoal.mockResolvedValue(GOAL_FIXTURE);

      const response = await request(app)
        .post("/api/savings-goals/g-1/restore")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .set("X-User-Id", "u-1");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(GOAL_FIXTURE);
      expect(serviceMock.restoreSavingsGoal).toHaveBeenCalledWith("u-1", "g-1");
    });
  });
});
