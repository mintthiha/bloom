"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BackToHome } from "@/components/BackToHome";
import { resolveRecapYear } from "../_components/review-month";
import { YearInReviewView } from "./_components/_yearInReview/YearInReviewView";

/** Reads `?year=` (defaulting to the year just finished in January, otherwise this year). */
function YearInReviewPageContent() {
  const searchParams = useSearchParams();
  const [now] = useState(() => new Date());
  const year = resolveRecapYear(searchParams.get("year"), now);
  return <YearInReviewView key={year} year={year} />;
}

export default function YearInReviewPage() {
  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 16px 48px" }}>
      <BackToHome />
      <Suspense>
        <YearInReviewPageContent />
      </Suspense>
    </div>
  );
}
