import { describe, expect, it } from "vitest";
import { parseSavedAccount } from "./saved-account";

describe("parseSavedAccount", () => {
  it("reads the saved email", () => {
    expect(parseSavedAccount('{"email":"jane@example.com"}')).toEqual({
      email: "jane@example.com",
    });
  });

  it("drops the raw token from an entry saved before the cookie existed", () => {
    expect(parseSavedAccount('{"token":"legacy-token","email":"jane@example.com"}')).toEqual({
      email: "jane@example.com",
    });
  });

  it.each([
    ["nothing stored", null],
    ["an empty string", ""],
    ["malformed JSON", "{oops"],
    ["a JSON string", '"jane@example.com"'],
    ["a missing email", '{"token":"t"}'],
    ["a blank email", '{"email":"  "}'],
    ["a non-string email", '{"email":42}'],
  ])("returns null for %s", (_description, storedValue) => {
    expect(parseSavedAccount(storedValue)).toBeNull();
  });
});
