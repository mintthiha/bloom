"use client";

import { Check } from "lucide-react";
import { BloomMark } from "@/components/BloomMark";
import { SHOWCASE_ORBS } from "./showcase-orbs";
import { useOrbPhysics } from "./useOrbPhysics";

const VALUE_PROPS = [
  { title: "Net worth at a glance", body: "Assets, debt, and the trend in one clear number." },
  {
    title: "Budgets you can trust",
    body: "Category spending tracked against your limits in real time.",
  },
  {
    title: "Every account, unified",
    body: "Chequing, savings, TFSA, RRSP, FHSA, and credit, side by side.",
  },
];

const ACCOUNT_TAGS = ["Chequing", "Savings", "TFSA", "RRSP", "FHSA", "Credit"];

/**
 * Branded showcase panel beside the sign-in options — deliberately fixed-dark (not theme-aware)
 * so the split reads intentionally in both light and dark mode. Hidden below lg.
 */
export function LoginShowcase() {
  const { panelRef, orbElementsRef, hasStarted, handlePanelMouseMove, handlePanelMouseLeave } =
    useOrbPhysics();

  return (
    <div
      ref={panelRef}
      onMouseMove={handlePanelMouseMove}
      onMouseLeave={handlePanelMouseLeave}
      className="hidden lg:flex"
      style={{
        position: "relative",
        overflow: "hidden",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "48px",
        borderRight: "1px solid #1f1f1f",
        background: "linear-gradient(160deg, #17120a 0%, #080808 62%)",
        color: "#efefef",
      }}
    >
      {/* Each orb's outer wrapper is driven by the physics loop (transform); inner handles the entrance scale. */}
      {SHOWCASE_ORBS.map((orb, index) => (
        <div
          key={index}
          ref={(element) => {
            orbElementsRef.current[index] = element;
          }}
          aria-hidden
          style={{
            position: "absolute",
            ...orb.anchor,
            width: `${orb.size}px`,
            height: `${orb.size}px`,
            pointerEvents: "none",
            willChange: "transform",
          }}
        >
          <div
            className={hasStarted ? "login-glow" : undefined}
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              background: orb.background,
              animationDelay: orb.entranceDelay,
              opacity: hasStarted ? undefined : 0,
            }}
          />
        </div>
      ))}

      <div
        className="fade-up"
        style={{ position: "relative", display: "flex", alignItems: "center", gap: "10px" }}
      >
        <BloomMark size={28} />
        <span style={{ fontWeight: 800, fontSize: "20px", letterSpacing: "-0.4px" }}>Bloom</span>
      </div>

      <div style={{ position: "relative", maxWidth: "440px" }}>
        <h1
          className="fade-up"
          style={{
            fontSize: "34px",
            fontWeight: 800,
            lineHeight: 1.12,
            letterSpacing: "-0.6px",
            marginBottom: "16px",
            animationDelay: "0.08s",
          }}
        >
          Your whole financial life, in one calm view.
        </h1>
        <p
          className="fade-up"
          style={{
            fontSize: "15px",
            lineHeight: 1.55,
            color: "#9898aa",
            marginBottom: "32px",
            animationDelay: "0.16s",
          }}
        >
          A clear view of your net worth, budgets, and cash flow, all in one place.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {VALUE_PROPS.map((prop, index) => (
            <div
              key={prop.title}
              className="fade-up value-prop"
              style={{
                display: "flex",
                gap: "12px",
                animationDelay: `${0.24 + index * 0.08}s`,
              }}
            >
              <span
                aria-hidden
                className="value-prop-icon"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "22px",
                  height: "22px",
                  borderRadius: "999px",
                  background: "color-mix(in srgb, var(--brand-accent) 12%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--brand-accent) 27%, transparent)",
                  color: "var(--brand-accent-text)",
                  flexShrink: 0,
                  marginTop: "1px",
                }}
              >
                <Check size={13} strokeWidth={2.5} />
              </span>
              <div className="value-prop-text">
                <p
                  className="value-prop-title"
                  style={{ fontSize: "14px", fontWeight: 600, marginBottom: "2px" }}
                >
                  {prop.title}
                </p>
                <p style={{ fontSize: "13px", color: "#888", lineHeight: 1.5 }}>{prop.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div
          className="fade-up"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            marginTop: "32px",
            animationDelay: "0.52s",
          }}
        >
          {ACCOUNT_TAGS.map((tag) => (
            <span
              key={tag}
              className="num"
              style={{
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.03em",
                padding: "4px 10px",
                borderRadius: "999px",
                background: "#111111",
                border: "1px solid #1f1f1f",
                color: "#888",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <p
        className="fade-up"
        style={{
          position: "relative",
          fontSize: "12px",
          color: "#6b6b80",
          animationDelay: "0.6s",
        }}
      >
        Know where you stand, every day.
      </p>
    </div>
  );
}
