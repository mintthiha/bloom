import { NextResponse } from "next/server";
import { diagnoseServices } from "./diagnose-services";

export const dynamic = "force-dynamic";

/**
 * Reports which parts of Bloom are reachable, for the error page's technical details. Public on
 * purpose (the middleware skips `/api`) so it still answers when sign-in itself is broken; it
 * reveals only up/down status, never hostnames or stack traces.
 */
export async function GET() {
  return NextResponse.json(await diagnoseServices(), {
    headers: { "Cache-Control": "no-store" },
  });
}
