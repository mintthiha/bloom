const STORAGE_KEY = "bloom_learn_chat";

/** A single chat turn, shared between the chat hook, the storage layer, and the UI. */
export type ChatMessage = { role: "user" | "assistant"; content: string };

/** Type guard for a persisted chat message, so malformed localStorage data is ignored. */
function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    (candidate.role === "user" || candidate.role === "assistant") &&
    typeof candidate.content === "string"
  );
}

/** Reads the saved conversation from localStorage, returning [] when absent or malformed. */
export function loadStoredMessages(): ChatMessage[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isChatMessage);
  } catch {
    return [];
  }
}

/** Persists the conversation so it survives reloads and navigation within the browser. */
export function saveStoredMessages(messages: ChatMessage[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // localStorage unavailable — the conversation simply won't persist.
  }
}

/** Clears the saved conversation. */
export function clearStoredMessages(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable — nothing to clear.
  }
}
