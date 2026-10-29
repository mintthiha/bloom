import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ACCENT_COLOR_OPTIONS } from "@/lib/app-accent";

// Guards WCAG AA (4.5:1 for body text) for the colour tokens in globals.css, so a later tweak to a
// surface or semantic colour can't quietly make money values or errors unreadable in one theme.

const globalsCss = readFileSync(path.join(__dirname, "globals.css"), "utf8");

/** Reads the custom properties declared directly inside the first block for `selector`. */
function readTokens(selector: string): Record<string, string> {
  const blockStart = globalsCss.indexOf(`${selector} {`);
  if (blockStart === -1) throw new Error(`No ${selector} block in globals.css`);
  const blockEnd = globalsCss.indexOf("\n}", blockStart);
  const block = globalsCss.slice(blockStart, blockEnd);
  const tokens: Record<string, string> = {};
  for (const [, name, value] of block.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    tokens[name] = value.trim();
  }
  return tokens;
}

/** Parses a #rrggbb colour into 0–255 channels. */
function toChannels(hex: string): number[] {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`Expected a #rrggbb colour, got "${hex}"`);
  return match.slice(1).map((pair) => parseInt(pair, 16));
}

/** WCAG relative luminance of sRGB channels. */
function luminanceOf(channels: number[]): number {
  const [red, green, blue] = channels.map((channel) => {
    const unit = channel / 255;
    return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** WCAG contrast ratio between two colours given as channels. */
function contrastRatio(first: number[], second: number[]): number {
  const [lighter, darker] = [luminanceOf(first), luminanceOf(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Mimics `color-mix(in srgb, <hex> <share>, black)` — the light theme's readable accent. */
function mixWithBlack(hex: string, accentShare: number): number[] {
  return toChannels(hex).map((channel) => Math.round(channel * accentShare));
}

// The surfaces text is placed on. --surface-3 and up are tracks, dividers, and borders (the token
// comments in globals.css name --surface-2 as the worst case for text), so they aren't checked.
const SURFACES = ["surface-0", "surface-1", "surface-2"];
const SEMANTIC_TEXT_TOKENS = [
  "text-primary",
  "text-secondary",
  "text-muted",
  "positive",
  "negative",
  "negative-soft",
  "caution",
  "warning",
  "inactive",
];

const themes = {
  light: readTokens(":root"),
  dark: { ...readTokens(":root"), ...readTokens(".dark") },
};

describe.each(Object.entries(themes))("%s theme", (_themeName, tokens) => {
  it.each(SEMANTIC_TEXT_TOKENS)("--%s clears 4.5:1 on every surface", (tokenName) => {
    for (const surfaceName of SURFACES) {
      const ratio = contrastRatio(toChannels(tokens[tokenName]), toChannels(tokens[surfaceName]));
      expect(ratio, `--${tokenName} on --${surfaceName}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("light theme accent text", () => {
  const lightTokens = themes.light;
  const accentShare = Number(
    /color-mix\(in srgb, var\(--brand-accent\) (\d+)%, black\)/.exec(
      lightTokens["brand-accent-light"]
    )?.[1]
  );

  it("uses the darkened accent for text", () => {
    expect(lightTokens["brand-accent-text"]).toBe("var(--brand-accent-light)");
    expect(accentShare).toBeGreaterThan(0);
  });

  it.each(ACCENT_COLOR_OPTIONS)("$label stays readable on every light surface", ({ hex }) => {
    for (const surfaceName of SURFACES) {
      const ratio = contrastRatio(
        mixWithBlack(hex, accentShare / 100),
        toChannels(lightTokens[surfaceName])
      );
      expect(ratio, `${hex} on --${surfaceName}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
