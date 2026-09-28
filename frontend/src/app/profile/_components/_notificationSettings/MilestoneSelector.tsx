"use client";

import { OptionPill } from "./OptionPill";
import { SettingSubsection } from "./SettingSubsection";
import { MILESTONE_OPTIONS, toggleMilestone } from "./notification-preferences";

/** Picks which savings-goal progress points raise a notification. */
export function MilestoneSelector({
  milestonePercentages,
  isDisabled,
  onChange,
}: {
  milestonePercentages: number[];
  isDisabled: boolean;
  onChange: (percentages: number[]) => void;
}) {
  return (
    <SettingSubsection
      label="Milestones to celebrate"
      hint="Bloom tells you once when a goal passes each of these."
    >
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {MILESTONE_OPTIONS.map((percentage) => (
          <OptionPill
            key={percentage}
            label={`${percentage}%`}
            isSelected={milestonePercentages.includes(percentage)}
            isDisabled={isDisabled}
            onSelect={() => onChange(toggleMilestone(milestonePercentages, percentage))}
          />
        ))}
      </div>
    </SettingSubsection>
  );
}
