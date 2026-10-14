import { describe, expect, it } from "vitest";
import { readChatReplyEvents, type ChatReplyEvent } from "./chat-reply-events";

const GROCERIES_BUDGET_DRAFT = {
  kind: "BUDGET",
  category: "Groceries",
  monthlyLimit: 400,
  currentMonthlyLimit: null,
};

/** Builds a reader that hands back the given raw text pieces, one per read. */
function readerOf(textPieces: string[]) {
  const encoder = new TextEncoder();
  let nextPieceIndex = 0;
  return {
    read: async () =>
      nextPieceIndex < textPieces.length
        ? { done: false, value: encoder.encode(textPieces[nextPieceIndex++]) }
        : { done: true, value: undefined },
  };
}

/** Drains the reply events read from the given raw text pieces into an array. */
async function collectEvents(textPieces: string[]): Promise<ChatReplyEvent[]> {
  const collected: ChatReplyEvent[] = [];
  for await (const replyEvent of readChatReplyEvents(readerOf(textPieces))) {
    collected.push(replyEvent);
  }
  return collected;
}

describe("readChatReplyEvents", () => {
  it("yields each event in order, text then the draft", async () => {
    const events = await collectEvents([
      `${JSON.stringify({ type: "text", text: "Drafted " })}\n`,
      `${JSON.stringify({ type: "text", text: "a budget." })}\n`,
      `${JSON.stringify({ type: "proposal", messageId: "m-2", proposedAction: GROCERIES_BUDGET_DRAFT })}\n`,
    ]);

    expect(events).toEqual([
      { type: "text", text: "Drafted " },
      { type: "text", text: "a budget." },
      { type: "proposal", messageId: "m-2", proposedAction: GROCERIES_BUDGET_DRAFT },
    ]);
  });

  it("yields several events that arrive in one read", async () => {
    const events = await collectEvents([
      `${JSON.stringify({ type: "text", text: "A" })}\n${JSON.stringify({ type: "text", text: "B" })}\n`,
    ]);

    expect(events).toEqual([
      { type: "text", text: "A" },
      { type: "text", text: "B" },
    ]);
  });

  it("reassembles an event split across reads", async () => {
    const line = `${JSON.stringify({ type: "text", text: "Hello world" })}\n`;

    const events = await collectEvents([line.slice(0, 9), line.slice(9, 20), line.slice(20)]);

    expect(events).toEqual([{ type: "text", text: "Hello world" }]);
  });

  it("reassembles a multi-byte character split across reads", async () => {
    const bytes = new TextEncoder().encode(
      `${JSON.stringify({ type: "text", text: "café — ok" })}\n`
    );
    const splitInsideCharacter = bytes.findIndex((byte) => byte > 127) + 1;
    let readCount = 0;
    const reader = {
      read: async () => {
        readCount += 1;
        if (readCount === 1) return { done: false, value: bytes.slice(0, splitInsideCharacter) };
        if (readCount === 2) return { done: false, value: bytes.slice(splitInsideCharacter) };
        return { done: true, value: undefined };
      },
    };

    const collected: ChatReplyEvent[] = [];
    for await (const replyEvent of readChatReplyEvents(reader)) collected.push(replyEvent);

    expect(collected).toEqual([{ type: "text", text: "café — ok" }]);
  });

  it("keeps line breaks that are part of the text", async () => {
    const events = await collectEvents([
      `${JSON.stringify({ type: "text", text: "Line one\n\nLine two" })}\n`,
    ]);

    expect(events).toEqual([{ type: "text", text: "Line one\n\nLine two" }]);
  });

  it("yields a final event that has no trailing newline", async () => {
    const events = await collectEvents([JSON.stringify({ type: "text", text: "Done" })]);

    expect(events).toEqual([{ type: "text", text: "Done" }]);
  });

  it("skips blank, malformed, and unrecognized lines", async () => {
    const events = await collectEvents([
      "\n",
      "not json\n",
      "null\n",
      '"just a string"\n',
      `${JSON.stringify({ type: "text" })}\n`,
      `${JSON.stringify({ type: "text", text: 42 })}\n`,
      `${JSON.stringify({ type: "proposal", messageId: "m-2" })}\n`,
      `${JSON.stringify({ type: "proposal", proposedAction: GROCERIES_BUDGET_DRAFT })}\n`,
      `${JSON.stringify({ type: "mystery", text: "?" })}\n`,
      `${JSON.stringify({ type: "text", text: "kept" })}\n`,
    ]);

    expect(events).toEqual([{ type: "text", text: "kept" }]);
  });

  it("yields nothing for an empty stream", async () => {
    await expect(collectEvents([])).resolves.toEqual([]);
  });
});
