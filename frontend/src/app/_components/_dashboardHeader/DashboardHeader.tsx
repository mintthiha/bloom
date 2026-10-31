"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { DateRangeControls } from "@/components/date-range-controls";
import type { DateRangeState } from "@/lib/date-range";
import { getBrowserTimeZone } from "@/lib/date-range";
import { getGreeting } from "@/lib/profile-cache";
import { GreetingHighlight } from "../_greetingHighlight/GreetingHighlight";

interface DashboardHeaderProps {
  /** First name for the greeting, or null for a nameless "Good morning." */
  firstName: string | null;
  /** Everything the one-line highlight under the greeting is chosen from. */
  highlight: ComponentProps<typeof GreetingHighlight>;
  dateRange: DateRangeState;
  onDateRangeChange: (dateRange: DateRangeState) => void;
}

/** Greeting, personalized highlight, time zone note, and the dashboard's date-range picker. */
export function DashboardHeader({
  firstName,
  highlight,
  dateRange,
  onDateRangeChange,
}: DashboardHeaderProps) {
  const [timeZone, setTimeZone] = useState("UTC");

  /** Detects the browser timezone for display (after mount, so server and client HTML match). */
  useEffect(() => {
    setTimeZone(getBrowserTimeZone());
  }, []);

  return (
    <div className="fade-up" style={{ marginBottom: "28px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "16px",
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "32px",
              fontWeight: 800,
              letterSpacing: "-0.5px",
              marginBottom: "6px",
            }}
          >
            {firstName ? `${getGreeting()}, ${firstName}.` : `${getGreeting()}.`}
          </h1>
          <GreetingHighlight {...highlight} />
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
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <DateRangeControls value={dateRange} onChange={onDateRangeChange} />
        </div>
      </div>
    </div>
  );
}
