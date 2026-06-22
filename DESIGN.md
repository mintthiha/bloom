---
name: Bloom
description: Personal banking dashboard — clear numbers, calm interface, no noise.
colors:
  amber: "#f59e0b"
  amber-light: "#fbbf24"
  surface-0: "#080808"
  surface-1: "#111111"
  surface-2: "#1a1a1a"
  surface-3: "#222222"
  surface-4: "#2c2c2c"
  border: "#1f1f1f"
  border-hover: "#333333"
  text-primary: "#efefef"
  text-secondary: "#888888"
  text-muted: "#777777"
  savings: "#22c55e"
  tfsa: "#38bdf8"
  rrsp: "#a78bfa"
  fhsa: "#fb7185"
  credit: "#ef4444"
  destructive: "#ef4444"
typography:
  display:
    fontFamily: "Outfit, sans-serif"
    fontSize: "32px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.5px"
  headline:
    fontFamily: "Outfit, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.3px"
  title:
    fontFamily: "Outfit, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Outfit, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Outfit, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.08em"
  mono:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1
    fontFeature: "tnum"
rounded:
  xs: "6px"
  sm: "8px"
  md: "10px"
  card-sm: "12px"
  lg: "14px"
  xl: "16px"
  full: "9999px"
spacing:
  xs: "6px"
  sm: "12px"
  md: "20px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
components:
  card:
    backgroundColor: "{colors.surface-1}"
    rounded: "{rounded.lg}"
    padding: "24px"
  stat-card:
    backgroundColor: "{colors.surface-1}"
    rounded: "12px"
    padding: "20px"
  button-primary:
    backgroundColor: "{colors.text-primary}"
    textColor: "{colors.surface-0}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "32px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "32px"
  button-nav-active:
    backgroundColor: "#f59e0b1a"
    textColor: "{colors.amber}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "44px"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    height: "32px"
    padding: "0 10px"
  eyebrow-label:
    textColor: "{colors.amber}"
---

# Design System: Bloom

## 1. Overview

**Creative North Star: "The Night Ledger"**

Bloom is a financial record-keeper for quiet, deliberate review. Its interface is built for the person who opens their dashboard to understand their situation — not to be entertained, encouraged, or upsold. The aesthetic is authoritative and calm: near-black surfaces, a single amber signal color, and typographic weight as the primary hierarchy tool.

Every design decision returns to one question: does this help the user see clearly? Surface colors create depth without decoration. Amber lights up active states and section labels — never as background fill, never as celebration. Numbers are always monospaced. Nothing glows, pulses, or animates unless it conveys state.

This system explicitly rejects glassmorphism, purple or teal gradients, neon greens as "positive money" signals, confetti animations on milestones, and motivational CTA language. A user with negative net worth should see that number clearly and without drama. The interface neither congratulates nor catastrophizes.

**Key Characteristics:**
- Near-black surface ramp (surface-0 → surface-4) for tonal depth, zero shadow dependency
- Single amber accent used for signal only — active states, labels, key highlights
- Outfit for all UI copy; JetBrains Mono (`.num`) for every numeric and currency value
- Flat, border-defined cards with 14px radius and 24px internal padding
- Motion is structural only — 150–280ms state transitions, no choreographic page sequences

## 2. Colors: The Night Palette

A restrained palette: one warm signal against a five-step greyscale ramp. Account-type colors appear only in data visualization.

### Primary
- **Signal Amber** (`#f59e0b`): The sole accent. Used for active navigation states, section eyebrow labels, and key numeric highlights (Total Cash, positive net worth). Never used as a button background or decorative fill. Its rarity is the point.
- **Amber Warm** (`#fbbf24`): Lighter amber variant — text selections (`background: #f59e0b28; color: #fbbf24`) and hover highlights within amber-tinted contexts.

### Neutral
- **Deep Night** (`#080808`): Body background — the baseline all surfaces rest on.
- **Card Black** (`#111111`): Primary card and panel surface. The main content layer.
- **Mid Surface** (`#1a1a1a`): Skeleton animation backgrounds, secondary embedded surfaces.
- **Dark Layer** (`#222222`): Tertiary surface — scrollbar tracks, nested dividers.
- **Edge Grey** (`#2c2c2c`): Highest neutral step — scrollbar thumbs, outermost borders on elevated elements.
- **Ink Edge** (`#1f1f1f`): Standard border. Defines card edges against the body.
- **Warm Border** (`#333333`): Hover-state border — interactive cards and hovered edges.
- **Clean White** (`#efefef`): Primary text. Near-white, not pure white.
- **Receded Grey** (`#888888`): Secondary text — metadata, labels, descriptions.
- **Ghost Grey** (`#777777`): Muted text — hints, placeholders, low-priority information.

### Tertiary (semantic account palette — data visualization only)
- **Savings Green** (`#22c55e`): Savings accounts. Success states, positive delta indicators.
- **Sky Blue** (`#38bdf8`): TFSA accounts.
- **Soft Purple** (`#a78bfa`): RRSP accounts.
- **Rose** (`#fb7185`): FHSA accounts.
- **Alert Red** (`#ef4444`): Credit accounts and destructive actions.

### Named Rules
**The One Signal Rule.** Amber appears on ≤10% of any given screen. It is an indicator light, not a brand color. Amber fill on a button or card background breaks the system.

**The Semantic Separation Rule.** Account-type colors (savings, TFSA, RRSP, FHSA, credit) exist only in data visualization — bar charts, account type badges. They never appear in navigation, buttons, or structural UI.

## 3. Typography

**Body Font:** Outfit (weights 300–800, Google Fonts)
**Mono Font:** JetBrains Mono (weights 300–500, Google Fonts; always via `.num` class with `font-variant-numeric: tabular-nums`)

**Character:** Outfit's high-weight variants (800) carry display-level authority without stiffness. JetBrains Mono grounds numeric data in precision and legibility. The pairing is: readable authority at scale, mechanical clarity at data. They never compete — Outfit handles all UI copy, Mono handles all quantities.

### Hierarchy
- **Display** (800, 32–34px, line-height 1.1, -0.5px): Page-level headings. Dashboard greeting (`Good morning, Alex.`), onboarding hero title.
- **Headline** (800, 22–24px, line-height 1.2, -0.3px): Card headings, step titles in multi-step flows.
- **Title** (700, 16px, line-height 1.3): Section labels (`Accounts`), sidebar group headers.
- **Body** (400, 14–15px, line-height 1.5): Descriptions, helper text, metadata. Cap at 65ch in prose contexts.
- **Label** (700, 11–13px, `0.08em` letter-spacing, UPPERCASE): Eyebrow kickers above card headlines. Always amber (`#f59e0b`) when used as a section marker. One per card maximum.
- **Mono** (400–500, 14–22px, tabular-nums): All currency values, account balances, percentages, numeric counters. Applied via `.num` class.

### Named Rules
**The Mono Lock Rule.** Every currency value, balance, percentage, and numeric counter uses JetBrains Mono with `font-variant-numeric: tabular-nums`. No exceptions. Outfit numerals in financial data produce misaligned columns and a design error.

**The Label Scarcity Rule.** Uppercase tracked labels appear once per card as the eyebrow — not above every paragraph. More than one amber eyebrow per card is visual shouting. If a second label is needed, use Title style in `#888888`.

## 4. Elevation

Bloom is a flat system. There are no box-shadows on structural surfaces. Depth is conveyed entirely through the surface ramp (`surface-0` → `surface-4`): the body is `#080808`, cards sit on `#111111`, embedded elements step up to `#1a1a1a` and `#222222`. Borders at `#1f1f1f` define card edges that the near-black-on-near-black context would otherwise lose.

Interactive cards lift by `translateY(-1px)` with a border shift to `#333333` on hover — a motion-based depth cue, not a shadow one.

### Named Rules
**The No-Shadow Rule.** No `box-shadow` on structural cards, panels, or containers. If an element needs to read as elevated, use a lighter surface token or a border step up. Shadows carry the wrong atmosphere for a precision instrument.

**The Border-as-Edge Rule.** Borders at `#1f1f1f` are not decorative — they are the only edge definition in a surface-ramp system. Removing a card border against the body background makes the card invisible. Never strip borders to appear "cleaner."

## 5. Components

### Cards / Containers
The foundational container for all dashboard content.
- **Corner Style:** Gently rounded (14px) — non-native feel, still precise.
- **Background:** `#111111` (`--surface-1`)
- **Shadow Strategy:** None. Edge defined by 1px solid `#1f1f1f`.
- **Border:** 1px solid `--border` at rest; shifts to `--border-hover` (`#333333`) on interactive cards.
- **Internal Padding:** 24px on all sides.
- **Header Pattern:** Amber uppercase eyebrow (Label style) + optional Headline below. Collapsible variant uses chevron (16px, muted grey `#777777`) right-aligned.
- **Collapsible Animation:** `grid-template-rows: 0fr → 1fr` at 280ms ease. Content opacity 0→1 at 200ms. No `max-height` hacks.

### Stat Cards (Dashboard Summary Row)
Compact, clickable metric tiles in the top summary row.
- **Background:** `#111111`, 12px radius, 20px padding.
- **Metric Title:** 11px, 600 weight, uppercase, `0.08em` tracking, `#888888`.
- **Value:** JetBrains Mono, 22px, 500 weight. Color is semantic: amber for Cash, green for positive net worth, red for negative, `#efefef` for neutral.
- **Hover (clickable only):** `translateY(-1px)`, border `#333333`, 150ms transition.
- **Non-clickable:** No hover style. `opacity: 0.9`.

### Buttons
Two behavioral registers: shadcn/ui for form actions, custom inline styles for sidebar navigation controls.

- **Primary (form actions):** Near-white bg (`#efefef`), near-black text (`#080808`), 10px radius, 32px height. Not amber — primary actions are neutral authority.
- **Ghost:** Transparent bg, `#888888` text, 10px radius. Secondary and icon-only actions.
- **Nav Active:** 44px min-height, `#f59e0b1a` bg, `#f59e0b` text, `1px solid #f59e0b66` border. Current-page state only.
- **Destructive:** `bg-destructive/10` (`#ef444419`), destructive text, destructive border on focus.
- **Focus (all):** 3px ring at 50% opacity. WCAG AA.
- **Disabled (all):** 50% opacity, `pointer-events: none`.

### Inputs / Fields
- **Style:** Transparent background, 1px `border-input` border, 10px radius, 32px height, 14px text.
- **Focus:** 3px ring, border → `--ring`. Visually distinct but not alarming.
- **Error:** 3px destructive ring, border → destructive (`#ef4444`).
- **Disabled:** `bg-input/50`, 50% opacity.

### Navigation (Sidebar)
Left sidebar, collapsible to icon-only via shadcn Sidebar primitive.
- **Brand mark:** 28×28px square (6px radius), amber fill (`#f59e0b`), black `B` letterform path.
- **Nav items:** 44px min-height, 10px radius, `#111111` bg, 1px `#1f1f1f` border. Active: `#f59e0b1a` bg, amber text + border. Default: `#888888` text.
- **Footer:** Profile block — 36px circular avatar (amber fallback ring), name at 13px/600, handle at 11px mono. Wraps in a `#111111` container with 14px radius when expanded.
- **Collapse behavior:** Labels hidden via `group-data-[collapsible=icon]:hidden`. Icon centered at 44px height.

### Eyebrow Label (Signature Component)
Bloom's primary section marker — the amber uppercase kicker that names a card or section before its headline.
- 11–13px, Outfit 700, uppercase, `0.08em` letter-spacing, `#f59e0b`.
- One per card. If more hierarchy is needed below it, use a Headline (22px/800) immediately beneath.
- Never used mid-paragraph, mid-list, or as a repeated divider pattern.

## 6. Do's and Don'ts

### Do:
- **Do** use amber (`#f59e0b`) only for active states, eyebrow labels, and key numeric highlights. One use per component.
- **Do** use JetBrains Mono (`.num` + `font-variant-numeric: tabular-nums`) for every currency value, balance, percentage, and numeric counter.
- **Do** define card depth through surface tokens and 1px borders — never through `box-shadow`.
- **Do** use `translateY(-1px)` at 150ms for hover lift on interactive cards.
- **Do** animate collapsible height with `grid-template-rows: 0fr → 1fr`, not `max-height`.
- **Do** include `@media (prefers-reduced-motion: reduce)` on every animation — instant transitions.
- **Do** show negative financial data (`#ef4444`) clearly and without alarm UI. The number is the information; the interface is neutral.
- **Do** cap prose body text at 65ch. Stat values, tables, and monospace data may run wider.
- **Do** use the account-type palette (savings green, TFSA blue, etc.) only in charts and type badges.

### Don't:
- **Don't** use purple, teal, or neon gradients anywhere in the interface.
- **Don't** use glassmorphism — no `backdrop-filter: blur` on structural cards or panels.
- **Don't** add confetti, celebration, or sparkle animations on financial milestones or goal completions.
- **Don't** use generic blue SaaS primary buttons. Primary actions use near-white on near-black.
- **Don't** use illustrated empty states with cartoon characters or mascots.
- **Don't** use bright neon green as a "positive money" signal. Savings green is `#22c55e` — measured, not neon.
- **Don't** use emoji in UI labels, buttons, status indicators, or toast messages.
- **Don't** use motivational CTA language ("Boost your savings!", "You're crushing it!"). The interface is neutral on outcomes.
- **Don't** add `box-shadow` to cards, panels, or containers.
- **Don't** place more than one amber eyebrow label inside a single card.
- **Don't** use Outfit for displaying financial numeric data — `.num` (JetBrains Mono) is non-negotiable for tabular values.
- **Don't** strip card borders to appear cleaner — without them, cards are invisible against the dark body.
