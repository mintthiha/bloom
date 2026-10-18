import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  },
}));

vi.mock("@prisma/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@prisma/client")>();
  return {
    ...actual,
    PrismaClient: class {
      $queryRaw = prismaMock.$queryRaw;
      $executeRaw = prismaMock.$executeRaw;
    },
  };
});

describe("chatHistoryService", () => {
  beforeEach(() => {
    prismaMock.$queryRaw.mockReset();
    prismaMock.$executeRaw.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("listRecentChatMessages", () => {
    it("returns the stored messages as the database ordered them", async () => {
      const { listRecentChatMessages } = await import("./chatHistoryService");
      const storedMessages = [
        { id: "m-1", role: "user", content: "What is a TFSA?", createdAt: new Date("2026-10-08") },
        { id: "m-2", role: "assistant", content: "A registered account.", createdAt: new Date() },
      ];
      prismaMock.$queryRaw.mockResolvedValueOnce(storedMessages);

      await expect(listRecentChatMessages("u-1", 200)).resolves.toEqual(storedMessages);
    });

    it("takes the newest messages for that user only, then presents them oldest first", async () => {
      const { listRecentChatMessages } = await import("./chatHistoryService");
      prismaMock.$queryRaw.mockResolvedValueOnce([]);

      await listRecentChatMessages("u-1", 20);

      const [sqlParts, ...parameters] = prismaMock.$queryRaw.mock.calls[0]!;
      const sql = String(sqlParts);
      expect(parameters).toEqual(["u-1", 20]);
      expect(sql).toMatch(/WHERE "userId" = \s*,?\s*ORDER BY "createdAt" DESC\s+LIMIT/);
      expect(sql.trimEnd()).toMatch(/ORDER BY "createdAt" ASC$/);
    });

    it("reads each message's spending lookup", async () => {
      const { listRecentChatMessages } = await import("./chatHistoryService");
      prismaMock.$queryRaw.mockResolvedValueOnce([]);

      await listRecentChatMessages("u-1", 20);

      const sql = String(prismaMock.$queryRaw.mock.calls[0]![0]);
      expect(sql.match(/"spendingLookup"/g)).toHaveLength(2);
    });

    it("reads each message's draft and where that draft stands", async () => {
      const { listRecentChatMessages } = await import("./chatHistoryService");
      prismaMock.$queryRaw.mockResolvedValueOnce([]);

      await listRecentChatMessages("u-1", 20);

      const sql = String(prismaMock.$queryRaw.mock.calls[0]![0]);
      expect(sql.match(/"proposedAction", "proposedActionStatus"/g)).toHaveLength(2);
    });
  });

  describe("saveChatExchange", () => {
    it("writes the question and the reply in one statement, question first", async () => {
      const { saveChatExchange } = await import("./chatHistoryService");
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-10-08T12:00:05.000Z"));
      const askedAt = new Date("2026-10-08T12:00:00.000Z");

      await saveChatExchange("u-1", { question: "What is a TFSA?", askedAt, reply: "An account." });

      expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(1);
      const [sqlParts, ...parameters] = prismaMock.$executeRaw.mock.calls[0]!;
      const sql = String(sqlParts);
      expect(sql.indexOf("'user'")).toBeGreaterThan(-1);
      expect(sql.indexOf("'user'")).toBeLessThan(sql.indexOf("'assistant'"));
      const [
        questionId,
        questionUserId,
        question,
        questionAt,
        replyId,
        replyUserId,
        reply,
        replyAt,
      ] = parameters;
      expect(questionId).not.toBe(replyId);
      expect([questionUserId, replyUserId]).toEqual(["u-1", "u-1"]);
      expect([question, reply]).toEqual(["What is a TFSA?", "An account."]);
      expect(questionAt).toEqual(askedAt);
      expect(replyAt).toEqual(new Date("2026-10-08T12:00:05.000Z"));
    });

    it("stamps the reply after the question even when the clock has not moved", async () => {
      const { saveChatExchange } = await import("./chatHistoryService");
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-10-08T12:00:00.000Z"));
      const askedAt = new Date("2026-10-08T12:00:00.000Z");

      await saveChatExchange("u-1", { question: "Hi", askedAt, reply: "Hello" });

      const parameters = prismaMock.$executeRaw.mock.calls[0]!.slice(1);
      expect(parameters[7]).toEqual(new Date("2026-10-08T12:00:00.001Z"));
    });

    it("returns the id the reply was stored under", async () => {
      const { saveChatExchange } = await import("./chatHistoryService");

      const replyMessageId = await saveChatExchange("u-1", {
        question: "Hi",
        askedAt: new Date(),
        reply: "Hello",
      });

      const parameters = prismaMock.$executeRaw.mock.calls[0]!.slice(1);
      expect(replyMessageId).toBe(parameters[4]);
      expect(replyMessageId).toEqual(expect.any(String));
    });

    it("stores an ordinary reply without a draft", async () => {
      const { saveChatExchange } = await import("./chatHistoryService");

      await saveChatExchange("u-1", { question: "Hi", askedAt: new Date(), reply: "Hello" });

      const parameters = prismaMock.$executeRaw.mock.calls[0]!.slice(1);
      expect(parameters.slice(8)).toEqual([null, null, null]);
    });

    it("stores the spending lookup a reply answered from, on the reply only", async () => {
      const { saveChatExchange } = await import("./chatHistoryService");

      await saveChatExchange("u-1", {
        question: "How much at Costco this year?",
        askedAt: new Date(),
        reply: "You spent $278.50 at Costco so far in 2026.",
        spendingLookup: { merchant: "Costco", period: "this year" },
      });

      const [sqlParts, ...parameters] = prismaMock.$executeRaw.mock.calls[0]!;
      expect(String(sqlParts)).toMatch(/NULL, NULL, NULL\),\s+\(/);
      expect(parameters[9]).toBeNull();
      expect(JSON.parse(parameters[10] as string)).toEqual({
        merchant: "Costco",
        period: "this year",
      });
    });

    it("stores a reply's draft as pending, on the reply only", async () => {
      const { saveChatExchange } = await import("./chatHistoryService");
      const proposedAction = {
        kind: "BUDGET" as const,
        category: "Groceries",
        monthlyLimit: 400,
        currentMonthlyLimit: null,
      };

      await saveChatExchange("u-1", {
        question: "Set a $400 grocery budget",
        askedAt: new Date(),
        reply: "Drafted.",
        proposedAction,
      });

      const [sqlParts, ...parameters] = prismaMock.$executeRaw.mock.calls[0]!;
      expect(String(sqlParts)).toMatch(/NULL, NULL\),\s+\(/);
      expect(JSON.parse(parameters[8] as string)).toEqual(proposedAction);
      expect(parameters[9]).toBe("PENDING");
    });
  });

  describe("moveProposedActionStatus", () => {
    it("moves only that user's draft, and only out of the expected status", async () => {
      const { moveProposedActionStatus } = await import("./chatHistoryService");
      const proposedAction = { kind: "BUDGET", category: "Groceries", monthlyLimit: 400 };
      prismaMock.$queryRaw.mockResolvedValueOnce([{ proposedAction }]);

      await expect(moveProposedActionStatus("u-1", "m-1", "PENDING", "CONFIRMED")).resolves.toEqual(
        proposedAction
      );

      const [sqlParts, ...parameters] = prismaMock.$queryRaw.mock.calls[0]!;
      const sql = String(sqlParts);
      expect(parameters).toEqual(["CONFIRMED", "m-1", "u-1", "PENDING"]);
      expect(sql).toMatch(/UPDATE "ChatMessage"\s+SET "proposedActionStatus" = /);
      expect(sql).toMatch(/"id" = \s*,?\s*AND "userId" = \s*,?\s*AND "proposedActionStatus" = /);
      expect(sql).toMatch(/RETURNING "proposedAction"/);
    });

    it("returns null when no draft was in the expected status", async () => {
      const { moveProposedActionStatus } = await import("./chatHistoryService");
      prismaMock.$queryRaw.mockResolvedValueOnce([]);

      await expect(
        moveProposedActionStatus("u-1", "m-1", "PENDING", "DISMISSED")
      ).resolves.toBeNull();
    });
  });

  describe("getProposedActionStatus", () => {
    it("returns where that user's draft stands", async () => {
      const { getProposedActionStatus } = await import("./chatHistoryService");
      prismaMock.$queryRaw.mockResolvedValueOnce([{ proposedActionStatus: "CONFIRMED" }]);

      await expect(getProposedActionStatus("u-1", "m-1")).resolves.toBe("CONFIRMED");

      const [sqlParts, ...parameters] = prismaMock.$queryRaw.mock.calls[0]!;
      expect(parameters).toEqual(["m-1", "u-1"]);
      expect(String(sqlParts)).toMatch(/WHERE "id" = \s*,?\s*AND "userId" = /);
    });

    it.each([
      ["the message carries no draft", [{ proposedActionStatus: null }]],
      ["the user has no such message", []],
    ])("returns null when %s", async (_description, rows) => {
      const { getProposedActionStatus } = await import("./chatHistoryService");
      prismaMock.$queryRaw.mockResolvedValueOnce(rows);

      await expect(getProposedActionStatus("u-1", "m-1")).resolves.toBeNull();
    });
  });

  describe("clearChatMessages", () => {
    it("deletes only that user's messages and reports how many were removed", async () => {
      const { clearChatMessages } = await import("./chatHistoryService");
      prismaMock.$executeRaw.mockResolvedValueOnce(6);

      await expect(clearChatMessages("u-1")).resolves.toBe(6);

      const [sqlParts, ...parameters] = prismaMock.$executeRaw.mock.calls[0]!;
      expect(String(sqlParts)).toMatch(/DELETE FROM "ChatMessage" WHERE "userId" = /);
      expect(parameters).toEqual(["u-1"]);
    });
  });
});
