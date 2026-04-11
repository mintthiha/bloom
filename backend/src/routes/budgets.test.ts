import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../app";

const { serviceMock } = vi.hoisted(() => ({
  serviceMock: {
    listBudgets: vi.fn(),
    getBudgetActivity: vi.fn(),
    upsertBudget: vi.fn(),
    deleteBudget: vi.fn(),
  },
}));

vi.mock("../services/budgetService", () => serviceMock);

describe("budget routes", () => {
  beforeEach(() => {
    serviceMock.listBudgets.mockReset();
    serviceMock.getBudgetActivity.mockReset();
    serviceMock.upsertBudget.mockReset();
    serviceMock.deleteBudget.mockReset();
  });

  it("returns 401 when x-user-id is missing", async () => {
    const response = await request(app).get("/api/budgets");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Unauthorized" });
  });

  it("returns the current user's budgets", async () => {
    serviceMock.listBudgets.mockResolvedValue([
      {
        id: "budget-1",
        userId: "user-1",
        category: "Groceries",
        monthlyLimit: 500,
        currentSpending: 320,
        remaining: 180,
        percentageUsed: 64,
        isOverBudget: false,
      },
    ]);

    const response = await request(app)
      .get("/api/budgets")
      .set("X-User-Id", "user-1");

    expect(response.status).toBe(200);
    expect(serviceMock.listBudgets).toHaveBeenCalledWith("user-1");
    expect(response.body[0]).toMatchObject({ category: "Groceries", monthlyLimit: 500 });
  });

  it("creates or updates a budget", async () => {
    serviceMock.upsertBudget.mockResolvedValue({
      id: "budget-1",
      userId: "user-1",
      category: "Dining",
      monthlyLimit: 250,
    });

    const response = await request(app)
      .put("/api/budgets")
      .set("X-User-Id", "user-1")
      .send({ category: "Dining", monthlyLimit: 250 });

    expect(response.status).toBe(200);
    expect(serviceMock.upsertBudget).toHaveBeenCalledWith("user-1", { category: "Dining", monthlyLimit: 250 });
    expect(response.body).toMatchObject({ category: "Dining", monthlyLimit: 250 });
  });

  it("rejects invalid budget payloads before hitting the service", async () => {
    const response = await request(app)
      .put("/api/budgets")
      .set("X-User-Id", "user-1")
      .send({ category: "", monthlyLimit: "250" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "category is required" });
    expect(serviceMock.upsertBudget).not.toHaveBeenCalled();
  });

  it("sanitizes budget category before calling the service", async () => {
    serviceMock.upsertBudget.mockResolvedValue({
      id: "budget-1",
      userId: "user-1",
      category: "Entertainment Budget",
      monthlyLimit: 250,
    });

    const response = await request(app)
      .put("/api/budgets")
      .set("X-User-Id", "user-1")
      .send({ category: "  Entertainment\u0000 \n Budget ", monthlyLimit: 250 });

    expect(response.status).toBe(200);
    expect(serviceMock.upsertBudget).toHaveBeenCalledWith("user-1", {
      category: "Entertainment Budget",
      monthlyLimit: 250,
    });
  });

  it("returns activity for a single budget", async () => {
    serviceMock.getBudgetActivity.mockResolvedValue({
      id: "budget-1",
      category: "Entertainment",
      month: "2026-04",
      monthlyLimit: 300,
      currentSpending: 69,
      remaining: 231,
      percentageUsed: 23,
      isOverBudget: false,
      activity: [],
      dailySpending: [],
      accountTotals: [],
    });

    const response = await request(app)
      .get("/api/budgets/budget-1/activity")
      .set("X-User-Id", "user-1");

    expect(response.status).toBe(200);
    expect(serviceMock.getBudgetActivity).toHaveBeenCalledWith("user-1", "budget-1");
    expect(response.body).toMatchObject({ category: "Entertainment", month: "2026-04" });
  });

  it("deletes a budget by id", async () => {
    const response = await request(app)
      .delete("/api/budgets/budget-1")
      .set("X-User-Id", "user-1");

    expect(response.status).toBe(204);
    expect(serviceMock.deleteBudget).toHaveBeenCalledWith("user-1", "budget-1");
  });
});
