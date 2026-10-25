import { describe, expect, it } from "vitest";
import {
  GENERIC_FAILURE_MESSAGE,
  SERVER_UNAVAILABLE_MESSAGE,
  getFailedRequestMessage,
  isServerUnavailableStatus,
  parseJsonOrNull,
} from "./backend-errors";

describe("isServerUnavailableStatus", () => {
  it.each([502, 503, 504])("treats %i as the server being unavailable", (status) => {
    expect(isServerUnavailableStatus(status)).toBe(true);
  });

  it.each([200, 400, 401, 404, 500, 501, 505])("does not treat %i as unavailable", (status) => {
    expect(isServerUnavailableStatus(status)).toBe(false);
  });
});

describe("parseJsonOrNull", () => {
  it("parses a JSON object", () => {
    expect(parseJsonOrNull('{"id":"account-1"}')).toEqual({ id: "account-1" });
  });

  it("parses JSON primitives and arrays", () => {
    expect(parseJsonOrNull("[1,2]")).toEqual([1, 2]);
    expect(parseJsonOrNull("0")).toBe(0);
  });

  it("returns null for an empty or whitespace-only body", () => {
    expect(parseJsonOrNull("")).toBeNull();
    expect(parseJsonOrNull("  \n")).toBeNull();
  });

  it("returns null for an HTML error page instead of throwing", () => {
    expect(parseJsonOrNull("<!DOCTYPE html><h1>502 Bad Gateway</h1>")).toBeNull();
  });
});

describe("getFailedRequestMessage", () => {
  it("uses the server's error message when the body has one", () => {
    expect(getFailedRequestMessage(400, { error: "Amount must be positive" })).toBe(
      "Amount must be positive"
    );
  });

  it("prefers the server's error message even on a gateway status", () => {
    expect(getFailedRequestMessage(503, { error: "Maintenance in progress" })).toBe(
      "Maintenance in progress"
    );
  });

  it("explains the server is unavailable for a gateway status without a message", () => {
    expect(getFailedRequestMessage(502, null)).toBe(SERVER_UNAVAILABLE_MESSAGE);
    expect(getFailedRequestMessage(504, { error: "" })).toBe(SERVER_UNAVAILABLE_MESSAGE);
  });

  it("falls back to a generic message for other statuses without a usable error", () => {
    expect(getFailedRequestMessage(500, null)).toBe(GENERIC_FAILURE_MESSAGE);
    expect(getFailedRequestMessage(404, { error: 42 })).toBe(GENERIC_FAILURE_MESSAGE);
    expect(getFailedRequestMessage(400, { message: "wrong field" })).toBe(GENERIC_FAILURE_MESSAGE);
    expect(getFailedRequestMessage(400, "plain string body")).toBe(GENERIC_FAILURE_MESSAGE);
  });
});
