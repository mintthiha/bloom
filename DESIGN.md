---
name: Bloom
description: Personal banking dashboard — clear numbers, calm interface, no noise.
colors:
  amber: "#f59e0b"
  accent-blue: "#3b82f6"
  accent-green: "#10b981"
  accent-violet: "#a855f7"
  accent-pink: "#ec4899"
  accent-cyan: "#06b6d4"
  surface-0: "#060a14"
  surface-1: "#0d131f"
  surface-2: "#141b2b"
  surface-3: "#1c2438"
  surface-4: "#263149"
  border: "#1b2334"
  border-hover: "#2d3854"
  text-primary: "#eef1f7"
  text-secondary: "#8b93a7"
  text-muted: "#808898"
  surface-0-day: "#eef2fb"
  surface-1-day: "#ffffff"
  surface-2-day: "#e6ecf8"
  surface-3-day: "#dbe4f4"
  surface-4-day: "#c4d0e6"
  border-day: "#d6e0f0"
  border-hover-day: "#b8c7e0"
  text-primary-day: "#0c1320"
  text-secondary-day: "#5c6480"
  text-muted-day: "#5b6472"
  positive: "#22c55e"
  negative: "#ef4444"
  negative-soft: "#f87171"
  caution: "#f97316"
  warning: "#d97706"
  inactive: "#9ca3af"
  positive-day: "#166534"
  negative-day: "#b91c1c"
  caution-day: "#9a3412"
  warning-day: "#92400e"
  inactive-day: "#4b5563"
  chequing: "#3b82f6"
  savings: "#22c55e"
  tfsa: "#38bdf8"
  rrsp: "#a78bfa"
  fhsa: "#fb7185"
  credit: "#ef4444"
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
    rounded: "{rounded.card-sm}"
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
  button-header-icon:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.sm}"
    size: "32px"
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
  progress-track:
    rounded: "{rounded.full}"
    height: "8px"
---

# Design System: Bloom

## Overview

**Creative North Star: "The Night Ledger"**

Bloom is a financial record-keeper for quiet, deliberate review. Its interface is built for the person who opens their dashboard to understand their situation — not to be entertained, encouraged, or upsold. The aesthetic is authoritative and calm: deep navy surfaces, a single signal accent, and typographic weight as the primary hierarchy tool. The night ledger is the default; a daytime ledger (the light theme) carries the same structure on pale blue-grey paper, and follows the operating system's preference unless the user picks one.

Every design decision returns to one question: does this help the user see clearly? Surface colors create depth without decoration. The accent lights up active states and section labels — never as background fill, never as celebration. Numbers are always monospaced. Nothing glows, pulses, or animates unless it conveys state.

Users may personalize three things, and only three: the app accent (one of six), and an identity color and emoji for each account and savings goal. Personalization changes *which* signal color or glyph appears — never how much signal there is.

This system explicitly rejects glassmorphism, purple or teal gradients, neon greens as "positive money" signals, confetti animations on milestones, and motivational CTA language. A user with negative net worth should see that number clearly and without drama. The interface neither congratulates nor catastrophizes.

**Key Characteristics:**
- Navy surface ramp (surface-0 → surface-4) for tonal depth, mirrored by a pale daytime ramp in the light theme
- One user-chosen signal accent (Signal Amber by default) used for signal only — active states, labels, key highlights
- Outfit for all UI copy; JetBrains Mono (`.num`) for every numeric and currency value — both self-hosted
- Border-defined cards with 14px radius, 24px padding, and a faint diagonal wash; flat at rest
- Motion is structural only — 150–280ms state transitions, all of it disabled under reduced motion

## Colors

A restrained palette: one signal accent against a five-step navy ramp, with deeper daytime equivalents and a small set of semantic money colors that are contrast-checked in both themes.

### Primary
- **Signal Amber** (default accent): The sole accent unless the user picks another. Used for active navigation, section eyebrow labels, focus rings, progress fills, and key numeric highlights. Never a button background or decorative fill. Its rarity is the point.
- **Accent alternatives** (blue, green, violet, pink, cyan): The other five options in the profile accent picker. They take Signal Amber's place everywhere and obey every rule written for it. Delivered as `--brand-accent`.
- **Readable accent** (`--brand-accent-text`): The accent as text and icon color. In the night theme it is the raw accent; in the daytime theme it is the accent mixed 55% with black, the lightest mix where every option clears 4.5:1 on light surfaces. Use it for accent-colored *text*; use the raw accent for fills, borders, and rings.

### Neutral
- **Deep Navy** (surface-0): Body background — the baseline all surfaces rest on.
- **Card Navy** (surface-1): Primary card and panel surface. The main content layer.
- **Raised Navy** (surface-2): Inputs, embedded panels, hovered rows, skeletons.
- **Layer Navy** (surface-3): Hover fills on secondary buttons, nested dividers, scrollbar tracks. Not a text surface.
- **Edge Navy** (surface-4): Highest neutral step — scrollbar thumbs, outer edges of elevated elements.
- **Ink Edge** (border): Standard border. Defines card edges against the body.
- **Lit Edge** (border-hover): Hover-state border on interactive elements.
- **Cool White** (text-primary): Primary text. Near-white with a blue cast, never pure white.
- **Receded Slate** (text-secondary): Secondary text — metadata, labels, descriptions.
- **Ghost Slate** (text-muted): Hints, placeholders, low-priority information.
- **Daytime ramp** (the `-day` tokens): The same roles on pale blue-grey paper — white cards on a `#eef2fb` body, ink text. Every role has a daytime value; never hard-code one theme's hex.

### Semantic (money and status)
- **Positive** (green): Gains, inflows, savings rate, completed goals.
- **Negative** (red): Debt, overspending, negative balances. **Negative Soft** is the gentler red for errors and outflow amounts.
- **Caution** (orange): "Worse than last month" deltas — a nudge, deliberately not alarm red.
- **Warning** (amber-brown): Approaching a limit, e.g. contribution-room warnings.
- **Inactive** (grey): Paused or disabled status.
- Each is a CSS variable (`--positive`, `--negative`, …) with a night and a daytime value. The night values are the bright originals; the daytime values are deeper shades, because the bright ones fall to 2–4:1 on white.

### Tertiary (account identity palette)
- **Chequing / Savings / TFSA / RRSP / FHSA / Credit**: One color per account type, plus eight user-pickable identity colors (amber, blue, green, violet, pink, cyan, red, slate) for telling same-type accounts apart. These are stored identity values, so they stay fixed hex — never swap them for theme tokens.

### Named Rules
**The One Signal Rule.** The accent appears on ≤10% of any given screen. It is an indicator light, not a brand color. Accent fill on a button or card background breaks the system — whichever of the six accents the user chose.

**The Token-Only Semantics Rule.** Money and status colors are always the semantic variables, never hex literals. A hard-coded `#22c55e` is 2.3:1 on a white card. The theme-contrast test enforces 4.5:1 for every semantic token on every text surface in both themes.

**The Identity Scope Rule.** Account-type and account identity colors mark *that account*: its badge, avatar, chart series, and its own page header. They never color navigation, global buttons, or structural UI.

## Typography

**Body Font:** Outfit (variable, self-hosted via `next/font`, exposed as `--font-sans`)
**Mono Font:** JetBrains Mono (variable, self-hosted via `next/font`, exposed as `--font-mono`; always through `.num` with tabular numerals)

**Character:** Outfit's heavy weights (800) carry display-level authority without stiffness. JetBrains Mono grounds numeric data in precision and legibility. Readable authority at scale, mechanical clarity at data — they never compete.

### Hierarchy
- **Display** (800, 32–34px, line-height 1.1, -0.5px): One per page, as its `h1`. Dashboard greeting, page titles, onboarding hero.
- **Headline** (800, 20–24px, line-height 1.2, -0.3px): Card headings, step titles, a data page's headline sentence.
- **Title** (700, 16px, line-height 1.3): Section labels, sidebar group headers.
- **Body** (400, 13–15px, line-height 1.5): Descriptions, helper text, metadata. Cap at 65ch in prose.
- **Label** (700, 11–13px, 0.08em tracking, UPPERCASE): Eyebrow kickers above card headlines, in the readable accent. One per card.
- **Mono** (400–500, 12–22px, tabular numerals): All currency values, balances, percentages, counters.

### Named Rules
**The Mono Lock Rule.** Every currency value, balance, percentage, and numeric counter uses JetBrains Mono with tabular numerals. No exceptions. Outfit numerals in financial data produce misaligned columns.

**The Prose Is Not Data Rule.** `.num` is for numbers only. Error messages, hints, and sentences are always Outfit — monospace prose reads as a stack trace.

**The Label Scarcity Rule.** Uppercase tracked labels appear once per card as the eyebrow. More than one accent eyebrow per card is visual shouting; use Title style in secondary text for a second level.

## Layout

Pages sit in a centered column (720px for settings-style pages, up to 1200px for dashboards) with 24px side padding and 40–48px top padding. The app shell is a collapsible left sidebar plus a 56px sticky header; full-page states (errors, empty pages) center vertically in the space below that header.

The dashboard is a reorderable card grid. On desktop it offers single, double, or auto-fit columns (`minmax(340px, 1fr)`); below the single 768px mobile breakpoint it always collapses to one column. Wide data tables keep their minimum width and scroll horizontally inside their own container rather than squeezing. Dialogs cap at 90vw.

Spacing follows the scale above; gaps between cards are 20px, between stat tiles 12px.

## Elevation & Depth

Bloom is flat at rest. Depth comes from the surface ramp — body on surface-0, cards on surface-1, embedded elements on surface-2 and surface-3 — with 1px borders defining every edge that near-navy-on-navy would otherwise lose. Cards add a faint diagonal wash (`--snapshot-gradient`: a 135° fade from a slightly lifted navy, or soft blue by day, into surface-1) that reads as material, not decoration.

Shadow appears only as a response to interaction: hoverable cards gain a soft drop shadow plus an inset accent hairline (`--shadow-hover`), and a tighter one while pressed. Modal dialogs, which float above the page, carry a deep ambient shadow. The sticky header is the one translucent surface (a blurred, 85–88% opaque body color) so content scrolls visibly beneath it.

### Named Rules
**The Flat-At-Rest Rule.** No shadow on any card, panel, or container at rest. Shadow is feedback (hover, press) or genuine overlay (dialogs) — never a default.

**The Border-as-Edge Rule.** Borders are not decorative — they are the only edge definition in a surface-ramp system. Never strip a card border to look cleaner; the card disappears.

## Shapes

Gently rounded and precise: 14px on cards, 12px on stat tiles, 10px on buttons, inputs, and list rows, 8px on small icon buttons and pills' inner controls, fully rounded on progress tracks, toggles, and count badges. Borders are 1px everywhere; a dashed 1px border marks an "add" or empty action slot. Progress tracks clip their fill to the track's own rounded shape.

## Components

### Buttons
- **Shape:** 10px radius, 32px tall (header icon buttons: 8px radius, 32px square).
- **Primary:** Near-white on near-black by night, ink on white by day — neutral authority, never the accent and never a fixed blue. The shadcn default variant maps here.
- **Secondary (outline):** Transparent with a border; border and label brighten on hover.
- **Accent outline:** For connection actions (Re-sync, Link bank account): accent text, 33%-accent border that becomes the full accent on hover.
- **Destructive:** Red-tinted; the default for delete-dialog confirm actions.
- **Hover / Focus / Active:** Hover is a CSS class, never JavaScript. Focus is a 2px accent outline offset 2px. Press scales slightly (`.press`).
- **Touch:** Small controls carry `.touch-target`, which enlarges the tap area to 44×44px on touch screens without changing their drawn size.

### Cards / Containers
- **Corner Style:** 14px.
- **Background:** Card navy with the diagonal wash; action cards (e.g. "open an account") are transparent with a dashed border.
- **Shadow Strategy:** Flat at rest; hover shadow per the Elevation section.
- **Border:** 1px border, lit on hover for interactive cards.
- **Internal Padding:** 24px.
- **Header Pattern:** Accent eyebrow (optional icon chip) + optional headline; collapsible cards add a right-aligned chevron and animate height with `grid-template-rows: 0fr → 1fr` (280ms) and content opacity (200ms).

### Stat Tiles (dashboard summary row)
- 12px radius, 20px padding, card navy, 1px border.
- **Title:** 11px, 600, uppercase, 0.08em tracking, secondary text.
- **Value:** JetBrains Mono, 22px, 500. Semantic color: positive/negative for net worth, the readable accent for cash, primary text when neutral.
- **Hover (clickable only):** Border lights and the tile lifts 1px via `translate` (not `transform`, which the entrance animation owns). Non-clickable tiles have no hover.

### Inputs / Fields
- **Style:** Surface fill or transparent, 1px border, 10px radius, 14px text.
- **Focus:** The global 2px accent focus ring. Search fields whose input sits inside a bordered wrapper put the ring on the wrapper (`:focus-within`).
- **Labels:** Every input has a visible label or an `aria-label`; placeholders are never the only label.
- **Error:** Negative-soft text in a tinted alert box (`role="alert"`), never monospace.

### Navigation
- **Sidebar:** Collapsible to icon-only. Items are 44px tall, 10px radius, card navy with a 1px border, secondary text. Active item: 10% accent tint, accent text, 40% accent border.
- **Header:** Centered search trigger (wide field on desktop, icon on mobile), then 32px bordered icon buttons for notifications, customize, privacy, cents, theme, and the profile avatar. Toggles that are switched on keep the brighter icon color at rest.

### Progress Bars
- 8px fully rounded track in a 4% text-color tint; the fill is full-size and drawn with `transform: scaleX` from the left (`.progress-fill` + `--progress`, built with `toProgressScale` so it's clamped to 0–1). 300ms transition, none under reduced motion.

### Full-Page States
- Errors and unavailable data replace the page with a centered empty-state card: icon chip, title, one calm sentence, Try again, and a "Show technical details" disclosure listing frontend / backend / database health. A failed load never falls through to an empty state that implies the user has no data.

### Eyebrow Label (signature component)
- 11–13px, Outfit 700, uppercase, 0.08em tracking, readable accent.
- One per card. Never mid-paragraph, mid-list, or as a repeated divider.

## Do's and Don'ts

### Do:
- **Do** use the accent only for active states, eyebrow labels, focus rings, progress fills, and key numeric highlights — and `--brand-accent-text` whenever it colors text.
- **Do** use the semantic variables (`--positive`, `--negative`, `--negative-soft`, `--caution`, `--warning`, `--inactive`) for every money and status color.
- **Do** use JetBrains Mono (`.num`) for every currency value, balance, percentage, and numeric counter.
- **Do** define depth with surface tokens and 1px borders; let shadow appear only on hover, press, or true overlays.
- **Do** put hover states in CSS classes that own both the resting and hovered values, so no inline style overrides them.
- **Do** lift hovered elements with `translate`, and draw progress with `scaleX` — never animate `width`, `height`, or margins.
- **Do** add `.touch-target` to any control smaller than 44px that isn't in a dense swatch grid.
- **Do** include a `prefers-reduced-motion: reduce` override for every animation and hover transform.
- **Do** show negative financial data clearly and without alarm UI. The number is the information.
- **Do** keep emoji to the user-chosen identity glyph on an account or savings goal.
- **Do** cap prose at 65ch; stat values, tables, and mono data may run wider.

### Don't:
- **Don't** use purple, teal, or neon gradients anywhere in the interface.
- **Don't** use glassmorphism on cards or panels — the sticky header's translucency is the single exception.
- **Don't** add confetti, celebration, or sparkle animations on financial milestones or goal completions.
- **Don't** use a fixed blue (or any fixed color) for primary buttons. Primary actions are neutral; the accent is signal.
- **Don't** hard-code one theme's hex for a semantic or neutral color — it will fail contrast in the other theme.
- **Don't** use illustrated empty states with cartoon characters or mascots.
- **Don't** use emoji in system copy: labels, buttons, status indicators, or toast messages.
- **Don't** use motivational CTA language ("Boost your savings!"). The interface is neutral on outcomes.
- **Don't** put a shadow on a card, panel, or container at rest.
- **Don't** place more than one accent eyebrow label inside a single card.
- **Don't** render prose in `.num`, or financial numbers in Outfit.
- **Don't** set hover styles from JavaScript (`onMouseEnter`) — keyboard users get no equivalent and reduced motion is ignored.
- **Don't** strip card borders to appear cleaner.
