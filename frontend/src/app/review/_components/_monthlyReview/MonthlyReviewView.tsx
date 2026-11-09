"use client";
import { useCallback, useEffect, useState } from "react";
import { CalendarCheck } from "lucide-react";
import { api, type MonthlyReview } from "@/lib/api";
import { getBrowserTimeZone } from "@/lib/date-range";
import { EmptyState } from "@/components/EmptyState";
import { useLoadFailureBoundary } from "@/hooks/useLoadFailureBoundary";
import { formatMonthName } from "../review-month";
import { ReviewHeader } from "./ReviewHeader";
import { ReviewStepper } from "./ReviewStepper";

type MonthlyReviewViewProps = {
  month: string;
  now: Date;
};

/** Loads one month's review and hosts the header plus the guided steps. */
export function MonthlyReviewView({ month, now }: MonthlyReviewViewProps) {
  const [review, setReview] = useState<MonthlyReview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const reportLoadFailure = useLoadFailureBoundary();

  /** Fetches the review for the month in the viewer's own time zone. */
  const loadReview = useCallback(async () => {
    const nextReview = await api.getMonthlyReview(month, getBrowserTimeZone());
    setReview(nextReview);
  }, [month]);

  /** Loads whenever the month changes; a failure shows the error page rather than a blank review. */
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setReview(null);
    api
      .getMonthlyReview(month, getBrowserTimeZone())
      .then((nextReview) => {
        if (!isCancelled) setReview(nextReview);
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
  }, [month, reportLoadFailure]);

  /** Reloads after a budget change inside the review, keeping the current step on screen. */
  const handleReviewChanged = useCallback(async () => {
    try {
      await loadReview();
    } catch (failure) {
      reportLoadFailure(failure);
    }
  }, [loadReview, reportLoadFailure]);

  /** Applies a just-saved completion without refetching the whole review. */
  function handleCompleted(completion: { completedAt: string; reviewStreak: number }) {
    setReview((current) => (current ? { ...current, ...completion } : current));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <ReviewHeader month={month} review={review} now={now} />
      {isLoading && <div className="skeleton" style={{ height: "320px", borderRadius: "14px" }} />}
      {!isLoading && review && !review.hasActivity && (
        <EmptyState
          icon={CalendarCheck}
          title={`Nothing recorded in ${formatMonthName(review.month)}`}
          description="Once a month has transactions — imported, linked, or added by hand — you can review it here."
        />
      )}
      {!isLoading && review?.hasActivity && (
        <ReviewStepper
          key={review.month}
          review={review}
          onReviewChanged={handleReviewChanged}
          onCompleted={handleCompleted}
        />
      )}
    </div>
  );
}
