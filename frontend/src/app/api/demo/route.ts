import { forwardToCredentialsAuth } from "../_credentialsAuth/forward-to-credentials-auth";
import { readClientIp } from "../_credentialsAuth/read-client-ip";

/**
 * Proxies demo-account provisioning to the backend, attaching the internal
 * secret so the backend accepts the request. No request body needed.
 */
export async function POST(req: Request) {
  return forwardToCredentialsAuth("/demo", "POST", undefined, {
    clientIp: readClientIp(req.headers),
  });
}
