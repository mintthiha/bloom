import { afterEach, describe, expect, it, vi } from "vitest";
import {
  REMEMBER_COOKIE_NAME,
  buildRememberCookieOptions,
  readCookieValue,
  readIssuedRememberToken,
} from "./remember-cookie";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("buildRememberCookieOptions", () => {
  const expiresAt = new Date("2026-11-24T00:00:00.000Z");

  it("keeps the token away from page scripts and cross-site requests", () => {
    expect(buildRememberCookieOptions(expiresAt)).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/api",
      expires: expiresAt,
    });
  });

  it("requires https in production only", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(buildRememberCookieOptions(expiresAt).secure).toBe(true);

    vi.stubEnv("NODE_ENV", "development");
    expect(buildRememberCookieOptions(expiresAt).secure).toBe(false);
  });
});

describe("readCookieValue", () => {
  it("finds the named cookie among others", () => {
    expect(
      readCookieValue(`theme=dark; ${REMEMBER_COOKIE_NAME}=abc123; other=1`, REMEMBER_COOKIE_NAME)
    ).toBe("abc123");
  });

  it("decodes an encoded value", () => {
    expect(readCookieValue("name=a%20b", "name")).toBe("a b");
  });

  it("does not match a cookie whose name only contains the one asked for", () => {
    expect(readCookieValue("not_bloom_remember=abc", REMEMBER_COOKIE_NAME)).toBeNull();
  });

  it("returns null for a missing header, missing cookie, or empty value", () => {
    expect(readCookieValue(null, REMEMBER_COOKIE_NAME)).toBeNull();
    expect(readCookieValue(undefined, REMEMBER_COOKIE_NAME)).toBeNull();
    expect(readCookieValue("theme=dark", REMEMBER_COOKIE_NAME)).toBeNull();
    expect(readCookieValue(`${REMEMBER_COOKIE_NAME}=`, REMEMBER_COOKIE_NAME)).toBeNull();
  });

  it("returns null for a value that can't be decoded", () => {
    expect(readCookieValue("name=%E0%A4%A", "name")).toBeNull();
  });
});

describe("readIssuedRememberToken", () => {
  it("reads a valid issue reply", () => {
    expect(
      readIssuedRememberToken({
        id: "user-1",
        email: "jane@example.com",
        token: "raw-token",
        expiresAt: "2026-11-24T00:00:00.000Z",
      })
    ).toEqual({
      email: "jane@example.com",
      token: "raw-token",
      expiresAt: new Date("2026-11-24T00:00:00.000Z"),
    });
  });

  it.each([
    ["a missing token", { email: "jane@example.com", expiresAt: "2026-11-24T00:00:00.000Z" }],
    ["an empty token", { email: "j@x.ca", token: "", expiresAt: "2026-11-24T00:00:00.000Z" }],
    ["a missing email", { token: "t", expiresAt: "2026-11-24T00:00:00.000Z" }],
    ["an unparseable expiry", { email: "j@x.ca", token: "t", expiresAt: "soon" }],
    ["a non-string expiry", { email: "j@x.ca", token: "t", expiresAt: 1234 }],
    ["null", null],
  ])("returns null for %s", (_description, body) => {
    expect(readIssuedRememberToken(body)).toBeNull();
  });
});
