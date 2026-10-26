import { CredentialsSignin } from "next-auth";
import {
  BACKEND_UNAVAILABLE_SIGN_IN_CODE,
  TOO_MANY_SIGN_IN_ATTEMPTS_CODE,
  parseJsonOrNull,
} from "./backend-errors";
import { REMEMBER_COOKIE_NAME, readCookieValue } from "./remember-cookie";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/**
 * Thrown from `authorize` when the backend couldn't check the credentials, so the login page can
 * say "try again shortly" instead of wrongly telling the user their password is incorrect.
 */
export class BackendUnavailableSignInError extends CredentialsSignin {
  code = BACKEND_UNAVAILABLE_SIGN_IN_CODE;
}

/** Thrown from `authorize` when the backend's failed sign-in limit blocks this email for now. */
export class TooManySignInAttemptsError extends CredentialsSignin {
  code = TOO_MANY_SIGN_IN_ATTEMPTS_CODE;
}

/**
 * `rememberToken` carries a demo account's one-time token; `useSavedSignIn` asks to sign in with
 * the token in this browser's httpOnly remember-me cookie, which page scripts can't read.
 */
export type SignInCredentials = Partial<
  Record<"email" | "password" | "rememberToken" | "useSavedSignIn", unknown>
>;

export type VerifiedUser = { id: string; email: string; name: string };

/** Whether a backend verify reply has the id and email a session needs. */
function isBackendUser(body: unknown): body is { id: string; email: string } {
  if (typeof body !== "object" || body === null) return false;
  const { id, email } = body as Record<string, unknown>;
  return typeof id === "string" && typeof email === "string";
}

/** Posts to a backend verify endpoint and maps its reply to a session user, null for a rejection, or a throw for an outage or lockout. */
async function verifyWithBackend(
  endpointPath: string,
  payload: Record<string, unknown>
): Promise<VerifiedUser | null> {
  let response: Response;
  try {
    response = await fetch(`${BACKEND}/api/credentials-auth${endpointPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": process.env.INTERNAL_API_SECRET ?? "",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new BackendUnavailableSignInError();
  }

  if (response.status >= 500) throw new BackendUnavailableSignInError();
  if (response.status === 429) throw new TooManySignInAttemptsError();
  if (!response.ok) return null;

  const user = parseJsonOrNull(await response.text());
  if (!isBackendUser(user)) return null;
  return { id: user.id, email: user.email, name: user.email.split("@")[0] };
}

/**
 * Verifies a demo token, the browser's saved sign-in cookie, or else an email + password against
 * the backend. Returns null when the credentials are rejected or missing, and throws a
 * `CredentialsSignin` subclass when the backend is unreachable or the email is locked out.
 */
export async function verifyCredentials(
  credentials: SignInCredentials | undefined,
  request?: Request
): Promise<VerifiedUser | null> {
  if (credentials?.rememberToken) {
    return verifyWithBackend("/remember/verify", { token: credentials.rememberToken });
  }
  if (credentials?.useSavedSignIn === "true") {
    const savedToken = readCookieValue(request?.headers.get("cookie"), REMEMBER_COOKIE_NAME);
    if (!savedToken) return null;
    return verifyWithBackend("/remember/verify", { token: savedToken });
  }
  if (!credentials?.email || !credentials?.password) return null;
  return verifyWithBackend("/verify", {
    email: credentials.email,
    password: credentials.password,
  });
}
