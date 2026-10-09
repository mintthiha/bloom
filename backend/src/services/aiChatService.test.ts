import { beforeEach, describe, expect, it, vi } from "vitest";
import { startChatReply } from "./aiChatService";

const { ollamaClientMock } = vi.hoisted(() => ({
  ollamaClientMock: { startChatStream: vi.fn() },
}));

vi.mock("../lib/ollama-client", () => ollamaClientMock);

beforeEach(() => {
  ollamaClientMock.startChatStream.mockReset();
});

describe("startChatReply", () => {
  it("puts the system prompt ahead of the conversation and uses the factual temperature", async () => {
    const replyChunks = (async function* () {
      yield "Hi";
    })();
    ollamaClientMock.startChatStream.mockResolvedValue(replyChunks);
    const abortController = new AbortController();

    const result = await startChatReply(
      "You are Bloom's assistant.",
      [
        { role: "user", content: "What is a TFSA?" },
        { role: "assistant", content: "A registered account." },
        { role: "user", content: "And an RRSP?" },
      ],
      abortController.signal
    );

    expect(result).toBe(replyChunks);
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
});
