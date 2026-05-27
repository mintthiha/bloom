import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../app";

const { serviceMock } = vi.hoisted(() => ({
  serviceMock: {
    searchTransactions: vi.fn(),
  },
}));

vi.mock("../services/transactionSearchService", () => serviceMock);

/** Minimal transaction shape returned by the search service. */
const TRANSACTION_FIXTURE = {
  id: "t-1",
  accountId: "a-1",
  type: "WITHDRAWAL",
  amount: 42.5,
  description: "Coffee",
  category: "Dining",
  merchant: "Tim Hortons",
  date: "2026-05-15T00:00:00.000Z",
};

describe("transaction routes", () => {
  beforeEach(() => {
    serviceMock.searchTransactions.mockReset();
  });

  // -------------------------------------------------------------------------
  // GET /api/transactions/search
  // -------------------------------------------------------------------------

  describe("GET /api/transactions/search", () => {
    it("returns 401 when x-user-id header is missing", async () => {
      const response = await request(app).get("/api/transactions/search?q=coffee");

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: "Unauthorized" });
    });

    it("returns an empty array without calling the service when q is absent", async () => {
      const response = await request(app)
        .get("/api/transactions/search")
        .set("X-User-Id", "u-1");

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
      expect(serviceMock.searchTransactions).not.toHaveBeenCalled();
    });

    it("returns an empty array without calling the service when q is an empty string", async () => {
      const response = await request(app)
        .get("/api/transactions/search?q=")
        .set("X-User-Id", "u-1");

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
      expect(serviceMock.searchTransactions).not.toHaveBeenCalled();
    });

    it("returns an empty array without calling the service when q is only whitespace", async () => {
      const response = await request(app)
        .get("/api/transactions/search?q=   ")
        .set("X-User-Id", "u-1");

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
      expect(serviceMock.searchTransactions).not.toHaveBeenCalled();
    });

    it("delegates to the service and returns results for a non-empty query", async () => {
      serviceMock.searchTransactions.mockResolvedValue([TRANSACTION_FIXTURE]);

      const response = await request(app)
        .get("/api/transactions/search?q=coffee")
        .set("X-User-Id", "u-1");

      expect(response.status).toBe(200);
      expect(serviceMock.searchTransactions).toHaveBeenCalledWith("u-1", "coffee", 20);
      expect(response.body[0]).toMatchObject({ description: "Coffee", amount: 42.5 });
    });

    it("passes the limit query parameter to the service when provided", async () => {
      serviceMock.searchTransactions.mockResolvedValue([]);

      await request(app)
        .get("/api/transactions/search?q=coffee&limit=5")
        .set("X-User-Id", "u-1");

      expect(serviceMock.searchTransactions).toHaveBeenCalledWith("u-1", "coffee", 5);
    });

    it("defaults limit to 20 when the limit parameter is absent", async () => {
      serviceMock.searchTransactions.mockResolvedValue([]);

      await request(app)
        .get("/api/transactions/search?q=rent")
        .set("X-User-Id", "u-1");

      expect(serviceMock.searchTransactions).toHaveBeenCalledWith("u-1", "rent", 20);
    });

    it("returns an empty array when the service finds no matches", async () => {
      serviceMock.searchTransactions.mockResolvedValue([]);

      const response = await request(app)
        .get("/api/transactions/search?q=zzznomatch")
        .set("X-User-Id", "u-1");

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });
});
