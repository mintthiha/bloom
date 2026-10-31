import {
  BACKEND_UNAVAILABLE_SIGN_IN_CODE,
  SERVER_UNAVAILABLE_MESSAGE,
  TOO_MANY_SIGN_IN_ATTEMPTS_CODE,
  TOO_MANY_SIGN_IN_ATTEMPTS_MESSAGE,
  getFailedRequestMessage,
  isServerUnavailableStatus,
} from "@/lib/backend-errors";

export const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password. Please try again.";
export const DEMO_FAILURE_MESSAGE = "Couldn't start the demo right now. Please try again.";

/** Picks the message for a rejected email + password sign-in from NextAuth's error code. */
export function describeCredentialSignInFailure(code: string | undefined): string {
  if (code === BACKEND_UNAVAILABLE_SIGN_IN_CODE) return SERVER_UNAVAILABLE_MESSAGE;
  if (code === TOO_MANY_SIGN_IN_ATTEMPTS_CODE) return TOO_MANY_SIGN_IN_ATTEMPTS_MESSAGE;
  return INVALID_CREDENTIALS_MESSAGE;
}

/** Picks the message for a failed demo request: the rate-limit reason, an outage, or a generic retry. */
export function describeDemoFailure(status: number, body: unknown): string {
  if (status === 429) return getFailedRequestMessage(status, body);
  if (isServerUnavailableStatus(status)) return SERVER_UNAVAILABLE_MESSAGE;
  return DEMO_FAILURE_MESSAGE;
}
