import { describe, expect, it } from "vitest";
import { readClientIp } from "./read-client-ip";

describe("readClientIp", () => {
  it("takes the rightmost X-Forwarded-For entry, the one the trusted proxy appended", () => {
    const headers = new Headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.7" });
    expect(readClientIp(headers)).toBe("203.0.113.7");
  });

  it("reads a single forwarded address", () => {
    expect(readClientIp(new Headers({ "x-forwarded-for": " 203.0.113.7 " }))).toBe("203.0.113.7");
  });

  it("ignores empty entries", () => {
    expect(readClientIp(new Headers({ "x-forwarded-for": "203.0.113.7, " }))).toBe("203.0.113.7");
  });

  it("falls back to X-Real-IP", () => {
    expect(readClientIp(new Headers({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
  });

  it("returns null when no proxy header is present", () => {
    expect(readClientIp(new Headers())).toBeNull();
    expect(readClientIp(new Headers({ "x-forwarded-for": " , " }))).toBeNull();
  });
});
