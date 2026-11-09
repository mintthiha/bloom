import Link from "next/link";
import type { MonthlyReview } from "@/lib/api";
import {
  formatMonthName,
  isCurrentOrFutureMonth,
  isRecapSeason,
  shiftMonthKey,
} from "../review-month";
import { describeStreak } from "./review-copy";

type ReviewHeaderProps = {
  month: string;
  review: MonthlyReview | null;
  now: Date;
};

/** Page header: which month is under review, its streak/completion, and month-to-month navigation. */
export function ReviewHeader({ month, review, now }: ReviewHeaderProps) {
  const previousMonth = shiftMonthKey(month, -1);
  const nextMonth = shiftMonthKey(month, 1);
  const canGoForward = !isCurrentOrFutureMonth(month, now);
  const streak = review ? describeStreak(review.reviewStreak) : null;
  const recapYear = Number(month.slice(0, 4));
  const isPromotingRecap = isRecapSeason(now);

  return (
    <header
      style={{
        background: "var(--snapshot-gradient)",
        border: "1px solid var(--border)",
        borderRadius: "14px",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <p
        style={{
          fontSize: "13px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--brand-accent-text)",
        }}
      >
        Monthly review
      </p>
      <h1 style={{ fontSize: "26px", fontWeight: 800, letterSpacing: "-0.4px" }}>
        {formatMonthName(month, true)}
      </h1>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
        {review?.completedAt && (
          <span
            style={{
              fontSize: "12px",
              fontWeight: 700,
              padding: "3px 10px",
              borderRadius: "999px",
              color: "var(--positive)",
              border: "1px solid var(--positive)",
            }}
          >
            ✓ Reviewed
          </span>
        )}
        {streak && (
          <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600 }}>
            {streak}
          </span>
        )}
      </div>
      <nav
        aria-label="Choose month"
        style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}
      >
        <Link
          href={`/review?month=${previousMonth}`}
          className="budget-action-pill"
          style={{ padding: "5px 12px", fontSize: "12px", fontWeight: 600, textDecoration: "none" }}
        >
          ← {formatMonthName(previousMonth)}
        </Link>
        {canGoForward && (
          <Link
            href={`/review?month=${nextMonth}`}
            className="budget-action-pill"
            style={{
              padding: "5px 12px",
              fontSize: "12px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            {formatMonthName(nextMonth)} →
          </Link>
        )}
        <Link
          href={`/review/year?year=${recapYear}`}
          className={`budget-action-pill${isPromotingRecap ? " is-on" : ""}`}
          style={{
            padding: "5px 12px",
            fontSize: "12px",
            fontWeight: 600,
            textDecoration: "none",
            marginLeft: "auto",
          }}
        >
          {recapYear} in Bloom ✦
        </Link>
      </nav>
    </header>
  );
}
