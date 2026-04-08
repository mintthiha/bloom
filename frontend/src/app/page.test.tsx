import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "./page";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getProfile: vi.fn(),
    listAccounts: vi.fn(),
    getMonthlySummary: vi.fn(),
  },
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: {
      ...actual.api,
      getProfile: apiMock.getProfile,
      listAccounts: apiMock.listAccounts,
      getMonthlySummary: apiMock.getMonthlySummary,
    },
  };
});

vi.mock("@/components/profile-form-panel", () => ({
  ProfileFormPanel: ({ title }: { title: string }) => React.createElement("div", null, title),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: () => null }),
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn() },
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Cell: () => null,
}));

describe("home page", () => {
  beforeEach(() => {
    apiMock.getProfile.mockReset();
    apiMock.listAccounts.mockReset();
    apiMock.getMonthlySummary.mockReset();
    apiMock.listAccounts.mockResolvedValue([]);
    apiMock.getMonthlySummary.mockResolvedValue({
      month: "2026-04",
      income: 0,
      spending: 0,
      netCashFlow: 0,
      topExpenseCategory: null,
      categories: [],
    });
  });

  it("shows onboarding when the user has no saved profile", async () => {
    apiMock.getProfile.mockResolvedValue(null);

    render(<Page />);

    expect(await screen.findByText("Let's set up your account.")).toBeInTheDocument();
    expect(screen.getByText("Create your profile")).toBeInTheDocument();
  });

  it("shows the dashboard greeting when a profile exists", async () => {
    apiMock.getProfile.mockResolvedValue({
      userId: "user-1",
      firstName: "Jane",
      lastName: "Doe",
      username: "janedoe",
      email: "jane@example.com",
      createdAt: "2026-04-04T00:00:00.000Z",
      updatedAt: "2026-04-04T00:00:00.000Z",
    });

    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText("Good morning, Jane.")).toBeInTheDocument();
    });
  });

  it("shows the monthly snapshot when accounts and summary data exist", async () => {
    apiMock.getProfile.mockResolvedValue({
      userId: "user-1",
      firstName: "Jane",
      lastName: "Doe",
      username: "janedoe",
      email: "jane@example.com",
      createdAt: "2026-04-04T00:00:00.000Z",
      updatedAt: "2026-04-04T00:00:00.000Z",
    });
    apiMock.listAccounts.mockResolvedValue([
      {
        id: "account-1",
        ownerName: "Jane Doe",
        nickname: "Main",
        accountType: "CHEQUING",
        balance: 1200,
        frozen: false,
        createdAt: "2026-04-04T00:00:00.000Z",
        updatedAt: "2026-04-04T00:00:00.000Z",
      },
    ]);
    apiMock.getMonthlySummary.mockResolvedValue({
      month: "2026-04",
      income: 2500,
      spending: 400,
      netCashFlow: 2100,
      topExpenseCategory: "Groceries",
      categories: [{ category: "Groceries", income: 0, spending: 400 }],
    });

    render(<Page />);

    expect(await screen.findByText("Monthly Snapshot")).toBeInTheDocument();
    expect(screen.getByText("Groceries")).toBeInTheDocument();
    expect(screen.getByText("$400.00")).toBeInTheDocument();
  });
});
