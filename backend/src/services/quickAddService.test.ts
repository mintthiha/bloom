import { beforeEach, describe, expect, it, vi } from "vitest";
import { draftTransactionFromNote } from "./quickAddService";

const { ollamaClientMock, categoryServiceMock } = vi.hoisted(() => ({
  ollamaClientMock: { requestChatCompletion: vi.fn() },
  categoryServiceMock: { listCategories: vi.fn() },
}));

vi.mock("../lib/ollama-client", () => ollamaClientMock);
vi.mock("./categoryService", () => categoryServiceMock);

beforeEach(() => {
  ollamaClientMock.requestChatCompletion.mockReset();
  categoryServiceMock.listCategories.mockReset();
  categoryServiceMock.listCategories.mockResolvedValue([
    { name: "Dining", type: "EXPENSE" },
    { name: "Groceries", type: "EXPENSE" },
    { name: "Salary", type: "INCOME" },
  ]);
});

describe("draftTransactionFromNote", () => {
  it("asks for JSON with the user's categories and today, then reads the reply into a draft", async () => {
    ollamaClientMock.requestChatCompletion.mockResolvedValue(
      JSON.stringify({ type: "expense", amount: 4.5, merchant: "Tim Hortons", category: "Dining" })
    );

    const draft = await draftTransactionFromNote(
      "user-1",
      "Coffee 4.50 at Tim's yesterday",
      "2026-10-17"
    );

    expect(categoryServiceMock.listCategories).toHaveBeenCalledWith("user-1");
    const [completionRequest] = ollamaClientMock.requestChatCompletion.mock.calls[0]!;
    expect(completionRequest).toMatchObject({ shouldReturnJson: true, temperature: 0.1 });
    expect(completionRequest.messages[0].content).toContain("Today is Saturday, 2026-10-17.");
    expect(completionRequest.messages[0].content).toContain(
      "for an expense, exactly one of: Dining, Groceries."
    );
    expect(completionRequest.messages[1]).toEqual({
      role: "user",
      content: "Coffee 4.50 at Tim's yesterday",
    });
    expect(draft).toEqual({
      direction: "EXPENSE",
      amount: 4.5,
      merchant: "Tim Hortons",
      category: "Dining",
      date: "2026-10-16",
    });
  });

  it("passes on the model being unavailable", async () => {
    ollamaClientMock.requestChatCompletion.mockRejectedValue(new Error("AI service unavailable"));

    await expect(draftTransactionFromNote("user-1", "coffee 4", "2026-10-17")).rejects.toThrow(
      "AI service unavailable"
    );
  });
});
