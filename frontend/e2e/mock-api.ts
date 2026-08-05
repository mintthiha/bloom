import type { Page } from "@playwright/test";

/**
 * Returns a correctly-shaped, empty/minimal body for a given backend path. Object-returning
 * endpoints get a valid empty object so pages render their empty states instead of crashing;
 * everything else defaults to an empty collection.
 */
function bodyForPath(path: string): unknown {
  if (path.startsWith("/accounts/summary/monthly")) {
    return {
      month: "2026-08",
      income: 0,
      spending: 0,
      netCashFlow: 0,
      topExpenseCategory: null,
      categories: [],
    };
  }
  if (path === "/subscriptions") {
    return { monthlyTotal: 0, annualTotal: 0, count: 0, subscriptions: [] };
  }
  if (path === "/notifications") {
    return { notifications: [], unreadCount: 0 };
  }
  if (path === "/profile") {
    return {
      userId: "e2e-user",
      firstName: "E2E",
      lastName: "Tester",
      username: "e2e_tester",
      email: "e2e@bloom.test",
      tfsaBirthYear: null,
      tfsaRoomUsedElsewhere: null,
      rrspContributionRoom: null,
      // Enabled so the reminder controls render active; a disabled section is dimmed and is
      // WCAG-exempt from contrast (1.4.3), which axe would otherwise flag as a false positive.
      billRemindersEnabled: true,
      billReminderLeadDays: 3,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
  }
  return [];
}

/**
 * Intercepts every same-origin `/api/bloom/*` call in the browser and fulfills it with a stub,
 * so the accessibility suite renders real authenticated pages without a running backend or database.
 */
export async function mockBloomApi(page: Page): Promise<void> {
  await page.route("**/api/bloom/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api\/bloom/, "");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(bodyForPath(path)),
    });
  });
}
