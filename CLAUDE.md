# Fitness Forge — Claude Instructions

## Project Overview

Fitness Forge is a vanilla JS, zero-dependency, offline-first fitness PWA. No build step, no framework — everything deploys directly to GitHub Pages. All state lives in `localStorage` under the key `fitness_forge_v1`.

**Live site:** https://mbaffour.github.io/fitness-forge/

---

## Design System

These principles apply to every piece of UI, CSS, and HTML written for this project. Do not deviate from them.

### Identity

Dark industrial. Raw, purposeful, high-contrast. Feels like a machinist's instrument panel — not a consumer wellness app. Every element earns its place.

### Colors

| Token | Value | Use |
|:------|:------|:----|
| `--fire` | `#ff6b1a` | **Primary accent** — CTAs, active states, progress, highlights. The only interactive color. |
| `--green` | `#4dffaa` | Success, completion, PRs, positive chart data |
| `--steel` | `#7ab3c8` | Info, volume charts, secondary data |
| `--ember` | `#ffb347` | Cardio entries, tertiary chart data |
| `--danger` | `#ff4444` | Destructive actions only |
| `--bg` | `#0d0d0b` | Page background — near-black with warmth, not pure black |
| `--surface` | `#141412` | Cards, sidebar |
| `--bg-2` | `#1a1917` | Input fields, nested panels |
| `--bg-3` | `#201f1c` | Dropdowns, tooltips |
| `--bg-4` | `#242320` | Active workout overlay, modals |
| `--border` | `#2e2c28` | All borders |
| `--border-hi` | `#403e38` | Hover/focus border |
| `--text` | `#f2ede4` | Primary text — warm white |
| `--text-2` | `#a09880` | Muted labels, metadata, secondary info |
| `--text-3` | `#5a5545` | Disabled states, ghost elements |

**Rules:**
- `--fire` is the **only** interactive accent. Never use green, steel, or ember for buttons or links.
- Always use CSS vars (`var(--fire)`) — never hardcode hex values in new code.
- No gradients on surfaces. Flat is intentional.
- Color carries meaning — fire = action, green = success, steel = info. Never use color decoratively.

### Typography

**Font: Fira Code everywhere. No exceptions. No other fonts.**

| Scale | Size | Weight | Notes |
|:------|:-----|:-------|:------|
| Display / H1 | `2rem` / `1.5rem` | 700 | Uppercase, `letter-spacing: 0.06em` |
| H2 | `1.1rem` | 600 | Uppercase, `letter-spacing: 0.04em` |
| Label-caps | `0.65rem` | 600 | Uppercase, `letter-spacing: 0.12em` — nav group headers, card labels |
| Body | `0.875rem` | 400 | `line-height: 1.6` |
| Body-sm | `0.8rem` | 400 | `line-height: 1.5` |
| Mono-data | `1rem` | 400 | Numbers, reps, weights, times |

**Rules:**
- All headings and labels are **uppercase**.
- Use generous `letter-spacing` (0.04–0.12em) on uppercase text for legibility.
- Numbers (reps, weights, times) read naturally in monospace — lean into it.

### Spacing & Shape

| Token | Value |
|:------|:------|
| `--r-sm` | `4px` — badges, tight elements |
| `--r-md` | `6px` — buttons, inputs |
| `--r-lg` | `10px` — cards |
| `--r-xl` | `12px` — larger panels |

**Rules:**
- Buttons: **6px radius** — firm, not harsh. Never pill-shaped.
- Cards: **10px radius**.
- No circles or pills except toggle/chip elements.
- Standard card padding: `16px`. Dense list rows: `12px`.

### Elevation (No Shadows)

Depth is communicated through surface color stepping — never box-shadow:

```
--bg (base) → --surface (cards) → --bg-2 (inputs) → --bg-3 (dropdowns) → --bg-4 (overlays)
```

### Layout

- **Desktop:** 240px fixed sidebar left; content fills remaining width; max-width `900px` centered.
- **Mobile (≤768px):** Slide-in drawer; 56px fixed topbar; **pages must use `padding-top: 72px`** to clear the bar.
- **Grids:** Mostly `repeat(2, 1fr)` for stat/phase cards; single column on narrow mobile.
- **Section labels:** `label-caps` style, `--text-3` color, with a `--border` line extending right via `::after`.

### Components

**Buttons — three variants only:**
- `btn-primary`: solid `--fire` background, `#0d0d0b` text, `6px` radius
- `btn-secondary`: transparent, `--border` border, `--text` color
- `btn-danger`: transparent, `--danger` text, danger border on hover

**Cards:** `--surface` background, `1px solid --border`. Active/current item gets `3px solid --fire` left border.

**Nav buttons:** Full-width, icon + label in a row. Active: `rgba(255,107,26,0.12)` background + `--fire` text.

**Charts (Chart.js):** All colors from CSS vars read at init time. No legend by default. Fire tooltips. Grid lines in `--border`. Container height: `220–280px` in `.chart-wrap`.

**Badges/tags:** `4px` radius, `label-caps` text, fire or green tint background.

### Theme System

Eight themes via `html[data-theme="..."]`. The **default is `heat`** (Forge Heat).
`forge` is the flat "Machinist" base (no attribute).

- **Expressive** (each sets color tokens **plus** signature treatments): `heat`
  (molten gradients via `--grad` + glow), `instrument` (blueprint grid, cyan/amber
  telemetry, squared radii), `vivid` (light surfaces, pill CTAs, dark hero block).
- **Flat color variants**: `forge` | `day` | `ambient` | `steel` | `ember`.

Expressive themes drive accent surfaces through `--grad` (a solid color on flat
themes, a gradient on `heat`/`vivid`) and add scoped `html[data-theme="…"]`
component overrides in `style.css`. Applied immediately on load in `main.js` to
prevent flash. Changed via `window.setTheme(name)`. Charts re-read CSS vars on
every init so they adapt automatically.

---

## Architecture

```
fitness-forge/
├── index.html                    # Shell, CDN imports (Chart.js), SW registration
├── manifest.json                 # PWA manifest
├── sw.js                         # Service worker — cache-first (bump version on deploy)
├── DESIGN.md                     # Full design token file (google-labs-code/design.md format)
├── src/
│   ├── main.js                   # Boot, shell builder, responsive nav (HUBS + sidebar + mobile tab bar), theme, global handlers
│   ├── store.js                  # All state — defaultState, save(), store functions, displayName(), gym profiles
│   ├── style.css                 # All styles — CSS custom properties (tokens + --s-N spacing scale) + theme overrides
│   ├── components/
│   │   ├── ui.js                 # Shared render helpers (card, statTile, sectionHead, segGroup, muscleChip, …)
│   │   ├── feedback.js           # Shared audio + haptic cue() for timers, set completion, PRs (respects Settings toggles)
│   │   ├── pages.js              # renderDashboard (hero + streak), renderWorkout, renderProgress, renderSettings, etc.
│   │   ├── active-workout.js     # Live set-by-set workout overlay: rest timer (haptic), ghosted last-session values, focus mode
│   │   ├── overload-mode.js      # Progressive-overload 3-day full-body mode (full muscle coverage)
│   │   ├── equipment.js          # Equipment-specific workouts: item picker, saved gym profiles, coverage heatmap
│   │   ├── onboarding.js         # Quiz + manual builder flows
│   │   ├── freestyle.js          # Freestyle session builder
│   │   ├── nutrition.js          # Nutrition page + macro tracking
│   │   ├── body-stats.js         # Body Stats page + weight check-in
│   │   ├── achievements.js       # Achievements, streaks, PRs
│   │   ├── charts.js             # Chart.js wrappers (all themed via CSS vars)
│   │   ├── library.js            # Exercise Library page (search + muscle/equipment/difficulty filters)
│   │   └── modal.js              # Exercise detail modal
│   ├── engine/
│   │   ├── generator.js          # 16-week program generation
│   │   ├── overload.js           # Progressive overload algorithm
│   │   └── bmr.js                # BMR/TDEE/macro calculator
│   └── data/
│       └── exercises.js          # 60+ exercise database with groups, cues, videos
```

## Coding Rules

1. **Vanilla JS only** — no npm, no build step, no frameworks. ES modules via `<script type="module">`.
2. **No new files unless necessary** — extend existing components before creating new ones.
3. **CSS vars over hardcoded colors** — always use `var(--fire)`, `var(--surface)`, etc.
4. **Global handlers go on `window`** — inline onclick in HTML calls `window.fn()` defined in JS modules.
5. **Chart.js is global** — loaded via CDN as `window.Chart`. Never import it.
6. **Always destroy charts before re-init** — use the `chartInstances` Map in `charts.js`.
7. **Service worker cache version** — bump `forge-vN` in `sw.js` after any CSS/JS changes.
8. **Archive before big changes** — tag the current state with `git tag vX.Y-stable` before starting new features.

## State Shape (`store.js`)

```js
{
  onboarded: bool,
  profile: { name, age, sex, height, weight, goal, level, daysPerWeek, equipment },
  program: { /* generated 16-week plan */ },
  currentPhase: 1–4,
  currentWeek: 1–4,
  workoutLog: [],          // simple mark-complete entries
  sessions: [],            // full per-set logs from active-workout.js
  cardioLog: [],
  nutritionLog: [],
  bodyLog: [],
  achievements: [],
  prs: {},                 // { exId: { weight, reps, date, e1rm } }
  customExercises: {},     // { id: {name, muscle, groups[], equip[], type, diff} } — user-created, merged into EXERCISES at boot
  streak: { current, longest, lastSessionDate },
  settings: { weightUnit, distanceUnit, restSeconds, theme, sound, haptics, restNotify, tourDone },
}
```

## Version History

| Tag | What shipped |
|:----|:------------|
| `v2.0-stable` | Full feature release — active workout, nutrition, body stats, achievements, cardio, charts, PWA |
| `v2.1-stable` | Rest timer, muscle tags, form cues, weekly + muscle-freq charts, mobile nav fix |
| `v2.2-stable` | 5-theme system with visual swatch picker |
| `v2.3-stable` | Collapsible sidebar drawer, back button, improved Backup & Restore UI |
| `v2.4-stable` | Design polish (Fira Code everywhere, CSS var tokens), animated exercise GIF previews, 13 new calisthenics exercises, modal redesign |
| `v2.9-stable` | Progressive-Overload mode (rotating 3-day full-body split covering all 12 muscle groups with auto-progressed targets), 24 new exercises, inline animated previews + muscle-group chips on cards, weekly muscle-coverage heatmap, progress rings, celebratory PR confetti |
| `v3.0-stable` | UI/UX redesign: fixed design tokens (`--surface`, `--ff-display`, `--s-1..8` spacing scale), shared `ui.js` component helpers, responsive IA (17 nav items → 5 hubs: Today/Train/Log/Progress/Profile with desktop sidebar + mobile bottom tab bar + hub sub-tabs), focus-mode workout player (hides nav, ghosted last-session values, haptic rest timer), hero dashboard + 7-day streak strip, guest/free onboarding (optional name), and **equipment-specific workouts** (item-level `requires:[]` model, saved gym profiles, kettlebell + band exercises) |
| `v3.3` | Real PWA icons (previous files were 70-byte placeholders), Exercise Library page (search + muscle/equipment/difficulty filters over the full DB), plate calculator + warm-up ramp (kg/lb aware, 🏋 button beside weight inputs), screen wake lock during active workouts & HIIT timers, GitHub-style training-consistency heatmap on Progress, URL hash routing (deep links + browser back/forward), rest countdown mirrored in the tab title when backgrounded |
| `v3.4` | **~760 more exercises** imported from free-exercise-db (public domain) → 900-exercise library, merged so curated entries win; Library capped to 60 rendered cards for speed + source attribution; **"Find video tutorials"** YouTube-search link in the modal for exercises without an embedded demo; installable-PWA polish (iOS Add-to-Home-Screen meta, in-app **Install App** button via `beforeinstallprompt`, `theme-color` follows the active theme). Generator: `tools/import-free-exercise-db.mjs`; data: `src/data/exercises-library.js` |
| `v3.5` | **Correctness:** kg/lb inputs now convert to canonical lbs before storing (`toStoredWeight`/`toDisplayWeight`/`weightInputStep`) — kg users no longer corrupt volume/PRs/1RM. **Workout logger overhaul:** editable/deletable sets, warm-up sets (excluded from volume/PRs), **supersets**, mid-session add/remove exercise, time-based logging (holds/carries + inline timer), per-side (unilateral) logging, rest-bar "next up". **Custom exercises** (create/delete, merged into the shared DB). **Strength analytics:** weekly volume trend, est-1RM progression, PR timeline, muscle map (Balance/Fatigue/Strength) with anatomical SVG front/back figures heat-tinted by training data. **Animated exercise GIFs** (© Gym visual) in the detail modal for ~430 matched exercises — runtime-hotlinked from hasaneyldrm/exercises-dataset, never vendored (generator `tools/import-gifs.mjs`, data `src/data/exercise-gifs.js`, static crossfade as offline fallback). **Onboarding coach tour** (uses the previously-orphaned coach-mark CSS) + **local rest-timer notifications** (offline, opt-in). **Import from Strong/Hevy/FitNotes** CSV (`src/components/import-workouts.js`). Shared `toast()` helper + empty-state CTAs + token hygiene. Feature-inspired by the AGPL openGym project via clean-room reimplementation (no code copied; stays MIT). Dev-only `tools/devserver.py` (no-cache static server). |
| `v3.6` | **Openly-licensed animated illustrations** (workout-guide, **CC BY-SA 4.0**, © Bryl Lim / Everkinetic) preferred in the detail modal for 123 matched exercises — runtime-hotlinked (never vendored) with required in-app attribution; generator `tools/import-workout-guide.mjs`, data `src/data/exercise-anim.js`; falls back to the licensed GIF then the free-exercise-db crossfade. Root `ATTRIBUTION.md` documents all media licensing. **Named progression schemes** — `settings.progression` = double (default) / linear / Greyskull LP, selectable in Settings and routed through `suggestNextSet`. **Mid-session exercise swap** (⇄) — replace a lift with a same-muscle alternative from the picker. |
| `v3.7` | **157 net-new animated exercises** from workout-guide's CC BY-SA 4.0 metadata (equipment / primary+secondary muscles / type) — the movements that didn't name-match our DB, each already carrying a workout-guide animation → 1057-exercise library (Bicycle Crunch, Bird Dog, Farmer Carry, Clamshell, Cossack Squat, Wall Sit, banded glute work, RDL variants, …). Same generator `tools/import-workout-guide.mjs` now emits `src/data/exercises-wg.js` (`WG_EXERCISES`, merged in `exercises.js` behind curated + library) and extends `EXERCISE_ANIM` to cover them; stretches + cardio excluded from the strength library. Metadata credited CC BY-SA 4.0 in `ATTRIBUTION.md`. |
