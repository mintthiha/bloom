import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClearConversation } from "./ClearConversation";

const { apiMock, toastMock } = vi.hoisted(() => ({
  apiMock: { clearChatMessages: vi.fn() },
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/api", () => ({ api: apiMock }));
vi.mock("sonner", () => ({ toast: toastMock }));

/** Renders the Clear button with sensible defaults, overridable per test. */
function renderClearConversation(
  overrides: Partial<React.ComponentProps<typeof ClearConversation>> = {}
) {
  const props = { messageCount: 4, isDisabled: false, onCleared: vi.fn(), ...overrides };
  render(<ClearConversation {...props} />);
  return props;
}

/** Opens the confirm dialog and presses its confirm button. */
function confirmClear() {
  fireEvent.click(screen.getByRole("button", { name: /clear/i }));
  fireEvent.click(screen.getByRole("button", { name: "Clear" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.clearChatMessages.mockResolvedValue(undefined);
});

describe("ClearConversation", () => {
  it("asks for confirmation, naming how many messages will be deleted, before deleting", () => {
    const { onCleared } = renderClearConversation({ messageCount: 4 });

    fireEvent.click(screen.getByRole("button", { name: /clear/i }));

    expect(screen.getByText("Clear your Bloom AI conversation?")).toBeInTheDocument();
    expect(screen.getByText(/permanently deletes all 4 messages/)).toBeInTheDocument();
    expect(apiMock.clearChatMessages).not.toHaveBeenCalled();
    expect(onCleared).not.toHaveBeenCalled();
  });

  it("words the confirmation for a single message", () => {
    renderClearConversation({ messageCount: 1 });

    fireEvent.click(screen.getByRole("button", { name: /clear/i }));

    expect(screen.getByText(/permanently deletes the 1 message in/)).toBeInTheDocument();
  });

  it("does nothing when the confirmation is cancelled", () => {
    const { onCleared } = renderClearConversation();

    fireEvent.click(screen.getByRole("button", { name: /clear/i }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(apiMock.clearChatMessages).not.toHaveBeenCalled();
    expect(onCleared).not.toHaveBeenCalled();
  });

  it("deletes the conversation, notifies the parent, and confirms with a toast", async () => {
    const { onCleared } = renderClearConversation();

    confirmClear();

    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Conversation cleared"));
    expect(apiMock.clearChatMessages).toHaveBeenCalledTimes(1);
    expect(onCleared).toHaveBeenCalledTimes(1);
  });

  it("keeps the conversation and shows an error toast when the delete fails", async () => {
    apiMock.clearChatMessages.mockRejectedValue(new Error("Request failed"));
    const { onCleared } = renderClearConversation();

    confirmClear();

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith("Couldn't clear the conversation")
    );
    expect(onCleared).not.toHaveBeenCalled();
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it("disables the button while a reply is streaming", () => {
    renderClearConversation({ isDisabled: true });

    expect(screen.getByRole("button", { name: /clear/i })).toBeDisabled();
  });
});
