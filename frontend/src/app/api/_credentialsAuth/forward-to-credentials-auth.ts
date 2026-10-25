import { NextResponse } from "next/server";
import {
  SERVER_UNAVAILABLE_MESSAGE,
  getFailedRequestMessage,
  parseJsonOrNull,
} from "@/lib/backend-errors";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/** Reads a route's JSON request body as an object, or null when it is missing or malformed. */
export async function readJsonObjectBody(
  request: Request
): Promise<Record<string, unknown> | null> {
  const body = parseJsonOrNull(await request.text().catch(() => ""));
  return typeof body === "object" && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : null;
}

/** The 400 every credentials route returns for a body it can't read. */
export function invalidRequestBodyResponse(): NextResponse {
  return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
}

/**
 * Forwards a request to a backend `/api/credentials-auth` endpoint with the internal secret and
 * relays its reply. The browser always gets JSON back: an unreachable backend becomes a 503 and
 * a non-JSON reply (e.g. an HTML 502 page) becomes a JSON error, so callers never hit a parse error.
 */
export async function forwardToCredentialsAuth(
  endpointPath: string,
  method: "POST" | "DELETE",
  payload?: Record<string, unknown>
): Promise<NextResponse> {
  let backendResponse: Response;
  try {
    backendResponse = await fetch(`${BACKEND}/api/credentials-auth${endpointPath}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": process.env.INTERNAL_API_SECRET ?? "",
      },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
  } catch {
    return NextResponse.json({ error: SERVER_UNAVAILABLE_MESSAGE }, { status: 503 });
  }

  if (backendResponse.status === 204) return new NextResponse(null, { status: 204 });

  const body = parseJsonOrNull(await backendResponse.text());
  if (body === null) {
    const status = backendResponse.ok ? 502 : backendResponse.status;
    return NextResponse.json({ error: getFailedRequestMessage(status, null) }, { status });
  }
  return NextResponse.json(body, { status: backendResponse.status });
}
