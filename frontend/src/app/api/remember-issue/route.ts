import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/**
 * Issues a remember-me token after verifying email + password.
 * Proxies to the backend with the internal secret so the browser never holds it.
 */
export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  const res = await fetch(`${BACKEND}/api/credentials-auth/remember/issue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Secret": process.env.INTERNAL_API_SECRET ?? "",
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
