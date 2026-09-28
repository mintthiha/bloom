"use client";

import { OptionPill } from "./OptionPill";
import { SettingSubsection } from "./SettingSubsection";
import { LEAD_DAY_OPTIONS } from "./notification-preferences";

/** Picks how many days before a due date bill reminders start appearing. */
export function LeadDaySelector({
  leadDays,
  isDisabled,
  onChange,
}: {
  leadDays: number;
  isDisabled: boolean;
  onChange: (days: number) => void;
}) {
  return (
    <SettingSubsection
      label="Remind me ahead by"
      hint="How many days before a due date to start reminding you."
    >
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {LEAD_DAY_OPTIONS.map((days) => (
          <OptionPill
            key={days}
            label={`${days} ${days === 1 ? "day" : "days"}`}
            isSelected={days === leadDays}
            isDisabled={isDisabled}
            onSelect={() => onChange(days)}
          />
        ))}
      </div>
    </SettingSubsection>
  );
}
