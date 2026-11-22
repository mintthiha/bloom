import Link from "next/link";
import type { MoneyLadder, MoneyLadderStepStatus } from "./money-ladder";

const SEGMENT_BACKGROUND: Record<MoneyLadderStepStatus, string> = {
  done: "var(--brand-accent)",
  current: "color-mix(in srgb, var(--brand-accent) 35%, transparent)",
  upcoming: "var(--surface-2)",
};

const STATUS_TEXT: Record<MoneyLadderStepStatus, string> = {
  done: "done",
  current: "you are here",
  upcoming: "up next",
};

const SECTION_LABEL_STYLE = {
  fontSize: "11px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--text-secondary)",
} as const;

/**
 * The "where your next dollar goes" ladder: a five-segment progress bar of the savings priority
 * steps, then the current step spelled out with real numbers and one link to act on it.
 */
export function MoneyLadderSection({ ladder }: { ladder: MoneyLadder }) {
  const { steps, focus } = ladder;
  const currentStep = steps[focus.stepNumber - 1];
  const nextUpcomingStep = steps.slice(focus.stepNumber).find((step) => step.status !== "done");

  return (
    <section aria-label="Where your next dollar goes">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: "12px",
          marginBottom: "8px",
        }}
      >
        <p style={SECTION_LABEL_STYLE}>Where your next dollar goes</p>
        <p className="num" style={{ fontSize: "11px", color: "var(--text-muted)", flexShrink: 0 }}>
          Step {focus.stepNumber} of {steps.length}
        </p>
      </div>

      <ol
        style={{
          display: "flex",
          gap: "4px",
          listStyle: "none",
          margin: "0 0 12px",
          padding: 0,
        }}
      >
        {steps.map((step) => (
          <li
            key={step.id}
            title={`${step.label}: ${STATUS_TEXT[step.status]}`}
            style={{
              flex: 1,
              height: "6px",
              borderRadius: "999px",
              background: SEGMENT_BACKGROUND[step.status],
              boxShadow:
                step.status === "current" ? "0 0 0 1px var(--brand-accent) inset" : undefined,
            }}
          >
            <span className="sr-only">
              {step.label}: {STATUS_TEXT[step.status]}
            </span>
          </li>
        ))}
      </ol>

      <div
        style={{
          background: "color-mix(in srgb, var(--brand-accent) 6%, transparent)",
          border: "1px solid color-mix(in srgb, var(--brand-accent) 25%, transparent)",
          borderRadius: "10px",
          padding: "12px 14px",
        }}
      >
        <p
          style={{
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--brand-accent-text)",
            marginBottom: "4px",
          }}
        >
          {currentStep.label}
        </p>
        <p
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: "4px",
          }}
        >
          {focus.headline}
        </p>
        <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
          {focus.detail}
        </p>

        {(focus.action || nextUpcomingStep) && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "8px 16px",
              marginTop: "10px",
            }}
          >
            {focus.action ? (
              <Link
                href={focus.action.href}
                className="press"
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--brand-accent-light)",
                  textDecoration: "none",
                }}
              >
                {focus.action.label} →
              </Link>
            ) : (
              <span />
            )}
            {nextUpcomingStep && (
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                Then: {nextUpcomingStep.label}
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
