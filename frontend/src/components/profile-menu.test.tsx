import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileMenu } from "./profile-menu";

const { apiMock, useSessionMock, signOutMock } = vi.hoisted(() => ({
  apiMock: { getProfile: vi.fn() },
  useSessionMock: vi.fn(),
  signOutMock: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  useSession: useSessionMock,
  signOut: signOutMock,
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { ...actual.api, getProfile: apiMock.getProfile } };
});

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

/** A signed-in session fixture. */
function session() {
  return { data: { user: { id: "u-1", email: "ada@bloom.test", image: null } } };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProfileMenu", () => {
  it("renders nothing when there is no session", () => {
    useSessionMock.mockReturnValue({ data: null });
    const { container } = render(<ProfileMenu />);
    expect(container).toBeEmptyDOMElement();
  });

  it("keeps the menu closed until the avatar button is clicked", () => {
    useSessionMock.mockReturnValue(session());
    apiMock.getProfile.mockResolvedValue(null);

    render(<ProfileMenu />);

    expect(screen.getByRole("button", { name: "Account menu" })).toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("shows the loaded profile name and handle when opened", async () => {
    useSessionMock.mockReturnValue(session());
    apiMock.getProfile.mockResolvedValue({
      firstName: "Ada",
      lastName: "Lovelace",
      username: "ada",
    });

    render(<ProfileMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("@ada")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Profile" })).toBeInTheDocument();
  });

  it("falls back to a default label and the session email when there is no profile", async () => {
    useSessionMock.mockReturnValue(session());
    apiMock.getProfile.mockResolvedValue(null);

    render(<ProfileMenu />);
    await waitFor(() => expect(apiMock.getProfile).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));

    expect(screen.getByText("Your profile")).toBeInTheDocument();
    expect(screen.getByText("ada@bloom.test")).toBeInTheDocument();
  });

  it("signs out with a redirect to /login", async () => {
    useSessionMock.mockReturnValue(session());
    apiMock.getProfile.mockResolvedValue(null);

    render(<ProfileMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Sign out" }));

    expect(signOutMock).toHaveBeenCalledWith({ callbackUrl: "/login" });
  });
});
