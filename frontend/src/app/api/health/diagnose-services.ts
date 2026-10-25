import { parseJsonOrNull } from "@/lib/backend-errors";
import { UNCHECKED_SERVICE, type ServiceHealthReport } from "@/lib/service-health";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export const HEALTH_CHECK_TIMEOUT_MS = 5000;

/** Reads a Node network error code (e.g. ECONNREFUSED), which undici nests under `cause`. */
function getNetworkErrorCode(error: unknown): string | null {
  const candidates: unknown[] = [error];
  if (typeof error === "object" && error !== null && "cause" in error) {
    const { cause } = error as { cause: unknown };
    candidates.push(cause);
    // Dual-stack connects (IPv4 + IPv6) fail with an AggregateError holding one error per attempt.
    if (typeof cause === "object" && cause !== null && "errors" in cause) {
      const { errors } = cause as { errors: unknown };
      if (Array.isArray(errors)) candidates.push(...errors);
    }
  }
  for (const candidate of candidates) {
    if (typeof candidate === "object" && candidate !== null && "code" in candidate) {
      const { code } = candidate as { code: unknown };
      if (typeof code === "string") return code;
    }
  }
  return null;
}

/** Turns a failed backend fetch into a plain-English guess at the cause. */
export function describeUnreachableBackend(error: unknown): string {
  const errorName =
    typeof error === "object" && error !== null && "name" in error
      ? (error as { name: unknown }).name
      : null;
  if (errorName === "TimeoutError" || errorName === "AbortError") {
    return `No response within ${HEALTH_CHECK_TIMEOUT_MS / 1000}s — the backend may be starting up or stuck.`;
  }

  const code = getNetworkErrorCode(error);
  switch (code) {
    case "ECONNREFUSED":
      return "Connection refused — the backend container or process isn't running.";
    case "ENOTFOUND":
    case "EAI_AGAIN":
      return "Backend host not found — check NEXT_PUBLIC_API_URL and the Docker network.";
    case "ECONNRESET":
      return "Connection dropped — the backend may have crashed or restarted.";
    default:
      return code ? `Unreachable (${code}).` : "Unreachable.";
  }
}

/** Whether a body is the backend's own `/health` reply rather than some other service's. */
function isBackendHealthBody(body: unknown): body is { service: "bloom-api"; db: string } {
  if (typeof body !== "object" || body === null) return false;
  const { service, db } = body as Record<string, unknown>;
  return service === "bloom-api" && typeof db === "string";
}

/**
 * Checks each link the app depends on, stopping at the first one that fails. Answering at all
 * proves the Next.js server is up; the backend's `/health` (outside `/api`, so no internal secret)
 * reports on itself and on Postgres.
 */
export async function diagnoseServices(): Promise<ServiceHealthReport> {
  const frontend = { status: "ok", detail: "Next.js server is running." } as const;

  let response: Response;
  try {
    response = await fetch(`${BACKEND}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
    });
  } catch (error) {
    return {
      frontend,
      backend: { status: "down", detail: describeUnreachableBackend(error) },
      database: UNCHECKED_SERVICE,
    };
  }

  const body = parseJsonOrNull(await response.text().catch(() => ""));
  if (!isBackendHealthBody(body)) {
    const detail =
      response.status >= 500
        ? `Backend answered with HTTP ${response.status} — check the backend logs.`
        : `Something answered with HTTP ${response.status}, but it isn't Bloom's backend — NEXT_PUBLIC_API_URL may point at the wrong service.`;
    return { frontend, backend: { status: "down", detail }, database: UNCHECKED_SERVICE };
  }

  const backend = { status: "ok", detail: "Backend API is running." } as const;
  if (body.db !== "ok") {
    return {
      frontend,
      backend,
      database: {
        status: "down",
        detail: "The backend can't reach Postgres — the database container may be down.",
      },
    };
  }
  return { frontend, backend, database: { status: "ok", detail: "Connected." } };
}
