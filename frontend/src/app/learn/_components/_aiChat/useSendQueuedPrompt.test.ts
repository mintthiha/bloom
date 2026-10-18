import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { queueAskBloomPrompt } from "@/lib/ask-bloom-handoff";
import { useSendQueuedPrompt } from "./useSendQueuedPrompt";

/** Builds a ref to an element whose scrollIntoView can be asserted on (jsdom doesn't implement it). */
function makeChatElementRef() {
  const element = document.createElement("div");
  element.scrollIntoView = vi.fn();
  return { current: element };
}

afterEach(() => {
  sessionStorage.clear();
});

describe("useSendQueuedPrompt", () => {
  it("sends the queued question once the chat is ready and scrolls the chat into view", () => {
    queueAskBloomPrompt("Why is my score 62?");
    const sendMessage = vi.fn();
    const chatElementRef = makeChatElementRef();

    renderHook(() => useSendQueuedPrompt({ isReady: true, sendMessage, chatElementRef }));

    expect(sendMessage).toHaveBeenCalledExactlyOnceWith("Why is my score 62?");
    expect(chatElementRef.current.scrollIntoView).toHaveBeenCalled();
  });

  it("waits for the chat to be ready before taking the question", () => {
    queueAskBloomPrompt("Why is my score 62?");
    const sendMessage = vi.fn();
    const chatElementRef = makeChatElementRef();

    const { rerender } = renderHook(
      ({ isReady }) => useSendQueuedPrompt({ isReady, sendMessage, chatElementRef }),
      { initialProps: { isReady: false } }
    );
    expect(sendMessage).not.toHaveBeenCalled();

    rerender({ isReady: true });
    expect(sendMessage).toHaveBeenCalledExactlyOnceWith("Why is my score 62?");
  });

  it("does nothing when no question is queued", () => {
    const sendMessage = vi.fn();
    const chatElementRef = makeChatElementRef();

    renderHook(() => useSendQueuedPrompt({ isReady: true, sendMessage, chatElementRef }));

    expect(sendMessage).not.toHaveBeenCalled();
    expect(chatElementRef.current.scrollIntoView).not.toHaveBeenCalled();
  });

  it("checks the queue only once per visit, even when a question is queued later", () => {
    const sendMessage = vi.fn();
    const chatElementRef = makeChatElementRef();

    const { rerender } = renderHook(
      ({ sendMessage: currentSendMessage }) =>
        useSendQueuedPrompt({ isReady: true, sendMessage: currentSendMessage, chatElementRef }),
      { initialProps: { sendMessage } }
    );
    queueAskBloomPrompt("Queued after the check");
    // A fresh sendMessage identity (as the chat hook hands out every render) re-runs the effect.
    rerender({ sendMessage: vi.fn() });

    expect(sendMessage).not.toHaveBeenCalled();
  });
});
