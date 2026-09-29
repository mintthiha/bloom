import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileFormPanel } from "./profile-form-panel";

const { useSessionMock, getProfileMock, saveProfileMock } = vi.hoisted(() => ({
  useSessionMock: vi.fn(),
  getProfileMock: vi.fn(),
  saveProfileMock: vi.fn(),
}));

vi.mock("next-auth/react", () => ({ useSession: useSessionMock }));

vi.mock("@/lib/api", () => ({
  api: { getProfile: getProfileMock, saveProfile: saveProfileMock },
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
  saveProfileMock.mockReset();
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

  it("saves the picked avatar colour with the rest of the profile", async () => {
    saveProfileMock.mockResolvedValue({
      firstName: "Jane",
      lastName: "Doe",
      username: "jane",
      email: "jane@example.com",
      province: null,
      avatarColor: "PINK",
    });

    render(<ProfileFormPanel {...PANEL_TEXT} />);
    await screen.findByLabelText("First Name");

    const avatarPicker = screen.getByRole("radiogroup", { name: "Avatar colour" });
    fireEvent.click(within(avatarPicker).getByRole("radio", { name: "Pink" }));
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() =>
      expect(saveProfileMock).toHaveBeenCalledWith(expect.objectContaining({ avatarColor: "PINK" }))
    );
  });

  it("preselects the saved avatar colour and can return to the automatic one", async () => {
    getProfileMock.mockResolvedValue({
      firstName: "Jane",
      lastName: "Doe",
      username: "jane",
      email: "jane@example.com",
      province: null,
      avatarColor: "GREEN",
      tfsaBirthYear: null,
      tfsaRoomUsedElsewhere: null,
      rrspContributionRoom: null,
    });
    saveProfileMock.mockResolvedValue({
      firstName: "Jane",
      lastName: "Doe",
      username: "jane",
      email: "jane@example.com",
      province: null,
      avatarColor: null,
    });

    render(<ProfileFormPanel {...PANEL_TEXT} />);
    await screen.findByLabelText("First Name");

    const avatarPicker = screen.getByRole("radiogroup", { name: "Avatar colour" });
    expect(within(avatarPicker).getByRole("radio", { name: "Green" })).toBeChecked();

    fireEvent.click(
      within(avatarPicker).getByRole("radio", { name: "Auto colour from your name" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() =>
      expect(saveProfileMock).toHaveBeenCalledWith(expect.objectContaining({ avatarColor: null }))
    );
  });
});
