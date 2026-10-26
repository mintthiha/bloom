/**
 * Reads the visitor's IP so the backend can rate-limit sign-ups per visitor. Assumes one trusted
 * reverse proxy (the TLS terminator) in front of Next.js: it appends the address it saw to
 * `X-Forwarded-For`, so the rightmost entry is the one a visitor can't forge — anything to its
 * left came from the visitor's own request.
 */
export function readClientIp(headers: Headers): string | null {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const addresses = forwardedFor
      .split(",")
      .map((address) => address.trim())
      .filter(Boolean);
    if (addresses.length > 0) return addresses[addresses.length - 1];
  }
  const realIp = headers.get("x-real-ip")?.trim();
  return realIp || null;
}
