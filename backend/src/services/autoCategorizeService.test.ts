import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../middleware/errorHandler";
import { startCategorySuggestionStream, suggestCategories } from "./autoCategorizeService";

const { ollamaClientMock, categoryServiceMock } = vi.hoisted(() => ({
  ollamaClientMock: { requestChatCompletion: vi.fn(), startChatStream: vi.fn() },
  categoryServiceMock: { listCategories: vi.fn() },
}));

vi.mock("../lib/ollama-client", () => ollamaClientMock);
vi.mock("./categoryService", () => categoryServiceMock);

/** Builds the generator of text chunks the Ollama client would hand back for a streamed reply. */
async function* streamOf(contentChunks: string[]): AsyncGenerator<string, void, void> {
  for (const contentChunk of contentChunks) yield contentChunk;
}

/** Drains a generator of suggestions into an array. */
async function collectSuggestions<Suggestion>(
  suggestions: AsyncIterable<Suggestion>
): Promise<Suggestion[]> {
  const collected: Suggestion[] = [];
  for await (const suggestion of suggestions) collected.push(suggestion);
  return collected;
}

beforeEach(() => {
  ollamaClientMock.requestChatCompletion.mockReset();
  ollamaClientMock.startChatStream.mockReset();
  categoryServiceMock.listCategories.mockReset();
  categoryServiceMock.listCategories.mockResolvedValue([
    { name: "Groceries" },
    { name: "Entertainment" },
  ]);
});

describe("suggestCategories", () => {
  it("returns the suggestions from the model's wrapped JSON reply", async () => {
    ollamaClientMock.requestChatCompletion.mockResolvedValue(
      JSON.stringify({
        suggestions: [
          { merchant: "Loblaws", category: "Groceries" },
          { merchant: "Netflix", category: "Entertainment" },
        ],
      })
    );

    await expect(suggestCategories("user-1", ["Loblaws", "Netflix"])).resolves.toEqual([
      { merchant: "Loblaws", category: "Groceries" },
      { merchant: "Netflix", category: "Entertainment" },
    ]);
  });

  it("prompts with the user's own categories and the merchants, asking for JSON", async () => {
    ollamaClientMock.requestChatCompletion.mockResolvedValue(JSON.stringify({ suggestions: [] }));

    await suggestCategories("user-1", ["Loblaws", "Netflix"]);

    expect(categoryServiceMock.listCategories).toHaveBeenCalledWith("user-1");
    const [chatRequest] = ollamaClientMock.requestChatCompletion.mock.calls[0]!;
    expect(chatRequest.shouldReturnJson).toBe(true);
    expect(chatRequest.temperature).toBe(0.1);
    expect(chatRequest.messages[0].role).toBe("system");
    expect(chatRequest.messages[0].content).toContain(
      "exactly one value from: Groceries, Entertainment."
    );
    expect(chatRequest.messages[1]).toEqual({
      role: "user",
      content: 'Categorize these merchants: ["Loblaws", "Netflix"]',
    });
  });

  it("accepts a bare array reply without the suggestions wrapper", async () => {
    ollamaClientMock.requestChatCompletion.mockResolvedValue(
      JSON.stringify([{ merchant: "Loblaws", category: "Groceries" }])
    );

    await expect(suggestCategories("user-1", ["Loblaws"])).resolves.toEqual([
      { merchant: "Loblaws", category: "Groceries" },
    ]);
  });

  it("drops suggestions whose category is not one of the user's categories", async () => {
    ollamaClientMock.requestChatCompletion.mockResolvedValue(
      JSON.stringify({
        suggestions: [
          { merchant: "Loblaws", category: "Groceries" },
          { merchant: "Unknown Corp", category: "NotACategory" },
        ],
      })
    );

    await expect(suggestCategories("user-1", ["Loblaws", "Unknown Corp"])).resolves.toEqual([
      { merchant: "Loblaws", category: "Groceries" },
    ]);
  });

  it("drops malformed entries and strips fields the model added", async () => {
    ollamaClientMock.requestChatCompletion.mockResolvedValue(
      JSON.stringify({
        suggestions: [
          null,
          "Loblaws",
          { merchant: "Loblaws" },
          { merchant: 42, category: "Groceries" },
          { merchant: "Netflix", category: "Entertainment", confidence: 0.9 },
        ],
      })
    );

    await expect(suggestCategories("user-1", ["Loblaws", "Netflix"])).resolves.toEqual([
      { merchant: "Netflix", category: "Entertainment" },
    ]);
  });

  it("throws a 502 when the model's reply is not valid JSON", async () => {
    ollamaClientMock.requestChatCompletion.mockResolvedValue("Sure! Here are the categories:");

    await expect(suggestCategories("user-1", ["Loblaws"])).rejects.toMatchObject({
      statusCode: 502,
      message: "AI returned invalid JSON",
    });
  });

  it.each([
    ["an object without a suggestions array", JSON.stringify({ result: "none" })],
    ["a suggestions field that is not an array", JSON.stringify({ suggestions: "Groceries" })],
    ["a JSON primitive", "42"],
    ["null", "null"],
  ])("throws a 502 when the reply is %s", async (_description, reply) => {
    ollamaClientMock.requestChatCompletion.mockResolvedValue(reply);

    await expect(suggestCategories("user-1", ["Loblaws"])).rejects.toMatchObject({
      statusCode: 502,
      message: "AI returned unexpected response format",
    });
  });

  it("propagates the client's error when the AI is unavailable", async () => {
    ollamaClientMock.requestChatCompletion.mockRejectedValue(
      new AppError(503, "AI service unavailable")
    );

    await expect(suggestCategories("user-1", ["Loblaws"])).rejects.toMatchObject({
      statusCode: 503,
    });
  });
});

describe("startCategorySuggestionStream", () => {
  it("yields one suggestion per completed line of model output", async () => {
    ollamaClientMock.startChatStream.mockResolvedValue(
      streamOf([
        '{"merchant":"Loblaws","category":"Groceries"}\n',
        '{"merchant":"Netflix","category":"Entertainment"}\n',
      ])
    );

    const suggestions = await startCategorySuggestionStream("user-1", ["Loblaws", "Netflix"]);

    expect(await collectSuggestions(suggestions)).toEqual([
      { merchant: "Loblaws", category: "Groceries" },
      { merchant: "Netflix", category: "Entertainment" },
    ]);
  });

  it("reassembles a suggestion that arrives token by token", async () => {
    ollamaClientMock.startChatStream.mockResolvedValue(
      streamOf(['{"merchant":"Lob', 'laws","category":', '"Groceries"}', "\n"])
    );

    const suggestions = await startCategorySuggestionStream("user-1", ["Loblaws"]);

    expect(await collectSuggestions(suggestions)).toEqual([
      { merchant: "Loblaws", category: "Groceries" },
    ]);
  });

  it("yields the last suggestion even when the output has no trailing newline", async () => {
    ollamaClientMock.startChatStream.mockResolvedValue(
      streamOf([
        '{"merchant":"Loblaws","category":"Groceries"}\n{"merchant":"Netflix",',
        '"category":"Entertainment"}',
      ])
    );

    const suggestions = await startCategorySuggestionStream("user-1", ["Loblaws", "Netflix"]);

    expect(await collectSuggestions(suggestions)).toEqual([
      { merchant: "Loblaws", category: "Groceries" },
      { merchant: "Netflix", category: "Entertainment" },
    ]);
  });

  it("skips prose, malformed lines, and categories the user does not have", async () => {
    ollamaClientMock.startChatStream.mockResolvedValue(
      streamOf([
        "Here are the categories:\n",
        '{"merchant":"Loblaws","category":"Groceries"}\n',
        '{"merchant":"Broken",\n',
        '{"merchant":"Unknown Corp","category":"NotACategory"}\n',
        "\n",
      ])
    );

    const suggestions = await startCategorySuggestionStream("user-1", ["Loblaws"]);

    expect(await collectSuggestions(suggestions)).toEqual([
      { merchant: "Loblaws", category: "Groceries" },
    ]);
  });

  it("prompts with the user's categories and forwards the caller's abort signal", async () => {
    ollamaClientMock.startChatStream.mockResolvedValue(streamOf([]));
    const abortController = new AbortController();

    await startCategorySuggestionStream("user-1", ["Loblaws"], abortController.signal);

    expect(categoryServiceMock.listCategories).toHaveBeenCalledWith("user-1");
    const [chatRequest] = ollamaClientMock.startChatStream.mock.calls[0]!;
    expect(chatRequest.signal).toBe(abortController.signal);
    expect(chatRequest.temperature).toBe(0.1);
    expect(chatRequest.shouldReturnJson).toBeUndefined();
    expect(chatRequest.messages[0].content).toContain(
      "exactly one value from: Groceries, Entertainment."
    );
    expect(chatRequest.messages[1]).toEqual({
      role: "user",
      content: 'Categorize these merchants: ["Loblaws"]',
    });
  });

  it("rejects before yielding anything when the AI is unavailable", async () => {
    ollamaClientMock.startChatStream.mockRejectedValue(new AppError(503, "AI service unavailable"));

    await expect(startCategorySuggestionStream("user-1", ["Loblaws"])).rejects.toMatchObject({
      statusCode: 503,
    });
  });
});
