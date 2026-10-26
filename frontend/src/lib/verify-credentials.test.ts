import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BACKEND_UNAVAILABLE_SIGN_IN_CODE, TOO_MANY_SIGN_IN_ATTEMPTS_CODE } from "./backend-errors";
import {
  BackendUnavailableSignInError,
  TooManySignInAttemptsError,
  verifyCredentials,
} from "./verify-credentials";

// next-auth's entry imports next/server, which only resolves inside Next; it re-exports this real class.
vi.mock("next-auth", async () => {
  const { CredentialsSignin } = await import("@auth/core/errors");
  return { CredentialsSignin };
});

const fetchMock = vi.fn();

/** Builds a backend reply with a JSON body. */
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("INTERNAL_API_SECRET", "test-secret");
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("verifyCredentials", () => {
  it("verifies email + password and names the user after their email's local part", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "user-1", email: "sam.lee@example.ca" }));

    const user = await verifyCredentials({ email: "sam.lee@example.ca", password: "secret123" });

    expect(user).toEqual({ id: "user-1", email: "sam.lee@example.ca", name: "sam.lee" });
    const [url, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:3001/api/credentials-auth/verify");
    expect((requestInit.headers as Record<string, string>)["X-Internal-Secret"]).toBe(
      "test-secret"
    );
    expect(JSON.parse(requestInit.body as string)).toEqual({
      email: "sam.lee@example.ca",
      password: "secret123",
    });
  });

  it("verifies a remember-me token instead of a password when one is given", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "user-1", email: "sam@example.ca" }));

    const user = await verifyCredentials({ rememberToken: "remember-token" });

    expect(user?.id).toBe("user-1");
    const [url, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:3001/api/credentials-auth/remember/verify");
    expect(JSON.parse(requestInit.body as string)).toEqual({ token: "remember-token" });
  });

  it.each([
    ["no credentials", undefined],
    ["a missing password", { email: "sam@example.ca" }],
    ["a missing email", { password: "secret123" }],
    ["an empty password", { email: "sam@example.ca", password: "" }],
  ])("returns null without calling the backend for %s", async (_description, credentials) => {
    await expect(verifyCredentials(credentials)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([401, 404])("returns null when the backend rejects with %i", async (status) => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "Invalid credentials" }, status));

    await expect(
      verifyCredentials({ email: "sam@example.ca", password: "wrong" })
    ).resolves.toBeNull();
  });

  it("returns null when a successful reply lacks the user's id or email", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "user-1" }));

    await expect(verifyCredentials({ rememberToken: "remember-token" })).resolves.toBeNull();
  });

  it("returns null when a successful reply is not JSON", async () => {
    fetchMock.mockResolvedValue(new Response("<html></html>", { status: 200 }));

    await expect(verifyCredentials({ rememberToken: "remember-token" })).resolves.toBeNull();
  });

  it("throws a backend-unavailable sign-in error when the backend can't be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    const verification = verifyCredentials({ email: "sam@example.ca", password: "secret123" });

    await expect(verification).rejects.toBeInstanceOf(BackendUnavailableSignInError);
    await expect(verification).rejects.toMatchObject({ code: BACKEND_UNAVAILABLE_SIGN_IN_CODE });
  });

  it.each([500, 502, 503])(
    "throws a backend-unavailable sign-in error for a %i",
    async (status) => {
      fetchMock.mockResolvedValue(new Response("<h1>Bad Gateway</h1>", { status }));

      await expect(verifyCredentials({ rememberToken: "remember-token" })).rejects.toBeInstanceOf(
        BackendUnavailableSignInError
      );
    }
  );

  it("throws a too-many-attempts sign-in error when the email is locked out", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "Too many sign-in attempts." }, 429));

    const verification = verifyCredentials({ email: "sam@example.ca", password: "secret123" });

    await expect(verification).rejects.toBeInstanceOf(TooManySignInAttemptsError);
    await expect(verification).rejects.toMatchObject({ code: TOO_MANY_SIGN_IN_ATTEMPTS_CODE });
  });

  describe("saved sign-in cookie", () => {
    /** Builds the sign-in request NextAuth hands to authorize, carrying the given cookies. */
    function requestWithCookies(cookieHeader: string) {
      return new Request("http://localhost/api/auth/callback/credentials", {
        method: "POST",
        headers: { cookie: cookieHeader },
      });
    }

    it("verifies the token from the httpOnly cookie", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ id: "user-1", email: "sam@example.ca" }));

      const user = await verifyCredentials(
        { useSavedSignIn: "true" },
        requestWithCookies("theme=dark; bloom_remember=cookie-token")
      );

      expect(user?.id).toBe("user-1");
      const [url, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("http://localhost:3001/api/credentials-auth/remember/verify");
      expect(JSON.parse(requestInit.body as string)).toEqual({ token: "cookie-token" });
    });

    it("returns null without calling the backend when there is no cookie", async () => {
      await expect(
        verifyCredentials({ useSavedSignIn: "true" }, requestWithCookies("theme=dark"))
      ).resolves.toBeNull();
      await expect(verifyCredentials({ useSavedSignIn: "true" })).resolves.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("ignores the cookie unless the saved sign-in was asked for", async () => {
      await expect(
        verifyCredentials({}, requestWithCookies("bloom_remember=cookie-token"))
      ).resolves.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
