import { requestChatCompletion } from "../lib/ollama-client";
import { listCategories } from "./categoryService";
import {
  buildQuickAddSystemPrompt,
  interpretQuickAddReply,
  type QuickAddDraft,
} from "./quickAddParsing";

// Near-deterministic sampling: the same note should read the same way every time.
const QUICK_ADD_TEMPERATURE = 0.1;

/**
 * Reads a one-line note such as "Coffee 4.50 at Tim's yesterday" into a draft transaction for the
 * user to review in the form. Nothing is recorded here.
 */
export async function draftTransactionFromNote(
  userId: string,
  note: string,
  today: string
): Promise<QuickAddDraft> {
  const userCategories = await listCategories(userId);
  const categories = {
    expenseCategoryNames: userCategories
      .filter((category) => category.type === "EXPENSE")
      .map((category) => category.name),
    incomeCategoryNames: userCategories
      .filter((category) => category.type === "INCOME")
      .map((category) => category.name),
  };
  const content = await requestChatCompletion({
    messages: [
      { role: "system", content: buildQuickAddSystemPrompt(categories, today) },
      { role: "user", content: note },
    ],
    temperature: QUICK_ADD_TEMPERATURE,
    shouldReturnJson: true,
  });
  return interpretQuickAddReply(content, { note, today, categories });
}
