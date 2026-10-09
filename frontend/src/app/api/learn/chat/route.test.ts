import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const { authMock, fetchFinancialSnapshotMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  fetchFinancialSnapshotMock: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("./financial-snapshot", () => ({ fetchFinancialSnapshot: fetchFinancialSnapshotMock }));

const fetchMock = vi.fn();

const EMPTY_SNAPSHOT = {
  accounts: [],
  monthlySummary: null,
  budgets: [],
  savingsGoals: [],
  subscriptions: null,
  recurringTransactions: [],
  profile: null,
  registeredTransactions: {},
};

/** Builds the request the chat hook sends: just the new question. */
function makeChatRequest(body: unknown): Request {
  return new Request("http://localhost/api/learn/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** Builds the backend's streamed plain-text reply. */
function makeBackendReply(replyChunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const replyChunk of replyChunks) controller.enqueue(encoder.encode(replyChunk));
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

/** Returns the URL, headers, and parsed JSON body of the request the route sent to the backend. */
function sentBackendRequest() {
  const [url, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
  return {
    url,
    headers: requestInit.headers as Record<string, string>,
    body: JSON.parse(requestInit.body as string) as { systemPrompt: string; message: string },
  };
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("INTERNAL_API_SECRET", "test-secret");
  fetchMock.mockReset();
  authMock.mockResolvedValue({ user: { id: "user-1" } });
  fetchFinancialSnapshotMock.mockResolvedValue(EMPTY_SNAPSHOT);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("POST /api/learn/chat", () => {
  it("returns 401 when the user is not signed in", async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(makeChatRequest({ message: "What is a TFSA?" }));

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["the message is missing", {}],
    ["the message is blank", { message: "   " }],
    ["the message is not a string", { message: ["Hi"] }],
    ["the body is JSON null", "null"],
    ["the body is not JSON", "not json"],
  ])("returns 400 when %s", async (_description, body) => {
    const response = await POST(makeChatRequest(body));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("relays the backend's streamed reply as plain text", async () => {
    fetchMock.mockResolvedValue(makeBackendReply(["A TFSA ", "is a registered account."]));

    const response = await POST(makeChatRequest({ message: "What is a TFSA?" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(await response.text()).toBe("A TFSA is a registered account.");
  });

  it("sends the question to the backend's internal chat endpoint as the signed-in user", async () => {
    fetchMock.mockResolvedValue(makeBackendReply(["ok"]));

    await POST(makeChatRequest({ message: "What is a TFSA?" }));

    const backendRequest = sentBackendRequest();
    expect(backendRequest.url).toBe("http://localhost:3001/api/internal/ai/chat");
    expect(backendRequest.headers).toMatchObject({
      "X-User-Id": "user-1",
      "X-Internal-Secret": "test-secret",
    });
    expect(backendRequest.body.message).toBe("What is a TFSA?");
  });

  it("grounds the system prompt with the Canadian tax facts but no snapshot for a user with no accounts", async () => {
    fetchMock.mockResolvedValue(makeBackendReply(["ok"]));

    await POST(makeChatRequest({ message: "What is a TFSA?" }));

    const { systemPrompt } = sentBackendRequest().body;
    expect(systemPrompt).toContain("You are Bloom's financial education assistant");
    expect(systemPrompt).toContain("FHSA contribution limit: $8,000 per year, $40,000 lifetime.");
    expect(systemPrompt).not.toContain("USER FINANCIAL SNAPSHOT");
  });

  it("adds the user's financial snapshot to the system prompt when they have accounts", async () => {
    fetchFinancialSnapshotMock.mockResolvedValue({
      ...EMPTY_SNAPSHOT,
      accounts: [{ id: "account-1", accountType: "CHEQUING", balance: 1500 }],
    });
    fetchMock.mockResolvedValue(makeBackendReply(["ok"]));

    await POST(makeChatRequest({ message: "What is a TFSA?" }));

    expect(fetchFinancialSnapshotMock).toHaveBeenCalledWith("user-1");
    const { systemPrompt } = sentBackendRequest().body;
    expect(systemPrompt).toContain("USER FINANCIAL SNAPSHOT");
    expect(systemPrompt).toContain("across 1 account(s)");
  });

  it("still answers, without personalization, when the snapshot cannot be loaded", async () => {
    fetchFinancialSnapshotMock.mockRejectedValue(new Error("backend down"));
    fetchMock.mockResolvedValue(makeBackendReply(["ok"]));

    const response = await POST(makeChatRequest({ message: "What is a TFSA?" }));

    expect(response.status).toBe(200);
    expect(sentBackendRequest().body.systemPrompt).not.toContain("USER FINANCIAL SNAPSHOT");
  });

  it("returns the friendly 503 message when the backend is unreachable", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    const response = await POST(makeChatRequest({ message: "What is a TFSA?" }));

    expect(response.status).toBe(503);
    expect(await response.text()).toBe(
      "Bloom AI is temporarily unavailable. Please try again in a moment."
    );
  });

  it("returns the friendly 503 message when the backend reports the AI is unavailable", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "AI service unavailable" }), { status: 503 })
    );

    const response = await POST(makeChatRequest({ message: "What is a TFSA?" }));

    expect(response.status).toBe(503);
    expect(await response.text()).toBe(
      "Bloom AI is temporarily unavailable. Please try again in a moment."
    );
  });

  it("returns 400 when the backend rejects the message", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "message must be at most 4000 characters" }), {
        status: 400,
      })
    );

    const response = await POST(makeChatRequest({ message: "a".repeat(4001) }));

    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Invalid message");
  });

  it("passes on the backend's rate limit as a 429 with its retry hint", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "Too many AI requests, please try again later." }), {
        status: 429,
        headers: { "Retry-After": "1200" },
      })
    );

    const response = await POST(makeChatRequest({ message: "What is a TFSA?" }));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("1200");
    expect(await response.text()).toBe(
      "You've reached the limit for Bloom AI messages. Please try again later."
    );
  });
});
