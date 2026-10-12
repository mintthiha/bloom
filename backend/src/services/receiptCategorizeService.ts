import { startChatStream } from "../lib/ollama-client";
import { listCategories } from "./categoryService";

/** One line item's suggested category; `itemNumber` is the item's 1-based position in the request. */
export type ReceiptItemCategory = { itemNumber: number; category: string };

// Near-deterministic sampling: the same item should land in the same category every time.
const CATEGORIZATION_TEMPERATURE = 0.1;

// The model answers "<number>|<category>"; other separators it sometimes drifts to are accepted too.
const ITEM_CATEGORY_LINE_PATTERN = /^\s*(\d+)\s*[|:.)-]\s*(.+?)\s*$/;

/** Loads the names of the user's own expense categories — a receipt is always a purchase. */
async function listExpenseCategoryNames(userId: string): Promise<string[]> {
  const categories = await listCategories(userId);
  return categories
    .filter((category) => category.type === "EXPENSE")
    .map((category) => category.name);
}

/** Formats the store and its numbered line items as the user turn of the prompt. */
function buildReceiptItemsPrompt(merchant: string | undefined, itemNames: string[]): string {
  const numberedItems = itemNames.map((itemName, index) => `${index + 1}. ${itemName}`).join("\n");
  return `${merchant ? `Store: ${merchant}\n` : ""}Items:\n${numberedItems}`;
}

/**
 * Parses one line of model output into a suggestion, ignoring prose, item numbers that were never
 * asked about, and categories the user does not have. The category is matched without regard to
 * case and returned exactly as the user spelled it.
 */
function parseItemCategoryLine(
  line: string,
  itemCount: number,
  allowedCategories: string[]
): ReceiptItemCategory | undefined {
  const match = ITEM_CATEGORY_LINE_PATTERN.exec(line);
  if (!match) return undefined;
  const itemNumber = Number(match[1]);
  if (itemNumber < 1 || itemNumber > itemCount) return undefined;
  const suggestedCategory = match[2]!.toLowerCase();
  const category = allowedCategories.find(
    (allowedCategory) => allowedCategory.toLowerCase() === suggestedCategory
  );
  return category ? { itemNumber, category } : undefined;
}

/**
 * Re-chunks the model's text into lines and yields each valid suggestion as its line completes.
 * Only the first answer for an item is kept, so a model that repeats itself can't flip a category.
 */
async function* parseItemCategoryStream(
  contentChunks: AsyncIterable<string>,
  itemCount: number,
  allowedCategories: string[]
): AsyncGenerator<ReceiptItemCategory, void, void> {
  const answeredItemNumbers = new Set<number>();
  let pendingOutput = "";

  /** Yields the suggestion on one line unless it is invalid or its item was already answered. */
  function* suggestionsFromLine(line: string): Generator<ReceiptItemCategory, void, void> {
    const suggestion = parseItemCategoryLine(line, itemCount, allowedCategories);
    if (!suggestion || answeredItemNumbers.has(suggestion.itemNumber)) return;
    answeredItemNumbers.add(suggestion.itemNumber);
    yield suggestion;
  }

  for await (const contentChunk of contentChunks) {
    pendingOutput += contentChunk;
    const completedLines = pendingOutput.split("\n");
    pendingOutput = completedLines.pop() ?? "";
    for (const completedLine of completedLines) yield* suggestionsFromLine(completedLine);
  }
  yield* suggestionsFromLine(pendingOutput);
}

/** An already-finished stream, for when there is nothing the model could usefully answer. */
async function* emptyItemCategoryStream(): AsyncGenerator<ReceiptItemCategory, void, void> {
  yield* [];
}

/**
 * Starts a streamed categorization of a scanned receipt's line items and resolves once the model
 * has begun answering. The model is asked for only an item number and a category per line: on the
 * CPU-only server every output token costs real time, and never echoing the (OCR-garbled) item
 * name means an answer can always be matched back to its item.
 */
export async function startReceiptItemCategoryStream(
  userId: string,
  merchant: string | undefined,
  itemNames: string[],
  signal?: AbortSignal
): Promise<AsyncGenerator<ReceiptItemCategory, void, void>> {
  const allowedCategories = await listExpenseCategoryNames(userId);
  if (allowedCategories.length === 0) return emptyItemCategoryStream();

  const systemPrompt = `You categorize the line items of a store receipt for a Canadian personal finance app called Bloom. Item names are abbreviated and may contain scanning mistakes — infer the most likely product, using the store as a hint. For each numbered item output ONLY one line with this exact shape: <item number>|<category>. No explanation, no markdown, no item names. The category must be exactly one value from: ${allowedCategories.join(", ")}. Include every item from the input.`;

  const contentChunks = await startChatStream({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: buildReceiptItemsPrompt(merchant, itemNames) },
    ],
    temperature: CATEGORIZATION_TEMPERATURE,
    signal,
  });
  return parseItemCategoryStream(contentChunks, itemNames.length, allowedCategories);
}
