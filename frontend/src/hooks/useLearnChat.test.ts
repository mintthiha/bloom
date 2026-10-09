import { renderHook, act, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { useLearnChat } from "./useLearnChat";

const { apiMock, toastMock } = vi.hoisted(() => ({
  apiMock: { listChatMessages: vi.fn() },
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/api", () => ({ api: apiMock }));
vi.mock("sonner", () => ({ toast: toastMock }));

/** Builds a fetch Response stub whose body streams the given text chunks. */
function streamingResponse(chunks: string[]) {
  const encoder = new TextEncoder();
  let index = 0;
  return {
    ok: true,
    body: {
      getReader: () => ({
        read: async () =>
          index < chunks.length
            ? { done: false, value: encoder.encode(chunks[index++]) }
            : { done: true, value: undefined },
      }),
    },
  };
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
