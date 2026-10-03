"use client";

import { CURRENCY_OPTIONS, Currency } from "@/lib/currency";
import { inputStyle as baseInputStyle } from "@/lib/styles/input";

type CurrencyPickerProps = {
  value: Currency;
  onChange: (value: Currency) => void;
};

/**
 * Dropdown for the display currency, shown on the profile page. Amounts are stored in CAD and
 * converted to the chosen currency for display only, using a cached daily exchange rate.
 */
export function CurrencyPicker({ value, onChange }: CurrencyPickerProps) {
  return (
    <select
      id="profile-currency"
      aria-label="Display currency"
      value={value}
      onChange={(e) => onChange(e.target.value as Currency)}
      style={{
        ...baseInputStyle,
        borderRadius: "10px",
        padding: "12px 14px",
        cursor: "pointer",
        appearance: "none",
      }}
    >
      {CURRENCY_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
