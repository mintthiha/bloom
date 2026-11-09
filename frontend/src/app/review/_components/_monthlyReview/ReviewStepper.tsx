"use client";
import { useState } from "react";
import type { MonthlyReview } from "@/lib/api";
import { buildReviewSteps, REVIEW_STEP_LABELS, type ReviewStepId } from "./review-steps";
import { CashFlowStep } from "./CashFlowStep";
import { CategoriesStep } from "./CategoriesStep";
import { BudgetsStep } from "./BudgetsStep";
import { GoalsStep } from "./GoalsStep";
import { FinishStep } from "./FinishStep";

type ReviewStepperProps = {
  review: MonthlyReview;
  onReviewChanged: () => Promise<void>;
  onCompleted: (completion: { completedAt: string; reviewStreak: number }) => void;
};

/** Walks the user through the review one step at a time, with a clickable progress row. */
export function ReviewStepper({ review, onReviewChanged, onCompleted }: ReviewStepperProps) {
  const steps = buildReviewSteps(review);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  // A reload can drop a step (e.g. the last budget deleted elsewhere); never point past the end.
  const stepIndex = Math.min(activeStepIndex, steps.length - 1);
  const activeStep = steps[stepIndex]!;
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === steps.length - 1;

  /** Renders the body for one step. */
  function renderStep(step: ReviewStepId) {
    switch (step) {
      case "cashFlow":
        return <CashFlowStep review={review} />;
      case "categories":
        return <CategoriesStep review={review} />;
      case "budgets":
        return <BudgetsStep review={review} onReviewChanged={onReviewChanged} />;
      case "goals":
        return <GoalsStep review={review} />;
      case "finish":
        return <FinishStep review={review} onCompleted={onCompleted} />;
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <nav
        aria-label="Review steps"
        style={{ display: "flex", flexDirection: "column", gap: "8px" }}
      >
        <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
          Step {stepIndex + 1} of {steps.length}
        </p>
        <ol style={{ display: "flex", gap: "6px", flexWrap: "wrap", listStyle: "none" }}>
          {steps.map((step, index) => (
            <li key={step}>
              <button
                type="button"
                className={`budget-action-pill${index === stepIndex ? " is-on" : ""}`}
                aria-current={index === stepIndex ? "step" : undefined}
                onClick={() => setActiveStepIndex(index)}
                style={{
                  padding: "5px 12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {REVIEW_STEP_LABELS[step]}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {renderStep(activeStep)}

      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
        <button
          type="button"
          className="outline-hover-button press"
          onClick={() => setActiveStepIndex(stepIndex - 1)}
          disabled={isFirstStep}
          style={{
            padding: "9px 16px",
            background: "transparent",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: isFirstStep ? "not-allowed" : "pointer",
            visibility: isFirstStep ? "hidden" : "visible",
          }}
        >
          ← Back
        </button>
        {!isLastStep && (
          <button
            type="button"
            className="press"
            onClick={() => setActiveStepIndex(stepIndex + 1)}
            style={{
              padding: "9px 18px",
              background: "var(--brand-accent)",
              color: "#000",
              border: "none",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Next: {REVIEW_STEP_LABELS[steps[stepIndex + 1]!]} →
          </button>
        )}
      </div>
    </div>
  );
}
