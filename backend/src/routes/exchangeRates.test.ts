import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../app";
import { AppError } from "../middleware/errorHandler";
import { INTERNAL_SECRET } from "../test-setup";

const { serviceMock } = vi.hoisted(() => ({
  serviceMock: { getExchangeRates: vi.fn() },
}));

vi.mock("../services/exchangeRateService", () => serviceMock);

describe("exchange rates routes", () => {
  beforeEach(() => {
    serviceMock.getExchangeRates.mockReset();
  });

  it("returns the cached exchange rates on GET /api/exchange-rates", async () => {
    serviceMock.getExchangeRates.mockResolvedValue({
      cadToUsd: 0.73,
      cadToEur: 0.68,
      fetchedAt: "2026-10-01T00:00:00.000Z",
    });

    const response = await request(app)
      .get("/api/exchange-rates")
      .set("X-Internal-Secret", INTERNAL_SECRET);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      cadToUsd: 0.73,
      cadToEur: 0.68,
      fetchedAt: "2026-10-01T00:00:00.000Z",
    });
  });

  it("propagates a service failure as the mapped error response", async () => {
    serviceMock.getExchangeRates.mockRejectedValue(
      new AppError(502, "Unable to fetch exchange rates")
    );

    const response = await request(app)
      .get("/api/exchange-rates")
      .set("X-Internal-Secret", INTERNAL_SECRET);

    expect(response.status).toBe(502);
    expect(response.body).toEqual({ error: "Unable to fetch exchange rates" });
  });
});
