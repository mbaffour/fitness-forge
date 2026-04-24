---
name: Fitness Forge
description: Industrial raw-iron aesthetic for a fitness tracking PWA — high contrast, forge-fire accents, and monospace precision
colors:
  primary: "#ff6b1a"
  bg: "#0d0d0b"
  bg-2: "#141412"
  bg-3: "#1c1b18"
  bg-4: "#242320"
  border: "#2e2c28"
  border-hi: "#403e38"
  text: "#f2ede4"
  text-2: "#a09880"
  text-3: "#5a5545"
  fire: "#ff6b1a"
  ember: "#ffb347"
  steel: "#7ab3c8"
  forge-green: "#4dffaa"
  danger: "#ff4444"
typography:
  display:
    fontFamily: Barlow Condensed
    fontSize: 72px
    fontWeight: 800
    letterSpacing: 0.02em
    lineHeight: 0.92
  display-sm:
    fontFamily: Barlow Condensed
    fontSize: 46px
    fontWeight: 800
    lineHeight: 1
  heading:
    fontFamily: Barlow Condensed
    fontSize: 24px
    fontWeight: 800
    letterSpacing: 0.04em
  body:
    fontFamily: Lora
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: Lora
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: Fira Code
    fontSize: 11px
    fontWeight: 400
    letterSpacing: 0.18em
  label-sm:
    fontFamily: Fira Code
    fontSize: 10px
    fontWeight: 400
    letterSpacing: 0.15em
  btn:
    fontFamily: Fira Code
    fontSize: 12px
    fontWeight: 400
    letterSpacing: 0.1em
  mono:
    fontFamily: Fira Code
    fontSize: 10px
rounded:
  sm: 3px
  md: 8px
  lg: 12px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
components:
  button-fire:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.bg}"
    rounded: "{rounded.sm}"
    padding: "11px 22px"
    typography: "{typography.btn}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-2}"
    rounded: "{rounded.sm}"
    padding: "11px 22px"
    typography: "{typography.btn}"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.danger}"
    rounded: "{rounded.sm}"
    padding: "11px 22px"
    typography: "{typography.btn}"
  button-green:
    backgroundColor: "rgba(77,255,170,0.12)"
    textColor: "{colors.forge-green}"
    rounded: "{rounded.sm}"
    padding: "11px 22px"
    typography: "{typography.btn}"
  card:
    backgroundColor: "{colors.bg-2}"
    rounded: "{rounded.md}"
    padding: "24px"
  card-elevated:
    backgroundColor: "{colors.bg-4}"
    rounded: "{rounded.lg}"
    padding: "24px"
  input:
    backgroundColor: "{colors.bg-3}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "11px 14px"
    typography: "{typography.body-sm}"
  tag-fire:
    backgroundColor: "rgba(255,107,26,0.14)"
    textColor: "{colors.fire}"
    rounded: "{rounded.sm}"
    padding: "3px 9px"
  tag-ember:
    backgroundColor: "rgba(255,179,71,0.12)"
    textColor: "{colors.ember}"
    rounded: "{rounded.sm}"
    padding: "3px 9px"
  tag-steel:
    backgroundColor: "rgba(122,179,200,0.1)"
    textColor: "{colors.steel}"
    rounded: "{rounded.sm}"
    padding: "3px 9px"
  alert-fire:
    backgroundColor: "rgba(255,107,26,0.08)"
    textColor: "{colors.fire}"
    rounded: "{rounded.sm}"
    padding: "14px 16px"
  caption:
    backgroundColor: "transparent"
    textColor: "{colors.text-3}"
    typography: "{typography.label-sm}"
  divider:
    backgroundColor: "{colors.border}"
    height: "1px"
  divider-hi:
    backgroundColor: "{colors.border-hi}"
    height: "1px"
  progress-bar:
    backgroundColor: "{colors.bg-3}"
    textColor: "{colors.fire}"
    height: "4px"
    rounded: "2px"
---

## Overview

Fitness Forge channels the aesthetic of a blacksmith's workshop: raw iron surfaces, forge-fire orange accents, and the precision of a machined part. The default theme is near-black with warm undertones — not pure black, but the color of charcoal and ash. Every element earns its place on screen; nothing is decorative without purpose.

The design system ships five complete themes — **Default** (industrial dark), **Day** (daylight concrete), **Ambient** (deep space), **Steel** (cold navy), and **Ember** (campfire warm) — all sharing the same token names and component structure. Switching themes is a `0.28s ease` transition on all CSS properties.

Typography is a three-family system: Barlow Condensed carries the weight of display numbers and headings with its compressed, muscular presence; Lora brings a warm, readable serif to body content; and Fira Code handles every label, button, and data point where monospace precision matters.

## Colors

The palette is built around a primary accent — **fire** (`#ff6b1a`) — that reads as a literal heat source against the near-black background. Three supporting accents extend the system: **ember** (`#ffb347`) for warm secondary highlights, **steel** (`#7ab3c8`) for cool informational states, and **forge-green** (`#4dffaa`) for success and progress indicators.

Background layers use four steps (`bg` → `bg-2` → `bg-3` → `bg-4`) to create depth without shadows. Each step is roughly 7–8 lightness points apart, enough to distinguish surfaces while preserving the overall dark character.

Text uses three tones: **text** (`#f2ede4`) for primary content with a warm off-white, **text-2** (`#a09880`) for secondary labels and metadata, and **text-3** (`#5a5545`) for disabled or tertiary states.

**Semantic mapping:**
- `fire` — primary actions, active states, focus rings, CTAs
- `forge-green` — completed sets, progress fill, success states
- `steel` — informational tags, cool data points
- `ember` — warm secondary data, PR highlights
- `danger` — destructive actions, error states

## Typography

Three font families, each with a distinct role:

**Barlow Condensed** (display) — Used exclusively for large numeric data, page titles, and countdown timers. Its compressed letterforms let 72px numbers occupy minimal horizontal space. Always set at weight 800 with tight leading (`0.92`).

**Lora** (body) — The workhorse for all reading content: exercise descriptions, cue text, session notes. The serif improves scannability at small sizes (`13–15px`) against dark backgrounds. Default line-height is `1.6`.

**Fira Code** (mono) — Every label, button, badge, and data tag. The monospace character spacing creates visual alignment in tables and stat grids. Used at `10–13px` with wide letter-spacing (`0.1–0.18em`) for the label hierarchy.

## Layout

The shell is a fixed sidebar (`240px`) plus fluid content area (`1fr`) on desktop, collapsing to a full-screen drawer pattern on mobile (`≤768px`).

Page padding is `44px 48px` on desktop, reducing to `72px 16px 32px` on mobile (accounting for the `56px` topbar). Cards use `24px` internal padding, tightening to `14px 12px` on mobile.

Content grids:
- `.g2` — `1fr 1fr` (collapses to `1fr` on mobile)
- `.g3` — `1fr 1fr 1fr` (collapses to `1fr 1fr` on mobile)
- `.g4` — `repeat(4, 1fr)` (collapses to `1fr 1fr` on mobile)
- `.g-auto` — `repeat(auto-fill, minmax(260px, 1fr))`

Spacing scale is base-4: `4 / 8 / 16 / 24 / 32 / 48px`. Component gaps prefer `12–16px`; section gaps prefer `24px`.

## Elevation & Depth

Depth is expressed primarily through background layering (`bg` → `bg-4`) rather than shadows. The four background steps create enough separation between sidebar, cards, and modals without requiring heavy drop shadows.

Shadows are reserved for floating elements:
- **Cards/panels:** `0 4px 24px rgba(0,0,0,0.5)`
- **Modals:** `0 24px 80px rgba(0,0,0,0.7)`
- **Sidebar (mobile drawer):** `8px 0 40px rgba(0,0,0,0.5)`

Glow effects (`--glow: 0 0 32px rgba(255,107,26,0.15)`) are used sparingly — on the brand mark, the fire button on hover, and the active play button — to simulate heat emission from the accent color.

Modal overlays use `backdrop-filter: blur(4px)`; the sidebar backdrop uses `blur(2px)`. These reinforce the layering hierarchy without heavy dimming.

## Shapes

The radius scale is deliberately conservative:
- `3px` (`--r`) — default for buttons, inputs, tags, and most interactive elements
- `8px` (`--r2`) — cards, modals, larger containers
- `12px` — full modal corners, achievement badges, streak calendar
- `9999px` / `50%` — pill badges (PR toasts) and circular icon buttons only

The near-flat `3px` default keeps the industrial character intact. Avoid rounding that softens structural elements into consumer-app territory.

Progress bars and quiz pips use `2px` — nearly square, reinforcing the data-precision aesthetic.

## Components

**Buttons** come in four variants:
- `button-fire` — Primary CTA; fire-colored fill with dark text. On hover: `box-shadow: 0 0 20px rgba(255,107,26,0.5)` and slight upward translation.
- `button-ghost` — Secondary; transparent with border. Default for most navigation actions.
- `button-danger` — Destructive; transparent with red text and faint red border.
- `button-green` — Confirmation; green-tinted fill for completing sets or confirming rest.

Button sizes: default (`11px 22px` padding), large (`14px 30px`), small (`7px 14px`).

**Cards** are the primary content container. A `1px solid var(--border)` edge with `8px` radius and `24px` padding. Stat cards add a `2px` top border in the accent color appropriate to the data type.

**Inputs** match the card background (`bg-3`) and share the `3px` radius. Focus state replaces the default border with `var(--fire)`. Error state triggers a `shake 0.3s` animation.

**Tags** are inline classifiers: `3px 9px` padding, `3px` radius, color-coded by semantic role (fire/green/steel/ember/dim). Always set in `Fira Code` at `10px`.

**Progress bars** are `4px` tall, `2px` radius, with a `0.7s cubic-bezier(.4,0,.2,1)` width transition for smooth fill animation.

**Alerts** mirror tag color coding at block level — fire, green, or neutral. `14px 16px` padding, full-width, `3px` radius.

## Do's and Don'ts

**Do** use `var(--fire)` as the single primary accent. All CTAs, active indicators, and focus states should share this color.

**Don't** introduce new accent colors. The five-color accent palette (fire, ember, steel, forge-green, danger) covers every semantic state. Adding a sixth breaks theme portability.

**Do** use Fira Code for all data labels, button text, and badges — even at sizes as small as `9–10px`. The monospace grid alignment is intentional.

**Don't** use Lora for UI chrome (buttons, nav, labels). It belongs to content, not interface structure.

**Do** keep shadows on floating layers only. Cards that sit in the normal flow use border + background color for separation, not `box-shadow`.

**Don't** apply `var(--glow)` to more than one or two elements per screen. Glow signals heat and urgency — overuse dilutes the effect.

**Do** maintain the four-step background hierarchy (`bg` → `bg-4`) for layering. Sidebar on `bg-2`, cards on `bg-2`, elevated modals on `bg-3`/`bg-4`.

**Don't** use pure black (`#000000`) or pure white (`#ffffff`). The warmth in `--bg` (`#0d0d0b`) and `--text` (`#f2ede4`) is load-bearing for the industrial aesthetic.
