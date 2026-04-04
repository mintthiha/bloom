import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "./page";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getProfile: vi.fn(),
    listAccounts: vi.fn(),
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
    apiMock.listAccounts.mockResolvedValue([]);
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
});
