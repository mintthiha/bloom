import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_CHAT_MESSAGE_LENGTH } from "@/lib/api";
import {
  QUEUED_PROMPT_LIFETIME_MS,
  QUEUED_PROMPT_STORAGE_KEY,
  queueAskBloomPrompt,
  takeQueuedAskBloomPrompt,
} from "./ask-bloom-handoff";

const QUEUED_AT = 1_700_000_000_000;

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("queueAskBloomPrompt / takeQueuedAskBloomPrompt", () => {
  it("hands a queued question over and removes it so it is sent only once", () => {
    queueAskBloomPrompt("Why is my score 62?", QUEUED_AT);

    expect(takeQueuedAskBloomPrompt(QUEUED_AT + 1000)).toBe("Why is my score 62?");
    expect(takeQueuedAskBloomPrompt(QUEUED_AT + 2000)).toBeNull();
  });

  it("returns null when nothing is queued", () => {
    expect(takeQueuedAskBloomPrompt(QUEUED_AT)).toBeNull();
  });

  it("still sends a question at exactly the end of its lifetime", () => {
    queueAskBloomPrompt("Question", QUEUED_AT);
    expect(takeQueuedAskBloomPrompt(QUEUED_AT + QUEUED_PROMPT_LIFETIME_MS)).toBe("Question");
  });

  it("drops a question that has outlived its lifetime, and clears it", () => {
    queueAskBloomPrompt("Stale question", QUEUED_AT);

    expect(takeQueuedAskBloomPrompt(QUEUED_AT + QUEUED_PROMPT_LIFETIME_MS + 1)).toBeNull();
    expect(sessionStorage.getItem(QUEUED_PROMPT_STORAGE_KEY)).toBeNull();
  });

  it("drops a question stamped in the future", () => {
    queueAskBloomPrompt("Question", QUEUED_AT);
    expect(takeQueuedAskBloomPrompt(QUEUED_AT - 1)).toBeNull();
  });

  it("drops malformed entries instead of throwing", () => {
    sessionStorage.setItem(QUEUED_PROMPT_STORAGE_KEY, "not json");
    expect(takeQueuedAskBloomPrompt(QUEUED_AT)).toBeNull();

    sessionStorage.setItem(QUEUED_PROMPT_STORAGE_KEY, JSON.stringify({ prompt: 42 }));
    expect(takeQueuedAskBloomPrompt(QUEUED_AT)).toBeNull();
  });

  it("drops a question that is only whitespace", () => {
    queueAskBloomPrompt("   ", QUEUED_AT);
    expect(takeQueuedAskBloomPrompt(QUEUED_AT)).toBeNull();
  });

  it("trims the question and caps it at the chat's message length", () => {
    queueAskBloomPrompt(`  ${"a".repeat(MAX_CHAT_MESSAGE_LENGTH + 50)}  `, QUEUED_AT);
    expect(takeQueuedAskBloomPrompt(QUEUED_AT)).toBe("a".repeat(MAX_CHAT_MESSAGE_LENGTH));
  });

  it("tolerates storage being unavailable", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => queueAskBloomPrompt("Question", QUEUED_AT)).not.toThrow();
    expect(takeQueuedAskBloomPrompt(QUEUED_AT)).toBeNull();
  });
});
