"use client";

import { BackToHome } from "@/components/BackToHome";
import { BudgetsOverview } from "./_components/_budgetsOverview/BudgetsOverview";

export default function BudgetsPage() {
  return (
    <div
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "40px 24px 48px",
      }}
    >
      <BackToHome />
      <BudgetsOverview />
    </div>
  );
}
