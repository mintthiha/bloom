import { CredentialsSignin } from "next-auth";
import { BACKEND_UNAVAILABLE_SIGN_IN_CODE, parseJsonOrNull } from "./backend-errors";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/**
 * Thrown from `authorize` when the backend couldn't check the credentials, so the login page can
 * say "try again shortly" instead of wrongly telling the user their password is incorrect.
 */
export class BackendUnavailableSignInError extends CredentialsSignin {
  code = BACKEND_UNAVAILABLE_SIGN_IN_CODE;
}

export type SignInCredentials = Partial<Record<"email" | "password" | "rememberToken", unknown>>;

export type VerifiedUser = { id: string; email: string; name: string };

/** Whether a backend verify reply has the id and email a session needs. */
function isBackendUser(body: unknown): body is { id: string; email: string } {
  if (typeof body !== "object" || body === null) return false;
  const { id, email } = body as Record<string, unknown>;
  return typeof id === "string" && typeof email === "string";
}

/** Posts to a backend verify endpoint and maps its reply to a session user, null for a rejection, or a throw for an outage. */
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
  if (!response.ok) return null;

  const user = parseJsonOrNull(await response.text());
  if (!isBackendUser(user)) return null;
  return { id: user.id, email: user.email, name: user.email.split("@")[0] };
}

/**
 * Verifies a remember-me token, or else an email + password, against the backend. Returns null
 * when the credentials are rejected or missing, and throws `BackendUnavailableSignInError` when
 * the backend can't be reached or fails.
 */
export async function verifyCredentials(
  credentials: SignInCredentials | undefined
): Promise<VerifiedUser | null> {
  if (credentials?.rememberToken) {
    return verifyWithBackend("/remember/verify", { token: credentials.rememberToken });
  }
  if (!credentials?.email || !credentials?.password) return null;
  return verifyWithBackend("/verify", {
    email: credentials.email,
    password: credentials.password,
  });
}
