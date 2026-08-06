import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatSection } from "./ChatSection";
import type { ChatMessage } from "./chat-storage";

vi.mock("./MarkdownMessage", () => ({
  MarkdownMessage: ({ content }: { content: string }) => (
    <div data-testid="markdown">{content}</div>
  ),
}));

vi.mock("./ThinkingIndicator", () => ({
  ThinkingIndicator: () => <div data-testid="thinking" />,
}));

/** Renders ChatSection with sensible default props, overridable per test. */
function renderChat(overrides: Partial<React.ComponentProps<typeof ChatSection>> = {}) {
  const props = {
    messages: [] as ChatMessage[],
    isDouble: false,
    streaming: false,
    messagesContainerRef: { current: null },
    textAreaRef: { current: null },
    input: "",
    setInput: vi.fn(),
    sendMessage: vi.fn(),
    handleKeyDown: vi.fn(),
    onStop: vi.fn(),
    onClear: vi.fn(),
    ...overrides,
  };
  render(<ChatSection {...props} />);
  return props;
}

describe("ChatSection", () => {
  it("shows suggested prompts on an empty conversation and sends one when clicked", () => {
    const { sendMessage } = renderChat();

    expect(screen.getByText(/Ask me anything about your money/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "What's my net worth right now?" }));

    expect(sendMessage).toHaveBeenCalledWith("What's my net worth right now?");
  });

  it("renders user text, assistant markdown, and a thinking indicator for an empty reply", () => {
    renderChat({
      messages: [
        { role: "user", content: "hi there" },
        { role: "assistant", content: "**hello**" },
        { role: "assistant", content: "" },
      ],
    });

    expect(screen.getByText("hi there")).toBeInTheDocument();
    expect(screen.getByTestId("markdown")).toHaveTextContent("**hello**");
    expect(screen.getByTestId("thinking")).toBeInTheDocument();
  });

  it("shows the Clear button only when there are messages", () => {
    const { onClear } = renderChat({ messages: [{ role: "user", content: "hi" }] });
    fireEvent.click(screen.getByRole("button", { name: /clear/i }));
    expect(onClear).toHaveBeenCalled();
  });

  it("hides the Clear button on an empty conversation", () => {
    renderChat();
    expect(screen.queryByRole("button", { name: /clear/i })).not.toBeInTheDocument();
  });

  it("updates the draft as the user types", () => {
    const { setInput } = renderChat();
    fireEvent.change(screen.getByLabelText("Ask a financial question"), {
      target: { value: "how much did I spend?" },
    });
    expect(setInput).toHaveBeenCalledWith("how much did I spend?");
  });

  it("disables send when the input is empty", () => {
    renderChat({ input: "" });
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("sends the current draft when the input has text", () => {
    const { sendMessage } = renderChat({ input: "hello" });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(sendMessage).toHaveBeenCalledWith();
  });

  it("shows a Stop button and disables the textarea while streaming", () => {
    const { onStop } = renderChat({ streaming: true, input: "x" });

    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Ask a financial question")).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Stop generating" }));
    expect(onStop).toHaveBeenCalled();
  });
});
