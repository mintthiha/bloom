import { startChatStream } from "../lib/ollama-client";

/** One turn of the visible conversation; the system prompt is supplied separately. */
export type ChatTurn = { role: "user" | "assistant"; content: string };

// Low temperature keeps answers factual and anchored to the provided figures, minimizing
// hallucinated numbers and off-topic drift — accuracy matters more than variety here.
const CHAT_TEMPERATURE = 0.2;

/**
 * Starts a streamed assistant reply to the conversation, steered by the caller's system prompt.
 * Resolves once the model has begun answering, with a generator of the reply's text chunks.
 */
export function startChatReply(
  systemPrompt: string,
  conversation: ChatTurn[],
  signal?: AbortSignal
): Promise<AsyncGenerator<string, void, void>> {
  return startChatStream({
    messages: [{ role: "system", content: systemPrompt }, ...conversation],
    temperature: CHAT_TEMPERATURE,
    signal,
  });
}
