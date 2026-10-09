import { AppError } from "../middleware/errorHandler";
import logger from "./logger";

export type OllamaChatRole = "system" | "user" | "assistant";

export type OllamaChatMessage = { role: OllamaChatRole; content: string };

export type OllamaChatRequest = {
  messages: OllamaChatMessage[];
  /** Sampling temperature; lower keeps the output more deterministic. */
  temperature: number;
  /** Constrains the reply to one valid JSON value (Ollama's `format: "json"`). */
  shouldReturnJson?: boolean;
  /** Lets the caller cancel generation, e.g. when the HTTP client that asked for it disconnects. */
  signal?: AbortSignal;
};

/** The subset of Ollama's `/api/chat` response (or one streamed NDJSON line of it) that Bloom reads. */
type OllamaChatPayload = { message?: { content?: string } };

export const AI_UNAVAILABLE_MESSAGE = "AI service unavailable";

const DEFAULT_OLLAMA_URL = "http://localhost:11434";
const DEFAULT_OLLAMA_MODEL = "qwen2.5:7b";
// Keep the model resident between requests so it isn't reloaded from disk each time;
// overridable via OLLAMA_KEEP_ALIVE (e.g. "-1" to keep it loaded indefinitely).
const DEFAULT_KEEP_ALIVE = "30m";
// Above Ollama's 2048-token default so a long system prompt isn't truncated. Every feature shares
// this one size because Ollama reloads the model whenever a request asks for a different one.
const CONTEXT_WINDOW_TOKENS = 4096;
// Abort if Ollama hasn't started responding within this window — long enough to cover a cold
// model load, short enough that a truly down service fails fast instead of hanging the request.
const CONNECT_TIMEOUT_MS = 60_000;
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

/** Pulls the generated text out of one streamed NDJSON line, ignoring blank or malformed lines. */
function extractStreamedContent(line: string): string | undefined {
  if (!line.trim()) return undefined;
  try {
    return (JSON.parse(line) as OllamaChatPayload).message?.content || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Yields the generated text chunk by chunk. A stream that stalls or drops part-way simply ends
 * early, so the consumer keeps whatever text already arrived instead of losing the whole reply.
 */
async function* readStreamedContent(
  body: ReadableStream<Uint8Array>,
  abortController: AbortController,
  watchdog: InactivityWatchdog
): AsyncGenerator<string, void, void> {
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
        const content = extractStreamedContent(line);
        if (content) yield content;
      }
    }
    const trailingContent = extractStreamedContent(pendingText);
    if (trailingContent) yield trailingContent;
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
 * text chunks to forward as they arrive.
 */
export async function startChatStream(
  request: OllamaChatRequest
): Promise<AsyncGenerator<string, void, void>> {
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
  return readStreamedContent(response.body, abortController, watchdog);
}
