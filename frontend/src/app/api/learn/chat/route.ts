import { auth } from "@/auth";
import { buildCanadianTaxFacts } from "./canadian-tax-facts";
import { buildFinancialContext } from "./financial-context";
import { fetchFinancialSnapshot } from "./financial-snapshot";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const SYSTEM_PROMPT = `You are Bloom's financial education assistant, helping Canadians understand personal finance concepts. You are knowledgeable, friendly, and concise. Focus on Canadian-specific information (TFSA, RRSP, FHSA, CRA, etc.) but also cover universal personal finance fundamentals.

Keep answers focused and practical. When discussing account types, mention key limits and rules relevant to Canadians. Avoid giving specific investment advice — instead, educate on concepts and direct users to speak with a financial advisor for personalized guidance.

For any Canadian contribution limit or tax figure, use only the authoritative numbers provided in this prompt — never state a limit from memory. If a specific figure isn't provided, say you're not certain rather than guessing.

Format answers with simple markdown when it aids clarity — short paragraphs, bold for key figures, and bullet lists for multiple points. Keep responses under 300 words unless the user asks for a detailed explanation.`;

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const rateLimitStore = new Map<string, number[]>();

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

  // Always ground the model with Bloom's authoritative Canadian limits so it can't guess them.
  let systemPrompt = `${SYSTEM_PROMPT}\n\n${buildCanadianTaxFacts()}`;
  // Personalize with the user's own Bloom data when available; on any failure, keep going without it.
  try {
    const snapshot = await fetchFinancialSnapshot(session.user.id);
    const financialContext = buildFinancialContext(snapshot);
    if (financialContext) {
      systemPrompt = `${systemPrompt}\n\n${financialContext}`;
    }
  } catch {
    // Keep the prompt without personalization.
  }

  // The backend owns the model call (settings, timeouts, stall detection); this route only builds
  // the prompt and relays the reply. Forwarding the request's signal lets Stop cancel generation.
  let backendResponse: Response;
  try {
    backendResponse = await fetch(`${BACKEND}/api/internal/ai/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": session.user.id,
        "X-Internal-Secret": process.env.INTERNAL_API_SECRET ?? "",
      },
      signal: req.signal,
      body: JSON.stringify({ systemPrompt, messages }),
    });
  } catch {
    return new Response(SERVICE_UNAVAILABLE_MESSAGE, { status: 503 });
  }

  if (backendResponse.status === 400) {
    return new Response("Invalid messages", { status: 400 });
  }
  if (!backendResponse.ok || !backendResponse.body) {
    return new Response(SERVICE_UNAVAILABLE_MESSAGE, { status: 503 });
  }

  return new Response(backendResponse.body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
