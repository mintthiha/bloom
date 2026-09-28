import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../app";
import { INTERNAL_SECRET } from "../test-setup";

const { serviceMock } = vi.hoisted(() => ({
  serviceMock: {
    listCategories: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
  },
}));

vi.mock("../services/categoryService", () => serviceMock);

describe("category routes", () => {
  beforeEach(() => {
    serviceMock.listCategories.mockReset();
    serviceMock.createCategory.mockReset();
    serviceMock.updateCategory.mockReset();
    serviceMock.deleteCategory.mockReset();
  });

  it("returns 401 when x-user-id is missing", async () => {
    const response = await request(app)
      .get("/api/categories")
      .set("X-Internal-Secret", INTERNAL_SECRET);

    expect(response.status).toBe(401);
  });

  it("returns the current user's categories on GET", async () => {
    serviceMock.listCategories.mockResolvedValue([
      { id: "c1", name: "Groceries", type: "EXPENSE", color: "#22c55e", icon: "🛒" },
    ]);

    const response = await request(app)
      .get("/api/categories")
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .set("X-User-Id", "user-1");

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(serviceMock.listCategories).toHaveBeenCalledWith("user-1");
  });

  it("creates a category on POST", async () => {
    serviceMock.createCategory.mockResolvedValue({ id: "c1", name: "Hobbies" });

    const response = await request(app)
      .post("/api/categories")
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .set("X-User-Id", "user-1")
      .send({ name: "Hobbies", type: "EXPENSE", color: "#22c55e", icon: "🎨" });

    expect(response.status).toBe(201);
    expect(serviceMock.createCategory).toHaveBeenCalledWith("user-1", {
      name: "Hobbies",
      type: "EXPENSE",
      color: "#22c55e",
      icon: "🎨",
    });
  });

  it("rejects a POST missing a name", async () => {
    const response = await request(app)
      .post("/api/categories")
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .set("X-User-Id", "user-1")
      .send({ type: "EXPENSE", color: "#22c55e" });

    expect(response.status).toBe(400);
    expect(serviceMock.createCategory).not.toHaveBeenCalled();
  });

  it("rejects a POST with an invalid type", async () => {
    const response = await request(app)
      .post("/api/categories")
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .set("X-User-Id", "user-1")
      .send({ name: "Hobbies", type: "SAVINGS", color: "#22c55e" });

    expect(response.status).toBe(400);
    expect(serviceMock.createCategory).not.toHaveBeenCalled();
  });

  it("updates a category on PATCH", async () => {
    serviceMock.updateCategory.mockResolvedValue({ id: "c1", name: "Food" });

    const response = await request(app)
      .patch("/api/categories/c1")
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .set("X-User-Id", "user-1")
      .send({ name: "Food", color: "#f97316" });

    expect(response.status).toBe(200);
    expect(serviceMock.updateCategory).toHaveBeenCalledWith("user-1", "c1", {
      name: "Food",
      color: "#f97316",
      icon: undefined,
    });
  });

  it("deletes a category on DELETE", async () => {
    const response = await request(app)
      .delete("/api/categories/c1")
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .set("X-User-Id", "user-1");

    expect(response.status).toBe(204);
    expect(serviceMock.deleteCategory).toHaveBeenCalledWith("user-1", "c1");
  });
});
