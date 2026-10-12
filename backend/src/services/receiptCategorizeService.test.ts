import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../middleware/errorHandler";
import { startReceiptItemCategoryStream } from "./receiptCategorizeService";

const { ollamaClientMock, categoryServiceMock } = vi.hoisted(() => ({
  ollamaClientMock: { startChatStream: vi.fn() },
  categoryServiceMock: { listCategories: vi.fn() },
}));

vi.mock("../lib/ollama-client", () => ollamaClientMock);
vi.mock("./categoryService", () => categoryServiceMock);

/** Builds the generator of text chunks the Ollama client would hand back for a streamed reply. */
async function* streamOf(contentChunks: string[]): AsyncGenerator<string, void, void> {
  for (const contentChunk of contentChunks) yield contentChunk;
}

/** Drains a generator of item categories into an array. */
async function collectItemCategories<ItemCategory>(
  itemCategories: AsyncIterable<ItemCategory>
): Promise<ItemCategory[]> {
  const collected: ItemCategory[] = [];
  for await (const itemCategory of itemCategories) collected.push(itemCategory);
  return collected;
}

beforeEach(() => {
  ollamaClientMock.startChatStream.mockReset();
  categoryServiceMock.listCategories.mockReset();
  categoryServiceMock.listCategories.mockResolvedValue([
    { name: "Groceries", type: "EXPENSE" },
    { name: "Household", type: "EXPENSE" },
    { name: "Salary", type: "INCOME" },
  ]);
});

describe("startReceiptItemCategoryStream", () => {
  it("yields one item category per completed line of model output", async () => {
    ollamaClientMock.startChatStream.mockResolvedValue(
      streamOf(["1|Groceries\n", "2|Household\n"])
    );

    const itemCategories = await startReceiptItemCategoryStream("user-1", "Walmart", [
      "BANANAS",
      "DISH SOAP",
    ]);

    expect(await collectItemCategories(itemCategories)).toEqual([
      { itemNumber: 1, category: "Groceries" },
      { itemNumber: 2, category: "Household" },
    ]);
  });

  it("reassembles a line that arrives token by token and yields a final line with no newline", async () => {
    ollamaClientMock.startChatStream.mockResolvedValue(
      streamOf(["1", "|Gro", "ceries", "\n2|House", "hold"])
    );

    const itemCategories = await startReceiptItemCategoryStream("user-1", undefined, [
      "BANANAS",
      "DISH SOAP",
    ]);

    expect(await collectItemCategories(itemCategories)).toEqual([
      { itemNumber: 1, category: "Groceries" },
      { itemNumber: 2, category: "Household" },
    ]);
  });

  it("accepts the other separators the model drifts to and matches categories regardless of case", async () => {
    ollamaClientMock.startChatStream.mockResolvedValue(
      streamOf(["1. groceries\n", "2: HOUSEHOLD\n", " 3 - Groceries \n"])
    );

    const itemCategories = await startReceiptItemCategoryStream("user-1", undefined, [
      "BANANAS",
      "DISH SOAP",
      "MILK",
    ]);

    expect(await collectItemCategories(itemCategories)).toEqual([
      { itemNumber: 1, category: "Groceries" },
      { itemNumber: 2, category: "Household" },
      { itemNumber: 3, category: "Groceries" },
    ]);
  });

  it("skips prose, unknown item numbers, and categories that are not the user's expense categories", async () => {
    ollamaClientMock.startChatStream.mockResolvedValue(
      streamOf([
        "Here are the categories:\n",
        "0|Groceries\n",
        "3|Groceries\n",
        "1|Electronics\n",
        "2|Salary\n",
        "\n",
        "1|Groceries\n",
      ])
    );

    const itemCategories = await startReceiptItemCategoryStream("user-1", undefined, [
      "BANANAS",
      "DISH SOAP",
    ]);

    expect(await collectItemCategories(itemCategories)).toEqual([
      { itemNumber: 1, category: "Groceries" },
    ]);
  });

  it("keeps only the first answer when the model repeats an item", async () => {
    ollamaClientMock.startChatStream.mockResolvedValue(
      streamOf(["1|Groceries\n", "1|Household\n"])
    );

    const itemCategories = await startReceiptItemCategoryStream("user-1", undefined, ["BANANAS"]);

    expect(await collectItemCategories(itemCategories)).toEqual([
      { itemNumber: 1, category: "Groceries" },
    ]);
  });

  it("prompts with the user's expense categories, the store, and the numbered items", async () => {
    ollamaClientMock.startChatStream.mockResolvedValue(streamOf([]));
    const abortController = new AbortController();

    await startReceiptItemCategoryStream(
      "user-1",
      "Walmart",
      ["BANANAS", "DISH SOAP"],
      abortController.signal
    );

    expect(categoryServiceMock.listCategories).toHaveBeenCalledWith("user-1");
    const [chatRequest] = ollamaClientMock.startChatStream.mock.calls[0]!;
    expect(chatRequest.signal).toBe(abortController.signal);
    expect(chatRequest.temperature).toBe(0.1);
    expect(chatRequest.messages[0].role).toBe("system");
    expect(chatRequest.messages[0].content).toContain(
      "exactly one value from: Groceries, Household."
    );
    expect(chatRequest.messages[1]).toEqual({
      role: "user",
      content: "Store: Walmart\nItems:\n1. BANANAS\n2. DISH SOAP",
    });
  });

  it("omits the store line when the merchant is unknown", async () => {
    ollamaClientMock.startChatStream.mockResolvedValue(streamOf([]));

    await startReceiptItemCategoryStream("user-1", undefined, ["BANANAS"]);

    const [chatRequest] = ollamaClientMock.startChatStream.mock.calls[0]!;
    expect(chatRequest.messages[1].content).toBe("Items:\n1. BANANAS");
  });

  it("yields nothing without calling the model when the user has no expense categories", async () => {
    categoryServiceMock.listCategories.mockResolvedValue([{ name: "Salary", type: "INCOME" }]);

    const itemCategories = await startReceiptItemCategoryStream("user-1", undefined, ["BANANAS"]);

    expect(await collectItemCategories(itemCategories)).toEqual([]);
    expect(ollamaClientMock.startChatStream).not.toHaveBeenCalled();
  });

  it("rejects before yielding anything when the AI is unavailable", async () => {
    ollamaClientMock.startChatStream.mockRejectedValue(new AppError(503, "AI service unavailable"));

    await expect(
      startReceiptItemCategoryStream("user-1", undefined, ["BANANAS"])
    ).rejects.toMatchObject({ statusCode: 503 });
  });
});
