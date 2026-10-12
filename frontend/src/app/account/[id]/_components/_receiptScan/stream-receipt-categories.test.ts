import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ReceiptItemCategorySuggestion,
  streamReceiptItemCategories,
} from "./stream-receipt-categories";

const fetchMock = vi.fn();

/** Builds a streamed SSE response whose body arrives in the given chunks. */
function streamedResponse(chunks: string[], init?: ResponseInit): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { status: 200, ...init });
}

/** Runs the stream against the mocked response and returns every suggestion it delivered. */
async function collectSuggestions(
  request = { merchant: "Walmart" as string | null, itemNames: ["BANANAS", "DISH SOAP"] }
): Promise<ReceiptItemCategorySuggestion[]> {
  const suggestions: ReceiptItemCategorySuggestion[] = [];
  await streamReceiptItemCategories(
    request,
    (suggestion) => suggestions.push(suggestion),
    new AbortController().signal
  );
  return suggestions;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("streamReceiptItemCategories", () => {
  it("posts the store and item names to the receipt categorization endpoint", async () => {
    fetchMock.mockResolvedValue(streamedResponse(["event: done\ndata: {}\n\n"]));
    const abortController = new AbortController();

    await streamReceiptItemCategories(
      { merchant: "Walmart", itemNames: ["BANANAS"] },
      () => {},
      abortController.signal
    );

    expect(fetchMock).toHaveBeenCalledWith("/api/bloom/receipts/categorize-stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merchant: "Walmart", items: ["BANANAS"] }),
      signal: abortController.signal,
    });
  });

  it("leaves the store out of the request when it is unknown", async () => {
    fetchMock.mockResolvedValue(streamedResponse(["event: done\ndata: {}\n\n"]));

    await collectSuggestions({ merchant: null, itemNames: ["BANANAS"] });

    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ items: ["BANANAS"] });
  });

  it("delivers each suggestion as its event arrives", async () => {
    fetchMock.mockResolvedValue(
      streamedResponse([
        'data: {"itemNumber":1,"category":"Groceries"}\n\n',
        'data: {"itemNumber":2,"category":"Household"}\n\n',
        "event: done\ndata: {}\n\n",
      ])
    );

    expect(await collectSuggestions()).toEqual([
      { itemNumber: 1, category: "Groceries" },
      { itemNumber: 2, category: "Household" },
    ]);
  });

  it("reassembles an event that is split across network chunks", async () => {
    fetchMock.mockResolvedValue(
      streamedResponse(['data: {"itemNumber":1,"cat', 'egory":"Groceries"}\n', "\nevent: done\n"])
    );

    expect(await collectSuggestions()).toEqual([{ itemNumber: 1, category: "Groceries" }]);
  });

  it("stops at the done event and ignores anything after it", async () => {
    fetchMock.mockResolvedValue(
      streamedResponse([
        'data: {"itemNumber":1,"category":"Groceries"}\n\n',
        'event: done\ndata: {}\n\ndata: {"itemNumber":2,"category":"Household"}\n\n',
      ])
    );

    expect(await collectSuggestions()).toEqual([{ itemNumber: 1, category: "Groceries" }]);
  });

  it("resolves when the stream simply ends without a done event", async () => {
    fetchMock.mockResolvedValue(
      streamedResponse(['data: {"itemNumber":1,"category":"Groceries"}\n\n'])
    );

    expect(await collectSuggestions()).toEqual([{ itemNumber: 1, category: "Groceries" }]);
  });

  it("skips malformed and incomplete payloads", async () => {
    fetchMock.mockResolvedValue(
      streamedResponse([
        "data: not json\n\n",
        'data: {"itemNumber":"1","category":"Groceries"}\n\n',
        'data: {"itemNumber":2}\n\n',
        "data: null\n\n",
        'data: {"itemNumber":3,"category":"Household"}\n\n',
        "event: done\ndata: {}\n\n",
      ])
    );

    expect(await collectSuggestions()).toEqual([{ itemNumber: 3, category: "Household" }]);
  });

  it("rejects when the stream reports an error event, keeping earlier suggestions", async () => {
    fetchMock.mockResolvedValue(
      streamedResponse([
        'data: {"itemNumber":1,"category":"Groceries"}\n\n',
        'event: error\ndata: {"message":"AI service unavailable"}\n\n',
      ])
    );
    const suggestions: ReceiptItemCategorySuggestion[] = [];

    await expect(
      streamReceiptItemCategories(
        { merchant: null, itemNames: ["BANANAS", "DISH SOAP"] },
        (suggestion) => suggestions.push(suggestion),
        new AbortController().signal
      )
    ).rejects.toThrow("AI service unavailable");
    expect(suggestions).toEqual([{ itemNumber: 1, category: "Groceries" }]);
  });

  it("rejects without parsing the body when the response is not ok", async () => {
    // A 502 from the proxy is an HTML page, which must never reach a JSON parser.
    fetchMock.mockResolvedValue(streamedResponse(["<html>Bad Gateway</html>"], { status: 502 }));

    await expect(collectSuggestions()).rejects.toThrow("AI service unavailable");
  });

  it("rejects when the request itself fails", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(collectSuggestions()).rejects.toThrow("Failed to fetch");
  });
});
