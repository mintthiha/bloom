import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";
import {
  GENERIC_FAILURE_MESSAGE,
  NETWORK_ERROR_MESSAGE,
  SERVER_UNAVAILABLE_MESSAGE,
} from "./backend-errors";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api request handling", () => {
  it("calls the proxy and returns the parsed JSON body", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([{ id: "account-1" }]), { status: 200 })
    );

    await expect(api.listAccounts()).resolves.toEqual([{ id: "account-1" }]);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/bloom/accounts");
  });

  it("resolves with undefined for a 204 response", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(api.deleteAccount("account-1")).resolves.toBeUndefined();
  });

  it("throws the server's error message for a JSON error response", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "Account is frozen" }), { status: 400 })
    );

    await expect(api.listAccounts()).rejects.toThrow("Account is frozen");
  });

  it("throws a clean unavailable message instead of a JSON parse error for an HTML 502 page", async () => {
    fetchMock.mockResolvedValue(
      new Response("<!DOCTYPE html><h1>502 Bad Gateway</h1>", {
        status: 502,
        headers: { "Content-Type": "text/html" },
      })
    );

    await expect(api.listAccounts()).rejects.toThrow(SERVER_UNAVAILABLE_MESSAGE);
  });

  it("throws a generic message for a non-JSON error with a non-gateway status", async () => {
    fetchMock.mockResolvedValue(new Response("<h1>Not Found</h1>", { status: 404 }));

    await expect(api.listAccounts()).rejects.toThrow(GENERIC_FAILURE_MESSAGE);
  });

  it("throws a generic message when a successful response is not JSON", async () => {
    fetchMock.mockResolvedValue(new Response("<html></html>", { status: 200 }));

    await expect(api.listAccounts()).rejects.toThrow(GENERIC_FAILURE_MESSAGE);
  });

  it("throws a connection message when the network request itself fails", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(api.listAccounts()).rejects.toThrow(NETWORK_ERROR_MESSAGE);
  });
});
