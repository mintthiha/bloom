"use client";

import { BookOpen, CreditCard, Info, PiggyBank, Target, TrendingUp } from "lucide-react";

type LearningCardsProps = {
  isDouble: boolean;
  expandedCard: number | null;
  setExpandedCard: React.Dispatch<React.SetStateAction<number | null>>;
  exploredCardIndices: Set<number>;
  onCardExplored: (index: number) => void;
};

export const CARDS = [
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

export function LearningCards({
  isDouble,
  expandedCard,
  setExpandedCard,
  exploredCardIndices,
  onCardExplored,
}: LearningCardsProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isDouble ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))",
        gap: "16px",
        marginBottom: isDouble ? 0 : "56px",
      }}
    >
      {CARDS.map((card, i) => {
        const Icon = card.icon;
        const expanded = expandedCard === i;
        const explored = exploredCardIndices.has(i);
        return (
          <button
            key={card.title}
            type="button"
            className="lift"
            onClick={() => {
              const nextExpanded = expanded ? null : i;
              setExpandedCard(nextExpanded);
              if (nextExpanded !== null) onCardExplored(nextExpanded);
            }}
            style={{
              textAlign: "left",
              background: "var(--surface-1)",
              border: `1px solid ${expanded ? card.color + "66" : "var(--border)"}`,
              borderRadius: "16px",
              padding: "20px",
              cursor: "pointer",
              transition: "border-color 0.15s, box-shadow 0.18s",
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
              <span style={{ fontSize: "13px", fontWeight: 700, lineHeight: 1.3 }}>
                {card.title}
              </span>
              {explored && (
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: "10px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "#22c55e",
                    background: "#22c55e18",
                    padding: "3px 7px",
                    borderRadius: "999px",
                    flexShrink: 0,
                  }}
                >
                  ✓ Explored
                </span>
              )}
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
}
