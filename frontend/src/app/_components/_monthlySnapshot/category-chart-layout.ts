/** Vertical space each horizontal category bar needs for its bar plus gap. */
const PIXELS_PER_CATEGORY_ROW = 28;

/** Space reserved for the value axis and its labels beneath the plotted rows. */
const CHART_VERTICAL_PADDING = 24;

/** Keeps a one- or two-category month from rendering a chart too short to read. */
const MINIMUM_CHART_HEIGHT = 120;

/** Caps the chart so a user with many custom categories can't push the card off-screen. */
const MAXIMUM_CHART_HEIGHT = 420;

/** Longest category label drawn in full before it is shortened to fit the axis gutter. */
export const MAXIMUM_CATEGORY_LABEL_LENGTH = 14;

/**
 * Sizes the horizontal category chart to its row count, so every category keeps a readable
 * band instead of being dropped by the axis, while staying within a dashboard card.
 */
export function computeCategoryChartHeight(categoryCount: number): number {
  if (categoryCount <= 0) return MINIMUM_CHART_HEIGHT;

  const contentHeight = categoryCount * PIXELS_PER_CATEGORY_ROW + CHART_VERTICAL_PADDING;
  return Math.min(MAXIMUM_CHART_HEIGHT, Math.max(MINIMUM_CHART_HEIGHT, contentHeight));
}

/**
 * Shortens a category label that would overflow the axis gutter, so a long custom name
 * ("Kids extracurriculars") degrades to an ellipsis rather than colliding with its bar.
 */
export function truncateCategoryLabel(label: string): string {
  const trimmed = label.trim();
  if (trimmed.length <= MAXIMUM_CATEGORY_LABEL_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAXIMUM_CATEGORY_LABEL_LENGTH - 1).trimEnd()}…`;
}
