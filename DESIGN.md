---
name: Fitness Forge
description: Dark industrial fitness PWA — built for serious athletes who train in low-light environments. Every pixel earns its place.
version: alpha
colors:
  primary: "#ff6b1a"
  on-primary: "#0d0d0b"
  background: "#0d0d0b"
  surface: "#141412"
  surface-2: "#1a1917"
  surface-3: "#201f1c"
  surface-4: "#242320"
  border: "#2e2c28"
  border-hi: "#403e38"
  text: "#f2ede4"
  text-2: "#a09880"
  text-3: "#5a5545"
  fire: "#ff6b1a"
  green: "#4dffaa"
  steel: "#7ab3c8"
  ember: "#ffb347"
  danger: "#ff4444"
  success: "#4dffaa"
typography:
  display:
    fontFamily: Fira Code
    fontSize: 2rem
    fontWeight: 700
    letterSpacing: 0.06em
    textTransform: uppercase
  h1:
    fontFamily: Fira Code
    fontSize: 1.5rem
    fontWeight: 700
    letterSpacing: 0.04em
    textTransform: uppercase
  h2:
    fontFamily: Fira Code
    fontSize: 1.1rem
    fontWeight: 600
    letterSpacing: 0.04em
    textTransform: uppercase
  body-md:
    fontFamily: Fira Code
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: Fira Code
    fontSize: 0.8rem
    fontWeight: 400
    lineHeight: 1.5
  label-caps:
    fontFamily: Fira Code
    fontSize: 0.65rem
    fontWeight: 600
    letterSpacing: 0.12em
    textTransform: uppercase
  mono-data:
    fontFamily: Fira Code
    fontSize: 1rem
    fontWeight: 400
rounded:
  none: 0px
  sm: 4px
  md: 6px
  lg: 10px
  xl: 12px
  pill: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
components:
  btn-primary:
    backgroundColor: "{colors.fire}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: 10px 20px
    typography: label-caps
  btn-primary-hover:
    backgroundColor: "#ff8540"
    textColor: "{colors.on-primary}"
  btn-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: 10px 20px
    typography: label-caps
  btn-danger:
    backgroundColor: "transparent"
    textColor: "{colors.danger}"
    rounded: "{rounded.md}"
    padding: 10px 20px
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
  card-accent:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
  nav-btn:
    backgroundColor: "transparent"
    textColor: "{colors.text-2}"
    rounded: "{rounded.md}"
    padding: 10px 14px
  nav-btn-active:
    backgroundColor: "rgba(255, 107, 26, 0.12)"
    textColor: "{colors.fire}"
  sidebar:
    backgroundColor: "{colors.surface}"
    width: 240px
  topbar:
    backgroundColor: "{colors.surface}"
    height: 56px
  input:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: 10px 12px
  badge-fire:
    backgroundColor: "rgba(255, 107, 26, 0.15)"
    textColor: "{colors.fire}"
    rounded: "{rounded.sm}"
    padding: 2px 6px
  badge-green:
    backgroundColor: "rgba(77, 255, 170, 0.12)"
    textColor: "{colors.green}"
    rounded: "{rounded.sm}"
    padding: 2px 6px
  stat-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
---

## Overview

Fitness Forge is a dark industrial fitness PWA. The aesthetic is raw, purposeful, and high-contrast — built for athletes who train hard and want a tool that feels as serious as their goals. Think forge fire, carbon steel, and glowing data in the dark.

The design ethos: **every element earns its place**. No decorative gradients, no rounded bubbles, no soft pastels. The UI feels closer to a machinist's instrument panel than a consumer wellness app.

## Colors

The palette is built on near-black surfaces with a single fire-orange primary and three secondary accent colors used sparingly for data visualization.

- **Fire (`#ff6b1a`):** The sole interactive accent — used for primary CTAs, active nav states, highlights, and progress. This is the forge flame.
- **Green (`#4dffaa`):** Success, completion, PRs, and the "done" state. Used in charts for positive metrics.
- **Steel (`#7ab3c8`):** Informational — volume charts, secondary data series, steel-blue tone.
- **Ember (`#ffb347`):** Warm data accent — used for cardio entries and tertiary chart data.
- **Background (`#0d0d0b`):** Near-black, not pure black. The dark has warmth.
- **Surface (`#141412`):** Cards and sidebar sit one step above background.
- **Text (`#f2ede4`):** Warm white — softer than pure white, feels natural on dark surfaces.
- **Text-2 (`#a09880`):** Muted labels, metadata, secondary information.
- **Text-3 (`#5a5545`):** Disabled states, dividers-as-text, ghost elements.

### Theme System

Five themes are available via `html[data-theme]`:

| Theme | Character |
|:------|:----------|
| `forge` (default) | Dark industrial, fire accents |
| `day` | Light warm surfaces, dark text |
| `ambient` | Deep blue-purple, ambient purple accent |
| `steel` | Cool blue-grey industrial |
| `ember` | Warm orange-tan, ember tones |

## Typography

All type is set in **Fira Code** — a monospace font that reinforces the data-forward, technical nature of the app. There are no serif or humanist fonts. Everything reads like a terminal with precision.

- **Display / H1:** Uppercase, wide letter-spacing — used for section titles and key metrics
- **Label-caps:** 0.65rem, 0.12em tracking — used for card labels, nav group headers, metadata tags
- **Mono-data:** Default monospace for numbers — reps, weights, times read naturally in monospace
- **Body:** 0.875rem — comfortable reading weight for instructions, descriptions

All uppercase text uses `letter-spacing: 0.06–0.12em` to maintain legibility at small sizes.

## Layout

The app is a single-page shell with a persistent sidebar on desktop and a slide-in drawer on mobile.

- **Desktop:** 240px fixed sidebar on the left; content area fills remaining width
- **Mobile (≤768px):** Sidebar collapses; 56px topbar fixed to top with hamburger + page title + back button; content has `padding-top: 72px` to clear the bar
- **Content max-width:** `900px` centered within the main area for wide viewports
- **Grid system:** Mostly two-column CSS grid (`repeat(2, 1fr)`) for stat cards and phase cards; single column on narrow mobile
- **Card padding:** `16px` standard; tighter `12px` for dense list rows
- **Section labels:** `label-caps` style, `--text-3` color, with a 1px `--border` line extending to the right via `::after`

## Elevation & Depth

There are no box-shadows or elevation levels in the traditional sense. Depth is communicated through **surface color stepping**:

| Level | Color | Use |
|:------|:------|:----|
| 0 — Base | `#0d0d0b` | Page background |
| 1 — Surface | `#141412` | Cards, sidebar |
| 2 — Raised | `#1a1917` | Input fields, nested panels |
| 3 — Overlay | `#201f1c` | Dropdowns, tooltips |
| 4 — Modal | `#242320` | Active workout overlay, modals |

Active workout overlay uses a full-viewport cover at level 4 with `z-index: 1000`.

## Shapes

- **Buttons:** `6px` radius — firm, not harsh
- **Cards:** `10px` radius — slightly warmer
- **Badges / tags:** `4px` radius — tight, data-like
- **Inputs:** `6px` radius — consistent with buttons
- **Active set rows:** `4px` radius — compact
- **No circles or pills** except toggle/chip elements

## Components

### Cards

Cards use `background: var(--surface)` with `border: 1px solid var(--border)`. An optional left accent border (`3px solid var(--fire)`) marks the currently active phase or item.

### Buttons

Three button variants:
- **Primary (fire):** Solid fire background, black text — used for the single most important action per view
- **Secondary (outline):** Transparent background, `--border` border, white text — secondary actions
- **Danger:** Transparent, red text, red border on hover — destructive actions only

### Navigation

Sidebar nav buttons span full width, icon + label in a row. Active state: fire-tinted background (`rgba(255,107,26,0.12)`) + fire text color. Nav group labels use `label-caps` in `--text-3`.

### Data Displays

- Stat numbers: large `display` typography in fire color for primary metrics, white for secondary
- Progress bars: fire-colored fill on `--surface-2` track, `4px` height, `pill` radius
- Rest timer: bottom-anchored bar, fire fill
- Muscle tags: small `badge-fire` chips on exercise rows

### Charts (Chart.js)

All charts use the design system colors via CSS custom properties read at init time. Dark grid lines (`--border`), no legend by default, fire-orange tooltips. Chart containers are `height: 220–280px` in `.chart-wrap` divs.

## Do's and Don'ts

**Do:**
- Use fire orange exclusively for primary interactive elements and active states
- Keep all text uppercase for headings and labels — it reinforces the brand
- Use Fira Code for all text including numbers — consistency is the identity
- Step surfaces darker/lighter instead of using shadows
- Keep charts minimal — no legends unless essential, minimal grid lines

**Don't:**
- Use rounded pill shapes on buttons or cards — too soft for this aesthetic
- Add gradients on surfaces — flat is intentional
- Use color for decoration — every color use must carry meaning (fire = action, green = success, steel = info)
- Mix sans-serif fonts — Fira Code only
- Put content behind the mobile topbar — always respect `padding-top: 72px` on mobile pages
