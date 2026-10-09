import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestChatCompletion, startChatStream } from "./ollama-client";

const fetchMock = vi.fn();

const CONVERSATION = [
  { role: "system" as const, content: "Be brief." },
  { role: "user" as const, content: "What is a TFSA?" },
];

/** Builds a non-streamed Ollama reply carrying the given assistant text. */
function makeCompletionResponse(content: string | undefined): Response {
  return new Response(JSON.stringify({ message: { content } }), { status: 200 });
}

/** Builds a streamed Ollama reply whose body delivers the given raw text pieces in order. */
function makeStreamResponse(bodyPieces: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const bodyPiece of bodyPieces) controller.enqueue(encoder.encode(bodyPiece));
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

/** Serializes one streamed NDJSON line the way Ollama emits it. */
function streamLine(content: string): string {
  return `${JSON.stringify({ message: { content } })}\n`;
}

/** Drains a generator of text chunks into an array. */
async function collectChunks(chunks: AsyncIterable<string>): Promise<string[]> {
  const collected: string[] = [];
  for await (const chunk of chunks) collected.push(chunk);
  return collected;
}

/** Returns the JSON body the client sent to Ollama on its most recent call. */
function lastRequestBody(): Record<string, unknown> {
  const [, requestInit] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return JSON.parse(requestInit.body as string) as Record<string, unknown>;
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("requestChatCompletion", () => {
  it("returns the assistant text from a completed reply", async () => {
    fetchMock.mockResolvedValue(makeCompletionResponse("A registered account."));

    await expect(requestChatCompletion({ messages: CONVERSATION, temperature: 0.1 })).resolves.toBe(
      "A registered account."
    );
  });

  it("sends the shared model settings with a non-streamed request", async () => {
    vi.stubEnv("OLLAMA_URL", "");
    vi.stubEnv("OLLAMA_MODEL", "");
    vi.stubEnv("OLLAMA_KEEP_ALIVE", "");
    fetchMock.mockResolvedValue(makeCompletionResponse("ok"));

    await requestChatCompletion({ messages: CONVERSATION, temperature: 0.1 });

    expect(fetchMock.mock.calls[0]![0]).toBe("http://localhost:11434/api/chat");
    expect(lastRequestBody()).toEqual({
      model: "qwen2.5:7b",
      messages: CONVERSATION,
      stream: false,
      keep_alive: "30m",
      options: { temperature: 0.1, num_ctx: 4096 },
    });
  });

  it("honours the Ollama environment overrides", async () => {
    vi.stubEnv("OLLAMA_URL", "http://ollama.test:9999");
    vi.stubEnv("OLLAMA_MODEL", "custom-model");
    vi.stubEnv("OLLAMA_KEEP_ALIVE", "-1");
    fetchMock.mockResolvedValue(makeCompletionResponse("ok"));

    await requestChatCompletion({ messages: CONVERSATION, temperature: 0.1 });

    expect(fetchMock.mock.calls[0]![0]).toBe("http://ollama.test:9999/api/chat");
    expect(lastRequestBody()).toMatchObject({ model: "custom-model", keep_alive: "-1" });
  });

  it("asks for JSON output only when requested", async () => {
    fetchMock.mockImplementation(async () => makeCompletionResponse("{}"));

    await requestChatCompletion({ messages: CONVERSATION, temperature: 0.1 });
    expect(lastRequestBody()).not.toHaveProperty("format");

    await requestChatCompletion({
      messages: CONVERSATION,
      temperature: 0.1,
      shouldReturnJson: true,
    });
    expect(lastRequestBody()).toHaveProperty("format", "json");
  });

  it("throws a 503 when Ollama is unreachable", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(
      requestChatCompletion({ messages: CONVERSATION, temperature: 0.1 })
    ).rejects.toMatchObject({ statusCode: 503, message: "AI service unavailable" });
  });

  it("throws a 503 when Ollama responds with a non-ok status", async () => {
    fetchMock.mockResolvedValue(new Response("model not found", { status: 404 }));

    await expect(
      requestChatCompletion({ messages: CONVERSATION, temperature: 0.1 })
    ).rejects.toMatchObject({ statusCode: 503 });
  });

  it("throws a 503 when the reply body is not JSON", async () => {
    fetchMock.mockResolvedValue(new Response("<html>Bad gateway</html>", { status: 200 }));

    await expect(
      requestChatCompletion({ messages: CONVERSATION, temperature: 0.1 })
    ).rejects.toMatchObject({ statusCode: 503 });
  });

  it("throws a 502 when the reply has no content", async () => {
    fetchMock.mockResolvedValue(makeCompletionResponse(undefined));

    await expect(
      requestChatCompletion({ messages: CONVERSATION, temperature: 0.1 })
    ).rejects.toMatchObject({ statusCode: 502, message: "AI returned no content" });
  });

  it("aborts the request when the caller's signal is already aborted", async () => {
    fetchMock.mockResolvedValue(makeCompletionResponse("ok"));
    const callerAbortController = new AbortController();
    callerAbortController.abort();

    await requestChatCompletion({
      messages: CONVERSATION,
      temperature: 0.1,
      signal: callerAbortController.signal,
    });

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestInit.signal?.aborted).toBe(true);
  });

  it("aborts a reply that takes longer than the completion timeout", async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    fetchMock.mockImplementation(
      (_url: string, requestInit: RequestInit) =>
        new Promise((_resolve, reject) => {
          requestSignal = requestInit.signal ?? undefined;
          requestSignal?.addEventListener("abort", () => reject(new Error("aborted")));
        })
    );

    const completion = requestChatCompletion({ messages: CONVERSATION, temperature: 0.1 });
    const expectation = expect(completion).rejects.toMatchObject({ statusCode: 503 });
    await vi.advanceTimersByTimeAsync(119_999);
    expect(requestSignal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    await expectation;
  });
});

describe("startChatStream", () => {
  it("yields each streamed chunk in order and requests a stream", async () => {
    fetchMock.mockResolvedValue(makeStreamResponse([streamLine("Hello"), streamLine(" world")]));

    const chunks = await startChatStream({ messages: CONVERSATION, temperature: 0.2 });

    expect(await collectChunks(chunks)).toEqual(["Hello", " world"]);
    expect(lastRequestBody()).toMatchObject({
      stream: true,
      options: { temperature: 0.2, num_ctx: 4096 },
    });
  });

  it("reassembles a line that arrives split across network reads", async () => {
    const line = streamLine("Hello");
    fetchMock.mockResolvedValue(makeStreamResponse([line.slice(0, 12), line.slice(12)]));

    const chunks = await startChatStream({ messages: CONVERSATION, temperature: 0.2 });

    expect(await collectChunks(chunks)).toEqual(["Hello"]);
  });

  it("yields a final line that has no trailing newline", async () => {
    fetchMock.mockResolvedValue(
      makeStreamResponse([streamLine("Hello"), streamLine(" world").trimEnd()])
    );

    const chunks = await startChatStream({ messages: CONVERSATION, temperature: 0.2 });

    expect(await collectChunks(chunks)).toEqual(["Hello", " world"]);
  });

  it("skips blank, malformed, and content-free lines", async () => {
    fetchMock.mockResolvedValue(
      makeStreamResponse([
        streamLine("Hello"),
        "\n",
        "not json\n",
        `${JSON.stringify({ done: true })}\n`,
        streamLine("!"),
      ])
    );

    const chunks = await startChatStream({ messages: CONVERSATION, temperature: 0.2 });

    expect(await collectChunks(chunks)).toEqual(["Hello", "!"]);
  });

  it("throws a 503 before streaming when Ollama is unreachable", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(
      startChatStream({ messages: CONVERSATION, temperature: 0.2 })
    ).rejects.toMatchObject({ statusCode: 503, message: "AI service unavailable" });
  });

  it("throws a 503 before streaming when Ollama responds with a non-ok status", async () => {
    fetchMock.mockResolvedValue(new Response("overloaded", { status: 500 }));

    await expect(
      startChatStream({ messages: CONVERSATION, temperature: 0.2 })
    ).rejects.toMatchObject({ statusCode: 503 });
  });

  it("throws a 503 when the response has no body to stream", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, body: null });

    await expect(
      startChatStream({ messages: CONVERSATION, temperature: 0.2 })
    ).rejects.toMatchObject({ statusCode: 503 });
  });

  it("ends early but keeps earlier chunks when the stream breaks part-way", async () => {
    const encoder = new TextEncoder();
    let readCount = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        readCount += 1;
        if (readCount === 1) controller.enqueue(encoder.encode(streamLine("Partial")));
        else controller.error(new Error("socket hang up"));
      },
    });
    fetchMock.mockResolvedValue(new Response(body, { status: 200 }));

    const chunks = await startChatStream({ messages: CONVERSATION, temperature: 0.2 });

    expect(await collectChunks(chunks)).toEqual(["Partial"]);
  });

  it("aborts the upstream request when the consumer stops reading early", async () => {
    fetchMock.mockResolvedValue(makeStreamResponse([streamLine("Hello"), streamLine(" world")]));

    const chunks = await startChatStream({ messages: CONVERSATION, temperature: 0.2 });
    for await (const chunk of chunks) {
      expect(chunk).toBe("Hello");
      break;
    }

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestInit.signal?.aborted).toBe(true);
  });

  it("aborts the upstream request when the caller's signal aborts", async () => {
    fetchMock.mockResolvedValue(makeStreamResponse([streamLine("Hello")]));
    const callerAbortController = new AbortController();

    await startChatStream({
      messages: CONVERSATION,
      temperature: 0.2,
      signal: callerAbortController.signal,
    });
    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestInit.signal?.aborted).toBe(false);

    callerAbortController.abort();

    expect(requestInit.signal?.aborted).toBe(true);
  });

  it("aborts when Ollama has not started responding within the connect timeout", async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    fetchMock.mockImplementation(
      (_url: string, requestInit: RequestInit) =>
        new Promise((_resolve, reject) => {
          requestSignal = requestInit.signal ?? undefined;
          requestSignal?.addEventListener("abort", () => reject(new Error("aborted")));
        })
    );

    const stream = startChatStream({ messages: CONVERSATION, temperature: 0.2 });
    const expectation = expect(stream).rejects.toMatchObject({ statusCode: 503 });
    await vi.advanceTimersByTimeAsync(59_999);
    expect(requestSignal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    await expectation;
  });

  it("ends the stream when no tokens arrive within the idle timeout", async () => {
    vi.useFakeTimers();
    const encoder = new TextEncoder();
    let requestSignal: AbortSignal | undefined;
    fetchMock.mockImplementation(async (_url: string, requestInit: RequestInit) => {
      requestSignal = requestInit.signal ?? undefined;
      let hasSentFirstChunk = false;
      const body = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (hasSentFirstChunk) {
            // Stall like a hung generation until the watchdog aborts the request.
            return new Promise<void>((resolve) => {
              requestSignal?.addEventListener("abort", () => {
                controller.error(new Error("aborted"));
                resolve();
              });
            });
          }
          hasSentFirstChunk = true;
          controller.enqueue(encoder.encode(streamLine("Partial")));
        },
      });
      return new Response(body, { status: 200 });
    });

    const chunks = await startChatStream({ messages: CONVERSATION, temperature: 0.2 });
    const collected = collectChunks(chunks);
    await vi.advanceTimersByTimeAsync(29_999);
    expect(requestSignal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    expect(await collected).toEqual(["Partial"]);
    expect(requestSignal?.aborted).toBe(true);
  });
});
