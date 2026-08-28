import { Router, Request, Response, NextFunction } from "express";
import { AppError } from "../middleware/errorHandler";
import { requireObject } from "../lib/validation";

const router = Router();

const ALLOWED_CATEGORIES = [
  "Groceries",
  "Rent",
  "Utilities",
  "Transport",
  "Dining",
  "Shopping",
  "Healthcare",
  "Entertainment",
  "Other",
  "Salary",
  "Freelance",
  "Gift",
  "Investment",
  "Other Income",
];

const MAX_MERCHANTS = 20;

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

/** Calls Ollama to suggest a category for each merchant and returns validated suggestions. */
router.post("/suggest", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers["x-user-id"] as string | undefined;
    if (!userId) throw new AppError(401, "Unauthorized");

    const body = requireObject(req.body);
    const merchants = parseMerchantsFromBody(body);

    const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
    const ollamaModel = process.env.OLLAMA_MODEL || "qwen2.5:7b";

    const categoryList = ALLOWED_CATEGORIES.join(", ");
    const merchantList = merchants.map((m) => `"${m}"`).join(", ");

    const systemPrompt = `You are a financial categorization assistant for a Canadian personal finance app called Bloom. Given merchant names, assign each one the most fitting category from the approved list. Return a JSON object with this exact shape: {"suggestions":[{"merchant":"...","category":"..."}]}. The category must be exactly one value from: ${categoryList}. Include every merchant from the input. Return only the JSON — no explanation, no markdown.`;

    const OLLAMA_TIMEOUT_MS = 35_000;
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), OLLAMA_TIMEOUT_MS);

    let ollamaResponse: globalThis.Response;
    try {
      ollamaResponse = await fetch(`${ollamaUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortController.signal,
        body: JSON.stringify({
          model: ollamaModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Categorize these merchants: [${merchantList}]` },
          ],
          stream: false,
          format: "json",
          options: { temperature: 0.1 },
        }),
      });
    } catch {
      throw new AppError(503, "AI service unavailable");
    } finally {
      clearTimeout(timeoutId);
    }

    if (!ollamaResponse.ok) {
      throw new AppError(503, "AI service unavailable");
    }

    const ollamaJson = (await ollamaResponse.json()) as { message?: { content?: string } };
    const content = ollamaJson.message?.content;
    if (!content) {
      throw new AppError(502, "AI returned no content");
    }

    let rawSuggestions: unknown;
    try {
      const parsed: unknown = JSON.parse(content);
      if (Array.isArray(parsed)) {
        rawSuggestions = parsed;
      } else if (parsed !== null && typeof parsed === "object") {
        const asRecord = parsed as Record<string, unknown>;
        rawSuggestions = Array.isArray(asRecord.suggestions) ? asRecord.suggestions : parsed;
      } else {
        rawSuggestions = [];
      }
    } catch {
      throw new AppError(502, "AI returned invalid JSON");
    }

    if (!Array.isArray(rawSuggestions)) {
      throw new AppError(502, "AI returned unexpected response format");
    }

    const suggestions = (rawSuggestions as unknown[])
      .filter(
        (item): item is { merchant: string; category: string } =>
          item !== null &&
          typeof item === "object" &&
          typeof (item as Record<string, unknown>).merchant === "string" &&
          typeof (item as Record<string, unknown>).category === "string" &&
          ALLOWED_CATEGORIES.includes((item as Record<string, unknown>).category as string)
      )
      .map((item) => ({ merchant: item.merchant, category: item.category }));

    res.json({ suggestions });
  } catch (err) {
    next(err);
  }
});

export default router;
