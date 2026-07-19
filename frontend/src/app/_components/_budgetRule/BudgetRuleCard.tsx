"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { api, CategoryBreakdownItem, DateRangeQuery, MonthlySummary } from "@/lib/api";
import { CollapsibleCard } from "@/components/collapsible-card";
import { formatCurrency } from "@/lib/format";

const NEEDS_CATEGORIES = new Set(["Groceries", "Rent", "Utilities", "Transport", "Healthcare"]);

const NEEDS_TARGET_PCT = 50;
const WANTS_TARGET_PCT = 30;
const SAVINGS_TARGET_PCT = 20;

type Props = {
  monthlySummary: MonthlySummary;
  rangeQuery?: DateRangeQuery;
};

type AccountRow = {
  accountId: string;
  accountOwnerName: string;
  accountNickname: string | null;
  spending: number;
};

type CategoryRow = {
  category: string;
  spending: number;
  accounts: AccountRow[];
};

/** Returns a color for a bucket bar based on distance from target. */
function getBucketColor(pct: number, targetPct: number, higherIsBetter: boolean): string {
  if (higherIsBetter) {
    if (pct >= targetPct) return "#22c55e";
    if (pct >= targetPct * 0.5) return "#3b82f6";
    return "#f87171";
  }
  if (pct <= targetPct) return "#22c55e";
  if (pct <= targetPct * 1.2) return "#3b82f6";
  return "#f87171";
}

type BucketRowProps = {
  label: string;
  sublabel: string;
  amount: number;
  pct: number;
  targetPct: number;
  color: string;
  insightText: string;
  categories: CategoryRow[];
  loading: boolean;
};

/** A single 50/30/20 bucket with a progress bar, target marker, and expandable category+account drilldown. */
function BucketRow({
  label,
  sublabel,
  amount,
  pct,
  targetPct,
  color,
  insightText,
  categories,
  loading,
}: BucketRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [scrollbarVisible, setScrollbarVisible] = useState(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const barWidth = Math.min(Math.max(pct, 0), 100);

  /** Shows the scrollbar briefly on scroll, then hides it after 1 second of inactivity. */
  function handleScroll() {
    setScrollbarVisible(true);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => setScrollbarVisible(false), 1000);
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: "8px",
          flexWrap: "wrap",
          marginBottom: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
          <span style={{ fontSize: "13px", fontWeight: 700 }}>{label}</span>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{sublabel}</span>
        </div>
        <div
          style={{
            display: "flex",
            gap: "10px",
            alignItems: "baseline",
            flexShrink: 0,
          }}
        >
          <span className="num" style={{ fontSize: "14px", fontWeight: 700, color }}>
            {pct.toFixed(0)}%
          </span>
          <span className="num" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
            {formatCurrency(amount)}
          </span>
        </div>
      </div>

      <div
        style={{
          position: "relative",
          height: "8px",
          background: "var(--surface-2)",
          borderRadius: "4px",
          marginBottom: "6px",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: "100%",
            width: `${barWidth}%`,
            background: color,
            borderRadius: "4px",
            transition: "width 0.5s ease",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `${targetPct}%`,
            top: "-3px",
            height: "14px",
            width: "2px",
            background: "var(--text-muted)",
            borderRadius: "1px",
            transform: "translateX(-50%)",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "8px",
          marginBottom: categories.length > 0 ? "8px" : "0",
        }}
      >
        <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{insightText}</span>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexShrink: 0 }}>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>target {targetPct}%</span>
          {categories.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--text-secondary)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "0",
                display: "flex",
                alignItems: "center",
                gap: "3px",
              }}
            >
              {expanded ? "Hide" : "Details"}
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s ease",
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div
          onScroll={handleScroll}
          className={`scrollbar-fade${scrollbarVisible ? " scrollbar-visible" : ""}`}
          style={{
            borderLeft: "2px solid var(--border)",
            marginLeft: "4px",
            paddingLeft: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            marginTop: "4px",
            maxHeight: "260px",
            overflowY: "auto",
          }}
        >
          {loading ? (
            <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>Loading...</p>
          ) : (
            categories.map((categoryRow) => (
              <div key={categoryRow.category}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    marginBottom: "4px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                    }}
                  >
                    {categoryRow.category}
                  </span>
                  <span
                    className="num"
                    style={{ fontSize: "12px", color: "var(--text-secondary)" }}
                  >
                    {formatCurrency(categoryRow.spending)}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px",
                  }}
                >
                  {categoryRow.accounts.map((accountRow) => (
                    <div
                      key={accountRow.accountId}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        paddingLeft: "10px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "11px",
                          color: "var(--text-muted)",
                        }}
                      >
                        {accountRow.accountNickname ?? accountRow.accountOwnerName}
                      </span>
                      <span
                        className="num"
                        style={{
                          fontSize: "11px",
                          color: "var(--text-muted)",
                        }}
                      >
                        {formatCurrency(accountRow.spending)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** Collapsible card visualizing how the user's spending maps to the 50/30/20 budgeting rule. */
export function BudgetRuleCard({ monthlySummary, rangeQuery }: Props) {
  const { income, spending, netCashFlow, categories } = monthlySummary;
  const [breakdown, setBreakdown] = useState<CategoryBreakdownItem[]>([]);
  const [breakdownLoading, setBreakdownLoading] = useState(false);

  /** Fetches per-category per-account spending breakdown for the current date range. */
  useEffect(() => {
    let cancelled = false;
    setBreakdownLoading(true);

    api
      .getCategoryBreakdown(rangeQuery)
      .then((data) => {
        if (!cancelled) {
          setBreakdown(data);
          setBreakdownLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setBreakdownLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [rangeQuery]);

  /** Groups breakdown rows into CategoryRow objects with nested account rows. */
  const categoryRowsByCategory = useMemo(() => {
    const map = new Map<string, CategoryRow>();
    for (const item of breakdown) {
      if (!map.has(item.category)) {
        map.set(item.category, { category: item.category, spending: 0, accounts: [] });
      }
      const entry = map.get(item.category)!;
      entry.spending += item.spending;
      entry.accounts.push({
        accountId: item.accountId,
        accountOwnerName: item.accountOwnerName,
        accountNickname: item.accountNickname,
        spending: item.spending,
      });
    }
    return map;
  }, [breakdown]);

  const needsAmount = useMemo(
    () =>
      categories
        .filter((c) => NEEDS_CATEGORIES.has(c.category) && c.spending > 0)
        .reduce((sum, c) => sum + c.spending, 0),
    [categories]
  );

  const wantsAmount = Math.max(spending - needsAmount, 0);
  const savingsAmount = netCashFlow;

  const needsPct = income > 0 ? (needsAmount / income) * 100 : 0;
  const wantsPct = income > 0 ? (wantsAmount / income) * 100 : 0;
  const savingsPct = income > 0 ? (savingsAmount / income) * 100 : 0;

  const needsCategoryRows = useMemo(
    () =>
      Array.from(categoryRowsByCategory.values())
        .filter((r) => NEEDS_CATEGORIES.has(r.category))
        .sort((a, b) => b.spending - a.spending),
    [categoryRowsByCategory]
  );

  const wantsCategoryRows = useMemo(
    () =>
      Array.from(categoryRowsByCategory.values())
        .filter((r) => !NEEDS_CATEGORIES.has(r.category))
        .sort((a, b) => b.spending - a.spending),
    [categoryRowsByCategory]
  );

  const largestNeed = needsCategoryRows[0] ?? null;
  const largestWant = wantsCategoryRows[0] ?? null;

  const needsColor = getBucketColor(needsPct, NEEDS_TARGET_PCT, false);
  const wantsColor = getBucketColor(wantsPct, WANTS_TARGET_PCT, false);
  const savingsColor = getBucketColor(savingsPct, SAVINGS_TARGET_PCT, true);

  return (
    <CollapsibleCard
      eyebrow="50 / 30 / 20"
      title="Budget Rule"
      description="How your spending maps to the 50/30/20 framework."
      className="fade-up fade-up-1"
      style={{}}
    >
      {income === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
          No income recorded this month.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <BucketRow
            label="Needs"
            sublabel="Groceries · Rent · Utilities · Transport · Healthcare"
            amount={needsAmount}
            pct={needsPct}
            targetPct={NEEDS_TARGET_PCT}
            color={needsColor}
            insightText={
              largestNeed
                ? `Largest: ${largestNeed.category} (${formatCurrency(largestNeed.spending)})`
                : "No needs spending recorded this month."
            }
            categories={needsCategoryRows}
            loading={breakdownLoading}
          />
          <BucketRow
            label="Wants"
            sublabel="Dining · Shopping · Entertainment & more"
            amount={wantsAmount}
            pct={wantsPct}
            targetPct={WANTS_TARGET_PCT}
            color={wantsColor}
            insightText={
              largestWant
                ? `Largest: ${largestWant.category} (${formatCurrency(largestWant.spending)})`
                : "No wants spending recorded this month."
            }
            categories={wantsCategoryRows}
            loading={breakdownLoading}
          />
          <BucketRow
            label="Savings"
            sublabel="Income minus all spending"
            amount={savingsAmount}
            pct={savingsPct}
            targetPct={SAVINGS_TARGET_PCT}
            color={savingsColor}
            insightText={
              savingsPct >= SAVINGS_TARGET_PCT
                ? "At or above the 20% savings target."
                : savingsPct > 0
                  ? `${(SAVINGS_TARGET_PCT - savingsPct).toFixed(0)}% short of the 20% target.`
                  : "Spending exceeds income this month."
            }
            categories={[]}
            loading={false}
          />
        </div>
      )}
    </CollapsibleCard>
  );
}
