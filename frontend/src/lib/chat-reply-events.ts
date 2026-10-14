import type { ProposedChatAction } from "@/lib/api";

/**
 * One piece of a streamed Bloom AI reply: text as it is generated, or — once the reply is stored —
 * the draft it carries, with the id of the stored message the draft is confirmed against.
 */
export type ChatReplyEvent =
  | { type: "text"; text: string }
  | { type: "proposal"; messageId: string; proposedAction: ProposedChatAction };

/** The part of a response body reader that reading reply events relies on. */
type ReplyChunkReader = {
  read: () => Promise<{ done: boolean; value?: Uint8Array }>;
};

/** Parses one line of the reply stream, returning null for a blank, malformed, or unknown line. */
function parseChatReplyEvent(line: string): ChatReplyEvent | null {
  if (!line.trim()) return null;
  let parsedLine: unknown;
  try {
    parsedLine = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof parsedLine !== "object" || parsedLine === null) return null;

  const candidate = parsedLine as Record<string, unknown>;
  if (candidate.type === "text" && typeof candidate.text === "string") {
    return { type: "text", text: candidate.text };
  }
  if (
    candidate.type === "proposal" &&
    typeof candidate.messageId === "string" &&
    typeof candidate.proposedAction === "object" &&
    candidate.proposedAction !== null
  ) {
    return {
      type: "proposal",
      messageId: candidate.messageId,
      proposedAction: candidate.proposedAction as ProposedChatAction,
    };
  }
  return null;
}

/**
 * Reads the chat reply stream — one JSON event per line — and yields each event as soon as its
 * line is complete, however the network happened to split the bytes.
 */
export async function* readChatReplyEvents(
  reader: ReplyChunkReader
): AsyncGenerator<ChatReplyEvent, void, void> {
  const decoder = new TextDecoder();
  let pendingText = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    pendingText += decoder.decode(value, { stream: true });
    const lines = pendingText.split("\n");
    pendingText = lines.pop() ?? "";
    for (const line of lines) {
      const replyEvent = parseChatReplyEvent(line);
      if (replyEvent) yield replyEvent;
    }
  }
  const trailingEvent = parseChatReplyEvent(pendingText);
  if (trailingEvent) yield trailingEvent;
}
