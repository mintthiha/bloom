import { Router, Request, Response, NextFunction } from "express";
import { AppError } from "../middleware/errorHandler";
import logger from "../lib/logger";
import { AI_UNAVAILABLE_MESSAGE } from "../lib/ollama-client";
import { optionalString, requireObject } from "../lib/validation";
import * as receiptCategorizeService from "../services/receiptCategorizeService";

const router = Router();

/** Caps one request's line items so a very long receipt can't turn into a multi-minute generation. */
const MAX_RECEIPT_ITEMS = 40;
const MAX_ITEM_NAME_LENGTH = 60;

/** Extracts the authenticated user id from the internal x-user-id header. */
function requireUserId(req: Request): string {
  const userId = req.headers["x-user-id"] as string | undefined;
  if (!userId) throw new AppError(401, "Unauthorized");
  return userId;
}

/**
 * Extracts and validates the receipt's line item names from the request body.
 * Trims each entry and enforces per-item length and total count limits.
 */
function parseItemNamesFromBody(body: Record<string, unknown>): string[] {
  if (!Array.isArray(body.items)) {
    throw new AppError(400, "items must be an array");
  }
  const items = body.items as unknown[];
  if (items.length === 0) {
    throw new AppError(400, "items must not be empty");
  }
  if (items.length > MAX_RECEIPT_ITEMS) {
    throw new AppError(400, `items must contain at most ${MAX_RECEIPT_ITEMS} items`);
  }
  const itemNames: string[] = [];
  for (const item of items) {
    if (typeof item !== "string" || !item.trim()) {
      throw new AppError(400, "each item must be a non-empty string");
    }
    // Item names are numbered one per line in the prompt, so a stray line break must not split one.
    itemNames.push(item.replace(/\s+/g, " ").trim().slice(0, MAX_ITEM_NAME_LENGTH));
  }
  return itemNames;
}

/**
 * Streams an AI-suggested expense category for each line item of a scanned receipt as SSE events,
 * emitting one {itemNumber, category} event as the model finishes each line.
 */
router.post("/categorize-stream", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req);
    const body = requireObject(req.body);
    const itemNames = parseItemNamesFromBody(body);
    const merchant = optionalString(body.merchant, "merchant", { max: 100 });

    // Stop generating as soon as the browser cancels (e.g. the user discards the scan).
    const abortController = new AbortController();
    res.on("close", () => abortController.abort());

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    let itemCategories: AsyncGenerator<receiptCategorizeService.ReceiptItemCategory, void, void>;
    try {
      itemCategories = await receiptCategorizeService.startReceiptItemCategoryStream(
        userId,
        merchant,
        itemNames,
        abortController.signal
      );
    } catch (error) {
      if (!(error instanceof AppError)) {
        logger.error({ err: error }, "Receipt categorization stream failed to start");
      }
      // The headers are already sent, so the failure has to travel as an SSE event, not a status.
      res.write(`event: error\ndata: ${JSON.stringify({ message: AI_UNAVAILABLE_MESSAGE })}\n\n`);
      res.end();
      return;
    }

    for await (const itemCategory of itemCategories) {
      res.write(`data: ${JSON.stringify(itemCategory)}\n\n`);
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
