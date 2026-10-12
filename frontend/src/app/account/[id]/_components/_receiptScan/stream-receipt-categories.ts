/** One item's suggested category; `itemNumber` is the item's 1-based position in the request. */
export type ReceiptItemCategorySuggestion = { itemNumber: number; category: string };

const AI_UNAVAILABLE_MESSAGE = "AI service unavailable";

/** Narrows one parsed SSE payload to a suggestion, or undefined when it isn't one. */
function toSuggestion(payload: unknown): ReceiptItemCategorySuggestion | undefined {
  if (payload === null || typeof payload !== "object") return undefined;
  const { itemNumber, category } = payload as Record<string, unknown>;
  if (typeof itemNumber !== "number" || typeof category !== "string") return undefined;
  return { itemNumber, category };
}

/**
 * Streams AI category suggestions for a receipt's line items from the backend SSE endpoint,
 * calling `onSuggestion` as the model finishes each item rather than waiting for the full reply.
 * Resolves when the stream ends; rejects when the AI service is unavailable or the request is
 * aborted through `signal`.
 */
export async function streamReceiptItemCategories(
  request: { merchant: string | null; itemNames: string[] },
  onSuggestion: (suggestion: ReceiptItemCategorySuggestion) => void,
  signal: AbortSignal
): Promise<void> {
  const response = await fetch("/api/bloom/receipts/categorize-stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ merchant: request.merchant ?? undefined, items: request.itemNames }),
    signal,
  });
  if (!response.ok || !response.body) throw new Error(AI_UNAVAILABLE_MESSAGE);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pendingText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) return;

    pendingText += decoder.decode(value, { stream: true });
    const lines = pendingText.split("\n");
    pendingText = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("event: error")) throw new Error(AI_UNAVAILABLE_MESSAGE);
      if (line.startsWith("event: done")) return;
      if (!line.startsWith("data: ")) continue;
      let payload: unknown;
      try {
        payload = JSON.parse(line.slice("data: ".length));
      } catch {
        // malformed SSE data — skip
        continue;
      }
      const suggestion = toSuggestion(payload);
      if (suggestion) onSuggestion(suggestion);
    }
  }
}
