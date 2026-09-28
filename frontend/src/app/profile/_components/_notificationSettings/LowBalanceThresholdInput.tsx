"use client";

import { useEffect, useState } from "react";
import { inputStyle as baseInputStyle } from "@/lib/styles/input";
import { SettingSubsection } from "./SettingSubsection";
import { parseLowBalanceThreshold } from "./notification-preferences";

/**
 * Dollar amount a cash account has to drop below before Bloom warns about it.
 * Keeps the half-typed value locally and only reports a usable amount upward,
 * so a stray keystroke never saves a threshold the backend would reject.
 */
export function LowBalanceThresholdInput({
  threshold,
  isDisabled,
  onCommit,
}: {
  threshold: number;
  isDisabled: boolean;
  onCommit: (threshold: number) => void;
}) {
  const [draftThreshold, setDraftThreshold] = useState(threshold.toString());

  /** Re-syncs the draft when the saved threshold changes (initial load or rollback). */
  useEffect(() => {
    setDraftThreshold(threshold.toString());
  }, [threshold]);

  /** Saves the typed amount, snapping back to the saved value when it is unusable. */
  function handleCommit() {
    const parsed = parseLowBalanceThreshold(draftThreshold);
    if (parsed === null) {
      setDraftThreshold(threshold.toString());
      return;
    }
    setDraftThreshold(parsed.toString());
    if (parsed !== threshold) onCommit(parsed);
  }

  return (
    <SettingSubsection label="Warn me below" hint="Applies to chequing and savings accounts.">
      <div style={{ display: "flex", alignItems: "center", gap: "8px", maxWidth: "200px" }}>
        <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>$</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="10"
          aria-label="Low balance threshold"
          disabled={isDisabled}
          value={draftThreshold}
          onChange={(event) => setDraftThreshold(event.target.value)}
          onBlur={handleCommit}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          style={{ ...baseInputStyle, borderRadius: "10px", padding: "10px 12px" }}
        />
      </div>
    </SettingSubsection>
  );
}
