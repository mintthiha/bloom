"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renders an assistant chat reply as markdown, scoped by the .chat-markdown class in globals.css. */
export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="chat-markdown">
      <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
    </div>
  );
}
