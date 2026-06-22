"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Account, Budget, MonthlySummary, SavingsGoal } from "@/lib/api";
import {
  getOnboardingDismissed,
  setOnboardingDismissed,
  getLearnPageExplored,
  setLearnPageExplored,
  setOnboardingAllStepsComplete,
  clearOnboardingAllStepsComplete,
} from "./onboarding-storage";
import { deriveOnboardingSteps, OnboardingStep } from "./onboarding-steps";

type Props = {
  accounts: Account[];
  budgets: Budget[];
  goals: SavingsGoal[];
  monthlySummary: MonthlySummary | null;
};

/** Single step row: shows a check or circle indicator beside a label, linked when incomplete. */
function OnboardingStepRow({
  step,
  onLearnNavigate,
}: {
  step: OnboardingStep;
  onLearnNavigate: () => void;
}) {
  const indicator = step.isComplete ? (
    <span
      aria-hidden="true"
      style={{
        fontSize: "12px",
        fontWeight: 700,
        color: "#22c55e",
        lineHeight: 1,
        flexShrink: 0,
        width: "14px",
        textAlign: "center",
      }}
    >
      ✓
    </span>
  ) : (
    <span
      aria-hidden="true"
      style={{
        fontSize: "12px",
        color: "var(--text-muted)",
        lineHeight: 1,
        flexShrink: 0,
        width: "14px",
        textAlign: "center",
      }}
    >
      ○
    </span>
  );

  const labelText = (
    <span
      style={{
        fontSize: "13px",
        fontWeight: step.isComplete ? 400 : 500,
        color: step.isComplete ? "var(--text-muted)" : "var(--text-primary)",
        textDecoration: step.isComplete ? "line-through" : "none",
      }}
    >
      {step.label}
    </span>
  );

  const rowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "5px 0",
  };

  if (!step.isComplete && step.href) {
    return (
      <div style={rowStyle}>
        {indicator}
        <Link
          href={step.href}
          onClick={step.id === "explore-learn" ? onLearnNavigate : undefined}
          style={{ textDecoration: "none" }}
        >
          {labelText}
        </Link>
      </div>
    );
  }

  return (
    <div style={rowStyle}>
      {indicator}
      {labelText}
    </div>
  );
}

/** Onboarding checklist shown at the top of the dashboard until all steps are complete or the user dismisses it. */
export function OnboardingChecklist({ accounts, budgets, goals, monthlySummary }: Props) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [hasExploredLearnPage, setHasExploredLearnPage] = useState(false);
  const [wasRestoredByUser, setWasRestoredByUser] = useState(false);

  /** Seeds dismissal and learn-explored state from localStorage on first render. */
  useEffect(() => {
    setIsDismissed(getOnboardingDismissed());
    setHasExploredLearnPage(getLearnPageExplored());
  }, []);

  /** Re-shows the checklist when the customize panel restores it without requiring a page reload. */
  useEffect(() => {
    function handleRestored() {
      setIsDismissed(false);
      setWasRestoredByUser(true);
      clearOnboardingAllStepsComplete();
    }
    window.addEventListener("bloom:onboarding-restored", handleRestored);
    return () => window.removeEventListener("bloom:onboarding-restored", handleRestored);
  }, []);

  const steps = useMemo(
    () =>
      deriveOnboardingSteps({
        accounts,
        budgets,
        goals,
        monthlySummary,
        hasExploredLearnPage,
      }),
    [accounts, budgets, goals, monthlySummary, hasExploredLearnPage]
  );

  const completedCount = steps.filter((s) => s.isComplete).length;
  const allStepsComplete = completedCount === steps.length;

  /** Writes the all-complete flag and notifies the panel so the restore button can appear. */
  useEffect(() => {
    if (allStepsComplete && !wasRestoredByUser) {
      setOnboardingAllStepsComplete();
      window.dispatchEvent(new Event("bloom:onboarding-all-complete"));
    }
  }, [allStepsComplete, wasRestoredByUser]);

  /** Permanently hides the checklist and notifies the customize panel to show the restore button. */
  function handleDismiss() {
    setOnboardingDismissed();
    setIsDismissed(true);
    window.dispatchEvent(new Event("bloom:onboarding-dismissed"));
  }

  /** Records Learn page visit in localStorage and reflects it in local state immediately. */
  function handleLearnNavigate() {
    setLearnPageExplored();
    setHasExploredLearnPage(true);
  }

  if (isDismissed || (allStepsComplete && !wasRestoredByUser)) return null;

  return (
    <div
      className="fade-up"
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "14px",
        padding: "20px 24px",
        marginBottom: "32px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "14px",
          gap: "12px",
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
              marginBottom: "4px",
            }}
          >
            Getting Started
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <h2
              style={{
                fontSize: "17px",
                fontWeight: 700,
                letterSpacing: "-0.2px",
                margin: 0,
              }}
            >
              Get started with Bloom
            </h2>
            <span
              className="num"
              style={{
                fontSize: "11px",
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: "999px",
                background: "#f59e0b22",
                color: "#f59e0b",
                flexShrink: 0,
              }}
            >
              {completedCount} of {steps.length} done
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss onboarding checklist"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--text-muted)",
            fontSize: "12px",
            fontWeight: 600,
            padding: "4px 8px",
            borderRadius: "6px",
            flexShrink: 0,
            marginTop: "2px",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
        >
          Dismiss
        </button>
      </div>

      {/* Steps */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
          gap: "0 16px",
        }}
      >
        {steps.map((step) => (
          <OnboardingStepRow key={step.id} step={step} onLearnNavigate={handleLearnNavigate} />
        ))}
      </div>
    </div>
  );
}
