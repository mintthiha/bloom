"use client";

import { BackToHome } from "@/components/BackToHome";
import { DateRangeControls } from "@/components/date-range-controls";
import { BudgetActivity } from "@/lib/api";
import { DateRangeState } from "@/lib/date-range";

type HeaderSectionProps = {
  budget: BudgetActivity;
  dateRange: DateRangeState;
  setDateRange: (range: DateRangeState) => void;
  timeZone: string;
};

export function HeaderSection({
  budget,
  dateRange,
  setDateRange,
  timeZone,
}: HeaderSectionProps) {
  return (
    <div className="fade-up" style={{ marginBottom: "28px" }}>
      <BackToHome />
      <div
        style={{
          marginTop: "18px",
          display: "flex",
          justifyContent: "space-between",
          gap: "16px",
          alignItems: "flex-start",
        }}
      >
        <div>
          <p
            style={{
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#f59e0b",
              marginBottom: "10px",
            }}
          >
            Budget Detail
          </p>
          <h1
            style={{
              fontSize: "32px",
              fontWeight: 800,
              letterSpacing: "-0.5px",
              marginBottom: "6px",
            }}
          >
            {budget.category}
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "15px" }}>
            Spending activity for {budget.month}.
          </p>
          <p
            style={{
              color: "var(--text-muted)",
              fontSize: "12px",
              marginTop: "6px",
            }}
          >
            Times shown in {timeZone}.
          </p>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            alignItems: "flex-end",
          }}
        >
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {budget.activity.length} transaction
            {budget.activity.length !== 1 ? "s" : ""}
          </span>
          <DateRangeControls value={dateRange} onChange={setDateRange} />
        </div>
      </div>
    </div>
  );
}
