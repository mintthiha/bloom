import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@prisma/client", () => ({
  PrismaClient: class {
    $queryRaw = prismaMock.$queryRaw;
  },
}));

const fetchMock = vi.fn();

describe("exchangeRateService", () => {
  beforeEach(() => {
    prismaMock.$queryRaw.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the cached rates without refetching when they are fresh", async () => {
    const { getExchangeRates } = await import("./exchangeRateService");
    prismaMock.$queryRaw.mockResolvedValueOnce([
      { id: 1, cadToUsd: "0.73", cadToEur: "0.68", fetchedAt: new Date() },
    ]);

    const result = await getExchangeRates();

    expect(result).toEqual({ cadToUsd: 0.73, cadToEur: 0.68, fetchedAt: expect.any(String) });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refetches and caches when there is no cached row", async () => {
    const { getExchangeRates } = await import("./exchangeRateService");
    prismaMock.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 1, cadToUsd: "0.74", cadToEur: "0.69", fetchedAt: new Date() },
      ]);
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ rates: { USD: 0.74, EUR: 0.69 } }),
    });

    const result = await getExchangeRates();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.frankfurter.app/latest?from=CAD&to=USD,EUR"
    );
    expect(result).toEqual({ cadToUsd: 0.74, cadToEur: 0.69, fetchedAt: expect.any(String) });
  });

  it("refetches when the cached row is older than 24 hours", async () => {
    const { getExchangeRates } = await import("./exchangeRateService");
    const staleDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ id: 1, cadToUsd: "0.70", cadToEur: "0.65", fetchedAt: staleDate }])
      .mockResolvedValueOnce([
        { id: 1, cadToUsd: "0.75", cadToEur: "0.70", fetchedAt: new Date() },
      ]);
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ rates: { USD: 0.75, EUR: 0.7 } }),
    });

    const result = await getExchangeRates();

    expect(fetchMock).toHaveBeenCalled();
    expect(result.cadToUsd).toBe(0.75);
  });

  it("falls back to a stale cached row when the refresh fails", async () => {
    const { getExchangeRates } = await import("./exchangeRateService");
    const staleDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
    prismaMock.$queryRaw.mockResolvedValueOnce([
      { id: 1, cadToUsd: "0.70", cadToEur: "0.65", fetchedAt: staleDate },
    ]);
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    const result = await getExchangeRates();

    expect(result).toEqual({
      cadToUsd: 0.7,
      cadToEur: 0.65,
      fetchedAt: staleDate.toISOString(),
    });
  });

  it("throws when the refresh fails and there is no cached row to fall back to", async () => {
    const { getExchangeRates } = await import("./exchangeRateService");
    prismaMock.$queryRaw.mockResolvedValueOnce([]);
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    await expect(getExchangeRates()).rejects.toMatchObject({
      statusCode: 502,
      message: "Unable to fetch exchange rates",
    });
  });
});
