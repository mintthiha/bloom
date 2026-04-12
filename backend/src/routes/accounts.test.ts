import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../app";

const { serviceMock } = vi.hoisted(() => ({
  serviceMock: {
    getMonthlySummary: vi.fn(),
    createAccount: vi.fn(),
    getAccount: vi.fn(),
    deposit: vi.fn(),
    getTransactions: vi.fn(),
    updateTransaction: vi.fn(),
    deleteTransaction: vi.fn(),
  },
}));

vi.mock("../services/accountService", () => serviceMock);

describe("account routes", () => {
  beforeEach(() => {
    serviceMock.getMonthlySummary.mockReset();
    serviceMock.createAccount.mockReset();
    serviceMock.getAccount.mockReset();
    serviceMock.deposit.mockReset();
    serviceMock.getTransactions.mockReset();
    serviceMock.updateTransaction.mockReset();
    serviceMock.deleteTransaction.mockReset();
  });

  it("returns 401 for monthly summary when x-user-id is missing", async () => {
    const response = await request(app).get("/api/accounts/summary/monthly");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Unauthorized" });
  });

  it("returns the monthly summary for the current user", async () => {
    serviceMock.getMonthlySummary.mockResolvedValue({
      month: "2026-04",
      income: 2500,
      spending: 400,
      netCashFlow: 2100,
      topExpenseCategory: "Groceries",
      categories: [{ category: "Groceries", income: 0, spending: 400 }],
    });

    const response = await request(app)
      .get("/api/accounts/summary/monthly")
      .set("X-User-Id", "user-1");

    expect(response.status).toBe(200);
    expect(serviceMock.getMonthlySummary).toHaveBeenCalledWith("user-1", undefined);
    expect(response.body).toMatchObject({
      month: "2026-04",
      topExpenseCategory: "Groceries",
    });
  });

  it("passes user ownership context into account lookups", async () => {
    serviceMock.getAccount.mockResolvedValue({
      id: "account-1",
      userId: "user-1",
      ownerName: "Jane Doe",
      nickname: null,
      accountType: "CHEQUING",
      balance: 0,
      frozen: false,
    });

    const response = await request(app)
      .get("/api/accounts/account-1")
      .set("X-User-Id", "user-1");

    expect(response.status).toBe(200);
    expect(serviceMock.getAccount).toHaveBeenCalledWith("user-1", "account-1");
  });

  it("rejects invalid account creation payloads before hitting the service", async () => {
    const response = await request(app)
      .post("/api/accounts")
      .set("X-User-Id", "user-1")
      .send({ ownerName: "", accountType: "CHEQUING" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "ownerName is required" });
    expect(serviceMock.createAccount).not.toHaveBeenCalled();
  });

  it("rejects invalid deposit payloads before hitting the service", async () => {
    const response = await request(app)
      .post("/api/accounts/account-1/deposit")
      .set("X-User-Id", "user-1")
      .send({ amount: "20" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "amount must be a number" });
    expect(serviceMock.deposit).not.toHaveBeenCalled();
  });

  it("sanitizes account creation input before calling the service", async () => {
    serviceMock.createAccount.mockResolvedValue({
      id: "account-1",
      userId: "user-1",
      ownerName: "Jane Doe",
      nickname: "Main Account",
      accountType: "CHEQUING",
      balance: 0,
      frozen: false,
    });

    const response = await request(app)
      .post("/api/accounts")
      .set("X-User-Id", "user-1")
      .send({ ownerName: "  Jane\t\nDoe  ", nickname: "  Main\u0000 \n Account ", accountType: "CHEQUING" });

    expect(response.status).toBe(201);
    expect(serviceMock.createAccount).toHaveBeenCalledWith("user-1", "Jane Doe", "CHEQUING", "Main Account");
  });

  it("passes transaction filters through to the service", async () => {
    serviceMock.getTransactions.mockResolvedValue([]);

    const response = await request(app)
      .get("/api/accounts/account-1/transactions?type=WITHDRAWAL&category=Dining&search=coffee&start=2026-04-01T00:00:00.000Z&end=2026-05-01T00:00:00.000Z")
      .set("X-User-Id", "user-1");

    expect(response.status).toBe(200);
    expect(serviceMock.getTransactions).toHaveBeenCalledWith("user-1", "account-1", {
      type: "WITHDRAWAL",
      category: "Dining",
      search: "coffee",
      start: new Date("2026-04-01T00:00:00.000Z"),
      end: new Date("2026-05-01T00:00:00.000Z"),
    });
  });

  it("rejects invalid transaction type filters", async () => {
    const response = await request(app)
      .get("/api/accounts/account-1/transactions?type=BAD_TYPE")
      .set("X-User-Id", "user-1");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "type must be DEPOSIT, WITHDRAWAL, TRANSFER_OUT, or TRANSFER_IN" });
    expect(serviceMock.getTransactions).not.toHaveBeenCalled();
  });

  it("sanitizes transaction edit input before calling the service", async () => {
    serviceMock.updateTransaction.mockResolvedValue({
      id: "account-1",
      userId: "user-1",
      ownerName: "Jane Doe",
      nickname: null,
      accountType: "CHEQUING",
      balance: 180,
      frozen: false,
    });

    const response = await request(app)
      .patch("/api/accounts/account-1/transactions/txn-1")
      .set("X-User-Id", "user-1")
      .send({ amount: 20, category: "  Dining \n", description: "  Coffee\tshop " });

    expect(response.status).toBe(200);
    expect(serviceMock.updateTransaction).toHaveBeenCalledWith("user-1", "account-1", "txn-1", {
      amount: 20,
      category: "Dining",
      description: "Coffee shop",
    });
  });

  it("rejects invalid transaction edit payloads before hitting the service", async () => {
    const response = await request(app)
      .patch("/api/accounts/account-1/transactions/txn-1")
      .set("X-User-Id", "user-1")
      .send({ amount: 0 });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "amount must be positive" });
    expect(serviceMock.updateTransaction).not.toHaveBeenCalled();
  });

  it("passes transaction deletes through to the service", async () => {
    const response = await request(app)
      .delete("/api/accounts/account-1/transactions/txn-1")
      .set("X-User-Id", "user-1");

    expect(response.status).toBe(204);
    expect(serviceMock.deleteTransaction).toHaveBeenCalledWith("user-1", "account-1", "txn-1");
  });
});
