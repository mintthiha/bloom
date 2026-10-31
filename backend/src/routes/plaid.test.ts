import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../app";
import { INTERNAL_SECRET } from "../test-setup";

const { serviceMock } = vi.hoisted(() => ({
  serviceMock: {
    createLinkToken: vi.fn(),
    exchangePublicToken: vi.fn(),
    syncAccountsAndTransactions: vi.fn(),
  },
}));

vi.mock("../services/plaidService", () => serviceMock);

/** Sends a POST to a /api/plaid path, as user-1 unless `userId` is null. */
function postPlaid(path: string, body?: object, userId: string | null = "user-1") {
  const pending = request(app).post(`/api/plaid${path}`).set("X-Internal-Secret", INTERNAL_SECRET);
  if (userId) pending.set("X-User-Id", userId);
  return body ? pending.send(body) : pending;
}

describe("plaid routes", () => {
  beforeEach(() => {
    serviceMock.createLinkToken.mockReset();
    serviceMock.exchangePublicToken.mockReset();
    serviceMock.syncAccountsAndTransactions.mockReset();
  });

  describe("POST /link-token", () => {
    it("returns a link token for the current user", async () => {
      serviceMock.createLinkToken.mockResolvedValue("link-sandbox-123");

      const response = await postPlaid("/link-token");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ linkToken: "link-sandbox-123" });
      expect(serviceMock.createLinkToken).toHaveBeenCalledWith("user-1");
    });

    it("returns 401 without a user", async () => {
      const response = await postPlaid("/link-token", undefined, null);

      expect(response.status).toBe(401);
      expect(serviceMock.createLinkToken).not.toHaveBeenCalled();
    });
  });

  describe("POST /exchange-token", () => {
    it("exchanges the public token for the current user and relays the result", async () => {
      serviceMock.exchangePublicToken.mockResolvedValue({ itemId: "item-1", accountsLinked: 2 });

      const response = await postPlaid("/exchange-token", {
        publicToken: "public-sandbox-abc",
        institutionName: "Tangerine",
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ itemId: "item-1", accountsLinked: 2 });
      expect(serviceMock.exchangePublicToken).toHaveBeenCalledWith(
        "public-sandbox-abc",
        "user-1",
        "Tangerine"
      );
    });

    it.each([
      ["a missing public token", { institutionName: "Tangerine" }],
      ["a missing institution name", { publicToken: "public-sandbox-abc" }],
      ["a non-string public token", { publicToken: 42, institutionName: "Tangerine" }],
      [
        "an institution name over 200 characters",
        { publicToken: "p", institutionName: "x".repeat(201) },
      ],
    ])("rejects %s before calling the service", async (_description, body) => {
      const response = await postPlaid("/exchange-token", body);

      expect(response.status).toBe(400);
      expect(serviceMock.exchangePublicToken).not.toHaveBeenCalled();
    });

    it("returns 401 without a user, even with a valid body", async () => {
      const response = await postPlaid(
        "/exchange-token",
        { publicToken: "public-sandbox-abc", institutionName: "Tangerine" },
        null
      );

      expect(response.status).toBe(401);
      expect(serviceMock.exchangePublicToken).not.toHaveBeenCalled();
    });
  });

  describe("POST /sync/:itemId", () => {
    it("re-syncs the item for the current user and reports the linked account count", async () => {
      serviceMock.syncAccountsAndTransactions.mockResolvedValue(3);

      const response = await postPlaid("/sync/item-1");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ accountsLinked: 3 });
      expect(serviceMock.syncAccountsAndTransactions).toHaveBeenCalledWith(
        "item-1",
        "user-1",
        true
      );
    });

    it("returns 401 without a user", async () => {
      const response = await postPlaid("/sync/item-1", undefined, null);

      expect(response.status).toBe(401);
      expect(serviceMock.syncAccountsAndTransactions).not.toHaveBeenCalled();
    });

    it("relays a service error, e.g. syncing another user's item", async () => {
      const { AppError } = await import("../middleware/errorHandler");
      serviceMock.syncAccountsAndTransactions.mockRejectedValue(
        new AppError(404, "Plaid item not found")
      );

      const response = await postPlaid("/sync/someone-elses-item");

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "Plaid item not found" });
    });
  });
});
