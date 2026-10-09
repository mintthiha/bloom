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
