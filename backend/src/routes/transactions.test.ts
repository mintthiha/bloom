import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../app";
import { INTERNAL_SECRET } from "../test-setup";

const { serviceMock, listServiceMock } = vi.hoisted(() => ({
  serviceMock: {
    searchTransactions: vi.fn(),
  },
  listServiceMock: {
    listTransactions: vi.fn(),
  },
}));

vi.mock("../services/transactionSearchService", () => serviceMock);
vi.mock("../services/transactionListService", () => listServiceMock);

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

/** Minimal paginated result shape returned by the list service. */
const LIST_RESULT_FIXTURE = {
  rows: [
    {
      id: "t-1",
      type: "WITHDRAWAL",
      amount: 42.5,
      effectiveAt: "2026-05-15T00:00:00.000Z",
      description: "Coffee",
      merchant: "Tim Hortons",
      category: "Dining",
      accountId: "a-1",
      accountName: "Chequing",
      accountNickname: null,
      accountType: "CHEQUING",
    },
  ],
  total: 1,
  page: 1,
  limit: 25,
  hasMore: false,
};

describe("transaction routes", () => {
  beforeEach(() => {
    serviceMock.searchTransactions.mockReset();
    listServiceMock.listTransactions.mockReset();
  });

  // -------------------------------------------------------------------------
  // GET /api/transactions/search
  // -------------------------------------------------------------------------

  describe("GET /api/transactions/search", () => {
    it("returns 401 when x-user-id header is missing", async () => {
      const response = await request(app)
        .get("/api/transactions/search?q=coffee")
        .set("X-Internal-Secret", INTERNAL_SECRET);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: "Unauthorized" });
    });

    it("returns an empty array without calling the service when q is absent", async () => {
      const response = await request(app)
        .get("/api/transactions/search")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .set("X-User-Id", "u-1");

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
      expect(serviceMock.searchTransactions).not.toHaveBeenCalled();
    });

    it("returns an empty array without calling the service when q is an empty string", async () => {
      const response = await request(app)
        .get("/api/transactions/search?q=")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .set("X-User-Id", "u-1");

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
      expect(serviceMock.searchTransactions).not.toHaveBeenCalled();
    });

    it("returns an empty array without calling the service when q is only whitespace", async () => {
      const response = await request(app)
        .get("/api/transactions/search?q=   ")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .set("X-User-Id", "u-1");

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
      expect(serviceMock.searchTransactions).not.toHaveBeenCalled();
    });

    it("delegates to the service and returns results for a non-empty query", async () => {
      serviceMock.searchTransactions.mockResolvedValue([TRANSACTION_FIXTURE]);

      const response = await request(app)
        .get("/api/transactions/search?q=coffee")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .set("X-User-Id", "u-1");

      expect(response.status).toBe(200);
      expect(serviceMock.searchTransactions).toHaveBeenCalledWith("u-1", "coffee", 20);
      expect(response.body[0]).toMatchObject({ description: "Coffee", amount: 42.5 });
    });

    it("passes the limit query parameter to the service when provided", async () => {
      serviceMock.searchTransactions.mockResolvedValue([]);

      await request(app)
        .get("/api/transactions/search?q=coffee&limit=5")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .set("X-User-Id", "u-1");

      expect(serviceMock.searchTransactions).toHaveBeenCalledWith("u-1", "coffee", 5);
    });

    it("defaults limit to 20 when the limit parameter is absent", async () => {
      serviceMock.searchTransactions.mockResolvedValue([]);

      await request(app)
        .get("/api/transactions/search?q=rent")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .set("X-User-Id", "u-1");

      expect(serviceMock.searchTransactions).toHaveBeenCalledWith("u-1", "rent", 20);
    });

    it("returns an empty array when the service finds no matches", async () => {
      serviceMock.searchTransactions.mockResolvedValue([]);

      const response = await request(app)
        .get("/api/transactions/search?q=zzznomatch")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .set("X-User-Id", "u-1");

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/transactions
  // -------------------------------------------------------------------------

  describe("GET /api/transactions", () => {
    it("returns 401 when x-user-id header is missing", async () => {
      const response = await request(app)
        .get("/api/transactions")
        .set("X-Internal-Secret", INTERNAL_SECRET);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: "Unauthorized" });
      expect(listServiceMock.listTransactions).not.toHaveBeenCalled();
    });

    it("delegates to the service with default paging and sort when no filters are given", async () => {
      listServiceMock.listTransactions.mockResolvedValue(LIST_RESULT_FIXTURE);

      const response = await request(app)
        .get("/api/transactions")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .set("X-User-Id", "u-1");

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ total: 1, page: 1, hasMore: false });
      expect(listServiceMock.listTransactions).toHaveBeenCalledWith("u-1", {
        accountId: undefined,
        type: undefined,
        category: undefined,
        search: undefined,
        start: undefined,
        end: undefined,
        sort: undefined,
        page: 1,
        limit: 25,
      });
    });

    it("passes every filter, sort, and paging parameter through to the service", async () => {
      listServiceMock.listTransactions.mockResolvedValue(LIST_RESULT_FIXTURE);

      await request(app)
        .get(
          "/api/transactions?account=a-1&type=DEPOSIT&category=Dining&search=coffee" +
            "&start=2026-05-01T00:00:00.000Z&end=2026-06-01T00:00:00.000Z" +
            "&sort=amount_desc&page=3&limit=10"
        )
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .set("X-User-Id", "u-1");

      expect(listServiceMock.listTransactions).toHaveBeenCalledWith("u-1", {
        accountId: "a-1",
        type: "DEPOSIT",
        category: "Dining",
        search: "coffee",
        start: new Date("2026-05-01T00:00:00.000Z"),
        end: new Date("2026-06-01T00:00:00.000Z"),
        sort: "amount_desc",
        page: 3,
        limit: 10,
      });
    });

    it("returns 400 for an invalid transaction type", async () => {
      const response = await request(app)
        .get("/api/transactions?type=NONSENSE")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .set("X-User-Id", "u-1");

      expect(response.status).toBe(400);
      expect(listServiceMock.listTransactions).not.toHaveBeenCalled();
    });

    it("returns 400 for an invalid sort key", async () => {
      const response = await request(app)
        .get("/api/transactions?sort=oldest")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .set("X-User-Id", "u-1");

      expect(response.status).toBe(400);
      expect(listServiceMock.listTransactions).not.toHaveBeenCalled();
    });

    it("falls back to default paging when page and limit are not positive integers", async () => {
      listServiceMock.listTransactions.mockResolvedValue(LIST_RESULT_FIXTURE);

      await request(app)
        .get("/api/transactions?page=0&limit=-5")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .set("X-User-Id", "u-1");

      expect(listServiceMock.listTransactions).toHaveBeenCalledWith(
        "u-1",
        expect.objectContaining({ page: 1, limit: 25 })
      );
    });
  });
});
