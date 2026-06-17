"use client";

import { Send } from "lucide-react";

type ChatSectionProps = {
  messages: Message[];
  isDouble: boolean;
  streaming: boolean;
  bottomRef: React.RefObject<HTMLDivElement|null>;
  textAreaRef: React.RefObject<HTMLTextAreaElement|null>;
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  sendMessage: () => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
};

type Message = { role: "user" | "assistant"; content: string };

export function ChatSection({ messages, isDouble, streaming, bottomRef, textAreaRef, input, setInput, sendMessage, handleKeyDown }: ChatSectionProps) {
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
            background: "#f59e0b",
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
          Powered by Claude
        </span>
      </div>

      {/* Demo notice */}
      <div
        style={{
          padding: "8px 24px",
          background: "var(--surface-2)",
          borderBottom: "1px solid var(--border)",
          fontSize: "12px",
          color: "var(--text-muted)",
          textAlign: "center",
        }}
      >
        AI model currently unavailable — this feature is disabled in the demo.
      </div>

      {/* Messages */}
      <div
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
          <div
            style={{
              color: "var(--text-muted)",
              fontSize: "13px",
              margin: "auto",
              textAlign: "center",
            }}
          >
            Ask me anything about TFSAs, RRSPs, credit cards, budgeting, or
            investing in Canada.
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
                borderRadius:
                  msg.role === "user"
                    ? "14px 14px 4px 14px"
                    : "14px 14px 14px 4px",
                background:
                  msg.role === "user" ? "#f59e0b22" : "var(--surface-2)",
                border:
                  msg.role === "user"
                    ? "1px solid #f59e0b44"
                    : "1px solid var(--border)",
                fontSize: "13px",
                lineHeight: 1.6,
                color: "var(--text-primary)",
                whiteSpace: "pre-wrap",
              }}
            >
              {msg.content}
              {msg.role === "assistant" &&
                streaming &&
                i === messages.length - 1 &&
                msg.content === "" && (
                  <span style={{ color: "var(--text-muted)" }}>Thinking…</span>
                )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
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
          placeholder="Ask a question…"
          rows={1}
          disabled={streaming || true}
          placeholder="AI unavailable in demo…"
          style={{
            flex: 1,
            resize: "none",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "10px 14px",
            fontSize: "13px",
            color: "var(--text-primary)",
            outline: "none",
            lineHeight: 1.5,
            fontFamily: "inherit",
            opacity: 0.5,
          }}
        />
        <button
          type="button"
          onClick={sendMessage}
          disabled={true}
          style={{
            width: "38px",
            height: "38px",
            borderRadius: "10px",
            border: "none",
            background: "var(--surface-3)",
            color: "var(--text-muted)",
            cursor: "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "background 0.15s",
          }}
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}