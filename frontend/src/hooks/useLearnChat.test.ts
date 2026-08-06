import { renderHook, act, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { useLearnChat } from "./useLearnChat";

const { storageMock } = vi.hoisted(() => ({
  storageMock: {
    loadStoredMessages: vi.fn(() => []),
    saveStoredMessages: vi.fn(),
    clearStoredMessages: vi.fn(),
  },
}));

vi.mock("@/app/learn/_components/_aiChat/chat-storage", () => storageMock);

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

beforeEach(() => {
  vi.clearAllMocks();
  storageMock.loadStoredMessages.mockReturnValue([]);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useLearnChat", () => {
  it("starts empty", () => {
    const { result } = renderHook(() => useLearnChat());
    expect(result.current.messages).toEqual([]);
    expect(result.current.input).toBe("");
    expect(result.current.streaming).toBe(false);
  });

  it("sends a message and appends the streamed assistant reply", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamingResponse(["Hello", " world"])));
    const { result } = renderHook(() => useLearnChat());

    await act(async () => {
      await result.current.sendMessage("hi");
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/learn/chat",
      expect.objectContaining({ method: "POST" })
    );
    expect(result.current.messages).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "Hello world" },
    ]);
    expect(result.current.streaming).toBe(false);
  });

  it("uses the typed input and clears it after sending", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamingResponse(["ok"])));
    const { result } = renderHook(() => useLearnChat());

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
    const { result } = renderHook(() => useLearnChat());

    await act(async () => {
      await result.current.sendMessage("hi");
    });

    expect(result.current.messages[1]).toEqual({
      role: "assistant",
      content: "Service unavailable",
    });
  });

  it("ignores empty submissions", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { result } = renderHook(() => useLearnChat());

    await act(async () => {
      await result.current.sendMessage("   ");
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([]);
  });

  it("clears the conversation and wipes storage", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamingResponse(["hi"])));
    const { result } = renderHook(() => useLearnChat());

    await act(async () => {
      await result.current.sendMessage("hi");
    });
    act(() => result.current.clearConversation());

    expect(result.current.messages).toEqual([]);
    expect(storageMock.clearStoredMessages).toHaveBeenCalled();
  });

  it("sends on Enter but not on Shift+Enter", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(streamingResponse(["ok"]));
    vi.stubGlobal("fetch", fetchSpy);
    const { result } = renderHook(() => useLearnChat());

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
