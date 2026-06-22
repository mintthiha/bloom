import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are Bloom's financial education assistant, helping Canadians understand personal finance concepts. You are knowledgeable, friendly, and concise. Focus on Canadian-specific information (TFSA, RRSP, FHSA, CRA, etc.) but also cover universal personal finance fundamentals.

Keep answers focused and practical. When discussing account types, mention key limits and rules relevant to Canadians. Avoid giving specific investment advice — instead, educate on concepts and direct users to speak with a financial advisor for personalized guidance.

Respond in plain text (no markdown formatting). Keep responses under 300 words unless the user asks for a detailed explanation.`;

/** Maximum number of requests allowed per IP within the rate limit window. */
const RATE_LIMIT_MAX = 10;

/** Rate limit window duration in milliseconds (1 hour). */
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/** In-memory store mapping IP addresses to their recent request timestamps. */
const rateLimitStore = new Map<string, number[]>();

/**
 * Checks whether the given IP has exceeded the rate limit.
 * Returns true if the request should be blocked, false if it is allowed.
 */
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const recentTimestamps = (rateLimitStore.get(ip) ?? []).filter(
    (timestamp) => timestamp > windowStart
  );

  if (recentTimestamps.length >= RATE_LIMIT_MAX) {
    return true;
  }

  recentTimestamps.push(now);
  rateLimitStore.set(ip, recentTimestamps);
  return false;
}

export async function POST(req: Request) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : "unknown";

  if (isRateLimited(clientIp)) {
    return new Response("Too many requests. Please try again later.", {
      status: 429,
      headers: { "Retry-After": "3600" },
    });
  }

  let messages: Anthropic.MessageParam[];

  try {
    const body = await req.json();
    messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response("Invalid messages", { status: 400 });
    }
  } catch {
    return new Response("Invalid request body", { status: 400 });
  }

  const stream = client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    messages,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
