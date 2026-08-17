import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/**
 * Revokes a remember-me token so it can no longer be used to sign in.
 * Called on explicit sign-out so the token is invalidated server-side immediately.
 */
export async function DELETE(req: NextRequest) {
  const { token } = await req.json();

  const res = await fetch(`${BACKEND}/api/credentials-auth/remember`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Secret": process.env.INTERNAL_API_SECRET ?? "",
    },
    body: JSON.stringify({ token }),
  });

  return new NextResponse(null, { status: res.status });
}
