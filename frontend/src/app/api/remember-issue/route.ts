import {
  forwardToCredentialsAuth,
  invalidRequestBodyResponse,
  readJsonObjectBody,
} from "../_credentialsAuth/forward-to-credentials-auth";

/**
 * Issues a remember-me token after verifying email + password.
 * Proxies to the backend with the internal secret so the browser never holds it.
 */
export async function POST(req: Request) {
  const requestBody = await readJsonObjectBody(req);
  if (!requestBody) return invalidRequestBodyResponse();

  const { email, password } = requestBody;
  return forwardToCredentialsAuth("/remember/issue", "POST", { email, password });
}
