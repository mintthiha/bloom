import { AppError } from "../middleware/errorHandler";
import logger from "./logger";

export type OllamaChatRole = "system" | "user" | "assistant" | "tool";

/** One function call the model asked for. The field names are Ollama's wire format. */
export type OllamaToolCall = { function: { name: string; arguments: Record<string, unknown> } };

export type OllamaChatMessage = {
  role: OllamaChatRole;
  content: string;
  /** Set on a replayed assistant turn that called a function instead of answering in text. */
  tool_calls?: OllamaToolCall[];
};

/** A function the model may call instead of answering in text, described by a JSON schema. */
export type OllamaToolDefinition = {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
};

/** One piece of a streamed reply: generated text, or a function the model chose to call. */
export type OllamaStreamEvent =
  | { type: "text"; text: string }
  | { type: "toolCall"; name: string; arguments: Record<string, unknown> };

export type OllamaChatRequest = {
  messages: OllamaChatMessage[];
  /** Functions the model may call. Omit for a plain text reply. */
  tools?: OllamaToolDefinition[];
  /** Sampling temperature; lower keeps the output more deterministic. */
  temperature: number;
  /** Constrains the reply to one valid JSON value (Ollama's `format: "json"`). */
  shouldReturnJson?: boolean;
  /** Lets the caller cancel generation, e.g. when the HTTP client that asked for it disconnects. */
  signal?: AbortSignal;
};

/** The subset of Ollama's `/api/chat` response (or one streamed NDJSON line of it) that Bloom reads. */
type OllamaChatPayload = { message?: { content?: string; tool_calls?: unknown } };

export const AI_UNAVAILABLE_MESSAGE = "AI service unavailable";

const DEFAULT_OLLAMA_URL = "http://localhost:11434";
const DEFAULT_OLLAMA_MODEL = "qwen2.5:7b";
// Keep the model resident between requests so it isn't reloaded from disk each time;
// overridable via OLLAMA_KEEP_ALIVE (e.g. "-1" to keep it loaded indefinitely).
const DEFAULT_KEEP_ALIVE = "30m";
// Above Ollama's 2048-token default so a long system prompt isn't truncated. Every feature shares
// this one size because Ollama reloads the model whenever a request asks for a different one.
const CONTEXT_WINDOW_TOKENS = 4096;
// Abort if Ollama hasn't started responding within this window. The CPU-only server reads an
// uncached prompt at about 30 tokens a second, so a chat prompt that fills the context window takes
// over two minutes before the first token — which happens whenever the cached prompt was replaced
// by another request or the system prompt changed. An unreachable server still fails at once.
const CONNECT_TIMEOUT_MS = 180_000;
// Abort mid-stream if no tokens arrive for this long, so a stalled generation can't hang forever.
const STREAM_IDLE_TIMEOUT_MS = 30_000;
// A non-streamed reply only arrives once generation has finished, so it gets a longer budget.
const COMPLETION_TIMEOUT_MS = 120_000;

/** A timer that aborts the request unless it is restarted again within the given window. */
type InactivityWatchdog = { restart: (timeoutMs: number) => void; stop: () => void };

/** Creates a controller that also aborts when the caller's own signal does. */
function createLinkedAbortController(callerSignal?: AbortSignal): AbortController {
  const abortController = new AbortController();
  if (callerSignal?.aborted) {
    abortController.abort();
  } else {
    callerSignal?.addEventListener("abort", () => abortController.abort(), { once: true });
  }
  return abortController;
}

/** Builds the watchdog that cancels a request whose upstream has gone quiet. */
function createInactivityWatchdog(abortController: AbortController): InactivityWatchdog {
  let timer: NodeJS.Timeout | undefined;
  return {
    restart(timeoutMs: number) {
      clearTimeout(timer);
      timer = setTimeout(() => abortController.abort(), timeoutMs);
    },
    stop() {
      clearTimeout(timer);
    },
  };
}

/**
 * Sends one chat request to Ollama with Bloom's shared model settings. Every transport or HTTP
 * failure becomes the same 503 so callers and users see one consistent "unavailable" outcome.
 */
async function postChatRequest(
  request: OllamaChatRequest,
  shouldStream: boolean,
  signal: AbortSignal
): Promise<Response> {
  const ollamaUrl = process.env.OLLAMA_URL || DEFAULT_OLLAMA_URL;

  let response: Response;
  try {
    response = await fetch(`${ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL,
        messages: request.messages,
        stream: shouldStream,
        ...(request.tools?.length ? { tools: request.tools } : {}),
        ...(request.shouldReturnJson ? { format: "json" } : {}),
        keep_alive: process.env.OLLAMA_KEEP_ALIVE || DEFAULT_KEEP_ALIVE,
        options: { temperature: request.temperature, num_ctx: CONTEXT_WINDOW_TOKENS },
      }),
    });
  } catch (error) {
    logger.warn({ err: error, ollamaUrl }, "Ollama request failed");
    throw new AppError(503, AI_UNAVAILABLE_MESSAGE);
  }

  if (!response.ok) {
    logger.warn({ status: response.status, ollamaUrl }, "Ollama returned a non-ok status");
    throw new AppError(503, AI_UNAVAILABLE_MESSAGE);
  }
  return response;
}

/** Reads the function calls off one streamed line, dropping any that carry no function name. */
function extractToolCallEvents(rawToolCalls: unknown): OllamaStreamEvent[] {
  if (!Array.isArray(rawToolCalls)) return [];
  const toolCallEvents: OllamaStreamEvent[] = [];
  for (const rawToolCall of rawToolCalls) {
    const calledFunction = (
      rawToolCall as { function?: { name?: unknown; arguments?: unknown } } | null
    )?.function;
    if (typeof calledFunction?.name !== "string" || !calledFunction.name) continue;
    const rawArguments = calledFunction.arguments;
    const hasArgumentObject =
      typeof rawArguments === "object" && rawArguments !== null && !Array.isArray(rawArguments);
    toolCallEvents.push({
      type: "toolCall",
      name: calledFunction.name,
      arguments: hasArgumentObject ? (rawArguments as Record<string, unknown>) : {},
    });
  }
  return toolCallEvents;
}

/**
 * Pulls the generated text and any function calls out of one streamed NDJSON line, ignoring
 * blank or malformed lines.
 */
function extractStreamedEvents(line: string): OllamaStreamEvent[] {
  if (!line.trim()) return [];
  let message: OllamaChatPayload["message"];
  try {
    message = (JSON.parse(line) as OllamaChatPayload | null)?.message;
  } catch {
    return [];
  }
  const textEvents: OllamaStreamEvent[] = message?.content
    ? [{ type: "text", text: message.content }]
    : [];
  return [...textEvents, ...extractToolCallEvents(message?.tool_calls)];
}

/**
 * Yields the reply piece by piece. A stream that stalls or drops part-way simply ends early, so
 * the consumer keeps whatever already arrived instead of losing the whole reply.
 */
async function* readStreamedEvents(
  body: ReadableStream<Uint8Array>,
  abortController: AbortController,
  watchdog: InactivityWatchdog
): AsyncGenerator<OllamaStreamEvent, void, void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pendingText = "";
  try {
    while (true) {
      // Restart the idle watchdog before each read so a stalled stream is aborted.
      watchdog.restart(STREAM_IDLE_TIMEOUT_MS);
      const { done, value } = await reader.read();
      if (done) break;
      pendingText += decoder.decode(value, { stream: true });
      const lines = pendingText.split("\n");
      pendingText = lines.pop() ?? "";
      for (const line of lines) {
        yield* extractStreamedEvents(line);
      }
    }
    yield* extractStreamedEvents(pendingText);
  } catch (error) {
    logger.warn({ err: error }, "Ollama stream ended early");
  } finally {
    watchdog.stop();
    // Stops generation upstream when the consumer walks away before the stream finishes.
    abortController.abort();
  }
}

/**
 * Asks Ollama for a complete (non-streamed) reply and returns its text. Throws a 503 when Ollama
 * is unreachable or too slow, and a 502 when it answers without any content.
 */
export async function requestChatCompletion(request: OllamaChatRequest): Promise<string> {
  const abortController = createLinkedAbortController(request.signal);
  const timeoutTimer = setTimeout(() => abortController.abort(), COMPLETION_TIMEOUT_MS);
  try {
    const response = await postChatRequest(request, false, abortController.signal);
    let payload: OllamaChatPayload;
    try {
      payload = (await response.json()) as OllamaChatPayload;
    } catch (error) {
      logger.warn({ err: error }, "Ollama reply could not be read");
      throw new AppError(503, AI_UNAVAILABLE_MESSAGE);
    }
    const content = payload.message?.content;
    if (!content) throw new AppError(502, "AI returned no content");
    return content;
  } finally {
    clearTimeout(timeoutTimer);
  }
}

/**
 * Opens a streamed reply. Resolves once Ollama has started answering — so a down service still
 * surfaces as a 503 before the caller commits to a streaming response — with a generator of the
 * text chunks and function calls as they arrive.
 */
export async function startChatEventStream(
  request: OllamaChatRequest
): Promise<AsyncGenerator<OllamaStreamEvent, void, void>> {
  const abortController = createLinkedAbortController(request.signal);
  const watchdog = createInactivityWatchdog(abortController);
  watchdog.restart(CONNECT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await postChatRequest(request, true, abortController.signal);
  } catch (error) {
    watchdog.stop();
    throw error;
  }
  if (!response.body) {
    watchdog.stop();
    throw new AppError(503, AI_UNAVAILABLE_MESSAGE);
  }
  return readStreamedEvents(response.body, abortController, watchdog);
}

/** Keeps only the generated text of a streamed reply. */
async function* keepTextOnly(
  streamEvents: AsyncIterable<OllamaStreamEvent>
): AsyncGenerator<string, void, void> {
  for await (const streamEvent of streamEvents) {
    if (streamEvent.type === "text") yield streamEvent.text;
  }
}

/**
 * Opens a streamed reply for a caller that offers the model no tools, and so only wants the text
 * chunks to forward as they arrive. Fails the same way `startChatEventStream` does.
 */
export async function startChatStream(
  request: OllamaChatRequest
): Promise<AsyncGenerator<string, void, void>> {
  return keepTextOnly(await startChatEventStream(request));
}
