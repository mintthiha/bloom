"use client";

import { toast } from "sonner";
import { CollapsibleCard } from "@/components/collapsible-card";
import { useVisualStyle } from "@/components/visual-style-provider";
import type { VisualStyle } from "@/lib/visual-style";
import { VisualStyleOptionTile } from "./VisualStyleOptionTile";

const VISUAL_STYLE_OPTIONS: { visualStyle: VisualStyle; label: string; description: string }[] = [
  {
    visualStyle: "classic",
    label: "Classic",
    description: "The calm, familiar Bloom. Subtle motion, nothing in your way.",
  },
  {
    visualStyle: "extravagant",
    label: "Extravagant",
    description: "Aurora backdrop, glowing cards, click sparks, and animated page transitions.",
  },
];

const VISUAL_STYLE_TOASTS: Record<VisualStyle, string> = {
  classic: "Back to the classic look",
  extravagant: "Extravagant look on. Enjoy the show",
};

/**
 * Profile-page card for choosing Bloom's look. The choice applies instantly and is saved to this
 * browser (like the theme), so it confirms with a toast instead of a saving state.
 */
export function VisualStyleCard() {
  const { visualStyle, setVisualStyle } = useVisualStyle();

  /** Applies the picked look and confirms it, ignoring a click on the one already active. */
  function handleSelect(nextVisualStyle: VisualStyle) {
    if (nextVisualStyle === visualStyle) return;
    setVisualStyle(nextVisualStyle);
    toast.success(VISUAL_STYLE_TOASTS[nextVisualStyle]);
  }

  return (
    <CollapsibleCard
      className="fade-up"
      eyebrow="Appearance"
      title="Pick Bloom's look"
      description="Switch between the classic interface and a showier, animation-heavy one. Saved to this browser; change it back any time."
      style={{ marginTop: "20px" }}
    >
      <div
        role="radiogroup"
        aria-label="Visual style"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "12px",
        }}
      >
        {VISUAL_STYLE_OPTIONS.map((option) => (
          <VisualStyleOptionTile
            key={option.visualStyle}
            visualStyle={option.visualStyle}
            label={option.label}
            description={option.description}
            isSelected={visualStyle === option.visualStyle}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </CollapsibleCard>
  );
}
