import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppSidebar } from "./app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

const { apiMock, useSessionMock, pathnameMock } = vi.hoisted(() => ({
  apiMock: { listRecurringTransactions: vi.fn() },
  useSessionMock: vi.fn(),
  pathnameMock: vi.fn(),
}));

vi.mock("next-auth/react", () => ({ useSession: useSessionMock }));

vi.mock("next/navigation", () => ({ usePathname: pathnameMock }));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: { ...actual.api, listRecurringTransactions: apiMock.listRecurringTransactions },
  };
});

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

/** Renders the sidebar inside the provider it depends on, at the given pathname. */
function renderSidebar(pathname = "/") {
  pathnameMock.mockReturnValue(pathname);
  return render(
    <SidebarProvider>
      <AppSidebar />
    </SidebarProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useSessionMock.mockReturnValue({ data: { user: { id: "u-1" } } });
  apiMock.listRecurringTransactions.mockResolvedValue([]);
});

describe("AppSidebar", () => {
  it("renders every primary navigation destination with the right href", () => {
    renderSidebar();

    const expected: [string, string][] = [
      ["Overview", "/"],
      ["Accounts", "/accounts"],
      ["Transactions", "/transactions"],
      ["Subscriptions", "/subscriptions"],
      ["Budgets", "/budgets"],
      ["Goals", "/goals"],
      ["Learn", "/learn"],
      ["Auto-categorize", "/auto-categorize"],
    ];
    for (const [label, href] of expected) {
      expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", href);
    }
  });

  it("links the brand mark back to the dashboard", () => {
    renderSidebar();
    expect(screen.getByRole("link", { name: "Bloom home" })).toHaveAttribute("href", "/");
  });

  it("loads the due-recurring count when signed in", async () => {
    apiMock.listRecurringTransactions.mockResolvedValue([
      { active: true, nextRunAt: "2020-01-01T00:00:00.000Z" },
    ]);
    renderSidebar("/budgets");

    await waitFor(() => expect(apiMock.listRecurringTransactions).toHaveBeenCalled());
  });

  it("does not query recurring rules when signed out", () => {
    useSessionMock.mockReturnValue({ data: null });
    renderSidebar();
    expect(apiMock.listRecurringTransactions).not.toHaveBeenCalled();
  });
});
