import { NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/**
 * Proxies demo-account provisioning to the backend, attaching the internal
 * secret so the backend accepts the request. No request body needed.
 */
export async function POST() {
  const res = await fetch(`${BACKEND}/api/credentials-auth/demo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Secret": process.env.INTERNAL_API_SECRET ?? "",
    },
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
