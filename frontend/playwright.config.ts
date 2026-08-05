import { defineConfig, devices } from "@playwright/test";

/**
 * A fixed secret used only for the E2E run. `global-setup.ts` signs a session cookie with it and
 * the dev server (below) validates that cookie with the same value — this lets the accessibility
 * suite reach authenticated pages without going through real Google OAuth, and it never touches the
 * production auth configuration.
 */
const E2E_AUTH_SECRET = "e2e-only-secret-e2e-only-secret-0123456789";
process.env.AUTH_SECRET = E2E_AUTH_SECRET;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    storageState: "./e2e/.auth/state.json",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // A dedicated port and never reusing an existing server: the forged session cookie only
    // validates against a server started with E2E_AUTH_SECRET, so we must not pick up a stray
    // `npm run dev` on 3000 that uses the real secret (that silently breaks auth).
    command: "npx next dev -p 3100",
    url: "http://localhost:3100/login",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      AUTH_SECRET: E2E_AUTH_SECRET,
      AUTH_URL: "http://localhost:3100",
      AUTH_GOOGLE_ID: "e2e-google-id",
      AUTH_GOOGLE_SECRET: "e2e-google-secret",
      INTERNAL_API_SECRET: "e2e-internal-secret",
      NEXT_PUBLIC_API_URL: "http://localhost:3999",
    },
  },
});
