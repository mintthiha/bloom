/**
 * Converts a 0–100 percentage into the 0–1 scale that `.progress-fill` reads from `--progress`.
 * Clamped because the fill is drawn with `scaleX`: an over-limit value would push past the track
 * and a negative one would mirror the bar backwards. Non-finite input draws an empty bar.
 */
export function toProgressScale(percentage: number): number {
  if (!Number.isFinite(percentage)) return 0;
  return Math.min(Math.max(percentage, 0), 100) / 100;
}
