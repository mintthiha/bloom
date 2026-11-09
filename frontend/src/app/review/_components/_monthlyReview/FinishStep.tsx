"use client";
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { api, type MonthlyReview } from "@/lib/api";
import { formatMonthName } from "../review-month";
import { describeStreak } from "./review-copy";
import { ReviewSection } from "./ReviewSection";

type FinishStepProps = {
  review: MonthlyReview;
  /** Receives the saved completion so the parent can show it without reloading the whole review. */
  onCompleted: (completion: { completedAt: string; reviewStreak: number }) => void;
};

/** Final step: mark the month as reviewed (which keeps the streak going) and point to what's next. */
export function FinishStep({ review, onCompleted }: FinishStepProps) {
  const [isCompleting, setIsCompleting] = useState(false);
  const monthName = formatMonthName(review.month);
  const nextMonthName = formatMonthName(review.nextMonth);
  const isComplete = review.completedAt !== null;
  const streak = describeStreak(review.reviewStreak);

  /** Records the review as finished and confirms with a toast. */
  async function handleComplete() {
    setIsCompleting(true);
    try {
      const completion = await api.completeMonthlyReview(review.month);
      toast.success(`${monthName} review complete`);
      onCompleted(completion);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save your review");
    } finally {
      setIsCompleting(false);
    }
  }

  return (
    <ReviewSection
      eyebrow="Wrap up"
      title={isComplete ? `${monthName} is reviewed` : `Ready to close out ${monthName}?`}
      description={
        isComplete
          ? `Nice work. ${streak ?? ""}`.trim()
          : `Finishing marks ${monthName} as reviewed and keeps your streak going. Your ${nextMonthName} budgets are already set.`
      }
    >
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
        {!isComplete && (
          <button
            type="button"
            className="press"
            onClick={handleComplete}
            disabled={isCompleting}
            style={{
              padding: "10px 18px",
              background: "var(--brand-accent)",
              color: "#000",
              border: "none",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 700,
              cursor: isCompleting ? "not-allowed" : "pointer",
              opacity: isCompleting ? 0.5 : 1,
            }}
          >
            {isCompleting ? "Saving…" : `Finish ${monthName} review`}
          </button>
        )}
        <Link
          href="/budgets"
          className="outline-hover-button press"
          style={{
            padding: "9px 16px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Open budgets
        </Link>
      </div>
    </ReviewSection>
  );
}
