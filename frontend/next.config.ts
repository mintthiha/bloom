import type { NextConfig } from "next";

// Sent on every response. A Content-Security-Policy is deliberately not set yet: the inline theme
// scripts, Plaid Link, and tesseract.js's CDN workers each need allowances worked out first.
const SECURITY_HEADERS = [
  // Bloom is never meant to be framed, which blocks clickjacking.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // Browsers ignore this over plain http (e.g. localhost), so it only takes effect on the live site.
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // No rewrites to the backend: the browser reaches it only through the route handlers under
  // /api (chiefly the authenticated /api/bloom proxy), never directly.
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
