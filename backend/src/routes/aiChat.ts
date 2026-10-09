import { Router, Request, Response, NextFunction } from "express";
import { AppError } from "../middleware/errorHandler";
import { requireObject } from "../lib/validation";
import * as aiChatService from "../services/aiChatService";

const router = Router();

/** Validates the system prompt without normalizing it, since its line breaks are meaningful. */
function parseSystemPromptFromBody(body: Record<string, unknown>): string {
  if (typeof body.systemPrompt !== "string" || !body.systemPrompt.trim()) {
    throw new AppError(400, "systemPrompt must be a non-empty string");
  }
  return body.systemPrompt;
}

/**
 * Validates the conversation, accepting only user and assistant turns so a caller can't slip an
 * extra system message in alongside the real system prompt.
 */
function parseConversationFromBody(body: Record<string, unknown>): aiChatService.ChatTurn[] {
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    throw new AppError(400, "messages must be a non-empty array");
  }
  return (body.messages as unknown[]).map((message) => {
    const { role, content } = (
      message !== null && typeof message === "object" ? message : {}
    ) as Record<string, unknown>;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") {
      throw new AppError(400, "each message must have a user or assistant role and string content");
    }
    return { role, content };
  });
}

/**
 * Streams the assistant's reply as plain text. Server-to-server only: the caller owns the system
 * prompt, so the Next.js proxy refuses to forward browser requests to `/api/internal/*`.
 */
router.post("/chat", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.headers["x-user-id"]) throw new AppError(401, "Unauthorized");

    const body = requireObject(req.body);
    const systemPrompt = parseSystemPromptFromBody(body);
    const conversation = parseConversationFromBody(body);

    // Stop generating as soon as the caller goes away (e.g. the user pressed Stop).
    const abortController = new AbortController();
    res.on("close", () => abortController.abort());

    // Started before any header is sent, so an unreachable model still surfaces as a 503 status.
    const replyChunks = await aiChatService.startChatReply(
      systemPrompt,
      conversation,
      abortController.signal
    );

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.flushHeaders();
    for await (const replyChunk of replyChunks) {
      res.write(replyChunk);
    }
    res.end();
  } catch (err) {
    if (res.headersSent) {
      res.end();
      return;
    }
    next(err);
  }
});

export default router;
