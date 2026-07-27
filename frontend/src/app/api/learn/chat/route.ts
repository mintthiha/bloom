import { auth } from "@/auth";
import { buildFinancialContext } from "./financial-context";
import { fetchFinancialSnapshot } from "./financial-snapshot";

const SYSTEM_PROMPT = `You are Bloom's financial education assistant, helping Canadians understand personal finance concepts. You are knowledgeable, friendly, and concise. Focus on Canadian-specific information (TFSA, RRSP, FHSA, CRA, etc.) but also cover universal personal finance fundamentals.

Keep answers focused and practical. When discussing account types, mention key limits and rules relevant to Canadians. Avoid giving specific investment advice — instead, educate on concepts and direct users to speak with a financial advisor for personalized guidance.

Respond in plain text (no markdown formatting). Keep responses under 300 words unless the user asks for a detailed explanation.`;

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const rateLimitStore = new Map<string, number[]>();

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
  const ollamaModel = process.env.OLLAMA_MODEL || "phi4-mini";

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

  const ollamaResponse = await fetch(`${ollamaUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: ollamaModel,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      stream: true,
    }),
  });

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = ollamaResponse.body!.getReader();

  const readable = new ReadableStream({
    async start(controller) {
      let buffer = "";
      try {
        while (true) {
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
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
