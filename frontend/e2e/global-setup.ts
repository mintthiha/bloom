import { encode } from "next-auth/jwt";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Cookie NextAuth uses for the JWT session over http (the `__Secure-` prefix is https-only). */
const COOKIE_NAME = "authjs.session-token";

/**
 * Mints a NextAuth session cookie signed with the E2E secret and writes it to a Playwright
 * storageState file, so every test starts already authenticated as a fixed test user. This mirrors
 * exactly what NextAuth would produce after a real login, without invoking the Google provider.
 */
async function globalSetup(): Promise<void> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET must be set for the E2E run");

  const token = await encode({
    salt: COOKIE_NAME,
    secret,
    maxAge: 60 * 60,
    token: { sub: "e2e-user", name: "E2E Tester", email: "e2e@bloom.test" },
  });

  const state = {
    cookies: [
      {
        name: COOKIE_NAME,
        value: token,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax" as const,
        expires: Math.floor(Date.now() / 1000) + 60 * 60,
      },
    ],
    origins: [],
  };

  const dir = join(process.cwd(), "e2e", ".auth");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "state.json"), JSON.stringify(state, null, 2));
}

export default globalSetup;
