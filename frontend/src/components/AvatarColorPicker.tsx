"use client";

import { Check, Sparkles } from "lucide-react";
import { InitialsAvatar } from "@/components/InitialsAvatar";
import { AVATAR_COLOR_OPTIONS, AvatarColor, getAvatarPalette } from "@/lib/initials-avatar";

type AvatarColorPickerProps = {
  /** The saved choice, or null to let Bloom derive the colour from the name. */
  value: AvatarColor | null;
  onChange: (value: AvatarColor | null) => void;
  /** Current form values, so the preview and the "Auto" swatch match what will be saved. */
  firstName: string;
  lastName: string;
  fallbackLabel: string;
};

/**
 * Swatch row for picking the avatar accent colour, with a live preview of the initials
 * avatar and an "Auto" option that keeps the colour derived from the user's name.
 */
export function AvatarColorPicker({
  value,
  onChange,
  firstName,
  lastName,
  fallbackLabel,
}: AvatarColorPickerProps) {
  const derivedPalette = getAvatarPalette(
    [firstName, lastName].filter(Boolean).join(" ") || fallbackLabel
  );

  /** Shared swatch sizing/shape; the colour and selection ring are layered on per option. */
  const swatchStyle = (palette: { background: string; text: string }, isSelected: boolean) => ({
    width: "34px",
    height: "34px",
    borderRadius: "999px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: palette.background,
    border: `1px solid ${palette.text}66`,
    color: palette.text,
    padding: 0,
    boxShadow: isSelected ? `0 0 0 2px var(--surface-1), 0 0 0 4px ${palette.text}` : "none",
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
      <InitialsAvatar
        firstName={firstName}
        lastName={lastName}
        fallbackLabel={fallbackLabel}
        colorChoice={value}
        size={48}
        label="Avatar preview"
      />
      <div
        role="radiogroup"
        aria-label="Avatar colour"
        style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}
      >
        <button
          type="button"
          role="radio"
          aria-checked={value === null}
          aria-label="Auto colour from your name"
          title="Auto — derived from your name"
          className="avatar-swatch"
          onClick={() => onChange(null)}
          style={swatchStyle(derivedPalette, value === null)}
        >
          {value === null ? <Check size={16} strokeWidth={3} /> : <Sparkles size={15} />}
        </button>
        {AVATAR_COLOR_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            aria-label={option.label}
            title={option.label}
            className="avatar-swatch"
            onClick={() => onChange(option.value)}
            style={swatchStyle(option.palette, value === option.value)}
          >
            {value === option.value && <Check size={16} strokeWidth={3} />}
          </button>
        ))}
      </div>
    </div>
  );
}
