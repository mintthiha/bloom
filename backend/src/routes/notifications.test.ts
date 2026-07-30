import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../app";
import { INTERNAL_SECRET } from "../test-setup";

const { serviceMock } = vi.hoisted(() => ({
  serviceMock: {
    generateBillReminders: vi.fn(),
    listNotifications: vi.fn(),
    markNotificationRead: vi.fn(),
    markAllNotificationsRead: vi.fn(),
    dismissNotification: vi.fn(),
  },
}));

vi.mock("../services/reminderService", () => serviceMock);

describe("notification routes", () => {
  beforeEach(() => {
    serviceMock.generateBillReminders.mockReset();
    serviceMock.listNotifications.mockReset();
    serviceMock.markNotificationRead.mockReset();
    serviceMock.markAllNotificationsRead.mockReset();
    serviceMock.dismissNotification.mockReset();
  });

  it("returns 401 when x-user-id is missing", async () => {
    const response = await request(app)
      .get("/api/notifications")
      .set("X-Internal-Secret", INTERNAL_SECRET);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Unauthorized" });
  });

  it("generates reminders then returns the notification list", async () => {
    serviceMock.generateBillReminders.mockResolvedValue({ createdCount: 2 });
    serviceMock.listNotifications.mockResolvedValue({
      notifications: [{ id: "n1" }],
      unreadCount: 1,
    });

    const response = await request(app)
      .get("/api/notifications")
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .set("X-User-Id", "user-1");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ notifications: [{ id: "n1" }], unreadCount: 1 });
    expect(serviceMock.generateBillReminders).toHaveBeenCalledWith("user-1");
    expect(serviceMock.listNotifications).toHaveBeenCalledWith("user-1");
  });

  it("marks a single notification read", async () => {
    serviceMock.markNotificationRead.mockResolvedValue({ id: "n1", status: "READ" });

    const response = await request(app)
      .patch("/api/notifications/n1/read")
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .set("X-User-Id", "user-1");

    expect(response.status).toBe(200);
    expect(serviceMock.markNotificationRead).toHaveBeenCalledWith("user-1", "n1");
  });

  it("marks all notifications read", async () => {
    serviceMock.markAllNotificationsRead.mockResolvedValue({ updated: 3 });

    const response = await request(app)
      .post("/api/notifications/read-all")
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .set("X-User-Id", "user-1");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ updated: 3 });
    expect(serviceMock.markAllNotificationsRead).toHaveBeenCalledWith("user-1");
  });

  it("dismisses a notification and returns 204", async () => {
    serviceMock.dismissNotification.mockResolvedValue(undefined);

    const response = await request(app)
      .delete("/api/notifications/n1")
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .set("X-User-Id", "user-1");

    expect(response.status).toBe(204);
    expect(serviceMock.dismissNotification).toHaveBeenCalledWith("user-1", "n1");
  });
});
