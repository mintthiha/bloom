"use client";

import { Ban, Check } from "lucide-react";
import { ACCOUNT_COLOR_PALETTES, AccountColor } from "@/lib/constants/account";
import { SAVINGS_GOAL_ICONS } from "@/lib/constants/savings-goal";

type GoalAppearancePickerProps = {
  selectedColor: AccountColor | null;
  selectedIcon: string | null;
  onColorChange: (color: AccountColor | null) => void;
  onIconChange: (icon: string | null) => void;
  disabled: boolean;
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "11px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--text-secondary)",
  marginBottom: "8px",
};

/** Shared swatch sizing/shape for both the colour dots and the emoji buttons. */
const swatchButtonStyle = (isSelected: boolean): React.CSSProperties => ({
  width: "30px",
  height: "30px",
  borderRadius: "8px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: isSelected ? "2px solid var(--brand-accent)" : "1px solid var(--border)",
  background: "var(--surface-2)",
  cursor: "pointer",
  padding: 0,
  fontSize: "14px",
});

/**
 * Colour and emoji pickers for a savings goal, so a list of goals reads as distinct things to
 * save for rather than a column of identical bars. Both are optional: re-clicking a selection
 * clears it back to the app accent and the default target icon.
 */
export function GoalAppearancePicker({
  selectedColor,
  selectedIcon,
  onColorChange,
  onIconChange,
  disabled,
}: GoalAppearancePickerProps) {
  return (
    <>
      <div>
        <span style={labelStyle}>Colour</span>
        <div
          role="radiogroup"
          aria-label="Goal colour"
          style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}
        >
          {(Object.keys(ACCOUNT_COLOR_PALETTES) as AccountColor[]).map((option) => {
            const palette = ACCOUNT_COLOR_PALETTES[option];
            const isSelected = selectedColor === option;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={palette.label}
                title={palette.label}
                disabled={disabled}
                className="avatar-swatch"
                onClick={() => onColorChange(isSelected ? null : option)}
                style={{
                  ...swatchButtonStyle(isSelected),
                  background: palette.soft,
                  borderColor: isSelected ? palette.color : palette.border,
                }}
              >
                {isSelected && <Check size={13} strokeWidth={3} color={palette.color} />}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <span style={labelStyle}>Icon</span>
        <div
          role="radiogroup"
          aria-label="Goal icon"
          style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}
        >
          <button
            type="button"
            role="radio"
            aria-checked={selectedIcon === null}
            aria-label="No icon"
            title="No icon — show the default target icon instead"
            disabled={disabled}
            className="avatar-swatch"
            onClick={() => onIconChange(null)}
            style={swatchButtonStyle(selectedIcon === null)}
          >
            <Ban size={14} color="var(--text-muted)" />
          </button>
          {SAVINGS_GOAL_ICONS.map((option) => {
            const isSelected = selectedIcon === option;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={`Icon ${option}`}
                disabled={disabled}
                className="avatar-swatch"
                onClick={() => onIconChange(isSelected ? null : option)}
                style={swatchButtonStyle(isSelected)}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
