import logger from "../lib/logger";
import {
  startChatEventStream,
  type OllamaChatMessage,
  type OllamaStreamEvent,
} from "../lib/ollama-client";
import {
  answerUnsupportedCommand,
  buildChatActionInstructions,
  buildChatActionTools,
  interpretToolCall,
  selectToolNameOfDraftJustShown,
  selectUserMessagesSinceLastDraft,
  toModelMessages,
  type ProposedChatAction,
  type ToolCallContext,
  type ToolCallInterpretation,
} from "./chatActionProposals";
import { loadChatActionReferenceData } from "./chatActionService";
import {
  listRecentChatMessages,
  saveChatExchange,
  type StoredChatMessage,
} from "./chatHistoryService";
import {
  buildSpendingLookupTool,
  formatSpendingAnswer,
  interpretSpendingLookup,
  LOOK_UP_SPENDING_TOOL_NAME,
  SPENDING_LOOKUP_INSTRUCTIONS,
  toSpendingLookupModelMessages,
  type SpendingLookupArguments,
} from "./chatSpendingLookup";
import { lookUpSpending } from "./spendingLookupService";

/**
 * One piece of the reply as it is relayed to the chat window: generated text, or — once the
 * exchange is stored — the draft the reply carries, with the message id it is confirmed against.
 */
export type ChatReplyEvent =
  | { type: "text"; text: string }
  | { type: "proposal"; messageId: string; proposedAction: ProposedChatAction };

// Low temperature keeps answers factual and anchored to the provided figures, minimizing
// hallucinated numbers and off-topic drift — accuracy matters more than variety here.
const CHAT_TEMPERATURE = 0.2;

// How much of the stored conversation is replayed to the model with each question. Older turns
// would not fit the model's context window anyway; exchanges are stored in pairs, so an even
// number keeps every replayed question together with its answer.
const PROMPT_HISTORY_MESSAGE_LIMIT = 20;

// A reply carries at most one draft, so further tool calls in the same reply are dropped.
const SINGLE_DRAFT_NOTE = "I can only draft one thing at a time — ask me for the next one after.";

// Without a stored message there is nothing to confirm the draft against, so no card is shown.
const DRAFT_NOT_STORED_NOTE = "\n\nI couldn't keep that draft just now — please ask me again.";

const SPENDING_LOOKUP_FAILED_REPLY = "I couldn't look up your spending just now. Please try again.";

/**
 * Answers a spending question from the user's own transactions. The answer is written from what
 * the lookup found rather than handed back to the model, which on this server would cost a second
 * slow round-trip and could still misquote the numbers.
 */
async function answerSpendingLookup(
  userId: string,
  toolArguments: Record<string, unknown>,
  toolCallContext: ToolCallContext
): Promise<ToolCallInterpretation & { lookupArguments: SpendingLookupArguments }> {
  const { query, reply, lookupArguments } = interpretSpendingLookup(toolArguments, toolCallContext);
  if (!query) return { proposedAction: null, reply, lookupArguments };
  try {
    const result = await lookUpSpending(userId, query);
    return { proposedAction: null, reply: formatSpendingAnswer(query, result), lookupArguments };
  } catch (error) {
    logger.error({ err: error }, "Failed to look up spending for a chat question");
    return { proposedAction: null, reply: SPENDING_LOOKUP_FAILED_REPLY, lookupArguments };
  }
}

/** Turns a stored message into what the model is shown of it, a spending answer as its lookup. */
function toReplayedModelMessages(message: StoredChatMessage): OllamaChatMessage[] {
  return message.spendingLookup
    ? toSpendingLookupModelMessages(message.content, message.spendingLookup)
    : toModelMessages(message);
}

/**
 * Relays the reply while collecting it, then stores the finished exchange. A tool call from the
 * model becomes a draft plus a fixed line introducing it — or, for a spending question, the
 * answer worked out from the user's transactions — rather than a second model round-trip.
 * A reply the user stopped part-way is stored as far as it got; a reply that produced nothing is
 * not stored, so the conversation never holds a question without an answer.
 */
async function* relayReplyAndStoreExchange(
  userId: string,
  streamEvents: AsyncIterable<OllamaStreamEvent>,
  toolCallContext: ToolCallContext
): AsyncGenerator<ChatReplyEvent, void, void> {
  const { question, today: askedAt } = toolCallContext;
  let reply = "";
  let interpretation: ToolCallInterpretation | null = null;
  let spendingLookupArguments: SpendingLookupArguments | undefined;
  let hasDroppedToolCalls = false;
  let hasStoredExchange = false;

  /** Stores the exchange at most once and returns the reply's id, or null if nothing was stored. */
  async function storeExchangeOnce(): Promise<string | null> {
    if (hasStoredExchange || !reply) return null;
    hasStoredExchange = true;
    try {
      return await saveChatExchange(userId, {
        question,
        askedAt,
        reply,
        proposedAction: interpretation?.proposedAction ?? undefined,
        spendingLookup: spendingLookupArguments,
      });
    } catch (error) {
      // The user already has the reply on screen; failing to store it shouldn't break the stream.
      logger.error({ err: error }, "Failed to save chat exchange");
      return null;
    }
  }

  try {
    for await (const streamEvent of streamEvents) {
      if (streamEvent.type === "text") {
        reply += streamEvent.text;
        yield streamEvent;
      } else if (interpretation) {
        hasDroppedToolCalls = true;
      } else if (streamEvent.name === LOOK_UP_SPENDING_TOOL_NAME) {
        const { lookupArguments, ...lookupInterpretation } = await answerSpendingLookup(
          userId,
          streamEvent.arguments,
          toolCallContext
        );
        interpretation = lookupInterpretation;
        spendingLookupArguments = lookupArguments;
      } else {
        interpretation = interpretToolCall(
          streamEvent.name,
          streamEvent.arguments,
          toolCallContext
        );
      }
    }

    if (interpretation) {
      const closingText =
        (reply ? "\n\n" : "") +
        interpretation.reply +
        (hasDroppedToolCalls ? ` ${SINGLE_DRAFT_NOTE}` : "");
      reply += closingText;
      yield { type: "text", text: closingText };
    }

    const replyMessageId = await storeExchangeOnce();
    if (interpretation?.proposedAction) {
      yield replyMessageId
        ? {
            type: "proposal",
            messageId: replyMessageId,
            proposedAction: interpretation.proposedAction,
          }
        : { type: "text", text: DRAFT_NOT_STORED_NOTE };
    }
  } finally {
    // Reached without a stored exchange only when the consumer stopped reading part-way.
    await storeExchangeOnce();
  }
}

/** Streams a fixed reply as if the model had written it, so it is relayed and stored the same way. */
async function* streamFixedReply(reply: string): AsyncGenerator<OllamaStreamEvent, void, void> {
  yield { type: "text", text: reply };
}

/**
 * Starts a streamed assistant reply to the user's question, steered by the caller's system prompt
 * and the user's recent conversation, with the write actions offered to the model as tools. A
 * clear command the chat can't carry out is answered with its fixed reply without asking the model.
 * Resolves once the model has begun answering, with a generator of the reply's events; the
 * exchange is stored when that generator finishes.
 */
export async function startChatReply(
  userId: string,
  systemPrompt: string,
  question: string,
  signal?: AbortSignal
): Promise<AsyncGenerator<ChatReplyEvent, void, void>> {
  const askedAt = new Date();
  const [recentMessages, referenceData] = await Promise.all([
    listRecentChatMessages(userId, PROMPT_HISTORY_MESSAGE_LIMIT),
    loadChatActionReferenceData(userId),
  ]);
  const toolCallContext: ToolCallContext = {
    referenceData,
    today: askedAt,
    question,
    earlierUserMessages: selectUserMessagesSinceLastDraft(recentMessages),
    toolNameOfDraftJustShown: selectToolNameOfDraftJustShown(recentMessages),
  };

  const unsupportedCommandReply = answerUnsupportedCommand(question, referenceData);
  if (unsupportedCommandReply) {
    return relayReplyAndStoreExchange(
      userId,
      streamFixedReply(unsupportedCommandReply),
      toolCallContext
    );
  }

  const streamEvents = await startChatEventStream({
    messages: [
      {
        role: "system",
        content:
          `${systemPrompt}\n\n${buildChatActionInstructions(referenceData, askedAt)}\n` +
          SPENDING_LOOKUP_INSTRUCTIONS,
      },
      ...recentMessages.flatMap(toReplayedModelMessages),
      { role: "user", content: question },
    ],
    tools: [...buildChatActionTools(referenceData), buildSpendingLookupTool(referenceData)],
    temperature: CHAT_TEMPERATURE,
    signal,
  });
  return relayReplyAndStoreExchange(userId, streamEvents, toolCallContext);
}
