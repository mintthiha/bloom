import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./page";

const { signInMock } = vi.hoisted(() => ({ signInMock: vi.fn() }));

vi.mock("next-auth/react", () => ({ signIn: signInMock }));

beforeEach(() => {
  signInMock.mockReset();
  vi.stubGlobal("fetch", vi.fn());
  // Force reduced-motion so the orb physics effect returns before starting the rAF loop,
  // which jsdom does not run — keeps the render deterministic.
  window.matchMedia = vi.fn().mockReturnValue({
    matches: true,
    media: "(prefers-reduced-motion: reduce)",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: () => false,
  }) as unknown as typeof window.matchMedia;
});

describe("LoginPage", () => {
  it("renders the welcome heading and Google sign-in call to action", () => {
    render(<LoginPage />);

    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByText("Sign in to access your accounts.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument();
  });

  it("renders the showcase value propositions and account tags", () => {
    render(<LoginPage />);

    expect(screen.getByText("Net worth at a glance")).toBeInTheDocument();
    expect(screen.getByText("Budgets you can trust")).toBeInTheDocument();
    expect(screen.getByText("Every account, unified")).toBeInTheDocument();

    for (const tag of ["Chequing", "Savings", "TFSA", "RRSP", "FHSA", "Credit"]) {
      expect(screen.getByText(tag)).toBeInTheDocument();
    }
  });

  it("calls signIn with Google and a callback to the dashboard when clicked", () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));

    expect(signInMock).toHaveBeenCalledWith("google", { callbackUrl: "/" });
  });

  it("provisions a demo account and signs in with the returned remember token", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: "demo-token", expiresAt: "2026-01-01" }),
    } as Response);
    signInMock.mockResolvedValueOnce({ url: "/" });

    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: /try bloom without signing in/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/demo", { method: "POST" }));
    expect(signInMock).toHaveBeenCalledWith("credentials", {
      rememberToken: "demo-token",
      callbackUrl: "/",
      redirect: false,
    });
  });

  it("shows an error when demo provisioning fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, json: async () => ({}) } as Response);

    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: /try bloom without signing in/i }));

    expect(
      await screen.findByText("Couldn't start the demo right now. Please try again.")
    ).toBeInTheDocument();
    expect(signInMock).not.toHaveBeenCalled();
  });
});
