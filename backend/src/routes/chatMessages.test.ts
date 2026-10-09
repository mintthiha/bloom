import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../app";
import { INTERNAL_SECRET } from "../test-setup";

const { serviceMock } = vi.hoisted(() => ({
  serviceMock: { listRecentChatMessages: vi.fn(), clearChatMessages: vi.fn() },
}));

vi.mock("../services/chatHistoryService", () => serviceMock);

describe("chat messages routes", () => {
  beforeEach(() => {
    serviceMock.listRecentChatMessages.mockReset();
    serviceMock.clearChatMessages.mockReset();
  });

  describe("GET /api/chat-messages", () => {
    it("returns 401 when x-user-id is missing", async () => {
      const response = await request(app)
        .get("/api/chat-messages")
        .set("X-Internal-Secret", INTERNAL_SECRET);

      expect(response.status).toBe(401);
      expect(serviceMock.listRecentChatMessages).not.toHaveBeenCalled();
    });

    it("returns the current user's most recent 200 messages", async () => {
      serviceMock.listRecentChatMessages.mockResolvedValue([
        {
          id: "m-1",
          role: "user",
          content: "What is a TFSA?",
          createdAt: "2026-10-08T12:00:00.000Z",
        },
        {
          id: "m-2",
          role: "assistant",
          content: "A registered account.",
          createdAt: "2026-10-08T12:00:05.000Z",
        },
      ]);

      const response = await request(app)
        .get("/api/chat-messages")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .set("X-User-Id", "user-1");

      expect(response.status).toBe(200);
      expect(response.body.messages).toHaveLength(2);
      expect(response.body.messages[1]).toMatchObject({
        role: "assistant",
        content: "A registered account.",
      });
      expect(serviceMock.listRecentChatMessages).toHaveBeenCalledWith("user-1", 200);
    });
  });

  describe("DELETE /api/chat-messages", () => {
    it("returns 401 when x-user-id is missing", async () => {
      const response = await request(app)
        .delete("/api/chat-messages")
        .set("X-Internal-Secret", INTERNAL_SECRET);

      expect(response.status).toBe(401);
      expect(serviceMock.clearChatMessages).not.toHaveBeenCalled();
    });

    it("clears the current user's conversation", async () => {
      serviceMock.clearChatMessages.mockResolvedValue(4);

      const response = await request(app)
        .delete("/api/chat-messages")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .set("X-User-Id", "user-1");

      expect(response.status).toBe(204);
      expect(serviceMock.clearChatMessages).toHaveBeenCalledWith("user-1");
    });
  });
});
