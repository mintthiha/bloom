import { forwardToCredentialsAuth } from "../_credentialsAuth/forward-to-credentials-auth";

/**
 * Proxies demo-account provisioning to the backend, attaching the internal
 * secret so the backend accepts the request. No request body needed.
 */
export async function POST() {
  return forwardToCredentialsAuth("/demo", "POST");
}
