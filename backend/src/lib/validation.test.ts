import { describe, expect, it } from "vitest";
import { optionalString, requireString } from "./validation";

describe("validation sanitization", () => {
  it("normalizes whitespace and strips control characters for required strings", () => {
    const value = requireString("  Jane\t\n\u0000Doe  ", "firstName");

    expect(value).toBe("Jane Doe");
  });

  it("normalizes whitespace and strips control characters for optional strings", () => {
    const value = optionalString("  Main\u0000 \n Account  ", "nickname");

    expect(value).toBe("Main Account");
  });

  it("returns undefined for optional strings that become empty after sanitization", () => {
    const value = optionalString(" \u0000 \n ", "description");

    expect(value).toBeUndefined();
  });
});
