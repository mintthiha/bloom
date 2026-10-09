import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../middleware/errorHandler";
import { startChatReply } from "./aiChatService";

const { ollamaClientMock, chatHistoryMock } = vi.hoisted(() => ({
  ollamaClientMock: { startChatStream: vi.fn() },
  chatHistoryMock: { listRecentChatMessages: vi.fn(), saveChatExchange: vi.fn() },
}));

vi.mock("../lib/ollama-client", () => ollamaClientMock);
vi.mock("./chatHistoryService", () => chatHistoryMock);

/** Builds the generator of text chunks the Ollama client would hand back for a streamed reply. */
async function* streamOf(replyChunks: string[]): AsyncGenerator<string, void, void> {
  for (const replyChunk of replyChunks) yield replyChunk;
}

/** Drains a generator of reply chunks into an array. */
async function collectChunks(replyChunks: AsyncIterable<string>): Promise<string[]> {
  const collected: string[] = [];
  for await (const replyChunk of replyChunks) collected.push(replyChunk);
  return collected;
}

beforeEach(() => {
  ollamaClientMock.startChatStream.mockReset();
  chatHistoryMock.listRecentChatMessages.mockReset();
  chatHistoryMock.saveChatExchange.mockReset();
  chatHistoryMock.listRecentChatMessages.mockResolvedValue([]);
});

describe("startChatReply", () => {
  it("sends the system prompt, then the stored conversation, then the new question", async () => {
    chatHistoryMock.listRecentChatMessages.mockResolvedValue([
      { id: "m-1", role: "user", content: "What is a TFSA?", createdAt: new Date() },
      { id: "m-2", role: "assistant", content: "A registered account.", createdAt: new Date() },
    ]);
    ollamaClientMock.startChatStream.mockResolvedValue(streamOf([]));
    const abortController = new AbortController();

    await startChatReply(
      "u-1",
      "You are Bloom's assistant.",
      "And an RRSP?",
      abortController.signal
    );

    expect(chatHistoryMock.listRecentChatMessages).toHaveBeenCalledWith("u-1", 20);
    expect(ollamaClientMock.startChatStream).toHaveBeenCalledWith({
      messages: [
        { role: "system", content: "You are Bloom's assistant." },
        { role: "user", content: "What is a TFSA?" },
        { role: "assistant", content: "A registered account." },
        { role: "user", content: "And an RRSP?" },
      ],
      temperature: 0.2,
      signal: abortController.signal,
    });
  });

  it("relays the reply chunks and stores the finished exchange", async () => {
    ollamaClientMock.startChatStream.mockResolvedValue(streamOf(["A TFSA ", "is an account."]));
    const startedAt = Date.now();

    const replyChunks = await startChatReply("u-1", "Prompt", "What is a TFSA?");

    expect(await collectChunks(replyChunks)).toEqual(["A TFSA ", "is an account."]);
    expect(chatHistoryMock.saveChatExchange).toHaveBeenCalledTimes(1);
    const [userId, exchange] = chatHistoryMock.saveChatExchange.mock.calls[0]!;
    expect(userId).toBe("u-1");
    expect(exchange).toMatchObject({ question: "What is a TFSA?", reply: "A TFSA is an account." });
    expect(exchange.askedAt.getTime()).toBeGreaterThanOrEqual(startedAt);
    expect(exchange.askedAt.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("stores nothing until the reply has finished", async () => {
    ollamaClientMock.startChatStream.mockResolvedValue(streamOf(["A TFSA ", "is an account."]));

    const replyChunks = await startChatReply("u-1", "Prompt", "What is a TFSA?");
    await replyChunks.next();

    expect(chatHistoryMock.saveChatExchange).not.toHaveBeenCalled();
  });

  it("stores the partial reply when the consumer stops reading early", async () => {
    ollamaClientMock.startChatStream.mockResolvedValue(streamOf(["A TFSA ", "is an account."]));

    const replyChunks = await startChatReply("u-1", "Prompt", "What is a TFSA?");
    await replyChunks.next();
    await replyChunks.return();

    expect(chatHistoryMock.saveChatExchange).toHaveBeenCalledWith(
      "u-1",
      expect.objectContaining({ question: "What is a TFSA?", reply: "A TFSA " })
    );
  });

  it("stores nothing when the model produced no text", async () => {
    ollamaClientMock.startChatStream.mockResolvedValue(streamOf([]));

    const replyChunks = await startChatReply("u-1", "Prompt", "What is a TFSA?");

    expect(await collectChunks(replyChunks)).toEqual([]);
    expect(chatHistoryMock.saveChatExchange).not.toHaveBeenCalled();
  });

  it("stores nothing and rejects when the AI is unavailable", async () => {
    ollamaClientMock.startChatStream.mockRejectedValue(new AppError(503, "AI service unavailable"));

    await expect(startChatReply("u-1", "Prompt", "What is a TFSA?")).rejects.toMatchObject({
      statusCode: 503,
    });
    expect(chatHistoryMock.saveChatExchange).not.toHaveBeenCalled();
  });

  it("still completes the stream when storing the exchange fails", async () => {
    ollamaClientMock.startChatStream.mockResolvedValue(streamOf(["An account."]));
    chatHistoryMock.saveChatExchange.mockRejectedValue(new Error("database unavailable"));

    const replyChunks = await startChatReply("u-1", "Prompt", "What is a TFSA?");

    await expect(collectChunks(replyChunks)).resolves.toEqual(["An account."]);
  });
});
