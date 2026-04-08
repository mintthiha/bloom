import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../app";

const { serviceMock } = vi.hoisted(() => ({
  serviceMock: {
    getMonthlySummary: vi.fn(),
  },
}));

vi.mock("../services/accountService", () => serviceMock);

describe("account routes", () => {
  beforeEach(() => {
    serviceMock.getMonthlySummary.mockReset();
  });

  it("returns 401 for monthly summary when x-user-id is missing", async () => {
    const response = await request(app).get("/api/accounts/summary/monthly");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Unauthorized" });
  });

  it("returns the monthly summary for the current user", async () => {
    serviceMock.getMonthlySummary.mockResolvedValue({
      month: "2026-04",
      income: 2500,
      spending: 400,
      netCashFlow: 2100,
      topExpenseCategory: "Groceries",
      categories: [{ category: "Groceries", income: 0, spending: 400 }],
    });

    const response = await request(app)
      .get("/api/accounts/summary/monthly")
      .set("X-User-Id", "user-1");

    expect(response.status).toBe(200);
    expect(serviceMock.getMonthlySummary).toHaveBeenCalledWith("user-1");
    expect(response.body).toMatchObject({
      month: "2026-04",
      topExpenseCategory: "Groceries",
    });
  });
});
