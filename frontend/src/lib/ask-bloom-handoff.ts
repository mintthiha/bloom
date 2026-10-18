import { MAX_CHAT_MESSAGE_LENGTH } from "@/lib/api";

/** sessionStorage key carrying a dashboard card's question over to the Learn page's chat. */
export const QUEUED_PROMPT_STORAGE_KEY = "bloom_ask_bloom_prompt";

/**
 * How long a queued question stays sendable. The hand-off is a same-tab navigation that takes a
 * second or two; anything older is a leftover from a navigation that never landed, and sending it
 * on some later visit to Learn would surprise the user.
 */
export const QUEUED_PROMPT_LIFETIME_MS = 60_000;

type QueuedPrompt = {
  prompt: string;
  queuedAt: number;
};

/**
 * Stores a question for the Learn page to send as soon as the chat is ready. The hand-off goes
 * through this tab's sessionStorage rather than the URL so a link from outside Bloom can never make
 * the chat send a message on the user's behalf.
 */
export function queueAskBloomPrompt(prompt: string, now: number = Date.now()): void {
  const queuedPrompt: QueuedPrompt = { prompt, queuedAt: now };
  try {
    sessionStorage.setItem(QUEUED_PROMPT_STORAGE_KEY, JSON.stringify(queuedPrompt));
  } catch {
    // Storage unavailable (private mode, blocked site data): the user still lands on the chat.
  }
}

/** Returns true when a parsed storage value has the shape `queueAskBloomPrompt` writes. */
function isQueuedPrompt(value: unknown): value is QueuedPrompt {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.prompt === "string" && typeof candidate.queuedAt === "number";
}

/**
 * Removes and returns the queued question, so it is sent at most once. Returns null when nothing is
 * queued, the entry is malformed, or it has outlived `QUEUED_PROMPT_LIFETIME_MS`.
 */
export function takeQueuedAskBloomPrompt(now: number = Date.now()): string | null {
  let storedValue: string | null;
  try {
    storedValue = sessionStorage.getItem(QUEUED_PROMPT_STORAGE_KEY);
    if (storedValue === null) return null;
    sessionStorage.removeItem(QUEUED_PROMPT_STORAGE_KEY);
  } catch {
    return null;
  }

  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(storedValue);
  } catch {
    return null;
  }
  if (!isQueuedPrompt(parsedValue)) return null;

  const ageMs = now - parsedValue.queuedAt;
  if (ageMs < 0 || ageMs > QUEUED_PROMPT_LIFETIME_MS) return null;

  const prompt = parsedValue.prompt.trim().slice(0, MAX_CHAT_MESSAGE_LENGTH);
  return prompt || null;
}
