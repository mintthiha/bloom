import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../app";

const { serviceMock } = vi.hoisted(() => ({
  serviceMock: {
    listRecurringTransactions: vi.fn(),
    createRecurringTransaction: vi.fn(),
    updateRecurringTransaction: vi.fn(),
    applyDueRecurringTransactions: vi.fn(),
    setRecurringTransactionActive: vi.fn(),
    deleteRecurringTransaction: vi.fn(),
  },
}));

vi.mock("../services/recurringTransactionService", () => serviceMock);

describe("recurring routes", () => {
  beforeEach(() => {
    serviceMock.listRecurringTransactions.mockReset();
    serviceMock.createRecurringTransaction.mockReset();
    serviceMock.updateRecurringTransaction.mockReset();
    serviceMock.applyDueRecurringTransactions.mockReset();
    serviceMock.setRecurringTransactionActive.mockReset();
    serviceMock.deleteRecurringTransaction.mockReset();
  });

  it("returns 401 when x-user-id is missing", async () => {
    const response = await request(app).get("/api/recurring");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Unauthorized" });
  });

  it("creates a recurring transaction after sanitizing inputs", async () => {
    serviceMock.createRecurringTransaction.mockResolvedValue({ id: "rule-1" });

    const response = await request(app)
      .post("/api/recurring")
      .set("X-User-Id", "user-1")
      .send({
        accountId: "account-1",
        name: "  Monthly rent ",
        type: "WITHDRAWAL",
        amount: 1200,
        category: "  Rent \n",
        merchant: "  Landlord Inc. ",
        description: "  Monthly\tpayment ",
        frequency: "MONTHLY",
        startDate: "2026-05-01T12:00:00.000Z",
        endDate: "2026-12-01T12:00:00.000Z",
      });

    expect(response.status).toBe(201);
    expect(serviceMock.createRecurringTransaction).toHaveBeenCalledWith("user-1", {
      accountId: "account-1",
      name: "Monthly rent",
      type: "WITHDRAWAL",
      amount: 1200,
      category: "Rent",
      merchant: "Landlord Inc.",
      description: "Monthly payment",
      frequency: "MONTHLY",
      startDate: new Date("2026-05-01T12:00:00.000Z"),
      endDate: new Date("2026-12-01T12:00:00.000Z"),
    });
  });

  it("rejects invalid recurring payloads before hitting the service", async () => {
    const response = await request(app)
      .post("/api/recurring")
      .set("X-User-Id", "user-1")
      .send({
        accountId: "account-1",
        name: "Invalid rule",
        type: "TRANSFER_OUT",
        amount: 1200,
        frequency: "MONTHLY",
        startDate: "2026-05-01T12:00:00.000Z",
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "type must be DEPOSIT or WITHDRAWAL" });
    expect(serviceMock.createRecurringTransaction).not.toHaveBeenCalled();
  });

  it("passes apply-due through to the service", async () => {
    serviceMock.applyDueRecurringTransactions.mockResolvedValue({ appliedCount: 1, failedCount: 0, applied: [], failures: [] });

    const response = await request(app)
      .post("/api/recurring/apply-due")
      .set("X-User-Id", "user-1");

    expect(response.status).toBe(200);
    expect(serviceMock.applyDueRecurringTransactions).toHaveBeenCalledWith("user-1");
  });

  it("updates a recurring transaction after sanitizing inputs", async () => {
    serviceMock.updateRecurringTransaction.mockResolvedValue({ id: "rule-1" });

    const response = await request(app)
      .put("/api/recurring/rule-1")
      .set("X-User-Id", "user-1")
      .send({
        accountId: "account-1",
        name: "  Main payroll ",
        type: "DEPOSIT",
        amount: 2500,
        category: "  Salary ",
        merchant: "  Acme Payroll ",
        description: "  Main\tjob ",
        frequency: "BIWEEKLY",
        startDate: "2026-05-02T12:00:00.000Z",
      });

    expect(response.status).toBe(200);
    expect(serviceMock.updateRecurringTransaction).toHaveBeenCalledWith("user-1", "rule-1", {
      accountId: "account-1",
      name: "Main payroll",
      type: "DEPOSIT",
      amount: 2500,
      category: "Salary",
      merchant: "Acme Payroll",
      description: "Main job",
      frequency: "BIWEEKLY",
      startDate: new Date("2026-05-02T12:00:00.000Z"),
      endDate: undefined,
    });
  });

  it("passes active toggle through to the service", async () => {
    serviceMock.setRecurringTransactionActive.mockResolvedValue({ id: "rule-1", active: false });

    const response = await request(app)
      .patch("/api/recurring/rule-1")
      .set("X-User-Id", "user-1")
      .send({ active: false });

    expect(response.status).toBe(200);
    expect(serviceMock.setRecurringTransactionActive).toHaveBeenCalledWith("user-1", "rule-1", false);
  });

  it("passes deletes through to the service", async () => {
    const response = await request(app)
      .delete("/api/recurring/rule-1")
      .set("X-User-Id", "user-1");

    expect(response.status).toBe(204);
    expect(serviceMock.deleteRecurringTransaction).toHaveBeenCalledWith("user-1", "rule-1");
  });
});
