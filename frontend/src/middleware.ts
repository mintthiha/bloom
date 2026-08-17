import { auth } from "@/auth";
import { NextResponse } from "next/server";

const AUTH_PAGES = new Set(["/login", "/register"]);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isAuthPage = AUTH_PAGES.has(req.nextUrl.pathname);

  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/", req.url));
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
