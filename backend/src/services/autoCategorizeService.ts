import { AppError } from "../middleware/errorHandler";
import { requestChatCompletion, startChatStream } from "../lib/ollama-client";
import { listCategories } from "./categoryService";

export type CategorySuggestion = { merchant: string; category: string };

// Near-deterministic sampling: the same merchant should land in the same category every time.
const CATEGORIZATION_TEMPERATURE = 0.1;

/** Loads the names of the user's own categories — the only values a suggestion may use. */
async function listAllowedCategoryNames(userId: string): Promise<string[]> {
  return (await listCategories(userId)).map((category) => category.name);
}

/** Formats the merchants as the user turn of the categorization prompt. */
function buildMerchantPrompt(merchants: string[]): string {
  const merchantList = merchants.map((merchant) => `"${merchant}"`).join(", ");
  return `Categorize these merchants: [${merchantList}]`;
}

/** Narrows an untrusted model value to a suggestion whose category is on the user's list. */
function toValidSuggestion(
  value: unknown,
  allowedCategories: string[]
): CategorySuggestion | undefined {
  if (value === null || typeof value !== "object") return undefined;
  const { merchant, category } = value as Record<string, unknown>;
  if (typeof merchant !== "string" || typeof category !== "string") return undefined;
  if (!allowedCategories.includes(category)) return undefined;
  return { merchant, category };
}

/** Parses one line of streamed model output, ignoring anything that isn't a complete suggestion. */
function parseSuggestionLine(
  line: string,
  allowedCategories: string[]
): CategorySuggestion | undefined {
  const trimmedLine = line.trim();
  if (!trimmedLine.startsWith("{")) return undefined;
  try {
    return toValidSuggestion(JSON.parse(trimmedLine), allowedCategories);
  } catch {
    // incomplete or malformed line — skip
    return undefined;
  }
}

/** Re-chunks the model's text into lines and yields each valid suggestion as its line completes. */
async function* parseSuggestionStream(
  contentChunks: AsyncIterable<string>,
  allowedCategories: string[]
): AsyncGenerator<CategorySuggestion, void, void> {
  let pendingOutput = "";
  for await (const contentChunk of contentChunks) {
    pendingOutput += contentChunk;
    const completedLines = pendingOutput.split("\n");
    pendingOutput = completedLines.pop() ?? "";
    for (const completedLine of completedLines) {
      const suggestion = parseSuggestionLine(completedLine, allowedCategories);
      if (suggestion) yield suggestion;
    }
  }
  const finalSuggestion = parseSuggestionLine(pendingOutput, allowedCategories);
  if (finalSuggestion) yield finalSuggestion;
}

/**
 * Asks the model to assign each merchant one of the user's categories and returns only the
 * suggestions that name a category the user actually has.
 */
export async function suggestCategories(
  userId: string,
  merchants: string[]
): Promise<CategorySuggestion[]> {
  const allowedCategories = await listAllowedCategoryNames(userId);
  const systemPrompt = `You are a financial categorization assistant for a Canadian personal finance app called Bloom. Given merchant names, assign each one the most fitting category from the approved list. Return a JSON object with this exact shape: {"suggestions":[{"merchant":"...","category":"..."}]}. The category must be exactly one value from: ${allowedCategories.join(", ")}. Include every merchant from the input. Return only the JSON — no explanation, no markdown.`;

  const content = await requestChatCompletion({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: buildMerchantPrompt(merchants) },
    ],
    temperature: CATEGORIZATION_TEMPERATURE,
    shouldReturnJson: true,
  });

  let parsedContent: unknown;
  try {
    parsedContent = JSON.parse(content);
  } catch {
    throw new AppError(502, "AI returned invalid JSON");
  }

  // The model usually honours the {"suggestions":[...]} wrapper but sometimes returns a bare array.
  const rawSuggestions = Array.isArray(parsedContent)
    ? parsedContent
    : (parsedContent as Record<string, unknown> | null)?.suggestions;
  if (!Array.isArray(rawSuggestions)) {
    throw new AppError(502, "AI returned unexpected response format");
  }

  return rawSuggestions
    .map((rawSuggestion) => toValidSuggestion(rawSuggestion, allowedCategories))
    .filter((suggestion): suggestion is CategorySuggestion => suggestion !== undefined);
}

/**
 * Starts a streamed categorization and resolves once the model has begun answering, with a
 * generator that yields one validated suggestion per merchant as the model finishes each line.
 */
export async function startCategorySuggestionStream(
  userId: string,
  merchants: string[],
  signal?: AbortSignal
): Promise<AsyncGenerator<CategorySuggestion, void, void>> {
  const allowedCategories = await listAllowedCategoryNames(userId);
  const systemPrompt = `You are a financial categorization assistant for a Canadian personal finance app called Bloom. Given merchant names, assign each one the most fitting category. Output ONLY one JSON object per line with this exact shape: {"merchant":"...","category":"..."}. No wrapper array, no markdown, no explanation. The category must be exactly one value from: ${allowedCategories.join(", ")}. Include every merchant from the input.`;

  const contentChunks = await startChatStream({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: buildMerchantPrompt(merchants) },
    ],
    temperature: CATEGORIZATION_TEMPERATURE,
    signal,
  });
  return parseSuggestionStream(contentChunks, allowedCategories);
}
