# Fitness Forge — Claude Instructions

## Project Overview

Fitness Forge is a vanilla JS, zero-dependency, offline-first fitness PWA. No build step, no framework — everything deploys directly to GitHub Pages. All state lives in `localStorage` under the key `fitness_forge_v1`.

**Live site:** https://mbaffour.github.io/fitness-forge/

## Design System

**Always read `DESIGN.md` before writing any UI code, CSS, or HTML.**

The project uses the [google-labs-code/design.md](https://github.com/google-labs-code/design.md) format — YAML design tokens + prose rationale. The tokens map directly to CSS custom properties in `src/style.css`.

Key rules from the design system:
- Font is **Fira Code** everywhere — no exceptions
- Fire orange (`#ff6b1a` / `var(--fire)`) is the **only** interactive accent color
- All surfaces step through `--bg` → `--surface` → `--bg-2` → `--bg-3` → `--bg-4` (no shadows)
- Headings/labels are **uppercase** with letter-spacing
- Button radius: `6px` — never pill-shaped
- On mobile, pages must clear the 56px topbar: `padding-top: 72px`

## Architecture

```
fitness-forge/
├── index.html                    # Shell, CDN imports (Chart.js), SW registration
├── manifest.json                 # PWA manifest
├── sw.js                         # Service worker — cache-first (bump version on deploy)
├── DESIGN.md                     # Design system (google-labs-code/design.md format)
├── src/
│   ├── main.js                   # Boot, shell builder, navigation, theme, global handlers
│   ├── store.js                  # All state — defaultState, save(), and store functions
│   ├── style.css                 # All styles — CSS custom properties + theme overrides
│   ├── components/
│   │   ├── pages.js              # renderDashboard, renderWorkout, renderProgress, etc.
│   │   ├── active-workout.js     # Live set-by-set workout overlay with rest timer
│   │   ├── onboarding.js         # Quiz + manual builder flows
│   │   ├── freestyle.js          # Freestyle session builder
│   │   ├── nutrition.js          # Nutrition page + macro tracking
│   │   ├── body-stats.js         # Body Stats page + weight check-in
│   │   ├── achievements.js       # Achievements, streaks, PRs
│   │   ├── charts.js             # Chart.js wrappers (all themed via CSS vars)
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
  streak: { current, longest, lastSessionDate },
  settings: { weightUnit, distanceUnit, restSeconds, theme },
}
```

## Themes

Five themes controlled by `html[data-theme="..."]` (default `forge` has no attribute):
`forge` | `day` | `ambient` | `steel` | `ember`

Theme is applied immediately on load in `main.js` to avoid flash. Changed via `window.setTheme(name)`.

## Version History

| Tag | What shipped |
|:----|:------------|
| `v2.0-stable` | Full feature release — active workout, nutrition, body stats, achievements, cardio, charts, PWA |
| `v2.1-stable` | Rest timer, muscle tags, form cues, weekly + muscle-freq charts, mobile nav fix |
| `v2.2-stable` | 5-theme system with visual swatch picker |
| `v2.3-stable` | Collapsible sidebar drawer, back button, improved Backup & Restore UI |
