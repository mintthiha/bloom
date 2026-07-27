import { afterEach, describe, expect, it } from "vitest";
import {
  clearStoredMessages,
  loadStoredMessages,
  saveStoredMessages,
  type ChatMessage,
} from "./chat-storage";

const STORAGE_KEY = "bloom_learn_chat";

afterEach(() => {
  localStorage.clear();
});

describe("chat-storage", () => {
  it("returns an empty array when nothing is stored", () => {
    expect(loadStoredMessages()).toEqual([]);
  });

  it("round-trips a saved conversation", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "What is a TFSA?" },
      { role: "assistant", content: "A Tax-Free Savings Account." },
    ];
    saveStoredMessages(messages);
    expect(loadStoredMessages()).toEqual(messages);
  });

  it("ignores malformed JSON", () => {
    localStorage.setItem(STORAGE_KEY, "not json");
    expect(loadStoredMessages()).toEqual([]);
  });

  it("filters out entries that are not valid chat messages", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { role: "user", content: "keep me" },
        { role: "system", content: "wrong role" },
        { role: "assistant", content: 42 },
        "not an object",
      ])
    );
    expect(loadStoredMessages()).toEqual([{ role: "user", content: "keep me" }]);
  });

  it("clears the stored conversation", () => {
    saveStoredMessages([{ role: "user", content: "hi" }]);
    clearStoredMessages();
    expect(loadStoredMessages()).toEqual([]);
  });
});
