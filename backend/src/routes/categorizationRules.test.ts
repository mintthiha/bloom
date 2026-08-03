import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../app";
import { INTERNAL_SECRET } from "../test-setup";

const { serviceMock } = vi.hoisted(() => ({
  serviceMock: {
    listRules: vi.fn(),
    upsertRule: vi.fn(),
    updateRule: vi.fn(),
    deleteRule: vi.fn(),
  },
}));

vi.mock("../services/categorizationRuleService", () => serviceMock);

const RULE = {
  id: "rule-1",
  userId: "user-1",
  merchant: "Loblaws",
  category: "Groceries",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("categorization rule routes", () => {
  beforeEach(() => {
    serviceMock.listRules.mockReset();
    serviceMock.upsertRule.mockReset();
    serviceMock.updateRule.mockReset();
    serviceMock.deleteRule.mockReset();
  });

  it("returns 401 when x-user-id is missing", async () => {
    const response = await request(app)
      .get("/api/categorization-rules")
      .set("X-Internal-Secret", INTERNAL_SECRET);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Unauthorized" });
  });

  it("returns the user's categorization rules", async () => {
    serviceMock.listRules.mockResolvedValue([RULE]);

    const response = await request(app)
      .get("/api/categorization-rules")
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .set("X-User-Id", "user-1");

    expect(response.status).toBe(200);
    expect(serviceMock.listRules).toHaveBeenCalledWith("user-1");
    expect(response.body[0]).toMatchObject({ merchant: "Loblaws", category: "Groceries" });
  });

  it("creates or updates a rule", async () => {
    serviceMock.upsertRule.mockResolvedValue(RULE);

    const response = await request(app)
      .put("/api/categorization-rules")
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .set("X-User-Id", "user-1")
      .send({ merchant: "Loblaws", category: "Groceries" });

    expect(response.status).toBe(200);
    expect(serviceMock.upsertRule).toHaveBeenCalledWith("user-1", "Loblaws", "Groceries");
    expect(response.body).toMatchObject({ merchant: "Loblaws", category: "Groceries" });
  });

  it("rejects a rule payload missing merchant", async () => {
    const response = await request(app)
      .put("/api/categorization-rules")
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .set("X-User-Id", "user-1")
      .send({ category: "Groceries" });

    expect(response.status).toBe(400);
    expect(serviceMock.upsertRule).not.toHaveBeenCalled();
  });

  it("rejects a rule payload missing category", async () => {
    const response = await request(app)
      .put("/api/categorization-rules")
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .set("X-User-Id", "user-1")
      .send({ merchant: "Loblaws" });

    expect(response.status).toBe(400);
    expect(serviceMock.upsertRule).not.toHaveBeenCalled();
  });

  it("updates a rule's merchant and category", async () => {
    const updated = { ...RULE, merchant: "Metro", category: "Groceries" };
    serviceMock.updateRule.mockResolvedValue(updated);

    const response = await request(app)
      .patch("/api/categorization-rules/rule-1")
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .set("X-User-Id", "user-1")
      .send({ merchant: "Metro", category: "Groceries" });

    expect(response.status).toBe(200);
    expect(serviceMock.updateRule).toHaveBeenCalledWith("user-1", "rule-1", "Metro", "Groceries");
    expect(response.body).toMatchObject({ merchant: "Metro", category: "Groceries" });
  });

  it("rejects a PATCH payload missing merchant", async () => {
    const response = await request(app)
      .patch("/api/categorization-rules/rule-1")
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .set("X-User-Id", "user-1")
      .send({ category: "Groceries" });

    expect(response.status).toBe(400);
    expect(serviceMock.updateRule).not.toHaveBeenCalled();
  });

  it("returns 409 when PATCH conflicts with an existing merchant", async () => {
    const { AppError } = await import("../middleware/errorHandler");
    serviceMock.updateRule.mockRejectedValue(
      new AppError(409, 'A rule for "Metro" already exists')
    );

    const response = await request(app)
      .patch("/api/categorization-rules/rule-1")
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .set("X-User-Id", "user-1")
      .send({ merchant: "Metro", category: "Groceries" });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: 'A rule for "Metro" already exists' });
  });

  it("deletes a rule and returns 204", async () => {
    serviceMock.deleteRule.mockResolvedValue(undefined);

    const response = await request(app)
      .delete("/api/categorization-rules/rule-1")
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .set("X-User-Id", "user-1");

    expect(response.status).toBe(204);
    expect(serviceMock.deleteRule).toHaveBeenCalledWith("user-1", "rule-1");
  });

  it("returns 404 when deleting a rule that does not belong to the user", async () => {
    const { AppError } = await import("../middleware/errorHandler");
    serviceMock.deleteRule.mockRejectedValue(new AppError(404, "Rule not found"));

    const response = await request(app)
      .delete("/api/categorization-rules/rule-999")
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .set("X-User-Id", "user-1");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Rule not found" });
  });
});
