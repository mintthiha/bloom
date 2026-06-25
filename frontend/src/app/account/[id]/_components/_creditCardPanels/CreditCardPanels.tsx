"use client";
import { useState, useRef, useEffect } from "react";
import type { Account, Transaction } from "@/lib/api";
import { ACCOUNT_TYPE_META } from "@/lib/constants/account";
import { DebtPayoffPanel } from "../_debtPayoff/DebtPayoffPanel";
import { CreditRewardsPanel } from "../_creditRewards/CreditRewardsPanel";

type ActivePanel = "debt" | "rewards";
type SwitchState = "idle" | "exiting" | "entering";

type CreditCardPanelsProps = {
  account: Account;
  txns: Transaction[];
};

const PANELS: { id: ActivePanel; label: string }[] = [
  { id: "debt", label: "Debt Planner" },
  { id: "rewards", label: "Rewards Estimator" },
];

const EXIT_MS = 240;

/**
 * Stacked card container that shows one credit panel at a time.
 * The back card peeks 12px below the front. Switching lifts the front card
 * upward (exit), swaps content, then the new card rises from below (enter).
 */
export function CreditCardPanels({ account, txns }: CreditCardPanelsProps) {
  const accentColor = ACCOUNT_TYPE_META.CREDIT.color;
  const [activePanel, setActivePanel] = useState<ActivePanel>("debt");
  const [switchState, setSwitchState] = useState<SwitchState>("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  /** Lifts the current card out, swaps content, then rises the new card in. */
  function handleSwitchTo(target: ActivePanel) {
    if (target === activePanel || switchState !== "idle") return;

    setSwitchState("exiting");

    timeoutRef.current = setTimeout(() => {
      setActivePanel(target);
      setSwitchState("entering");

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setSwitchState("idle");
        });
      });
    }, EXIT_MS);
  }

  const frontTransform =
    switchState === "exiting"
      ? "translateY(-32px) scale(0.97)"
      : switchState === "entering"
        ? "translateY(24px) scale(0.97)"
        : "translateY(0) scale(1)";

  const frontOpacity = switchState === "idle" ? 1 : 0;
  const frontTransition =
    switchState === "entering"
      ? "none"
      : `transform ${EXIT_MS}ms ease, opacity ${Math.round(EXIT_MS * 0.75)}ms ease`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {/* Tab switcher */}
      <div style={{ display: "flex", gap: "6px" }}>
        {PANELS.map(({ id, label }) => {
          const isActive = activePanel === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleSwitchTo(id)}
              disabled={switchState !== "idle"}
              style={{
                padding: "6px 14px",
                borderRadius: "20px",
                border: isActive ? `1px solid ${accentColor}55` : "1px solid var(--border)",
                background: isActive ? `${accentColor}18` : "transparent",
                color: isActive ? accentColor : "var(--text-muted)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: isActive || switchState !== "idle" ? "default" : "pointer",
                transition: "background 0.15s ease, color 0.15s ease, border-color 0.15s ease",
                fontFamily: "inherit",
                letterSpacing: "0.02em",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Stacked card area — back card peeks 12px below front card */}
      <div style={{ position: "relative", paddingBottom: "12px" }}>
        {/* Back card visual: starts 10px lower, 8px narrower each side */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 10,
            left: 8,
            right: 8,
            bottom: 0,
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderRadius: "14px",
            zIndex: 0,
            opacity: 0.55,
          }}
        />

        {/* Front card */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            transform: frontTransform,
            opacity: frontOpacity,
            transition: frontTransition,
            willChange: "transform, opacity",
          }}
        >
          {activePanel === "debt" ? (
            <DebtPayoffPanel account={account} />
          ) : (
            <CreditRewardsPanel txns={txns} />
          )}
        </div>
      </div>
    </div>
  );
}
