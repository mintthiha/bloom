"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BackToHome } from "@/components/BackToHome";
import { resolveReviewMonth } from "./_components/review-month";
import { MonthlyReviewView } from "./_components/_monthlyReview/MonthlyReviewView";

/** Reads `?month=` (defaulting to last month) and renders that month's review. */
function MonthlyReviewPageContent() {
  const searchParams = useSearchParams();
  const [now] = useState(() => new Date());
  const month = resolveReviewMonth(searchParams.get("month"), now);
  return <MonthlyReviewView month={month} now={now} />;
}

export default function MonthlyReviewPage() {
  return (
    <div style={{ maxWidth: "760px", margin: "0 auto", padding: "40px 16px 48px" }}>
      <BackToHome />
      <Suspense>
        <MonthlyReviewPageContent />
      </Suspense>
    </div>
  );
}
