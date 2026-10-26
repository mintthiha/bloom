import { NextResponse } from "next/server";
import { GENERIC_FAILURE_MESSAGE } from "@/lib/backend-errors";
import {
  REMEMBER_COOKIE_NAME,
  buildRememberCookieOptions,
  readIssuedRememberToken,
} from "@/lib/remember-cookie";
import {
  forwardToCredentialsAuth,
  invalidRequestBodyResponse,
  readJsonObjectBody,
} from "../_credentialsAuth/forward-to-credentials-auth";

/**
 * Issues a remember-me token after verifying email + password, and stores it in an httpOnly
 * cookie. The token never reaches page scripts: the reply carries only the email to display.
 */
export async function POST(req: Request) {
  const requestBody = await readJsonObjectBody(req);
  if (!requestBody) return invalidRequestBodyResponse();

  const { email, password } = requestBody;
  const backendResponse = await forwardToCredentialsAuth("/remember/issue", "POST", {
    email,
    password,
  });
  if (backendResponse.status !== 200) return backendResponse;

  const issued = readIssuedRememberToken(await backendResponse.json());
  if (!issued) return NextResponse.json({ error: GENERIC_FAILURE_MESSAGE }, { status: 502 });

  const response = NextResponse.json({ email: issued.email });
  response.cookies.set(
    REMEMBER_COOKIE_NAME,
    issued.token,
    buildRememberCookieOptions(issued.expiresAt)
  );
  return response;
}
