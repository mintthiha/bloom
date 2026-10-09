import { Router, Request, Response, NextFunction } from "express";
import { AppError } from "../middleware/errorHandler";
import logger from "../lib/logger";
import { AI_UNAVAILABLE_MESSAGE } from "../lib/ollama-client";
import { requireObject } from "../lib/validation";
import * as autoCategorizeService from "../services/autoCategorizeService";

const router = Router();

const MAX_MERCHANTS = 20;

/** Extracts the authenticated user id from the internal x-user-id header. */
function requireUserId(req: Request): string {
  const userId = req.headers["x-user-id"] as string | undefined;
  if (!userId) throw new AppError(401, "Unauthorized");
  return userId;
}

/**
 * Extracts and validates the list of merchants from the request body.
 * Trims each entry and enforces per-item length and total count limits.
 */
function parseMerchantsFromBody(body: Record<string, unknown>): string[] {
  if (!Array.isArray(body.merchants)) {
    throw new AppError(400, "merchants must be an array");
  }
  const merchants = body.merchants as unknown[];
  if (merchants.length === 0) {
    throw new AppError(400, "merchants must not be empty");
  }
  if (merchants.length > MAX_MERCHANTS) {
    throw new AppError(400, `merchants must contain at most ${MAX_MERCHANTS} items`);
  }
  const sanitized: string[] = [];
  for (const item of merchants) {
    if (typeof item !== "string" || !item.trim()) {
      throw new AppError(400, "each merchant must be a non-empty string");
    }
    sanitized.push(item.trim().slice(0, 100));
  }
  return sanitized;
}

/** Returns an AI-suggested category for each merchant, limited to the user's own categories. */
router.post("/suggest", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req);
    const merchants = parseMerchantsFromBody(requireObject(req.body));

    res.json({ suggestions: await autoCategorizeService.suggestCategories(userId, merchants) });
  } catch (err) {
    next(err);
  }
});

/**
 * Streams AI category suggestions as SSE events, emitting one {merchant, category} event
 * per merchant as the model generates each line, rather than waiting for the full response.
 */
router.post("/suggest-stream", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req);
    const merchants = parseMerchantsFromBody(requireObject(req.body));

    // Stop generating as soon as the browser cancels (e.g. the user turns AI suggestions off).
    const abortController = new AbortController();
    res.on("close", () => abortController.abort());

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    let suggestions: AsyncGenerator<autoCategorizeService.CategorySuggestion, void, void>;
    try {
      suggestions = await autoCategorizeService.startCategorySuggestionStream(
        userId,
        merchants,
        abortController.signal
      );
    } catch (error) {
      if (!(error instanceof AppError)) {
        logger.error({ err: error }, "Category suggestion stream failed to start");
      }
      // The headers are already sent, so the failure has to travel as an SSE event, not a status.
      res.write(`event: error\ndata: ${JSON.stringify({ message: AI_UNAVAILABLE_MESSAGE })}\n\n`);
      res.end();
      return;
    }

    for await (const suggestion of suggestions) {
      res.write(`data: ${JSON.stringify(suggestion)}\n\n`);
    }

    res.write("event: done\ndata: {}\n\n");
    res.end();
  } catch (err) {
    if (res.headersSent) {
      res.end();
      return;
    }
    next(err);
  }
});

export default router;
