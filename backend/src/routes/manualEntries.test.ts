import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../app";
import { INTERNAL_SECRET } from "../test-setup";

const { serviceMock } = vi.hoisted(() => ({
  serviceMock: {
    listManualEntries: vi.fn(),
    createManualEntry: vi.fn(),
    updateManualEntry: vi.fn(),
    deleteManualEntry: vi.fn(),
    restoreManualEntry: vi.fn(),
  },
}));

vi.mock("../services/manualEntryService", () => serviceMock);
vi.mock("../services/activityService", () => ({ logActivity: vi.fn() }));

describe("manual entry routes", () => {
  beforeEach(() => {
    serviceMock.listManualEntries.mockReset();
    serviceMock.createManualEntry.mockReset();
    serviceMock.updateManualEntry.mockReset();
    serviceMock.deleteManualEntry.mockReset();
    serviceMock.restoreManualEntry.mockReset();
  });

  describe("DELETE /api/manual-entries/:id", () => {
    it("returns 401 when x-user-id is missing", async () => {
      const response = await request(app)
        .delete("/api/manual-entries/e-1")
        .set("X-Internal-Secret", INTERNAL_SECRET);

      expect(response.status).toBe(401);
    });

    it("soft-deletes the entry and returns 204", async () => {
      serviceMock.deleteManualEntry.mockResolvedValue({ name: "Car", type: "ASSET" });

      const response = await request(app)
        .delete("/api/manual-entries/e-1")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .set("X-User-Id", "u-1");

      expect(response.status).toBe(204);
      expect(serviceMock.deleteManualEntry).toHaveBeenCalledWith("u-1", "e-1");
    });
  });

  describe("POST /api/manual-entries/:id/restore", () => {
    it("returns 401 when x-user-id is missing", async () => {
      const response = await request(app)
        .post("/api/manual-entries/e-1/restore")
        .set("X-Internal-Secret", INTERNAL_SECRET);

      expect(response.status).toBe(401);
    });

    it("restores the entry and returns 204", async () => {
      serviceMock.restoreManualEntry.mockResolvedValue({ name: "Car", type: "ASSET" });

      const response = await request(app)
        .post("/api/manual-entries/e-1/restore")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .set("X-User-Id", "u-1");

      expect(response.status).toBe(204);
      expect(serviceMock.restoreManualEntry).toHaveBeenCalledWith("u-1", "e-1");
    });

    it("returns 404 when the entry cannot be restored", async () => {
      const { AppError } = await import("../middleware/errorHandler");
      serviceMock.restoreManualEntry.mockRejectedValue(
        new AppError(404, "Manual entry e-9 not found")
      );

      const response = await request(app)
        .post("/api/manual-entries/e-9/restore")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .set("X-User-Id", "u-1");

      expect(response.status).toBe(404);
    });
  });
});
