"use client";

import { Check } from "lucide-react";
import { ACCENT_COLOR_OPTIONS, AccentColor } from "@/lib/app-accent";

type AppAccentColorPickerProps = {
  value: AccentColor;
  onChange: (value: AccentColor) => void;
};

/**
 * Swatch row for the app-wide accent colour, shown next to the avatar colour picker on the
 * profile page. Separate setting from the avatar colour: this one drives buttons, links, and
 * highlights across the whole app rather than just the initials avatar.
 */
export function AppAccentColorPicker({ value, onChange }: AppAccentColorPickerProps) {
  const swatchStyle = (hex: string, isSelected: boolean) => ({
    width: "34px",
    height: "34px",
    borderRadius: "999px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: `${hex}22`,
    border: `1px solid ${hex}66`,
    color: hex,
    padding: 0,
    boxShadow: isSelected ? `0 0 0 2px var(--surface-1), 0 0 0 4px ${hex}` : "none",
  });

  return (
    <div
      role="radiogroup"
      aria-label="App accent colour"
      style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}
    >
      {ACCENT_COLOR_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          aria-label={option.label}
          title={option.label}
          className="avatar-swatch"
          onClick={() => onChange(option.value)}
          style={swatchStyle(option.hex, value === option.value)}
        >
          {value === option.value && <Check size={16} strokeWidth={3} />}
        </button>
      ))}
    </div>
  );
}
