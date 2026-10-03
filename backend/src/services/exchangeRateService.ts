import { AppError } from "../middleware/errorHandler";
import prisma from "../lib/prisma";
import logger from "../lib/logger";

/** How long a cached rate is trusted before a refresh is attempted. */
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

type ExchangeRateRow = {
  id: number;
  cadToUsd: string;
  cadToEur: string;
  fetchedAt: Date;
};

export type ExchangeRates = {
  cadToUsd: number;
  cadToEur: number;
  fetchedAt: string;
};

/** Converts a raw cached row into API-safe numbers/strings. */
function normalizeRow(row: ExchangeRateRow): ExchangeRates {
  return {
    cadToUsd: Number(row.cadToUsd),
    cadToEur: Number(row.cadToEur),
    fetchedAt: row.fetchedAt.toISOString(),
  };
}

/** Fetches fresh CAD-to-USD/EUR rates from Frankfurter.app (free, no API key, ECB reference rates). */
async function fetchLatestRates(): Promise<{ cadToUsd: number; cadToEur: number }> {
  const response = await fetch("https://api.frankfurter.app/latest?from=CAD&to=USD,EUR");
  if (!response.ok) {
    throw new Error(`Frankfurter responded with ${response.status}`);
  }
  const data = (await response.json()) as { rates?: { USD?: number; EUR?: number } };
  const cadToUsd = data.rates?.USD;
  const cadToEur = data.rates?.EUR;
  if (typeof cadToUsd !== "number" || typeof cadToEur !== "number") {
    throw new Error("Frankfurter response missing USD/EUR rates");
  }
  return { cadToUsd, cadToEur };
}

/**
 * Returns the cached CAD-to-USD/EUR exchange rates, refreshing them from Frankfurter.app when the
 * cache is missing or older than 24 hours. Falls back to a stale cached row if the refresh fails,
 * and only throws when there is no cached row to fall back to.
 */
export async function getExchangeRates(): Promise<ExchangeRates> {
  const rows = await prisma.$queryRaw<ExchangeRateRow[]>`
    SELECT "id", "cadToUsd", "cadToEur", "fetchedAt" FROM "ExchangeRate" WHERE "id" = 1 LIMIT 1
  `;
  const cached = rows[0];
  const isStale = !cached || Date.now() - cached.fetchedAt.getTime() > STALE_AFTER_MS;

  if (!isStale) {
    return normalizeRow(cached);
  }

  try {
    const { cadToUsd, cadToEur } = await fetchLatestRates();
    const updatedRows = await prisma.$queryRaw<ExchangeRateRow[]>`
      INSERT INTO "ExchangeRate" ("id", "cadToUsd", "cadToEur", "fetchedAt")
      VALUES (1, ${cadToUsd}, ${cadToEur}, CURRENT_TIMESTAMP)
      ON CONFLICT ("id")
      DO UPDATE SET
        "cadToUsd" = EXCLUDED."cadToUsd",
        "cadToEur" = EXCLUDED."cadToEur",
        "fetchedAt" = EXCLUDED."fetchedAt"
      RETURNING "id", "cadToUsd", "cadToEur", "fetchedAt"
    `;
    return normalizeRow(updatedRows[0]);
  } catch (err) {
    if (cached) {
      logger.warn({ err }, "Falling back to stale cached exchange rates");
      return normalizeRow(cached);
    }
    throw new AppError(502, "Unable to fetch exchange rates");
  }
}
