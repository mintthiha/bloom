import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../app";
import { AppError } from "../middleware/errorHandler";
import { INTERNAL_SECRET } from "../test-setup";

const { serviceMock } = vi.hoisted(() => ({
  serviceMock: { startChatReply: vi.fn() },
}));

vi.mock("../services/aiChatService", () => serviceMock);

const SYSTEM_PROMPT = "You are Bloom's assistant.\n\n- TFSA limit: $7,000.";

/** Builds the generator of reply chunks the chat service would hand back. */
async function* replyOf(replyChunks: string[]): AsyncGenerator<string, void, void> {
  for (const replyChunk of replyChunks) yield replyChunk;
}

/** Posts a chat request as the Next.js server would, with the internal secret and a user id. */
function postChat(body: unknown, userId = "user-1") {
  return request(app)
    .post("/api/internal/ai/chat")
    .set("X-Internal-Secret", INTERNAL_SECRET)
    .set("X-User-Id", userId)
    .send(body as object);
}

describe("AI chat route", () => {
  beforeEach(() => {
    serviceMock.startChatReply.mockReset();
  });

  it("returns 401 without the internal secret", async () => {
    const response = await request(app)
      .post("/api/internal/ai/chat")
      .set("X-User-Id", "user-1")
      .send({ systemPrompt: SYSTEM_PROMPT, message: "What is a TFSA?" });

    expect(response.status).toBe(401);
    expect(serviceMock.startChatReply).not.toHaveBeenCalled();
  });

  it("returns 401 when x-user-id is missing", async () => {
    const response = await request(app)
      .post("/api/internal/ai/chat")
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .send({ systemPrompt: SYSTEM_PROMPT, message: "What is a TFSA?" });

    expect(response.status).toBe(401);
    expect(serviceMock.startChatReply).not.toHaveBeenCalled();
  });

  it("streams the reply chunks back as plain text", async () => {
    serviceMock.startChatReply.mockResolvedValue(
      replyOf(["A TFSA ", "is a registered ", "account."])
    );

    const response = await postChat({ systemPrompt: SYSTEM_PROMPT, message: "What is a TFSA?" });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/plain");
    expect(response.text).toBe("A TFSA is a registered account.");
  });

  it("passes the user, the untouched system prompt, and the trimmed question to the service", async () => {
    serviceMock.startChatReply.mockResolvedValue(replyOf([]));

    await postChat({ systemPrompt: SYSTEM_PROMPT, message: "  What is\na TFSA?  " });

    expect(serviceMock.startChatReply).toHaveBeenCalledWith(
      "user-1",
      SYSTEM_PROMPT,
      "What is\na TFSA?",
      expect.any(AbortSignal)
    );
  });

  it("accepts a question of exactly 4000 characters", async () => {
    serviceMock.startChatReply.mockResolvedValue(replyOf(["ok"]));

    const response = await postChat({ systemPrompt: SYSTEM_PROMPT, message: "a".repeat(4000) });

    expect(response.status).toBe(200);
  });

  it("returns 503 as JSON when the AI is unavailable, before any stream starts", async () => {
    serviceMock.startChatReply.mockRejectedValue(new AppError(503, "AI service unavailable"));

    const response = await postChat({ systemPrompt: SYSTEM_PROMPT, message: "What is a TFSA?" });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: "AI service unavailable" });
  });

  it.each([
    ["the system prompt is missing", { message: "Hi" }],
    ["the system prompt is blank", { systemPrompt: "   ", message: "Hi" }],
    ["the system prompt is not a string", { systemPrompt: 42, message: "Hi" }],
    ["the message is missing", { systemPrompt: SYSTEM_PROMPT }],
    ["the message is blank", { systemPrompt: SYSTEM_PROMPT, message: "   " }],
    ["the message is not a string", { systemPrompt: SYSTEM_PROMPT, message: ["Hi"] }],
    [
      "the message is longer than 4000 characters",
      { systemPrompt: SYSTEM_PROMPT, message: "a".repeat(4001) },
    ],
  ])("returns 400 when %s", async (_description, body) => {
    const response = await postChat(body);

    expect(response.status).toBe(400);
    expect(serviceMock.startChatReply).not.toHaveBeenCalled();
  });

  it("limits each user to 30 chat requests an hour without affecting other users", async () => {
    serviceMock.startChatReply.mockImplementation(async () => replyOf(["ok"]));
    const body = { systemPrompt: SYSTEM_PROMPT, message: "What is a TFSA?" };

    for (let requestNumber = 1; requestNumber <= 30; requestNumber++) {
      const allowedResponse = await postChat(body, "heavy-user");
      expect(allowedResponse.status).toBe(200);
    }
    const limitedResponse = await postChat(body, "heavy-user");
    const otherUserResponse = await postChat(body, "another-user");

    expect(limitedResponse.status).toBe(429);
    expect(limitedResponse.body).toEqual({
      error: "Too many AI requests, please try again later.",
    });
    expect(limitedResponse.headers["retry-after"]).toBeDefined();
    expect(otherUserResponse.status).toBe(200);
    expect(serviceMock.startChatReply).toHaveBeenCalledTimes(31);
  });
});
