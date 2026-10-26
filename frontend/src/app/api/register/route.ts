import {
  forwardToCredentialsAuth,
  invalidRequestBodyResponse,
  readJsonObjectBody,
} from "../_credentialsAuth/forward-to-credentials-auth";
import { readClientIp } from "../_credentialsAuth/read-client-ip";

/**
 * Proxies account creation to the backend's credentials-auth register endpoint,
 * attaching the internal secret so the backend accepts the request.
 */
export async function POST(req: Request) {
  const requestBody = await readJsonObjectBody(req);
  if (!requestBody) return invalidRequestBodyResponse();

  const { email, password } = requestBody;
  return forwardToCredentialsAuth(
    "/register",
    "POST",
    { email, password },
    { clientIp: readClientIp(req.headers) }
  );
}
