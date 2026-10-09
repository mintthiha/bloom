import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// Backend routes under this prefix trust their caller's input (e.g. the AI chat takes a system
// prompt), so they are reachable only from this app's own server code, never through the proxy.
const INTERNAL_ONLY_PATH_PREFIX = "/api/internal/";

async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path } = await params;
  const url = `${BACKEND}/api/${path.join("/")}${req.nextUrl.search}`;

  // Checked on the resolved, lowercased path: an encoded "../" segment or different casing (the
  // backend's routing is case-insensitive) must not sidestep the prefix match.
  if (new URL(url).pathname.toLowerCase().startsWith(INTERNAL_ONLY_PATH_PREFIX)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const headers = new Headers({
    "Content-Type": "application/json",
    "X-User-Id": session.user.id,
    "X-Internal-Secret": process.env.INTERNAL_API_SECRET ?? "",
  });

  const body = req.method !== "GET" && req.method !== "HEAD" ? await req.text() : undefined;

  const res = await fetch(url, { method: req.method, headers, body });

  if (res.status === 204) return new NextResponse(null, { status: 204 });

  if (res.headers.get("Content-Type")?.includes("text/event-stream")) {
    return new NextResponse(res.body, {
      status: res.status,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

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
