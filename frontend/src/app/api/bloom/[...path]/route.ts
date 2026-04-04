import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path } = await params;
  const url = `${BACKEND}/api/${path.join("/")}${req.nextUrl.search}`;

  const headers = new Headers({ "Content-Type": "application/json", "X-User-Id": session.user.id });

  const body = req.method !== "GET" && req.method !== "HEAD" ? await req.text() : undefined;

  const res = await fetch(url, { method: req.method, headers, body });

  if (res.status === 204) return new NextResponse(null, { status: 204 });

  const data = await res.text();
  return new NextResponse(data, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
