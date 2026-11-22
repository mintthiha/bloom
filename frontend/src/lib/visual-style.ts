/** The two looks Bloom can render in: the calm default, or the animation-heavy showpiece. */
export type VisualStyle = "classic" | "extravagant";

/** localStorage key for the chosen look. Device-level, like the theme, so it survives logins. */
export const VISUAL_STYLE_STORAGE_KEY = "bloom-visual-style";

/** Attribute on `<html>` that the extravagant stylesheet keys every rule off. */
export const VISUAL_STYLE_ATTRIBUTE = "data-visual-style";

export const DEFAULT_VISUAL_STYLE: VisualStyle = "classic";

/** Reads a stored value back into a known look, falling back to classic for anything unrecognised. */
export function parseVisualStyle(storedValue: string | null | undefined): VisualStyle {
  return storedValue === "extravagant" ? "extravagant" : DEFAULT_VISUAL_STYLE;
}

/**
 * Builds the synchronous head script that stamps the saved look onto `<html>` before first paint,
 * so an extravagant user never sees a flash of the classic styling while React hydrates.
 */
export function buildVisualStyleBootScript(): string {
  const storageKey = JSON.stringify(VISUAL_STYLE_STORAGE_KEY);
  const attribute = JSON.stringify(VISUAL_STYLE_ATTRIBUTE);
  return `(function(){try{var v=localStorage.getItem(${storageKey});document.documentElement.setAttribute(${attribute},v==='extravagant'?'extravagant':'classic')}catch(e){}})();`;
}
