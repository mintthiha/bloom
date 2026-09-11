"use client";

import { BackToHome } from "@/components/BackToHome";
import { ActivityExplorer } from "./_components/_activityExplorer/ActivityExplorer";

/** Dedicated page listing every action taken in Bloom, with filtering, sorting, and paging. */
export default function ActivityPage() {
  return (
    <div
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "40px 24px 48px",
      }}
    >
      <BackToHome />

      <div className="fade-up" style={{ marginBottom: "28px" }}>
        <h1
          style={{
            fontSize: "32px",
            fontWeight: 800,
            letterSpacing: "-0.5px",
            marginBottom: "6px",
          }}
        >
          Activity
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "15px" }}>
          A log of every action you&apos;ve taken in Bloom, such as account changes, transactions,
          goals, budgets, and more.
        </p>
      </div>

      <div className="fade-up fade-up-1">
        <ActivityExplorer />
      </div>
    </div>
  );
}
