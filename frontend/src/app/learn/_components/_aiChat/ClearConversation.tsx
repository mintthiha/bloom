"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { api } from "@/lib/api";

type ClearConversationProps = {
  messageCount: number;
  /** True while a reply is streaming: clearing then would race the reply being stored. */
  isDisabled: boolean;
  onCleared: () => void;
};

/** The chat header's Clear button plus its confirm step; deletes the stored conversation. */
export function ClearConversation({ messageCount, isDisabled, onCleared }: ClearConversationProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  /** Deletes the conversation on the server, then lets the parent empty the chat window. */
  async function handleConfirmClear() {
    setIsClearing(true);
    try {
      await api.clearChatMessages();
      onCleared();
      setIsConfirmOpen(false);
      toast.success("Conversation cleared");
    } catch {
      toast.error("Couldn't clear the conversation");
    } finally {
      setIsClearing(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="chat-danger"
        onClick={() => setIsConfirmOpen(true)}
        disabled={isDisabled}
        title="Clear conversation"
        style={{
          marginLeft: "auto",
          display: "flex",
          alignItems: "center",
          gap: "5px",
          background: "transparent",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "5px 9px",
          fontSize: "12px",
          color: "var(--text-secondary)",
          cursor: "pointer",
          opacity: isDisabled ? 0.5 : 1,
        }}
      >
        <Trash2 size={13} />
        Clear
      </button>
      <ConfirmDeleteDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title="Clear your Bloom AI conversation?"
        description={`This permanently deletes ${
          messageCount === 1 ? "the 1 message" : `all ${messageCount} messages`
        } in this conversation, on every device. It can't be undone.`}
        onConfirm={handleConfirmClear}
        isDeleting={isClearing}
        confirmLabel="Clear"
      />
    </>
  );
}
