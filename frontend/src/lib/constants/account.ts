export const ACCOUNT_TYPE_META = {
  CHEQUING: { label: "Chequing", color: "#3b82f6", soft: "#3b82f622", border: "#3b82f644" },
  SAVINGS: { label: "Savings", color: "#22c55e", soft: "#16a34a22", border: "#16a34a44" },
  TFSA: { label: "TFSA", color: "#38bdf8", soft: "#0ea5e922", border: "#0ea5e944" },
  RRSP: { label: "RRSP", color: "#a78bfa", soft: "#8b5cf622", border: "#8b5cf644" },
  FHSA: { label: "FHSA", color: "#fb7185", soft: "#f43f5e22", border: "#f43f5e44" },
  CREDIT: { label: "Credit", color: "#ef4444", soft: "#ef444422", border: "#ef444444" },
} as const;

/** Named accent colours a user can pick per account, so accounts of the same type are still distinguishable. */
export const ACCOUNT_COLORS = [
  "AMBER",
  "BLUE",
  "GREEN",
  "VIOLET",
  "PINK",
  "CYAN",
  "RED",
  "SLATE",
] as const;

export type AccountColor = (typeof ACCOUNT_COLORS)[number];

/** Palette for each custom account colour, shaped like {@link ACCOUNT_TYPE_META} so UI can swap between them. */
export const ACCOUNT_COLOR_PALETTES: Record<
  AccountColor,
  { label: string; color: string; soft: string; border: string }
> = {
  AMBER: { label: "Amber", color: "#f59e0b", soft: "#f59e0b22", border: "#f59e0b44" },
  BLUE: { label: "Blue", color: "#3b82f6", soft: "#3b82f622", border: "#3b82f644" },
  GREEN: { label: "Green", color: "#22c55e", soft: "#22c55e22", border: "#22c55e44" },
  VIOLET: { label: "Violet", color: "#a78bfa", soft: "#a78bfa22", border: "#a78bfa44" },
  PINK: { label: "Pink", color: "#ec4899", soft: "#ec489922", border: "#ec489944" },
  CYAN: { label: "Cyan", color: "#38bdf8", soft: "#38bdf822", border: "#38bdf844" },
  RED: { label: "Red", color: "#ef4444", soft: "#ef444422", border: "#ef444444" },
  SLATE: { label: "Slate", color: "#94a3b8", soft: "#94a3b822", border: "#94a3b844" },
};

/** Curated emoji a user can pick to represent an account's institution or purpose at a glance. */
export const ACCOUNT_ICONS = [
  "🏦",
  "🏛️",
  "💳",
  "💰",
  "🐷",
  "🎓",
  "✈️",
  "🏠",
  "🚗",
  "☕",
  "🛒",
  "🎮",
  "💼",
  "🎁",
  "⭐",
  "❤️",
] as const;
