"use client";

import { useMemo, useState } from "react";
import { Account, Budget, MonthlySummary, NetWorthSnapshot } from "@/lib/api";
import { CollapsibleCard } from "@/components/collapsible-card";
import { computeHealthScore, SubScore } from "@/lib/financial-health-score";

interface FinancialHealthScoreProps {
  accounts: Account[];
  budgets: Budget[];
  monthlySummary: MonthlySummary;
  netWorthHistory: NetWorthSnapshot[];
}

/** Returns the display colour for an overall 0–100 score. */
function overallScoreColor(total: number): string {
  if (total > 70) return "#22c55e";
  if (total >= 40) return "#3b82f6";
  return "#ef4444";
}

/** Returns the display colour for a sub-score out of 20. */
function subScoreColor(score: number): string {
  const pct = score / 20;
  if (pct >= 0.7) return "#22c55e";
  if (pct >= 0.4) return "#3b82f6";
  return "#ef4444";
}

/** Compact score + grade badge shown in the card header, visible even when collapsed. */
function ScoreBadge({ total, grade, color }: { total: number; grade: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <span className="num" style={{ fontSize: "15px", fontWeight: 800, color }}>
        {total}
      </span>
      <span
        style={{
          fontSize: "12px",
          fontWeight: 700,
          padding: "1px 7px",
          borderRadius: "5px",
          background: `${color}22`,
          border: `1px solid ${color}44`,
          color,
        }}
      >
        {grade}
      </span>
    </div>
  );
}

/** One factor row showing its label, score, progress bar, status, and optional improvement tip. */
function SubScoreRow({ sub }: { sub: SubScore }) {
  const color = subScoreColor(sub.score);
  return (
    <div style={{ marginBottom: "20px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "6px",
        }}
      >
        <span style={{ fontSize: "13px", fontWeight: 600 }}>{sub.label}</span>
        <span className="num" style={{ fontSize: "13px", fontWeight: 700, color, flexShrink: 0 }}>
          {sub.score} / 20
        </span>
      </div>
      <div
        style={{
          height: "6px",
          background: "#ffffff0a",
          borderRadius: "999px",
          overflow: "hidden",
          marginBottom: "5px",
        }}
      >
        <div
          style={{
            width: `${(sub.score / 20) * 100}%`,
            height: "100%",
            background: color,
            borderRadius: "999px",
            transition: "width 0.4s ease",
          }}
        />
      </div>
      <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{sub.status}</p>
      {sub.tip && (
        <p
          style={{
            fontSize: "11px",
            color: "var(--text-muted)",
            marginTop: "2px",
          }}
        >
          {sub.tip}
        </p>
      )}
    </div>
  );
}

/** A single scoring tier shown as a compact chip inside the methodology explainer. */
function TierChip({ condition, points }: { condition: string; points: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        fontSize: "11px",
        padding: "2px 7px",
        borderRadius: "4px",
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        color: "var(--text-secondary)",
        margin: "2px",
      }}
    >
      {condition}
      <span style={{ color: "var(--text-muted)" }}>→</span>
      <span className="num" style={{ fontWeight: 700, color: "var(--text-primary)" }}>
        {points}
      </span>
    </span>
  );
}

/** Methodology block for one factor inside the "How is this calculated?" section. */
function FactorDetail({
  label,
  description,
  tiers,
}: {
  label: string;
  description: string;
  tiers: Array<{ condition: string; points: number }>;
}) {
  return (
    <div style={{ marginBottom: "18px" }}>
      <p style={{ fontSize: "13px", fontWeight: 600, marginBottom: "2px" }}>{label}</p>
      <p
        style={{
          fontSize: "12px",
          color: "var(--text-secondary)",
          marginBottom: "6px",
          lineHeight: 1.5,
        }}
      >
        {description}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap" }}>
        {tiers.map((tier, i) => (
          <TierChip key={i} condition={tier.condition} points={tier.points} />
        ))}
      </div>
    </div>
  );
}

/** Collapsible section showing the full scoring methodology for every factor. */
function CalculationExplainer() {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        borderTop: "1px solid var(--border)",
        marginTop: "4px",
        paddingTop: "12px",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          fontSize: "12px",
          fontWeight: 600,
          color: "var(--text-secondary)",
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
            transition: "transform 0.2s ease",
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
        How is this calculated?
      </button>

      <div
        style={{
          display: "grid",
          gridTemplateRows: open ? "1fr" : "0fr",
          transition: "grid-template-rows 0.28s ease",
        }}
      >
        <div style={{ overflow: "hidden" }}>
          <div
            style={{
              paddingTop: "14px",
              opacity: open ? 1 : 0,
              transition: "opacity 0.2s ease",
            }}
          >
            <p
              style={{
                fontSize: "12px",
                color: "var(--text-secondary)",
                marginBottom: "18px",
                lineHeight: 1.6,
              }}
            >
              Your score is the sum of five factors, each worth 0–20 points (maximum 100). Every
              factor is computed from data already on your dashboard — no extra input required. Each
              chip below shows a condition and the points it earns.
            </p>

            <FactorDetail
              label="Savings Rate"
              description="Net cash flow ÷ income for the selected period. Measures what percentage of income you're keeping."
              tiers={[
                { condition: "≥ 20%", points: 20 },
                { condition: "15–19%", points: 16 },
                { condition: "10–14%", points: 12 },
                { condition: "5–9%", points: 6 },
                { condition: "0–4%", points: 2 },
                { condition: "Negative", points: 0 },
                { condition: "No income", points: 10 },
              ]}
            />

            <FactorDetail
              label="Budget Adherence"
              description="How many of your monthly budget categories are within their set limit."
              tiers={[
                { condition: "All within limit", points: 20 },
                { condition: "≥ 75% within", points: 15 },
                { condition: "≥ 50% within", points: 10 },
                { condition: "≥ 25% within", points: 5 },
                { condition: "< 25% within", points: 0 },
                { condition: "No budgets set", points: 8 },
              ]}
            />

            <FactorDetail
              label="Debt Ratio"
              description="Credit card balance ÷ total cash assets (all non-credit accounts). Measures how much of your savings is offset by debt."
              tiers={[
                { condition: "No debt", points: 20 },
                { condition: "< 5% of cash", points: 18 },
                { condition: "5–14%", points: 14 },
                { condition: "15–29%", points: 10 },
                { condition: "30–49%", points: 5 },
                { condition: "50–99%", points: 2 },
                { condition: "≥ 100%", points: 0 },
              ]}
            />

            <FactorDetail
              label="Emergency Coverage"
              description="Chequing + savings balance ÷ monthly spending. Measures how many months you could cover expenses if income stopped. Registered accounts (TFSA, RRSP, FHSA) are excluded as they have withdrawal rules."
              tiers={[
                { condition: "≥ 6 months", points: 20 },
                { condition: "3–5.9 months", points: 15 },
                { condition: "2–2.9 months", points: 10 },
                { condition: "1–1.9 months", points: 6 },
                { condition: "< 1 month", points: 0 },
                { condition: "No spending data", points: 10 },
              ]}
            />

            <FactorDetail
              label="Net Worth Trend"
              description="Direction of net worth compared to the previous month's snapshot. Rewards both growth and a positive net worth."
              tiers={[
                { condition: "Growing + positive", points: 20 },
                { condition: "Growing + negative", points: 14 },
                { condition: "Flat + positive", points: 12 },
                { condition: "Flat + negative", points: 6 },
                { condition: "Declining + positive", points: 5 },
                { condition: "Declining + negative", points: 0 },
                { condition: "< 2 snapshots", points: 10 },
              ]}
            />

            <div
              style={{
                paddingTop: "12px",
                borderTop: "1px solid var(--border)",
                display: "flex",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              {(
                [
                  { grade: "A", range: "85–100", label: "Excellent" },
                  { grade: "B", range: "70–84", label: "Good" },
                  { grade: "C", range: "50–69", label: "Fair" },
                  { grade: "D", range: "35–49", label: "Needs Work" },
                  { grade: "F", range: "0–34", label: "Critical" },
                ] as const
              ).map(({ grade, range, label }) => (
                <span key={grade} style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  <span className="num" style={{ fontWeight: 700, color: "var(--text-secondary)" }}>
                    {grade}
                  </span>{" "}
                  {range} — {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Dashboard card showing an overall 0–100 financial health score with five sub-score factors and a full methodology explainer. */
export function FinancialHealthScore({
  accounts,
  budgets,
  monthlySummary,
  netWorthHistory,
}: FinancialHealthScoreProps) {
  const healthScore = useMemo(
    () => computeHealthScore({ accounts, budgets, monthlySummary, netWorthHistory }),
    [accounts, budgets, monthlySummary, netWorthHistory]
  );

  const scoreColor = overallScoreColor(healthScore.total);

  return (
    <CollapsibleCard
      eyebrow="Financial Health"
      title="How your finances are doing"
      description="A single grade from your savings, debt, spending, and net worth trend."
      headerRight={
        <ScoreBadge total={healthScore.total} grade={healthScore.grade} color={scoreColor} />
      }
    >
      {/* Prominent score display */}
      <div
        style={{
          textAlign: "center",
          padding: "8px 0 24px",
          borderBottom: "1px solid var(--border)",
          marginBottom: "24px",
        }}
      >
        <div
          className="num"
          style={{
            fontSize: "64px",
            fontWeight: 800,
            color: scoreColor,
            lineHeight: 1,
            letterSpacing: "-3px",
          }}
        >
          {healthScore.total}
        </div>
        <div
          style={{
            fontSize: "16px",
            fontWeight: 700,
            color: scoreColor,
            marginTop: "6px",
          }}
        >
          {healthScore.grade} &mdash; {healthScore.label}
        </div>
        <p
          style={{
            fontSize: "12px",
            color: "var(--text-muted)",
            marginTop: "2px",
          }}
        >
          out of 100 &middot; 5 factors
        </p>
        <div
          style={{
            maxWidth: "240px",
            margin: "14px auto 0",
            height: "8px",
            background: "#ffffff0a",
            borderRadius: "999px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${healthScore.total}%`,
              height: "100%",
              background: scoreColor,
              borderRadius: "999px",
              transition: "width 0.5s ease",
            }}
          />
        </div>
      </div>

      {/* Five sub-score factor rows */}
      {healthScore.subScores.map((sub) => (
        <SubScoreRow key={sub.id} sub={sub} />
      ))}

      {/* Full methodology explainer */}
      <CalculationExplainer />
    </CollapsibleCard>
  );
}
