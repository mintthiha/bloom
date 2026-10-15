import { render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatSection } from "./ChatSection";
import type { ChatActionProposal, ChatMessage } from "@/lib/api";

vi.mock("./MarkdownMessage", () => ({
  MarkdownMessage: ({ content }: { content: string }) => (
    <div data-testid="markdown">{content}</div>
  ),
}));

vi.mock("./ThinkingIndicator", () => ({
  ThinkingIndicator: () => <div data-testid="thinking" />,
}));

vi.mock("./ProposedActionCard", () => ({
  ProposedActionCard: ({
    proposal,
    onStatusChange,
  }: {
    proposal: ChatActionProposal;
    onStatusChange: (messageId: string, status: "DISMISSED") => void;
  }) => (
    <button type="button" onClick={() => onStatusChange(proposal.messageId, "DISMISSED")}>
      Draft {proposal.messageId} is {proposal.status}
    </button>
  ),
}));

vi.mock("./ClearConversation", () => ({
  ClearConversation: ({
    messageCount,
    isDisabled,
    onCleared,
  }: {
    messageCount: number;
    isDisabled: boolean;
    onCleared: () => void;
  }) => (
    <button type="button" disabled={isDisabled} onClick={onCleared}>
      Clear {messageCount} messages
    </button>
  ),
}));

/** Renders ChatSection with sensible default props, overridable per test. */
function renderChat(overrides: Partial<React.ComponentProps<typeof ChatSection>> = {}) {
  const props = {
    messages: [] as ChatMessage[],
    isLoadingHistory: false,
    isDouble: false,
    streaming: false,
    messagesContainerRef: { current: null },
    textAreaRef: { current: null },
    input: "",
    setInput: vi.fn(),
    sendMessage: vi.fn(),
    handleKeyDown: vi.fn(),
    onStop: vi.fn(),
    onCleared: vi.fn(),
    onProposalStatusChange: vi.fn(),
    ...overrides,
  };
  rerenderLatestChat = render(<ChatSection {...props} />).rerender;
  return props;
}

let rerenderLatestChat: (ui: React.ReactElement) => void = () => {};

/** Re-renders the chat that `renderChat` last rendered with new props, as a parent update would. */
function rerenderChat(props: React.ComponentProps<typeof ChatSection>) {
  rerenderLatestChat(<ChatSection {...props} />);
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

  it("offers a prompt that asks Bloom AI to draft a budget", () => {
    const { sendMessage } = renderChat();

    fireEvent.click(
      screen.getByRole("button", { name: "Set a $400 monthly budget for groceries" })
    );

    expect(sendMessage).toHaveBeenCalledWith("Set a $400 monthly budget for groceries");
  });

  it("shows a draft card only under the reply that carries one, and reports what the user did", () => {
    const { onProposalStatusChange } = renderChat({
      messages: [
        { role: "user", content: "Set a $400 grocery budget" },
        {
          role: "assistant",
          content: "I've drafted a budget.",
          proposal: {
            messageId: "m-2",
            status: "PENDING",
            proposedAction: {
              kind: "BUDGET",
              category: "Groceries",
              monthlyLimit: 400,
              currentMonthlyLimit: null,
            },
          },
        },
        { role: "assistant", content: "Anything else?" },
      ],
    });

    expect(screen.getAllByTestId("markdown")[0]).toHaveTextContent("I've drafted a budget.");
    const draftCards = screen.getAllByRole("button", { name: /^Draft / });
    expect(draftCards).toHaveLength(1);
    expect(draftCards[0]).toHaveTextContent("Draft m-2 is PENDING");

    fireEvent.click(draftCards[0]!);
    expect(onProposalStatusChange).toHaveBeenCalledWith("m-2", "DISMISSED");
  });

  it("offers Clear with the message count when there are messages", () => {
    const { onCleared } = renderChat({
      messages: [
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello" },
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: "Clear 2 messages" }));
    expect(onCleared).toHaveBeenCalled();
  });

  it("disables Clear while a reply is streaming", () => {
    renderChat({ streaming: true, messages: [{ role: "user", content: "hi" }] });
    expect(screen.getByRole("button", { name: /clear/i })).toBeDisabled();
  });

  it("shows a loading note instead of suggested prompts while the conversation loads", () => {
    renderChat({ isLoadingHistory: true, input: "hello" });

    expect(screen.getByRole("status")).toHaveTextContent("Loading your conversation…");
    expect(screen.queryByText(/Ask me anything about your money/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Ask a financial question")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("caps the question at 4000 characters", () => {
    renderChat();
    expect(screen.getByLabelText("Ask a financial question")).toHaveAttribute("maxlength", "4000");
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

describe("ChatSection — opening at the latest message", () => {
  const STORED_CONVERSATION: ChatMessage[] = [
    { role: "user", content: "hello" },
    { role: "assistant", content: "Hi! How can I help?" },
  ];

  /**
   * jsdom does no layout, so the container reports a fixed content height and every scroll
   * position written to it is recorded.
   */
  function trackScrollPositions(): number[] {
    const scrollPositions: number[] = [];
    vi.spyOn(Element.prototype, "scrollHeight", "get").mockReturnValue(900);
    vi.spyOn(Element.prototype, "scrollTop", "set").mockImplementation((position: number) => {
      scrollPositions.push(position);
    });
    return scrollPositions;
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("scrolls to the bottom when it mounts with the conversation already loaded", () => {
    const scrollPositions = trackScrollPositions();

    renderChat({ messages: STORED_CONVERSATION, messagesContainerRef: { current: null } });

    expect(scrollPositions).toEqual([900]);
  });

  it("waits for the conversation to load, then scrolls to the bottom", () => {
    const scrollPositions = trackScrollPositions();
    const messagesContainerRef = { current: null };
    const props = renderChat({ isLoadingHistory: true, messagesContainerRef });

    expect(scrollPositions).toEqual([]);

    rerenderChat({ ...props, isLoadingHistory: false, messages: STORED_CONVERSATION });

    expect(scrollPositions).toEqual([900]);
  });

  it("does not jump to the bottom again when a new message arrives", () => {
    const scrollPositions = trackScrollPositions();
    const props = renderChat({ messages: STORED_CONVERSATION });

    rerenderChat({
      ...props,
      messages: [...STORED_CONVERSATION, { role: "user", content: "another question" }],
    });

    expect(scrollPositions).toEqual([900]);
  });
});
