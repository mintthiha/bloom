import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OllamaStreamEvent } from "../lib/ollama-client";
import { AppError } from "../middleware/errorHandler";
import { startChatReply, type ChatReplyEvent } from "./aiChatService";
import type { ChatActionReferenceData } from "./chatActionProposals";

const { ollamaClientMock, chatHistoryMock, chatActionMock } = vi.hoisted(() => ({
  ollamaClientMock: { startChatEventStream: vi.fn() },
  chatHistoryMock: { listRecentChatMessages: vi.fn(), saveChatExchange: vi.fn() },
  chatActionMock: { loadChatActionReferenceData: vi.fn() },
}));

vi.mock("../lib/ollama-client", () => ollamaClientMock);
vi.mock("./chatHistoryService", () => chatHistoryMock);
vi.mock("./chatActionService", () => chatActionMock);

const REFERENCE_DATA: ChatActionReferenceData = {
  expenseCategoryNames: ["Dining", "Groceries"],
  incomeCategoryNames: ["Salary"],
  accounts: [{ id: "account-savings", name: "Rainy day", accountType: "SAVINGS" }],
  budgets: [],
  savingsGoals: [],
  rules: [],
};

const GROCERIES_BUDGET_DRAFT = {
  kind: "BUDGET",
  category: "Groceries",
  monthlyLimit: 400,
  currentMonthlyLimit: null,
};

const GROCERIES_BUDGET_INTRODUCTION =
  "I've drafted a monthly budget for Groceries. Review it below — nothing is saved until you confirm.";

/** Builds a text event the Ollama client would yield for a chunk of generated text. */
function textEvent(text: string): OllamaStreamEvent {
  return { type: "text", text };
}

/** Builds the event the Ollama client would yield when the model calls a tool. */
function toolCallEvent(name: string, toolArguments: Record<string, unknown>): OllamaStreamEvent {
  return { type: "toolCall", name, arguments: toolArguments };
}

/** Builds the generator of events the Ollama client would hand back for a streamed reply. */
async function* streamOf(
  streamEvents: OllamaStreamEvent[]
): AsyncGenerator<OllamaStreamEvent, void, void> {
  for (const streamEvent of streamEvents) yield streamEvent;
}

/** Drains a generator of reply events into an array. */
async function collectEvents(
  replyEvents: AsyncIterable<ChatReplyEvent>
): Promise<ChatReplyEvent[]> {
  const collected: ChatReplyEvent[] = [];
  for await (const replyEvent of replyEvents) collected.push(replyEvent);
  return collected;
}

beforeEach(() => {
  ollamaClientMock.startChatEventStream.mockReset();
  chatHistoryMock.listRecentChatMessages.mockReset();
  chatHistoryMock.saveChatExchange.mockReset();
  chatActionMock.loadChatActionReferenceData.mockReset();
  chatHistoryMock.listRecentChatMessages.mockResolvedValue([]);
  chatHistoryMock.saveChatExchange.mockResolvedValue("reply-message-1");
  chatActionMock.loadChatActionReferenceData.mockResolvedValue(REFERENCE_DATA);
});

describe("startChatReply — the request sent to the model", () => {
  it("sends the system prompt, then the stored conversation, then the new question", async () => {
    chatHistoryMock.listRecentChatMessages.mockResolvedValue([
      {
        id: "m-1",
        role: "user",
        content: "What is a TFSA?",
        proposedAction: null,
        proposedActionStatus: null,
        createdAt: new Date(),
      },
      {
        id: "m-2",
        role: "assistant",
        content: "A registered account.",
        proposedAction: null,
        proposedActionStatus: null,
        createdAt: new Date(),
      },
    ]);
    ollamaClientMock.startChatEventStream.mockResolvedValue(streamOf([]));
    const abortController = new AbortController();

    await startChatReply(
      "u-1",
      "You are Bloom's assistant.",
      "And an RRSP?",
      abortController.signal
    );

    expect(chatHistoryMock.listRecentChatMessages).toHaveBeenCalledWith("u-1", 20);
    expect(chatActionMock.loadChatActionReferenceData).toHaveBeenCalledWith("u-1");
    const [chatRequest] = ollamaClientMock.startChatEventStream.mock.calls[0]!;
    expect(chatRequest.messages).toEqual([
      { role: "system", content: expect.stringMatching(/^You are Bloom's assistant\.\n\nACTIONS/) },
      { role: "user", content: "What is a TFSA?" },
      { role: "assistant", content: "A registered account." },
      { role: "user", content: "And an RRSP?" },
    ]);
    expect(chatRequest.temperature).toBe(0.2);
    expect(chatRequest.signal).toBe(abortController.signal);
  });

  it("offers the write tools, limited to the user's own categories", async () => {
    ollamaClientMock.startChatEventStream.mockResolvedValue(streamOf([]));

    await startChatReply("u-1", "Prompt", "Set a grocery budget");

    const [chatRequest] = ollamaClientMock.startChatEventStream.mock.calls[0]!;
    expect(
      chatRequest.tools.map((tool: { function: { name: string } }) => tool.function.name)
    ).toEqual(["propose_budget", "propose_categorization_rule", "propose_savings_goal"]);
    expect(chatRequest.tools[0].function.parameters.properties.category.enum).toEqual([
      "Dining",
      "Groceries",
    ]);
  });

  it("replays an earlier draft as a tool call with what the user did about it", async () => {
    chatHistoryMock.listRecentChatMessages.mockResolvedValue([
      {
        id: "m-1",
        role: "user",
        content: "Set a $400 grocery budget",
        proposedAction: null,
        proposedActionStatus: null,
        createdAt: new Date(),
      },
      {
        id: "m-2",
        role: "assistant",
        content: GROCERIES_BUDGET_INTRODUCTION,
        proposedAction: GROCERIES_BUDGET_DRAFT,
        proposedActionStatus: "CONFIRMED",
        createdAt: new Date(),
      },
    ]);
    ollamaClientMock.startChatEventStream.mockResolvedValue(streamOf([]));

    await startChatReply("u-1", "Prompt", "Thanks");

    const [chatRequest] = ollamaClientMock.startChatEventStream.mock.calls[0]!;
    expect(chatRequest.messages.slice(1)).toEqual([
      { role: "user", content: "Set a $400 grocery budget" },
      {
        role: "assistant",
        content: "",
        tool_calls: [
          {
            function: {
              name: "propose_budget",
              arguments: { category: "Groceries", monthlyLimit: 400 },
            },
          },
        ],
      },
      { role: "tool", content: "The user confirmed this draft and it was saved." },
      { role: "assistant", content: GROCERIES_BUDGET_INTRODUCTION },
      { role: "user", content: "Thanks" },
    ]);
  });
});

describe("startChatReply — a text reply", () => {
  it("relays the reply chunks and stores the finished exchange", async () => {
    ollamaClientMock.startChatEventStream.mockResolvedValue(
      streamOf([textEvent("A TFSA "), textEvent("is an account.")])
    );
    const startedAt = Date.now();

    const replyEvents = await startChatReply("u-1", "Prompt", "What is a TFSA?");

    expect(await collectEvents(replyEvents)).toEqual([
      { type: "text", text: "A TFSA " },
      { type: "text", text: "is an account." },
    ]);
    expect(chatHistoryMock.saveChatExchange).toHaveBeenCalledTimes(1);
    const [userId, exchange] = chatHistoryMock.saveChatExchange.mock.calls[0]!;
    expect(userId).toBe("u-1");
    expect(exchange).toMatchObject({ question: "What is a TFSA?", reply: "A TFSA is an account." });
    expect(exchange.proposedAction).toBeUndefined();
    expect(exchange.askedAt.getTime()).toBeGreaterThanOrEqual(startedAt);
    expect(exchange.askedAt.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("stores nothing until the reply has finished", async () => {
    ollamaClientMock.startChatEventStream.mockResolvedValue(
      streamOf([textEvent("A TFSA "), textEvent("is an account.")])
    );

    const replyEvents = await startChatReply("u-1", "Prompt", "What is a TFSA?");
    await replyEvents.next();

    expect(chatHistoryMock.saveChatExchange).not.toHaveBeenCalled();
  });

  it("stores the partial reply, once, when the consumer stops reading early", async () => {
    ollamaClientMock.startChatEventStream.mockResolvedValue(
      streamOf([textEvent("A TFSA "), textEvent("is an account.")])
    );

    const replyEvents = await startChatReply("u-1", "Prompt", "What is a TFSA?");
    await replyEvents.next();
    await replyEvents.return();

    expect(chatHistoryMock.saveChatExchange).toHaveBeenCalledTimes(1);
    expect(chatHistoryMock.saveChatExchange).toHaveBeenCalledWith(
      "u-1",
      expect.objectContaining({ question: "What is a TFSA?", reply: "A TFSA " })
    );
  });

  it("stores nothing when the model produced no text", async () => {
    ollamaClientMock.startChatEventStream.mockResolvedValue(streamOf([]));

    const replyEvents = await startChatReply("u-1", "Prompt", "What is a TFSA?");

    expect(await collectEvents(replyEvents)).toEqual([]);
    expect(chatHistoryMock.saveChatExchange).not.toHaveBeenCalled();
  });

  it("stores nothing and rejects when the AI is unavailable", async () => {
    ollamaClientMock.startChatEventStream.mockRejectedValue(
      new AppError(503, "AI service unavailable")
    );

    await expect(startChatReply("u-1", "Prompt", "What is a TFSA?")).rejects.toMatchObject({
      statusCode: 503,
    });
    expect(chatHistoryMock.saveChatExchange).not.toHaveBeenCalled();
  });

  it("still completes the stream when storing the exchange fails", async () => {
    ollamaClientMock.startChatEventStream.mockResolvedValue(streamOf([textEvent("An account.")]));
    chatHistoryMock.saveChatExchange.mockRejectedValue(new Error("database unavailable"));

    const replyEvents = await startChatReply("u-1", "Prompt", "What is a TFSA?");

    await expect(collectEvents(replyEvents)).resolves.toEqual([
      { type: "text", text: "An account." },
    ]);
  });
});

describe("startChatReply — a reply that calls a tool", () => {
  it("introduces the draft in text, stores it with the exchange, then hands over the draft", async () => {
    ollamaClientMock.startChatEventStream.mockResolvedValue(
      streamOf([toolCallEvent("propose_budget", { category: "Groceries", monthlyLimit: 400 })])
    );

    const replyEvents = await startChatReply("u-1", "Prompt", "Set a $400 grocery budget");

    expect(await collectEvents(replyEvents)).toEqual([
      { type: "text", text: GROCERIES_BUDGET_INTRODUCTION },
      { type: "proposal", messageId: "reply-message-1", proposedAction: GROCERIES_BUDGET_DRAFT },
    ]);
    expect(chatHistoryMock.saveChatExchange).toHaveBeenCalledTimes(1);
    expect(chatHistoryMock.saveChatExchange).toHaveBeenCalledWith(
      "u-1",
      expect.objectContaining({
        question: "Set a $400 grocery budget",
        reply: GROCERIES_BUDGET_INTRODUCTION,
        proposedAction: GROCERIES_BUDGET_DRAFT,
      })
    );
  });

  it("keeps any text the model wrote before the tool call, separated from the introduction", async () => {
    ollamaClientMock.startChatEventStream.mockResolvedValue(
      streamOf([
        textEvent("Good idea."),
        toolCallEvent("propose_budget", { category: "Groceries", monthlyLimit: 400 }),
      ])
    );

    const replyEvents = await startChatReply("u-1", "Prompt", "Set a $400 grocery budget");
    const events = await collectEvents(replyEvents);

    expect(events.slice(0, 2)).toEqual([
      { type: "text", text: "Good idea." },
      { type: "text", text: `\n\n${GROCERIES_BUDGET_INTRODUCTION}` },
    ]);
    expect(chatHistoryMock.saveChatExchange.mock.calls[0]![1].reply).toBe(
      `Good idea.\n\n${GROCERIES_BUDGET_INTRODUCTION}`
    );
  });

  it("asks the user for what is missing, and drafts nothing, when the tool call does not hold up", async () => {
    ollamaClientMock.startChatEventStream.mockResolvedValue(
      streamOf([toolCallEvent("propose_budget", { category: "Pets", monthlyLimit: 80 })])
    );

    const replyEvents = await startChatReply("u-1", "Prompt", "Set a pet budget");
    const events = await collectEvents(replyEvents);

    expect(events).toEqual([
      { type: "text", text: expect.stringContaining('"Pets" isn\'t one of them') },
    ]);
    const [, exchange] = chatHistoryMock.saveChatExchange.mock.calls[0]!;
    expect(exchange.reply).toContain('"Pets" isn\'t one of them');
    expect(exchange.proposedAction).toBeUndefined();
  });

  it("asks for the amount, and drafts nothing, when the model made one up", async () => {
    ollamaClientMock.startChatEventStream.mockResolvedValue(
      streamOf([toolCallEvent("propose_budget", { category: "Groceries", monthlyLimit: 400 })])
    );

    const replyEvents = await startChatReply("u-1", "Prompt", "Set a grocery budget");

    expect(await collectEvents(replyEvents)).toEqual([
      { type: "text", text: "How much should the monthly limit for Groceries be?" },
    ]);
    expect(chatHistoryMock.saveChatExchange.mock.calls[0]![1].proposedAction).toBeUndefined();
  });

  it("accepts an amount the user gave in an earlier turn of the conversation", async () => {
    chatHistoryMock.listRecentChatMessages.mockResolvedValue([
      {
        id: "m-1",
        role: "user",
        content: "I want to spend at most $400 on groceries",
        proposedAction: null,
        proposedActionStatus: null,
        createdAt: new Date(),
      },
      {
        id: "m-2",
        role: "assistant",
        content: "Your groceries averaged $520, so $9,999 would be too much.",
        proposedAction: null,
        proposedActionStatus: null,
        createdAt: new Date(),
      },
    ]);
    ollamaClientMock.startChatEventStream.mockResolvedValue(
      streamOf([toolCallEvent("propose_budget", { category: "Groceries", monthlyLimit: 400 })])
    );

    const replyEvents = await startChatReply("u-1", "Prompt", "Yes, set that budget");
    const events = await collectEvents(replyEvents);

    expect(events.at(-1)).toMatchObject({
      type: "proposal",
      proposedAction: GROCERIES_BUDGET_DRAFT,
    });
  });

  it("does not accept an amount left over from a request that already produced a draft", async () => {
    chatHistoryMock.listRecentChatMessages.mockResolvedValue([
      {
        id: "m-1",
        role: "user",
        content: "Set a $400 grocery budget",
        proposedAction: null,
        proposedActionStatus: null,
        createdAt: new Date(),
      },
      {
        id: "m-2",
        role: "assistant",
        content: GROCERIES_BUDGET_INTRODUCTION,
        proposedAction: GROCERIES_BUDGET_DRAFT,
        proposedActionStatus: "CONFIRMED",
        createdAt: new Date(),
      },
    ]);
    ollamaClientMock.startChatEventStream.mockResolvedValue(
      streamOf([toolCallEvent("propose_savings_goal", { goalName: "Trip", targetAmount: 400 })])
    );

    const replyEvents = await startChatReply("u-1", "Prompt", "Create a goal for a trip in June");

    expect(await collectEvents(replyEvents)).toEqual([
      { type: "text", text: "To draft that goal, tell me how much you want to save." },
    ]);
  });

  it("does not accept an amount that only the assistant mentioned", async () => {
    chatHistoryMock.listRecentChatMessages.mockResolvedValue([
      {
        id: "m-1",
        role: "user",
        content: "How much should I budget for groceries?",
        proposedAction: null,
        proposedActionStatus: null,
        createdAt: new Date(),
      },
      {
        id: "m-2",
        role: "assistant",
        content: "Around $400 would be reasonable.",
        proposedAction: null,
        proposedActionStatus: null,
        createdAt: new Date(),
      },
    ]);
    ollamaClientMock.startChatEventStream.mockResolvedValue(
      streamOf([toolCallEvent("propose_budget", { category: "Groceries", monthlyLimit: 400 })])
    );

    const replyEvents = await startChatReply("u-1", "Prompt", "Yes, do that");

    expect(await collectEvents(replyEvents)).toEqual([
      { type: "text", text: "How much should the monthly limit for Groceries be?" },
    ]);
  });

  it("drafts only the first of several tool calls and says so", async () => {
    ollamaClientMock.startChatEventStream.mockResolvedValue(
      streamOf([
        toolCallEvent("propose_budget", { category: "Groceries", monthlyLimit: 400 }),
        toolCallEvent("propose_budget", { category: "Dining", monthlyLimit: 100 }),
      ])
    );

    const replyEvents = await startChatReply(
      "u-1",
      "Prompt",
      "Set a $400 grocery budget and a $100 dining budget"
    );
    const events = await collectEvents(replyEvents);

    expect(events).toEqual([
      {
        type: "text",
        text: `${GROCERIES_BUDGET_INTRODUCTION} I can only draft one thing at a time — ask me for the next one after.`,
      },
      { type: "proposal", messageId: "reply-message-1", proposedAction: GROCERIES_BUDGET_DRAFT },
    ]);
  });

  it("validates a savings goal's deadline against the day the question was asked", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-12T15:00:00.000Z"));
    try {
      ollamaClientMock.startChatEventStream.mockResolvedValue(
        streamOf([
          toolCallEvent("propose_savings_goal", {
            goalName: "Japan trip",
            targetAmount: 3000,
            targetDate: "2026-10-11",
          }),
        ])
      );

      const replyEvents = await startChatReply("u-1", "Prompt", "Save $3000 for a trip");
      const events = await collectEvents(replyEvents);

      expect(events).toEqual([
        { type: "text", text: expect.stringContaining("(2026-10-11) has already passed") },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows no card, and says why, when the draft could not be stored", async () => {
    ollamaClientMock.startChatEventStream.mockResolvedValue(
      streamOf([toolCallEvent("propose_budget", { category: "Groceries", monthlyLimit: 400 })])
    );
    chatHistoryMock.saveChatExchange.mockRejectedValue(new Error("database unavailable"));

    const replyEvents = await startChatReply("u-1", "Prompt", "Set a $400 grocery budget");
    const events = await collectEvents(replyEvents);

    expect(events).toEqual([
      { type: "text", text: GROCERIES_BUDGET_INTRODUCTION },
      { type: "text", text: expect.stringContaining("I couldn't keep that draft just now") },
    ]);
  });

  it("stores the draft with the reply when the consumer stops reading at the introduction", async () => {
    ollamaClientMock.startChatEventStream.mockResolvedValue(
      streamOf([toolCallEvent("propose_budget", { category: "Groceries", monthlyLimit: 400 })])
    );

    const replyEvents = await startChatReply("u-1", "Prompt", "Set a $400 grocery budget");
    await replyEvents.next();
    await replyEvents.return();

    expect(chatHistoryMock.saveChatExchange).toHaveBeenCalledTimes(1);
    expect(chatHistoryMock.saveChatExchange).toHaveBeenCalledWith(
      "u-1",
      expect.objectContaining({
        reply: GROCERIES_BUDGET_INTRODUCTION,
        proposedAction: GROCERIES_BUDGET_DRAFT,
      })
    );
  });
});
