import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../app";
import { AppError } from "../middleware/errorHandler";
import { INTERNAL_SECRET } from "../test-setup";

const { serviceMock, chatActionServiceMock } = vi.hoisted(() => ({
  serviceMock: { listRecentChatMessages: vi.fn(), clearChatMessages: vi.fn() },
  chatActionServiceMock: { confirmProposedAction: vi.fn(), dismissProposedAction: vi.fn() },
}));

vi.mock("../services/chatHistoryService", () => serviceMock);
vi.mock("../services/chatActionService", () => chatActionServiceMock);

describe("chat messages routes", () => {
  beforeEach(() => {
    serviceMock.listRecentChatMessages.mockReset();
    serviceMock.clearChatMessages.mockReset();
    chatActionServiceMock.confirmProposedAction.mockReset();
    chatActionServiceMock.dismissProposedAction.mockReset();
  });

  describe.each([
    ["confirm", chatActionServiceMock.confirmProposedAction, "CONFIRMED"],
    ["dismiss", chatActionServiceMock.dismissProposedAction, "DISMISSED"],
  ] as const)("POST /api/chat-messages/:id/proposed-action/%s", (verb, actionMock, status) => {
    it("returns 401 when x-user-id is missing", async () => {
      const response = await request(app)
        .post(`/api/chat-messages/m-2/proposed-action/${verb}`)
        .set("X-Internal-Secret", INTERNAL_SECRET);

      expect(response.status).toBe(401);
      expect(actionMock).not.toHaveBeenCalled();
    });

    it("acts on that message's draft as the current user and returns where it now stands", async () => {
      actionMock.mockResolvedValue({ id: "m-2", proposedActionStatus: status });

      const response = await request(app)
        .post(`/api/chat-messages/m-2/proposed-action/${verb}`)
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .set("X-User-Id", "user-1");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ id: "m-2", proposedActionStatus: status });
      expect(actionMock).toHaveBeenCalledWith("user-1", "m-2");
    });

    it("passes on the service's refusal when the draft was already acted on", async () => {
      actionMock.mockRejectedValue(new AppError(409, "This suggestion has already been saved"));

      const response = await request(app)
        .post(`/api/chat-messages/m-2/proposed-action/${verb}`)
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .set("X-User-Id", "user-1");

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ error: "This suggestion has already been saved" });
    });
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
