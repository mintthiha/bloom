"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { api, type QuickAddDraft } from "@/lib/api";
import { inputStyle } from "@/lib/styles/input";
import { formatLocalDate } from "../transaction-date";

// The backend reads at most one line of this length.
const MAX_NOTE_LENGTH = 200;

interface QuickAddBarProps {
  /** Fills the form from the draft and returns the line to show about what's left to check. */
  onDraft: (draft: QuickAddDraft) => string;
}

/**
 * A one-line box that reads a note such as "Coffee 4.50 at Tim's yesterday" with Bloom AI and
 * pre-fills the new-transaction form. Nothing is recorded until the user submits the form.
 */
export function QuickAddBar({ onDraft }: QuickAddBarProps) {
  const [note, setNote] = useState("");
  const [isDrafting, setIsDrafting] = useState(false);
  const [fillNote, setFillNote] = useState<string | null>(null);
  const canDraft = !isDrafting && Boolean(note.trim());

  /** Sends the note for reading, with the user's own date so "yesterday" means their yesterday. */
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canDraft) return;
    setIsDrafting(true);
    setFillNote(null);
    try {
      const { draft } = await api.draftQuickAddTransaction(
        note.trim(),
        formatLocalDate(new Date())
      );
      setFillNote(onDraft(draft));
      setNote("");
    } catch {
      toast.error("Bloom AI couldn't read that note just now. Fill in the form below instead.");
    } finally {
      setIsDrafting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: "16px" }}>
      <div style={{ display: "flex", gap: "8px" }}>
        <input
          type="text"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={MAX_NOTE_LENGTH}
          disabled={isDrafting}
          placeholder={`Quick add, e.g. "Coffee 4.50 at Tim's yesterday"`}
          aria-label="Describe a transaction"
          style={{ ...inputStyle, flex: 1, minWidth: 0 }}
        />
        <button
          type="submit"
          className="budget-action-pill"
          disabled={!canDraft}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 12px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: canDraft ? "pointer" : "not-allowed",
            opacity: canDraft ? 1 : 0.5,
            whiteSpace: "nowrap",
          }}
        >
          <Sparkles size={14} aria-hidden="true" />
          {isDrafting ? "Reading…" : "Fill in"}
        </button>
      </div>
      {(isDrafting || fillNote) && (
        <p
          role="status"
          style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "6px 0 0" }}
        >
          {isDrafting ? "Reading your note — this can take a few seconds." : fillNote}
        </p>
      )}
    </form>
  );
}
