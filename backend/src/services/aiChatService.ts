import logger from "../lib/logger";
import { startChatStream } from "../lib/ollama-client";
import { listRecentChatMessages, saveChatExchange } from "./chatHistoryService";

// Low temperature keeps answers factual and anchored to the provided figures, minimizing
// hallucinated numbers and off-topic drift — accuracy matters more than variety here.
const CHAT_TEMPERATURE = 0.2;

// How much of the stored conversation is replayed to the model with each question. Older turns
// would not fit the model's context window anyway; exchanges are stored in pairs, so an even
// number keeps every replayed question together with its answer.
const PROMPT_HISTORY_MESSAGE_LIMIT = 20;

/**
 * Relays the reply while collecting it, then stores the finished exchange. A reply the user
 * stopped part-way is stored as far as it got; a reply that produced nothing is not stored, so
 * the conversation never holds a question without an answer.
 */
async function* saveExchangeWhenFinished(
  userId: string,
  question: string,
  askedAt: Date,
  replyChunks: AsyncIterable<string>
): AsyncGenerator<string, void, void> {
  let reply = "";
  try {
    for await (const replyChunk of replyChunks) {
      reply += replyChunk;
      yield replyChunk;
    }
  } finally {
    if (reply) {
      try {
        await saveChatExchange(userId, { question, askedAt, reply });
      } catch (error) {
        // The user already has the reply on screen; failing to store it shouldn't break the stream.
        logger.error({ err: error }, "Failed to save chat exchange");
      }
    }
  }
}

/**
 * Starts a streamed assistant reply to the user's question, steered by the caller's system prompt
 * and the user's recent conversation. Resolves once the model has begun answering, with a
 * generator of the reply's text chunks; the exchange is stored when that generator finishes.
 */
export async function startChatReply(
  userId: string,
  systemPrompt: string,
  question: string,
  signal?: AbortSignal
): Promise<AsyncGenerator<string, void, void>> {
  const askedAt = new Date();
  const recentMessages = await listRecentChatMessages(userId, PROMPT_HISTORY_MESSAGE_LIMIT);

  const replyChunks = await startChatStream({
    messages: [
      { role: "system", content: systemPrompt },
      ...recentMessages.map(({ role, content }) => ({ role, content })),
      { role: "user", content: question },
    ],
    temperature: CHAT_TEMPERATURE,
    signal,
  });
  return saveExchangeWhenFinished(userId, question, askedAt, replyChunks);
}
