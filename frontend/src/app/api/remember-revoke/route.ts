import { NextRequest, NextResponse } from "next/server";
import { REMEMBER_COOKIE_NAME, REMEMBER_COOKIE_PATH } from "@/lib/remember-cookie";
import { forwardToCredentialsAuth } from "../_credentialsAuth/forward-to-credentials-auth";

/**
 * Revokes the saved sign-in token held in this browser's cookie, so it can no longer be used to
 * sign in, and clears the cookie. Called when the user forgets the saved account on the login page.
 */
export async function DELETE(req: NextRequest) {
  const token = req.cookies.get(REMEMBER_COOKIE_NAME)?.value;
  const response = token
    ? await forwardToCredentialsAuth("/remember", "DELETE", { token })
    : new NextResponse(null, { status: 204 });

  // Clear it even when the backend is unreachable: this browser should forget the token either way.
  response.cookies.delete({ name: REMEMBER_COOKIE_NAME, path: REMEMBER_COOKIE_PATH });
  return response;
}
