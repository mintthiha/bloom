/** Shown when the backend can't be reached or answers with a gateway error — usually a cold start. */
export const SERVER_UNAVAILABLE_MESSAGE =
  "Bloom's server is unavailable right now — it may be waking up. Please try again in a moment.";

/** Shown when the browser can't reach Bloom at all, e.g. the device is offline. */
export const NETWORK_ERROR_MESSAGE = "Couldn't reach Bloom. Check your connection and try again.";

/** Fallback for a failed request whose response carries no usable error message. */
export const GENERIC_FAILURE_MESSAGE = "Something went wrong. Please try again.";

/** NextAuth sign-in error code meaning the backend couldn't verify credentials, not that they were wrong. */
export const BACKEND_UNAVAILABLE_SIGN_IN_CODE = "backend_unavailable";

const GATEWAY_ERROR_STATUSES = new Set([502, 503, 504]);

/** Whether a status means the server is down or unreachable rather than rejecting the request. */
export function isServerUnavailableStatus(status: number): boolean {
  return GATEWAY_ERROR_STATUSES.has(status);
}

/** Parses a response body as JSON, returning null when it is empty or not JSON (e.g. an HTML error page). */
export function parseJsonOrNull(text: string): unknown {
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Picks the user-facing message for a failed request: the server's own error when it sent one, else one based on the status. */
export function getFailedRequestMessage(status: number, body: unknown): string {
  if (typeof body === "object" && body !== null && "error" in body) {
    const { error } = body as { error: unknown };
    if (typeof error === "string" && error.trim()) return error;
  }
  return isServerUnavailableStatus(status) ? SERVER_UNAVAILABLE_MESSAGE : GENERIC_FAILURE_MESSAGE;
}
