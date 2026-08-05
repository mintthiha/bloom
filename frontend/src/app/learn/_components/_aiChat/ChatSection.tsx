"use client";

import { Send, Square, Trash2 } from "lucide-react";
import type { ChatMessage } from "./chat-storage";
import { MarkdownMessage } from "./MarkdownMessage";
import { ThinkingIndicator } from "./ThinkingIndicator";

type ChatSectionProps = {
  messages: ChatMessage[];
  isDouble: boolean;
  streaming: boolean;
  messagesContainerRef: React.RefObject<HTMLDivElement | null>;
  textAreaRef: React.RefObject<HTMLTextAreaElement | null>;
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  sendMessage: (overrideText?: string) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onStop: () => void;
  onClear: () => void;
};

/** Starter questions shown in the empty chat; the personalized ones exercise the user's own data. */
const SUGGESTED_PROMPTS = [
  "How am I doing on my budget this month?",
  "How much TFSA room do I have left?",
  "What's my net worth right now?",
  "What's the difference between a TFSA and an RRSP?",
];

export function ChatSection({
  messages,
  isDouble,
  streaming,
  messagesContainerRef,
  textAreaRef,
  input,
  setInput,
  sendMessage,
  handleKeyDown,
  onStop,
  onClear,
}: ChatSectionProps) {
  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "20px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Chat header */}
      <div
        style={{
          padding: "18px 24px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <div
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: "#22c55e",
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: "14px", fontWeight: 700 }}>Ask Bloom AI</span>
        <span
          style={{
            fontSize: "12px",
            color: "var(--text-secondary)",
            marginLeft: "4px",
          }}
        >
          Self-hosted
        </span>
        {messages.length > 0 && (
          <button
            type="button"
            className="chat-danger"
            onClick={onClear}
            title="Clear conversation"
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: "5px",
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "5px 9px",
              fontSize: "12px",
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            <Trash2 size={13} />
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        style={{
          minHeight: "220px",
          maxHeight: isDouble ? "560px" : "420px",
          overflowY: "auto",
          padding: "20px 24px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {messages.length === 0 && (
          <div style={{ margin: "auto", display: "flex", flexDirection: "column", gap: "14px" }}>
            <div
              style={{
                color: "var(--text-muted)",
                fontSize: "13px",
                textAlign: "center",
              }}
            >
              Ask me anything about your money, or try one of these:
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="chat-suggestion"
                  onClick={() => sendMessage(prompt)}
                  style={{
                    textAlign: "left",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: "10px",
                    padding: "9px 12px",
                    fontSize: "13px",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "75%",
                padding: "10px 14px",
                borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                background: msg.role === "user" ? "#f59e0b22" : "var(--surface-2)",
                border: msg.role === "user" ? "1px solid #f59e0b44" : "1px solid var(--border)",
                fontSize: "13px",
                lineHeight: 1.6,
                color: "var(--text-primary)",
                whiteSpace: msg.role === "user" ? "pre-wrap" : "normal",
              }}
            >
              {msg.role === "assistant" ? (
                msg.content ? (
                  <MarkdownMessage content={msg.content} />
                ) : (
                  <ThinkingIndicator />
                )
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div
        style={{
          padding: "16px 20px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          gap: "10px",
          alignItems: "flex-end",
        }}
      >
        <textarea
          ref={textAreaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={streaming}
          placeholder="Ask a question…"
          aria-label="Ask a financial question"
          style={{
            flex: 1,
            resize: "none",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "10px 14px",
            fontSize: "13px",
            color: "var(--text-primary)",
            lineHeight: 1.5,
            fontFamily: "inherit",
            opacity: streaming ? 0.5 : 1,
          }}
        />
        {streaming ? (
          <button
            type="button"
            className="chat-danger"
            onClick={onStop}
            title="Stop generating"
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "10px",
              border: "1px solid var(--border)",
              background: "var(--surface-3)",
              color: "var(--text-primary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Square size={13} fill="currentColor" />
          </button>
        ) : (
          <button
            type="button"
            className="chat-send"
            onClick={() => sendMessage()}
            disabled={!input.trim()}
            title="Send"
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "10px",
              border: "none",
              background: input.trim() ? "#f59e0b" : "var(--surface-3)",
              color: input.trim() ? "white" : "var(--text-muted)",
              cursor: input.trim() ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Send size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
