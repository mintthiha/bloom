import { auth } from "@/auth";
import { buildCanadianTaxFacts } from "./canadian-tax-facts";
import { buildFinancialContext } from "./financial-context";
import { fetchFinancialSnapshot } from "./financial-snapshot";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const SYSTEM_PROMPT = `You are Bloom's financial education assistant, helping Canadians understand personal finance concepts. You are knowledgeable, friendly, and concise. Focus on Canadian-specific information (TFSA, RRSP, FHSA, CRA, etc.) but also cover universal personal finance fundamentals.

Keep answers focused and practical. When discussing account types, mention key limits and rules relevant to Canadians. Avoid giving specific investment advice — instead, educate on concepts and direct users to speak with a financial advisor for personalized guidance.

For any Canadian contribution limit or tax figure, use only the authoritative numbers provided in this prompt — never state a limit from memory. If a specific figure isn't provided, say you're not certain rather than guessing.

Format answers with simple markdown when it aids clarity — short paragraphs, bold for key figures, and bullet lists for multiple points. Keep responses under 300 words unless the user asks for a detailed explanation.`;

const SERVICE_UNAVAILABLE_MESSAGE =
  "Bloom AI is temporarily unavailable. Please try again in a moment.";
const RATE_LIMITED_MESSAGE =
  "You've reached the limit for Bloom AI messages. Please try again later.";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  let message: string;
  try {
    const body = await req.json();
    if (typeof body?.message !== "string" || !body.message.trim()) {
      return new Response("Invalid message", { status: 400 });
    }
    message = body.message;
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

  // The backend owns the model call, the conversation history, and the per-user rate limit; this
  // route only builds the prompt and relays the reply. Forwarding the request's signal lets Stop
  // cancel generation.
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
      body: JSON.stringify({ systemPrompt, message }),
    });
  } catch {
    return new Response(SERVICE_UNAVAILABLE_MESSAGE, { status: 503 });
  }

  if (backendResponse.status === 400) {
    return new Response("Invalid message", { status: 400 });
  }
  if (backendResponse.status === 429) {
    const retryAfter = backendResponse.headers.get("Retry-After");
    return new Response(RATE_LIMITED_MESSAGE, {
      status: 429,
      headers: retryAfter ? { "Retry-After": retryAfter } : undefined,
    });
  }
  if (!backendResponse.ok || !backendResponse.body) {
    return new Response(SERVICE_UNAVAILABLE_MESSAGE, { status: 503 });
  }

  return new Response(backendResponse.body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
