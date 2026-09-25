import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileFormPanel } from "./profile-form-panel";

const { useSessionMock, getProfileMock } = vi.hoisted(() => ({
  useSessionMock: vi.fn(),
  getProfileMock: vi.fn(),
}));

vi.mock("next-auth/react", () => ({ useSession: useSessionMock }));

vi.mock("@/lib/api", () => ({
  api: { getProfile: getProfileMock, saveProfile: vi.fn() },
}));

vi.mock("@/components/dashboard-visibility-provider", () => ({
  useDashboardVisibility: () => ({ allCollapsed: false }),
}));

const PANEL_TEXT = {
  title: "Who you are",
  description: "Your name and email.",
  submitLabel: "Save profile",
};

beforeEach(() => {
  useSessionMock.mockReturnValue({
    data: { user: { name: "Jane Doe", email: "jane@example.com" } },
    status: "authenticated",
  });
  getProfileMock.mockResolvedValue(null);
});

describe("ProfileFormPanel", () => {
  it("renders the form fields once loaded", async () => {
    render(<ProfileFormPanel {...PANEL_TEXT} />);

    expect(await screen.findByLabelText("First Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Province or Territory")).toBeInTheDocument();
  });

  // Onboarding shows this form as a required first step, so it must not offer a way to
  // collapse itself out of sight. Only the profile page opts into the collapsible shell.
  it("has no collapse control by default", async () => {
    render(<ProfileFormPanel {...PANEL_TEXT} />);

    await screen.findByLabelText("First Name");
    expect(screen.queryByRole("button", { name: /collapse|expand/i })).not.toBeInTheDocument();
  });

  it("renders a collapsible shell when asked, with the eyebrow label", async () => {
    render(<ProfileFormPanel {...PANEL_TEXT} collapsible eyebrow="Profile Details" />);

    await screen.findByLabelText("First Name");
    expect(screen.getByText("Profile Details")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /collapse|expand/i })).toBeInTheDocument();
  });
});
