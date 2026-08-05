import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockBloomApi } from "./mock-api";

/** WCAG 2.0/2.1 A and AA rule sets — the conformance level PRODUCT.md targets. */
const WCAG_AA_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/** Authenticated pages to scan. `/profile` renders the labelled profile form. */
const AUTHENTICATED_PATHS = ["/", "/transactions", "/budgets", "/goals", "/profile"];

/** Runs axe against the current page and returns only the serious/critical violations. */
async function seriousViolations(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_AA_TAGS).analyze();
  return results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
}

/** Compact, readable summary of any violations so failures point straight at the offending rule. */
function summarize(violations: Awaited<ReturnType<typeof seriousViolations>>) {
  return JSON.stringify(
    violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })),
    null,
    2
  );
}

for (const path of AUTHENTICATED_PATHS) {
  test(`no serious/critical a11y violations on ${path}`, async ({ page }) => {
    await mockBloomApi(page);
    await page.goto(path);
    await page.waitForLoadState("networkidle");

    const violations = await seriousViolations(page);
    expect(violations, summarize(violations)).toEqual([]);
  });
}

test.describe("unauthenticated", () => {
  // The login page must be scanned without a session cookie, or the middleware redirects away.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("no serious/critical a11y violations on /login", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    const violations = await seriousViolations(page);
    expect(violations, summarize(violations)).toEqual([]);
  });
});
