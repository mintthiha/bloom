import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BACKEND_UNAVAILABLE_SIGN_IN_CODE, SERVER_UNAVAILABLE_MESSAGE } from "@/lib/backend-errors";
import LoginPage from "./page";

const { signInMock } = vi.hoisted(() => ({ signInMock: vi.fn() }));

vi.mock("next-auth/react", () => ({ signIn: signInMock }));

beforeEach(() => {
  signInMock.mockReset();
  localStorage.clear();
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

  it("says the server is unavailable when demo provisioning hits a gateway error", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 503 } as Response);

    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: /try bloom without signing in/i }));

    expect(await screen.findByText(SERVER_UNAVAILABLE_MESSAGE)).toBeInTheDocument();
  });

  describe("email sign-in", () => {
    /** Fills in the email form and submits it. */
    function submitEmailSignIn({ shouldRemember = false } = {}) {
      fireEvent.change(screen.getByPlaceholderText("Email"), {
        target: { value: "sam@example.ca" },
      });
      fireEvent.change(screen.getByPlaceholderText("Password"), {
        target: { value: "secret123" },
      });
      if (shouldRemember) fireEvent.click(screen.getByLabelText("Remember me for 30 days"));
      fireEvent.click(screen.getByRole("button", { name: "Sign in with email" }));
    }

    it("says the credentials are wrong when sign-in is rejected", async () => {
      signInMock.mockResolvedValueOnce({ error: "CredentialsSignin", code: "credentials" });

      render(<LoginPage />);
      submitEmailSignIn();

      expect(
        await screen.findByText("Invalid email or password. Please try again.")
      ).toBeInTheDocument();
    });

    it("says the server is unavailable instead of blaming the password when the backend is down", async () => {
      signInMock.mockResolvedValueOnce({
        error: "CredentialsSignin",
        code: BACKEND_UNAVAILABLE_SIGN_IN_CODE,
      });

      render(<LoginPage />);
      submitEmailSignIn();

      expect(await screen.findByText(SERVER_UNAVAILABLE_MESSAGE)).toBeInTheDocument();
      expect(screen.queryByText(/invalid email or password/i)).not.toBeInTheDocument();
    });

    it("saves the remember-me token after a successful sign-in", async () => {
      signInMock.mockResolvedValueOnce({});
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: "remember-token" }),
      } as Response);

      render(<LoginPage />);
      submitEmailSignIn({ shouldRemember: true });

      await waitFor(() =>
        expect(JSON.parse(localStorage.getItem("bloom_saved_account") ?? "null")).toEqual({
          token: "remember-token",
          email: "sam@example.ca",
        })
      );
    });

    it("does not show an error when remembering the account fails after sign-in succeeded", async () => {
      signInMock.mockResolvedValueOnce({});
      vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Failed to fetch"));

      render(<LoginPage />);
      submitEmailSignIn({ shouldRemember: true });

      await waitFor(() =>
        expect(fetch).toHaveBeenCalledWith("/api/remember-issue", expect.anything())
      );
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Sign in with email" })).toBeEnabled()
      );
      expect(screen.queryByText("Something went wrong. Please try again.")).not.toBeInTheDocument();
    });
  });

  describe("saved account sign-in", () => {
    const savedAccount = { token: "remember-token", email: "saved@example.ca" };

    beforeEach(() => {
      localStorage.setItem("bloom_saved_account", JSON.stringify(savedAccount));
    });

    it("forgets the saved account when its token has expired", async () => {
      signInMock.mockResolvedValueOnce({ error: "CredentialsSignin", code: "credentials" });

      render(<LoginPage />);
      fireEvent.click(await screen.findByRole("button", { name: /saved@example\.ca/ }));

      expect(
        await screen.findByText("Your saved sign-in has expired. Please sign in again.")
      ).toBeInTheDocument();
      expect(localStorage.getItem("bloom_saved_account")).toBeNull();
    });

    it("keeps the saved account when the backend is down so the user can retry", async () => {
      signInMock.mockResolvedValueOnce({
        error: "CredentialsSignin",
        code: BACKEND_UNAVAILABLE_SIGN_IN_CODE,
      });

      render(<LoginPage />);
      fireEvent.click(await screen.findByRole("button", { name: /saved@example\.ca/ }));

      expect(await screen.findByText(SERVER_UNAVAILABLE_MESSAGE)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /saved@example\.ca/ })).toBeInTheDocument();
      expect(JSON.parse(localStorage.getItem("bloom_saved_account") ?? "null")).toEqual(
        savedAccount
      );
    });
  });
});
