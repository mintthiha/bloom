"use client";
import { useState, useRef, useEffect } from "react";
import {
  BookOpen,
  TrendingUp,
  CreditCard,
  PiggyBank,
  Target,
  Info,
} from "lucide-react";
import { useDashboardView } from "@/components/dashboard-view-provider";
import { ChatSection } from "./_components/_aiChat/ChatSection";

type Message = { role: "user" | "assistant"; content: string };

const CARDS = [
  {
    icon: PiggyBank,
    title: "TFSA — Tax-Free Savings Account",
    color: "#22c55e",
    summary:
      "Grow your money tax-free. Withdrawals are also tax-free and add back to your room the following year.",
    points: [
      "2025 contribution room: $7,000 (lifetime limit varies by birth year)",
      "Any investment income earned inside is 100% tax-free",
      "Withdrawals don't count as income — no impact on government benefits",
      "Unused room carries forward indefinitely",
      "Over-contributions are penalized 1% per month",
    ],
  },
  {
    icon: TrendingUp,
    title: "RRSP — Registered Retirement Savings Plan",
    color: "#3b82f6",
    summary:
      "Reduce your taxable income today. Pay tax only when you withdraw in retirement (typically at a lower rate).",
    points: [
      "Contribution limit: 18% of previous year's earned income, up to $32,490 (2025)",
      "Contributions reduce your taxable income dollar-for-dollar",
      "Grows tax-deferred — no tax until withdrawal",
      "Must convert to RRIF by age 71",
      "HBP: borrow up to $60,000 tax-free for a first home (must repay over 15 years)",
    ],
  },
  {
    icon: BookOpen,
    title: "FHSA — First Home Savings Account",
    color: "#f59e0b",
    summary:
      "The best of both worlds: RRSP-like deductions on contributions and TFSA-like tax-free withdrawals for a first home.",
    points: [
      "Annual limit: $8,000 | Lifetime limit: $40,000",
      "Contributions are tax-deductible (like RRSP)",
      "Qualifying withdrawals for a first home are completely tax-free",
      "Unused room carries forward up to $8,000 per year",
      "Must be a first-time home buyer and Canadian resident",
    ],
  },
  {
    icon: CreditCard,
    title: "Credit Card Debt & Interest",
    color: "#ef4444",
    summary:
      "Credit cards charge ~20% annual interest. Even small balances compound quickly if you only pay the minimum.",
    points: [
      "Typical Canadian credit card APR: 19.99%–24.99%",
      "Minimum payments barely cover interest — most goes to the lender, not your balance",
      "A $1,000 balance at 20% APR paying only minimums takes years and costs hundreds in interest",
      "Pay in full each month to avoid all interest charges",
      "Credit utilization below 30% helps your credit score",
    ],
  },
  {
    icon: Target,
    title: "Budgeting Basics",
    color: "#a855f7",
    summary:
      "A simple budget tells your money where to go before the month starts, instead of wondering where it went.",
    points: [
      "50/30/20 rule: 50% needs, 30% wants, 20% savings/debt",
      "Track every expense category — surprises usually hide in food and subscriptions",
      "Pay yourself first: automate savings before spending",
      "An emergency fund of 3–6 months of expenses prevents debt spirals",
      "Review your budget monthly and adjust for big life changes",
    ],
  },
  {
    icon: Info,
    title: "Net Worth — Your Financial Snapshot",
    color: "#06b6d4",
    summary:
      "Net worth = everything you own minus everything you owe. Growing this number over time is the goal.",
    points: [
      "Assets: cash, investments, property, pension value",
      "Liabilities: mortgage, car loan, credit card debt, student loans",
      "Track it monthly — the trend matters more than the number",
      "A negative net worth is normal early in life (student debt, mortgage start)",
      "Focus on growing assets and shrinking high-interest liabilities simultaneously",
    ],
  },
];

export default function LearnPage() {
  const { view } = useDashboardView();
  const isDouble = view === "double";
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || streaming) return;

    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: text },
    ];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);

    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const res = await fetch("/api/learn/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.ok || !res.body) throw new Error("Request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === "assistant") {
            updated[updated.length - 1] = {
              ...last,
              content: last.content + chunk,
            };
          }
          return updated;
        });
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === "assistant") {
          updated[updated.length - 1] = {
            ...last,
            content: "Sorry, something went wrong. Please try again.",
          };
        }
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const cardsSection = (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isDouble
          ? "1fr"
          : "repeat(auto-fill, minmax(280px, 1fr))",
        gap: "16px",
        marginBottom: isDouble ? 0 : "56px",
      }}
    >
      {CARDS.map((card, i) => {
        const Icon = card.icon;
        const expanded = expandedCard === i;
        return (
          <button
            key={card.title}
            type="button"
            onClick={() => setExpandedCard(expanded ? null : i)}
            style={{
              textAlign: "left",
              background: "var(--surface-1)",
              border: `1px solid ${expanded ? card.color + "66" : "var(--border)"}`,
              borderRadius: "16px",
              padding: "20px",
              cursor: "pointer",
              transition: "border-color 0.15s",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "10px",
              }}
            >
              <div
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "10px",
                  background: card.color + "22",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon size={16} style={{ color: card.color }} />
              </div>
              <span
                style={{ fontSize: "13px", fontWeight: 700, lineHeight: 1.3 }}
              >
                {card.title}
              </span>
            </div>

            <p
              style={{
                fontSize: "13px",
                color: "var(--text-secondary)",
                lineHeight: 1.55,
                marginBottom: expanded ? "14px" : 0,
              }}
            >
              {card.summary}
            </p>

            {expanded && (
              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {card.points.map((point) => (
                  <li
                    key={point}
                    style={{
                      display: "flex",
                      gap: "8px",
                      alignItems: "flex-start",
                    }}
                  >
                    <span
                      style={{
                        color: card.color,
                        fontWeight: 700,
                        marginTop: "1px",
                        flexShrink: 0,
                      }}
                    >
                      ·
                    </span>
                    <span
                      style={{
                        fontSize: "12px",
                        color: "var(--text-secondary)",
                        lineHeight: 1.55,
                      }}
                    >
                      {point}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div
              style={{
                marginTop: "12px",
                fontSize: "11px",
                color: "var(--text-muted)",
                fontWeight: 600,
              }}
            >
              {expanded ? "Click to collapse" : "Click to expand"}
            </div>
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      style={{
        maxWidth: isDouble ? "1400px" : "900px",
        margin: "0 auto",
        padding: "32px 24px 80px",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: "36px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "6px" }}>
          Learn
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
          Understand the financial concepts that shape your money.
        </p>
      </div>

      {isDouble ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "24px",
            alignItems: "start",
          }}
        >
          <div
            style={{ display: "flex", flexDirection: "column", gap: "16px" }}
          >
            {cardsSection}
          </div>
          <div style={{ position: "sticky", top: "80px" }}>
            <ChatSection 
              messages={messages}
              isDouble={isDouble}
              streaming={streaming}
              bottomRef={bottomRef}
              textAreaRef={textareaRef}
              input={input}
              setInput={setInput}
              sendMessage={sendMessage}
              handleKeyDown={handleKeyDown}
            />
          </div>
        </div>
      ) : (
        <>
          {cardsSection}
          <ChatSection 
            messages={messages}
            isDouble={isDouble}
            streaming={streaming}
            bottomRef={bottomRef}
            textAreaRef={textareaRef}
            input={input}
            setInput={setInput}
            sendMessage={sendMessage}
            handleKeyDown={handleKeyDown}
          />
        </>
      )}

      <p
        style={{
          marginTop: "16px",
          fontSize: "11px",
          color: "var(--text-muted)",
          textAlign: "center",
        }}
      >
        Bloom AI provides general financial education only — not personalized
        financial advice. Consult a licensed advisor for your specific
        situation.
      </p>
    </div>
  );
}
