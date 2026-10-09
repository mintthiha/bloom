import { Router, Request, Response, NextFunction } from "express";
import { AppError } from "../middleware/errorHandler";
import { requireObject } from "../lib/validation";
import * as aiChatService from "../services/aiChatService";

const router = Router();

// Generous for a typed question, small enough that one message can't crowd out the model's context.
const MAX_QUESTION_LENGTH = 4000;

/** Validates the system prompt without normalizing it, since its line breaks are meaningful. */
function parseSystemPromptFromBody(body: Record<string, unknown>): string {
  if (typeof body.systemPrompt !== "string" || !body.systemPrompt.trim()) {
    throw new AppError(400, "systemPrompt must be a non-empty string");
  }
  return body.systemPrompt;
}

/** Validates the user's question, trimming only the ends so its own line breaks survive. */
function parseQuestionFromBody(body: Record<string, unknown>): string {
  if (typeof body.message !== "string" || !body.message.trim()) {
    throw new AppError(400, "message must be a non-empty string");
  }
  const question = body.message.trim();
  if (question.length > MAX_QUESTION_LENGTH) {
    throw new AppError(400, `message must be at most ${MAX_QUESTION_LENGTH} characters`);
  }
  return question;
}

/**
 * Streams the assistant's reply to one new question as plain text; the earlier turns come from the
 * user's stored conversation. Server-to-server only: the caller owns the system prompt, so the
 * Next.js proxy refuses to forward browser requests to `/api/internal/*`.
 */
router.post("/chat", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers["x-user-id"] as string | undefined;
    if (!userId) throw new AppError(401, "Unauthorized");

    const body = requireObject(req.body);
    const systemPrompt = parseSystemPromptFromBody(body);
    const question = parseQuestionFromBody(body);

    // Stop generating as soon as the caller goes away (e.g. the user pressed Stop).
    const abortController = new AbortController();
    res.on("close", () => abortController.abort());

    // Started before any header is sent, so an unreachable model still surfaces as a 503 status.
    const replyChunks = await aiChatService.startChatReply(
      userId,
      systemPrompt,
      question,
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
