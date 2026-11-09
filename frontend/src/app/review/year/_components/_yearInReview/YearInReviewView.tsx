"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api, type YearInReview } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { getBrowserTimeZone } from "@/lib/date-range";
import { EmptyState } from "@/components/EmptyState";
import { useLoadFailureBoundary } from "@/hooks/useLoadFailureBoundary";
import { STAT_TILE_GRID_STYLE, StatTile } from "../../../_components/_monthlyReview/ReviewSection";
import { buildRecapHighlights, buildRecapShareText, recapTitle } from "./year-recap";
import { YearSpendingChart } from "./YearSpendingChart";

/** Formats an amount with no cents — the recap is about the big picture. */
const formatWholeDollars = (amount: number) => formatCurrency(amount, { hideCents: true });

/** Loads and renders the year recap: totals, the monthly chart, highlights, and a copyable summary. */
export function YearInReviewView({ year }: { year: number }) {
  const [recap, setRecap] = useState<YearInReview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const reportLoadFailure = useLoadFailureBoundary();

  /** Fetches the recap for the year in the viewer's own time zone. */
  useEffect(() => {
    let isCancelled = false;
    api
      .getYearInReview(year, getBrowserTimeZone())
      .then((nextRecap) => {
        if (!isCancelled) setRecap(nextRecap);
      })
      .catch((failure) => {
        if (!isCancelled) reportLoadFailure(failure);
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });
    return () => {
      isCancelled = true;
    };
  }, [year, reportLoadFailure]);

  /** Copies the plain-text recap to the clipboard so the user can paste it anywhere. */
  async function handleCopyRecap() {
    if (!recap) return;
    try {
      await navigator.clipboard.writeText(buildRecapShareText(recap, formatWholeDollars));
      toast.success("Recap copied");
    } catch {
      toast.error("Couldn't copy — your browser blocked clipboard access");
    }
  }

  if (isLoading) {
    return <div className="skeleton" style={{ height: "420px", borderRadius: "14px" }} />;
  }
  if (!recap || !recap.hasActivity) {
    return (
      <EmptyState
        icon={Sparkles}
        title={`Nothing recorded in ${year} yet`}
        description="Your recap fills in as transactions are imported, linked, or added."
      />
    );
  }

  const highlights = buildRecapHighlights(recap, formatWholeDollars);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <header
        style={{
          background: "var(--snapshot-gradient)",
          border: "1px solid var(--border)",
          borderRadius: "14px",
          padding: "28px 24px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <p
              style={{
                fontSize: "13px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--brand-accent-text)",
                marginBottom: "6px",
              }}
            >
              Year in review
            </p>
            <h1 style={{ fontSize: "30px", fontWeight: 800, letterSpacing: "-0.5px" }}>
              {recapTitle(recap)}
            </h1>
          </div>
          <button
            type="button"
            className="outline-hover-button press"
            onClick={handleCopyRecap}
            style={{
              alignSelf: "flex-start",
              padding: "8px 14px",
              background: "transparent",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Copy recap
          </button>
        </div>
        <div style={STAT_TILE_GRID_STYLE}>
          <StatTile label="Money in" value={formatWholeDollars(recap.totals.income)} />
          <StatTile label="Money out" value={formatWholeDollars(recap.totals.spending)} />
          <StatTile
            label={recap.totals.netSaved >= 0 ? "Saved" : "Overspent"}
            value={formatWholeDollars(Math.abs(recap.totals.netSaved))}
            detail={
              recap.totals.savingsRate !== null && recap.totals.savingsRate > 0
                ? `${Math.round(recap.totals.savingsRate * 100)}% of income`
                : null
            }
          />
          <StatTile
            label="Transactions"
            value={recap.totals.transactionCount.toLocaleString("en-CA")}
            detail={`across ${recap.activeMonthCount} month${recap.activeMonthCount === 1 ? "" : "s"}`}
          />
        </div>
      </header>

      <section
        style={{
          background: "var(--surface-1)",
          border: "1px solid var(--border)",
          borderRadius: "14px",
          padding: "20px 24px",
        }}
      >
        <YearSpendingChart months={recap.months} />
      </section>

      {highlights.length > 0 && (
        <section aria-label="Highlights">
          <ul
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
              gap: "12px",
              listStyle: "none",
            }}
          >
            {highlights.map((highlight) => (
              <li
                key={highlight.id}
                style={{
                  background: "var(--surface-1)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  padding: "16px",
                  minWidth: 0,
                }}
              >
                <p
                  style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "6px" }}
                >
                  {highlight.label}
                </p>
                <p
                  style={{
                    fontSize: "18px",
                    fontWeight: 800,
                    overflowWrap: "anywhere",
                  }}
                >
                  {highlight.value}
                </p>
                {highlight.detail && (
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                    {highlight.detail}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
        {recap.isYearComplete
          ? "Calculated from everything you recorded this year."
          : "Year to date — this fills in as the year goes on."}{" "}
        <Link href="/review" style={{ color: "var(--brand-accent-text)", fontWeight: 600 }}>
          Back to monthly review
        </Link>
      </p>
    </div>
  );
}
