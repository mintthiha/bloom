import { renderHook, act, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { ChatReplyEvent } from "@/lib/chat-reply-events";
import { useLearnChat } from "./useLearnChat";

const { apiMock, toastMock } = vi.hoisted(() => ({
  apiMock: { listChatMessages: vi.fn() },
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/api", () => ({ api: apiMock }));
vi.mock("sonner", () => ({ toast: toastMock }));

const GROCERIES_BUDGET_DRAFT = {
  kind: "BUDGET" as const,
  category: "Groceries",
  monthlyLimit: 400,
  currentMonthlyLimit: null,
};

/** Builds a fetch Response stub whose body streams the given reply events, one JSON line each. */
function eventStreamResponse(replyEvents: ChatReplyEvent[]) {
  const encoder = new TextEncoder();
  let index = 0;
  return {
    ok: true,
    body: {
      getReader: () => ({
        read: async () =>
          index < replyEvents.length
            ? { done: false, value: encoder.encode(`${JSON.stringify(replyEvents[index++])}\n`) }
            : { done: true, value: undefined },
      }),
    },
  };
}

/** Builds a fetch Response stub whose body streams a plain text reply in the given chunks. */
function streamingResponse(chunks: string[]) {
  return eventStreamResponse(chunks.map((chunk) => ({ type: "text", text: chunk })));
}

/** Renders the hook and waits until the stored conversation has finished loading. */
async function renderLoadedChat() {
  const rendered = renderHook(() => useLearnChat());
  await waitFor(() => expect(rendered.result.current.isLoadingHistory).toBe(false));
  return rendered;
}

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.listChatMessages.mockResolvedValue({ messages: [] });
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("useLearnChat", () => {
  it("starts empty and loading, then settles once the stored conversation arrives", async () => {
    const { result } = renderHook(() => useLearnChat());

    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoadingHistory).toBe(true);
    expect(result.current.input).toBe("");
    expect(result.current.streaming).toBe(false);

    await waitFor(() => expect(result.current.isLoadingHistory).toBe(false));
    expect(result.current.messages).toEqual([]);
  });

  it("shows the conversation the server has stored", async () => {
    apiMock.listChatMessages.mockResolvedValue({
      messages: [
        { id: "m-1", role: "user", content: "What is a TFSA?", createdAt: "2026-10-08T12:00:00Z" },
        { id: "m-2", role: "assistant", content: "An account.", createdAt: "2026-10-08T12:00:05Z" },
      ],
    });

    const { result } = await renderLoadedChat();

    expect(result.current.messages).toEqual([
      { role: "user", content: "What is a TFSA?" },
      { role: "assistant", content: "An account." },
    ]);
  });

  it("restores a stored reply's draft along with where it stands", async () => {
    apiMock.listChatMessages.mockResolvedValue({
      messages: [
        {
          id: "m-1",
          role: "user",
          content: "Set a $400 grocery budget",
          proposedAction: null,
          proposedActionStatus: null,
          createdAt: "2026-10-12T12:00:00Z",
        },
        {
          id: "m-2",
          role: "assistant",
          content: "I've drafted a budget.",
          proposedAction: GROCERIES_BUDGET_DRAFT,
          proposedActionStatus: "CONFIRMED",
          createdAt: "2026-10-12T12:00:05Z",
        },
      ],
    });

    const { result } = await renderLoadedChat();

    expect(result.current.messages).toEqual([
      { role: "user", content: "Set a $400 grocery budget" },
      {
        role: "assistant",
        content: "I've drafted a budget.",
        proposal: {
          messageId: "m-2",
          proposedAction: GROCERIES_BUDGET_DRAFT,
          status: "CONFIRMED",
        },
      },
    ]);
    expect(result.current.messages[0]).not.toHaveProperty("proposal");
  });

  it("attaches a streamed draft to the reply as pending", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        eventStreamResponse([
          { type: "text", text: "I've drafted " },
          { type: "text", text: "a budget." },
          { type: "proposal", messageId: "m-2", proposedAction: GROCERIES_BUDGET_DRAFT },
        ])
      )
    );
    const { result } = await renderLoadedChat();

    await act(async () => {
      await result.current.sendMessage("Set a $400 grocery budget");
    });

    expect(result.current.messages).toEqual([
      { role: "user", content: "Set a $400 grocery budget" },
      {
        role: "assistant",
        content: "I've drafted a budget.",
        proposal: { messageId: "m-2", proposedAction: GROCERIES_BUDGET_DRAFT, status: "PENDING" },
      },
    ]);
  });

  it("updates only the matching draft when its status changes", async () => {
    apiMock.listChatMessages.mockResolvedValue({
      messages: ["m-2", "m-4"].map((id) => ({
        id,
        role: "assistant",
        content: "Drafted.",
        proposedAction: GROCERIES_BUDGET_DRAFT,
        proposedActionStatus: "PENDING",
        createdAt: "2026-10-12T12:00:00Z",
      })),
    });
    const { result } = await renderLoadedChat();

    act(() => result.current.setProposalStatus("m-4", "DISMISSED"));

    expect(result.current.messages.map((message) => message.proposal?.status)).toEqual([
      "PENDING",
      "DISMISSED",
    ]);
    expect(result.current.messages[1]?.proposal?.proposedAction).toEqual(GROCERIES_BUDGET_DRAFT);
  });

  it("starts an empty chat and tells the user when the conversation cannot be loaded", async () => {
    apiMock.listChatMessages.mockRejectedValue(new Error("Request failed"));

    const { result } = await renderLoadedChat();

    expect(result.current.messages).toEqual([]);
    expect(toastMock.error).toHaveBeenCalledWith("Couldn't load your conversation");
  });

  it("does not send while the stored conversation is still loading", async () => {
    apiMock.listChatMessages.mockReturnValue(new Promise(() => {}));
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { result } = renderHook(() => useLearnChat());

    await act(async () => {
      await result.current.sendMessage("hi");
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([]);
  });

  it("sends only the new message and appends the streamed assistant reply", async () => {
    apiMock.listChatMessages.mockResolvedValue({
      messages: [
        { id: "m-1", role: "user", content: "earlier", createdAt: "2026-10-08T12:00:00Z" },
        { id: "m-2", role: "assistant", content: "reply", createdAt: "2026-10-08T12:00:05Z" },
      ],
    });
    const fetchSpy = vi.fn().mockResolvedValue(streamingResponse(["Hello", " world"]));
    vi.stubGlobal("fetch", fetchSpy);
    const { result } = await renderLoadedChat();

    await act(async () => {
      await result.current.sendMessage("hi");
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/learn/chat",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ message: "hi" }) })
    );
    expect(result.current.messages).toEqual([
      { role: "user", content: "earlier" },
      { role: "assistant", content: "reply" },
      { role: "user", content: "hi" },
      { role: "assistant", content: "Hello world" },
    ]);
    expect(result.current.streaming).toBe(false);
  });

  it("uses the typed input and clears it after sending", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamingResponse(["ok"])));
    const { result } = await renderLoadedChat();

    act(() => result.current.setInput("what is a TFSA?"));
    await act(async () => {
      await result.current.sendMessage();
    });

    expect(result.current.input).toBe("");
    expect(result.current.messages[0]).toEqual({ role: "user", content: "what is a TFSA?" });
  });

  it("surfaces the server's message on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, body: null, text: async () => "Service unavailable" })
    );
    const { result } = await renderLoadedChat();

    await act(async () => {
      await result.current.sendMessage("hi");
    });

    expect(result.current.messages[1]).toEqual({
      role: "assistant",
      content: "Service unavailable",
    });
  });

  it("shows a fallback reply when the request itself fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const { result } = await renderLoadedChat();

    await act(async () => {
      await result.current.sendMessage("hi");
    });

    expect(result.current.messages[1]).toEqual({
      role: "assistant",
      content: "Sorry, something went wrong. Please try again.",
    });
    expect(result.current.streaming).toBe(false);
  });

  it("marks the reply as stopped when generation is cancelled before any text arrives", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError"))
            );
          })
      )
    );
    const { result } = await renderLoadedChat();

    let pendingSend: Promise<void> = Promise.resolve();
    act(() => {
      pendingSend = result.current.sendMessage("hi");
    });
    await waitFor(() => expect(result.current.streaming).toBe(true));
    await act(async () => {
      result.current.stopGeneration();
      await pendingSend;
    });

    expect(result.current.messages[1]).toEqual({ role: "assistant", content: "_Stopped._" });
    expect(result.current.streaming).toBe(false);
  });

  it("ignores empty submissions", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { result } = await renderLoadedChat();

    await act(async () => {
      await result.current.sendMessage("   ");
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([]);
  });

  it("empties the chat window and removes the legacy browser copy when reset", async () => {
    localStorage.setItem("bloom_learn_chat", JSON.stringify([{ role: "user", content: "old" }]));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamingResponse(["hi"])));
    const { result } = await renderLoadedChat();

    await act(async () => {
      await result.current.sendMessage("hi");
    });
    act(() => result.current.resetConversation());

    expect(result.current.messages).toEqual([]);
    expect(localStorage.getItem("bloom_learn_chat")).toBeNull();
  });

  it("sends on Enter but not on Shift+Enter", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(streamingResponse(["ok"]));
    vi.stubGlobal("fetch", fetchSpy);
    const { result } = await renderLoadedChat();

    act(() => result.current.setInput("hello"));

    const preventDefault = vi.fn();
    act(() => {
      result.current.handleKeyDown({
        key: "Enter",
        shiftKey: true,
        preventDefault,
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>);
    });
    expect(fetchSpy).not.toHaveBeenCalled();

    await act(async () => {
      result.current.handleKeyDown({
        key: "Enter",
        shiftKey: false,
        preventDefault,
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>);
    });
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
  });
});

/**
 * Builds a stand-in messages container with a fixed viewport height whose content height the test
 * controls, since jsdom does no layout. `scrollTop` is a plain writable value so jumps can be read.
 */
function makeMessagesContainer(clientHeight: number) {
  const container = document.createElement("div");
  let scrollHeight = clientHeight;
  Object.defineProperty(container, "clientHeight", { get: () => clientHeight });
  Object.defineProperty(container, "scrollHeight", { get: () => scrollHeight });
  Object.defineProperty(container, "scrollTop", { value: 0, writable: true });
  return {
    container,
    setContentHeight(height: number) {
      scrollHeight = height;
    },
  };
}

describe("useLearnChat scrolling", () => {
  it("jumps to the bottom when a message is sent, even one taller than the follow threshold", async () => {
    let resolveFetch: (response: unknown) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise((resolve) => (resolveFetch = resolve)))
    );
    const { result } = await renderLoadedChat();
    const { container, setContentHeight } = makeMessagesContainer(400);
    result.current.messagesContainerRef.current = container;
    // The new question renders 300px of content below the old bottom — well past 120px.
    setContentHeight(700);

    act(() => {
      void result.current.sendMessage("A tall question\nwith\nmany\nlines");
    });

    expect(container.scrollTop).toBe(700);
    await act(async () => resolveFetch(streamingResponse(["ok"])));
  });

  it("does not drag the user back down mid-reply after they scroll up", async () => {
    let releaseSecondChunk: () => void = () => {};
    const secondChunkReleased = new Promise<void>((resolve) => (releaseSecondChunk = resolve));
    const encoder = new TextEncoder();
    const chunks = ["first ", "second"];
    let chunkIndex = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: async () => {
              if (chunkIndex === 1) await secondChunkReleased;
              return chunkIndex < chunks.length
                ? {
                    done: false,
                    value: encoder.encode(
                      `${JSON.stringify({ type: "text", text: chunks[chunkIndex++] })}\n`
                    ),
                  }
                : { done: true, value: undefined };
            },
          }),
        },
      })
    );
    const { result } = await renderLoadedChat();
    const { container, setContentHeight } = makeMessagesContainer(400);
    result.current.messagesContainerRef.current = container;
    setContentHeight(700);

    let sendPromise: Promise<void> = Promise.resolve();
    act(() => {
      sendPromise = result.current.sendMessage("hi");
    });
    await waitFor(() => expect(result.current.messages.at(-1)?.content).toBe("first "));

    // The user scrolls up to re-read; then more of the reply streams in.
    container.scrollTop = 0;
    setContentHeight(900);
    await act(async () => {
      releaseSecondChunk();
      await sendPromise;
    });

    expect(result.current.messages.at(-1)?.content).toBe("first second");
    expect(container.scrollTop).toBe(0);
  });
});
