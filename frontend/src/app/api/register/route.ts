import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/**
 * Proxies account creation to the backend's credentials-auth register endpoint,
 * attaching the internal secret so the backend accepts the request.
 */
export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  const res = await fetch(`${BACKEND}/api/credentials-auth/register`, {
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
