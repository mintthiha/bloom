"use client";
import { Check } from "lucide-react";
import { CATEGORY_COLOR_OPTIONS } from "./category-options";

/** Swatch row for picking a category's accent colour from the curated palette. */
export function CategoryColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Category colour"
      style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}
    >
      {CATEGORY_COLOR_OPTIONS.map((option) => {
        const isSelected = option.value.toLowerCase() === value.toLowerCase();
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={option.label}
            title={option.label}
            className="avatar-swatch"
            onClick={() => onChange(option.value)}
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "999px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: option.value,
              border: "1px solid rgba(0,0,0,0.1)",
              padding: 0,
              boxShadow: isSelected
                ? `0 0 0 2px var(--surface-1), 0 0 0 4px ${option.value}`
                : "none",
            }}
          >
            {isSelected && <Check size={14} strokeWidth={3} color="#fff" />}
          </button>
        );
      })}
    </div>
  );
}
