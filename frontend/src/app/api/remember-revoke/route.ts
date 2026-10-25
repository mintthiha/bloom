import {
  forwardToCredentialsAuth,
  invalidRequestBodyResponse,
  readJsonObjectBody,
} from "../_credentialsAuth/forward-to-credentials-auth";

/**
 * Revokes a remember-me token so it can no longer be used to sign in.
 * Called on explicit sign-out so the token is invalidated server-side immediately.
 */
export async function DELETE(req: Request) {
  const requestBody = await readJsonObjectBody(req);
  if (!requestBody) return invalidRequestBodyResponse();

  return forwardToCredentialsAuth("/remember", "DELETE", { token: requestBody.token });
}
