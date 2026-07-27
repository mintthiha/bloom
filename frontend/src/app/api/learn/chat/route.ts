import { auth } from "@/auth";
import { buildFinancialContext } from "./financial-context";
import { fetchFinancialSnapshot } from "./financial-snapshot";

const SYSTEM_PROMPT = `You are Bloom's financial education assistant, helping Canadians understand personal finance concepts. You are knowledgeable, friendly, and concise. Focus on Canadian-specific information (TFSA, RRSP, FHSA, CRA, etc.) but also cover universal personal finance fundamentals.

Keep answers focused and practical. When discussing account types, mention key limits and rules relevant to Canadians. Avoid giving specific investment advice — instead, educate on concepts and direct users to speak with a financial advisor for personalized guidance.

Format answers with simple markdown when it aids clarity — short paragraphs, bold for key figures, and bullet lists for multiple points. Keep responses under 300 words unless the user asks for a detailed explanation.`;

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const rateLimitStore = new Map<string, number[]>();

// Abort if Ollama hasn't started responding within this window — long enough to cover a cold
// model load, short enough that a truly down service fails fast instead of hanging the request.
const OLLAMA_CONNECT_TIMEOUT_MS = 60_000;
// Abort mid-stream if no tokens arrive for this long, so a stalled generation can't hang forever.
const OLLAMA_STREAM_IDLE_TIMEOUT_MS = 30_000;
const SERVICE_UNAVAILABLE_MESSAGE =
  "Bloom AI is temporarily unavailable. Please try again in a moment.";

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const recentTimestamps = (rateLimitStore.get(ip) ?? []).filter(
    (timestamp) => timestamp > windowStart
  );
  if (recentTimestamps.length >= RATE_LIMIT_MAX) return true;
  recentTimestamps.push(now);
  rateLimitStore.set(ip, recentTimestamps);
  return false;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const forwardedFor = req.headers.get("x-forwarded-for");
  const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : "unknown";

  if (isRateLimited(clientIp)) {
    return new Response("Too many requests. Please try again later.", {
      status: 429,
      headers: { "Retry-After": "3600" },
    });
  }

  let messages: { role: string; content: string }[];
  try {
    const body = await req.json();
    messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response("Invalid messages", { status: 400 });
    }
  } catch {
    return new Response("Invalid request body", { status: 400 });
  }

  const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
  const ollamaModel = process.env.OLLAMA_MODEL || "qwen2.5:7b";

  // Personalize the system prompt with the user's own Bloom data when available; on any failure,
  // fall back to the generic prompt so the chat still works.
  let systemPrompt = SYSTEM_PROMPT;
  try {
    const snapshot = await fetchFinancialSnapshot(session.user.id);
    const financialContext = buildFinancialContext(snapshot);
    if (financialContext) {
      systemPrompt = `${SYSTEM_PROMPT}\n\n${financialContext}`;
    }
  } catch {
    // Keep the generic prompt.
  }

  // Guard the upstream call: a connect timeout while waiting for the first response, then an idle
  // watchdog once streaming, both driven by the same AbortController.
  const abortController = new AbortController();
  let inactivityTimer = setTimeout(() => abortController.abort(), OLLAMA_CONNECT_TIMEOUT_MS);

  let ollamaResponse: Response;
  try {
    ollamaResponse = await fetch(`${ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: abortController.signal,
      body: JSON.stringify({
        model: ollamaModel,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
        // Keep the model resident between requests so it isn't reloaded from disk each time;
        // overridable via OLLAMA_KEEP_ALIVE (e.g. "-1" to keep it loaded indefinitely).
        keep_alive: process.env.OLLAMA_KEEP_ALIVE || "30m",
        options: {
          // Steady, factual answers over creative ones for financial guidance.
          temperature: 0.4,
          // Enlarge the context window so the prepended financial snapshot isn't truncated
          // by Ollama's 2048-token default.
          num_ctx: 4096,
        },
      }),
    });
  } catch {
    clearTimeout(inactivityTimer);
    return new Response(SERVICE_UNAVAILABLE_MESSAGE, { status: 503 });
  }

  if (!ollamaResponse.ok || !ollamaResponse.body) {
    clearTimeout(inactivityTimer);
    return new Response(SERVICE_UNAVAILABLE_MESSAGE, { status: 503 });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = ollamaResponse.body.getReader();

  const readable = new ReadableStream({
    async start(controller) {
      let buffer = "";
      try {
        while (true) {
          // Restart the idle watchdog before each read so a stalled stream is aborted.
          clearTimeout(inactivityTimer);
          inactivityTimer = setTimeout(
            () => abortController.abort(),
            OLLAMA_STREAM_IDLE_TIMEOUT_MS
          );
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const parsed = JSON.parse(line);
            if (parsed.message?.content) {
              controller.enqueue(encoder.encode(parsed.message.content));
            }
          }
        }
      } catch {
        // Aborted (timeout) or a malformed chunk: stop reading and close the stream cleanly so the
        // client keeps whatever text already arrived instead of erroring.
      } finally {
        clearTimeout(inactivityTimer);
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
