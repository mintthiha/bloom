import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../app";
import { INTERNAL_SECRET } from "../test-setup";

const { serviceMock } = vi.hoisted(() => ({
  serviceMock: {
    exportUserData: vi.fn(),
    deleteAllUserData: vi.fn(),
  },
}));

vi.mock("../services/userDataService", () => serviceMock);

describe("user data routes", () => {
  beforeEach(() => {
    serviceMock.exportUserData.mockReset();
    serviceMock.deleteAllUserData.mockReset();
  });

  describe("GET /api/user-data/export", () => {
    it("returns 401 when x-user-id is missing", async () => {
      const response = await request(app)
        .get("/api/user-data/export")
        .set("X-Internal-Secret", INTERNAL_SECRET);

      expect(response.status).toBe(401);
      expect(serviceMock.exportUserData).not.toHaveBeenCalled();
    });

    it("returns the export bundle for the authenticated user", async () => {
      serviceMock.exportUserData.mockResolvedValue({
        exportVersion: 1,
        exportedAt: "2026-09-26T00:00:00.000Z",
        profile: null,
        accounts: [],
        transactions: [],
      });

      const response = await request(app)
        .get("/api/user-data/export")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .set("X-User-Id", "u-1");

      expect(response.status).toBe(200);
      expect(response.body.exportVersion).toBe(1);
      expect(serviceMock.exportUserData).toHaveBeenCalledWith("u-1");
    });
  });

  describe("DELETE /api/user-data", () => {
    it("returns 401 without deleting anything when x-user-id is missing", async () => {
      const response = await request(app)
        .delete("/api/user-data")
        .set("X-Internal-Secret", INTERNAL_SECRET);

      expect(response.status).toBe(401);
      expect(serviceMock.deleteAllUserData).not.toHaveBeenCalled();
    });

    it("erases the account and returns 204", async () => {
      serviceMock.deleteAllUserData.mockResolvedValue(undefined);

      const response = await request(app)
        .delete("/api/user-data")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .set("X-User-Id", "u-1");

      expect(response.status).toBe(204);
      expect(serviceMock.deleteAllUserData).toHaveBeenCalledWith("u-1");
    });

    it("surfaces a service failure as a 500 instead of a silent success", async () => {
      serviceMock.deleteAllUserData.mockRejectedValue(new Error("db down"));

      const response = await request(app)
        .delete("/api/user-data")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .set("X-User-Id", "u-1");

      expect(response.status).toBe(500);
    });
  });
});
