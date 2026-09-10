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
| `v3.8` | **Interactive Body Map trainer** (`src/components/body-map.js`, new **Train → Body Map** page) — tap any muscle on the anatomical front/back figure to open its best available exercises (equipment-aware, curated staples first) with progressive-overload targets and cold-start **starting weights**, then either **⚡ Start** an instant targeted "FOCUS" workout or **＋ Add to session** to stack several muscles into one workout (tray persisted as `state.bodyMapTray`). Reuses the analytics muscle-map SVG (now exported as `renderBodyFigures(groups,{interactive})` + `muscleLoadData()`), `getExercisesForItems`/`getOwnedItems`, `suggestNextSet` (with existing `coldStartWeight`), and `startActiveWorkout`. Regions shaded by recent training load so undertrained muscles stand out. |
| `v3.9` | **Fitbod-style Body Map detail** — every exercise now states **per-set weights** (`1·138 lbs × 8  2·138 lbs × 8 …`) computed per working set from `suggestNextSet`, instead of one summary target; **muscle recovery read-out** in the panel header (`Trained 2d ago · recovering` / `Fresh · never trained`, from the last completed non-warm-up set touching that group); **more exercises per muscle** — 8 by default, expandable to 30 with a link through to the full Exercise Library; and exercises you've **actually logged rank first**, so their loads are progressed rather than cold-start estimates. |
| `v3.10` | **Real anatomical body model** — the hand-drawn boxy figure (rectangle arms, slab torso) is replaced by proper anatomical muscle polygons from **react-body-highlighter (MIT, © 2020 GV79)**, remapped onto our 12 muscle-group ids and re-rendered with our own tokens: distinct pecs, delts, biceps/triceps, lats, traps, obliques/abs, quad heads, hamstrings, glutes, calves and forearms across front + back on a 100×200 canvas. Generated data `src/data/body-model.js` (`BODY_FRONT`/`BODY_BACK`); `renderBodyFigures()` in `analytics.js` now renders polygons (neutral head/neck/knee regions are drawn but not tappable), so both the Body Map trainer and the Analytics muscle map get the upgrade. MIT notice recorded in `ATTRIBUTION.md`. |
| `v3.11` | **Goal Programs** (`src/components/programs.js`, data `src/data/programs.js`, new **Train → Programs** page) — 19 curated, finite plans across 5 categories: **Skills** (First Pull-Up, First Push-Up, Handstand), **Strength** (Bigger Bench, Squat 5×5, Deadlift Power), **Physique** (Bigger Arms, Glute Build, V-Taper, Lean Out), **Event Prep** (Ski/Snowboard, Hiking, Beach, Wedding, Fitness Test, First 5K) and **Health** (Desk-Job Posture, Bulletproof Lower Back, Return to Training). Each carries a goal, week/day structure with real exercise ids (237 refs, all validated), a progression rule and milestones. Browse by category, expand to preview every session, then run it: `state.goalProgram` tracks week + completed sessions with a progress bar, tickable milestones, and ⚡ Start straight into the live logger. Equipment-aware (flags missing kit). |
| `v3.12` | **Proper anatomical body map + exercise demos from the map.** The low-poly figure is replaced with detailed bezier muscle paths **plus a body outline** from **react-muscle-highlighter (MIT, © 2024 My Muscle Contributors)** — 86 front / 68 back paths, a real silhouette with head, hands and feet, and anatomically shaped pecs, delts, biceps, abs, quads, glutes, hamstrings and calves. Generator `tools/import-body-model.mjs`. Untrained muscles now render neutral (no orange cast) so only trained ones glow, and each figure gets its own viewBox — the previous model overflowed a fixed `0 0 100 200` box and clipped the back calves. **Every exercise row in the Body Map panel and in a Program's session preview now opens the full exercise modal** (animated demo, form cues, video tutorial) via `openExDetail`. |
| `v3.13` | **Multi-muscle targeting + challenges + 21 more programs.** Body Map is now **multi-select**: tap several muscles (chest + triceps + shoulders) to target them together — selected muscles fill solid on the figure, appear as removable chips, and each gets its own section; one ⚡ Start builds a balanced session across all of them (`state.bodyMapSel`). Every exercise row in the Body Map and in a Program's session preview now carries an explicit **▶ demo button** opening the full modal (animation/GIF/still + form cues + video) — all 1057 exercises have a visual, 109 an embedded video, the rest a tutorial search. **Programs 19 → 40** (new: Muscle-Up, Pistol Squat, First Dip, OHP Builder, Powerlifting Meet, Iron Grip, Thicker Back, Chest Spec, Stubborn Calves, Visible Abs, Murph, Obstacle Race, Ruck March, Vertical Jump, Sprint Speed, Boxing, Strong Over 50, No Gym, Hotel Room 20, Knee-Friendly Legs, Shoulder Health). New **Challenges** tab: 8 short daily challenges (30-Day Push-Up, Plank Ladder, Squat Century, Burpee Blitz, Pull-Up Grind, Hollow Hold, Daily Movement, Farmer's Week) with an escalating daily target, day-dot tracker and a named reward (`state.challenge`). |
| `v3.14` | **Interactive tutorials, everywhere there's an exercise.** The flat coaching-cue list becomes a **step-through walkthrough** in the exercise modal (`_tut` state in `modal.js`): one numbered step at a time, progress dots you can jump to, Back / Next / ✓ Got it, and — for the 280 workout-guide exercises — a **phase strip** (Start · Middle · End) whose frame highlights in sync with the current step. Exercises with no written cues but with animation frames (the 157 workout-guide additions) get the phase strip as their walkthrough. **The live workout logger now has a ▶ tutorial button on every exercise** — previously the one place you could not check your form was mid-set. Common Mistakes renamed to **Avoid These Mistakes**. **Challenges 8 → 18** (Dip Dive, Lunge March, Row Streak, Calf Climb, Core 28, Swing Fortnight, Mountain Ten, Side Plank Duel, Daily Mobility, Wall Sit Wager). |
| `v3.15` | **Video-tutorial pipeline + better fallback.** `tools/import-youtube.mjs` resolves real YouTube ids for the 948 exercises without one and emits `src/data/exercise-videos.js`. The API key is read from `YT_API_KEY` **at generation time only and never ships to the browser** — this is a public client-side app, so an embedded key would be readable and billable. The generator is resumable (skips mapped), `--limit`-capped for the 10,000-unit/day quota (search.list = 100 units, so ~90/day), `--dry` to preview, and ordered so quota lands on exercises used by a Program first, then those with animations. `modal.js` resolves curated `youtubeId` → generated map → search link, and embeds via **youtube-nocookie**. Exercises with no video get a prominent "Watch a tutorial" card instead of a small link. Map ships empty until the generator is run. |
| `v3.16` | **Bug fixes + tutorial visuals for the other 774.** Fixed: (1) selecting several muscles on the Body Map produced an **uneven spread** — the per-muscle cap compared `muscle` label strings, so four muscles gave 3 back / 1 biceps instead of 2 each; it now counts per muscle. (2) **Undo was dead** on a program session that completed a week — finishing the week advanced `p.week`, so the row's `sessionKey` no longer matched and the button silently did nothing; it now falls back to reversing the most recent session. (3) `renderProgress`/`renderDashboard`/`renderSchedule` accessed `program.benchmarks/targets/cardioPrescriptions/splitDays` **unguarded**, crashing the whole page for any save whose program lacked a field (old backups, restored data); all five accesses are now guarded. **Tutorials:** 774 exercises had written steps but no picture in the walkthrough despite having a GIF (352) or still (419) — the walkthrough now shows that demo beside the steps, so every tutorial pairs words with a visual. |
| `v3.17` | **42 of 109 embedded videos were dead.** A keyless audit (YouTube's public **oEmbed** endpoint — no API key, no quota) found 42 of the 109 curated `youtubeId`s returned **404**: the modal was rendering a thumbnail and "CLICK TO LOAD VIDEO" for videos that do not exist. Two more resolved but pointed at the wrong equipment (*Barbell Shrugs* → a dumbbell video, *Barbell Curls* → a dumbbell curl). All 44 cleared, so those exercises fall back to the working "Watch a tutorial" search card; the surviving **65 verify clean**. New `tools/verify-videos.mjs` (`--fix`) checks every id for 404s and equipment contradictions and can be re-run any time — ids rot, so this is now a maintenance step after any `import-youtube.mjs` run. |
| `v3.18` | **Media everywhere + a generator that no longer eats its own output.** Six Programs exercises had no animation only because the name matcher missed them (Cable Chest Flyes, Hip Abduction, Glute Kickback, Russian Twists, Hanging Leg Raises, L-Sit) — a verified `ALIAS` table in `tools/import-workout-guide.mjs` maps them to the right workout-guide slug, taking animations 280 → **286** and Programs/Challenges media coverage to **94 of 95** (only Box Jumps lacks a visual; the near-names *Jump Squat*/*Step-Up* are different lifts, so mapping them was refused). **Generator bug:** re-running `import-workout-guide.mjs` emptied `exercises-wg.js` and silently shrank the library 1057 → 900, because its own previously-generated `wg_` entries matched by name and were treated as pre-existing. It now ignores self-generated entries and **aborts** rather than writing a file with 0 net-new. **New `exThumbHTML()`** renders a cheap still thumbnail (workout-guide frame → GIF → free-exercise-db still) now shown in the **Body Map rows, Program session previews and the live workout logger** — three modes that previously listed exercise names with no picture. |
| `v3.19` | **You can now open any exercise from anywhere it appears.** An audit of all 14 components found two sections with no route to an exercise at all: **Achievements** (PR cards) and **Analytics** (PR timeline + most-trained lift) rendered exercise names as dead text. Both are now tappable (keyboard-accessible) and carry a thumbnail. **Thumbnails added** to Freestyle and Calisthenics cards, which could already open the detail but showed no picture. Full coverage is now: Workout, Programs, Overload, Body Map, Live Logger, Freestyle, Calisthenics, Equipment, Library, Achievements and Analytics. **Dedupe:** `freestyle.js` defined a second, identical `window.openExDetail`, so whichever module loaded last silently won — removed, leaving the single definition in `main.js`. |
| `v3.20` | **HIIT rebuilt on the real exercise database — its media was entirely broken.** Audit found **all 16 HIIT demo GIFs returned 404** (the free-exercise-db paths asked for `.gif` when that repo serves `.jpg`, and all three Wikimedia files are gone) and **5 of 16 HIIT videos were dead**. HIIT kept a parallel, unverified media set of its own. Fixed by mapping **14 of 16 moves to real exercise ids** (Burpees→`burpee`, Mountain Climbers→`mtn_climber`, Squat Jumps→`jump_sq`, Lateral Jumps→`wg_skater_hop`, …) so they draw on the same verified animation/GIF/still pipeline as everything else — **14/14 media URLs now resolve**, up from 0/16. Jump Lunges and Star Jumps are left unmapped: no honest match exists and forcing one would repeat the wrong-equipment bug. Dead video ids cleared; a new **Guide** button on each move opens the full walkthrough. Also fixed: an empty video id rendered an **empty broken YouTube player** (`embed/?rel=0`) — the video branch now falls through to the still. |
| `v3.21` | **All 16 HIIT moves mapped + a full media audit.** Jump Lunges → `fx_Scissors_Jump` and Star Jumps → `fx_Star_Jump` — both existed all along; the earlier "no honest match" came from searching only for *jump lunge*, when the library names the movement **Scissors Jump** ("jump as high as you can, switch the position of your legs"). HIIT is now **16/16 mapped, 16/16 media resolving**. **Full media sweep** of all 1,606 URLs (`tools/verify-media.mjs`, keyless): animations **286/286** and GIFs **431/431** are clean, but **20 curated `imgKey` stills 404'd** (Burpee, Jump Squat, Mountain Climbers, Romanian Deadlift, Goblet Squat, …) — the same fabricated-data pattern as the dead videos. All 20 cleared; every one has an animation or GIF, so no exercise lost its picture. The verifier itself is hardened: modest concurrency, retries with backoff, and **only a definitive HTTP status counts as broken** — a network error is reported as *unreachable* and never acted on, because an unthrottled re-run had reported 170 working GIFs as broken and `--fix` would have wiped them. |
| `v3.22` | **Full audit — every exercise now has a picture.** Seven-part sweep: data integrity, video ids, all media URLs, every page + interaction flow, service-worker precache completeness, duplicate object keys, and data-file syntax. Results: videos **65/65** alive, media **0 broken of 1588**, pages+flows **0 issues**, precache complete (no missing, no stale), no duplicate keys. Two exercises still had **no visual at all** and both are fixed: **Band Lat Pulldown** → the workout-guide `banded-lat-pulldown` animation (added to the `ALIAS` table, so animations 286 → **287**), and **Box Jumps** → the verified `Front_Box_Jump` still (same movement; workout-guide has no box jump). Fixing Box Jumps exposed a **duplicate-key bug**: its object carried `imgKey` twice, so a trailing `imgKey:null` silently overrode the real value — a whole class of silent failure, so audit 6 now scans every entry for duplicate keys (none others found). **All 1057 exercises now have a demo.** |
| `v3.23` | **Verified by running the app, not by reading it — and it found real bugs.** Every prior check proved only "no crash" + "HTTP 200"; the sandbox blocks the media hosts *for the browser*, so nothing had ever been seen to render. Proxying those hosts into headless Chromium gave real evidence: **1057/1057 exercise visuals decode** (`naturalWidth > 0`), the 3-frame animation genuinely cycles, thumbnails paint on all 11 surfaces, a logged session produces exactly the recomputed volume/PR/streak numbers (warm-ups excluded, kg→lbs correct), 21 pages render clean at desktop **and** 390px with no overflow, and the app boots + logs a workout with the network cut. Three defects fixed: (1) **the artwork was near-invisible** — workout-guide illustrations are pure-white silhouettes (`fill:#fff`, no strokes) drawn on a cream `#f3efe7` surface; they now sit on a new `--anim-bg` dark well (modal, tutorial phase strip, every list thumb); (2) **body-map muscles had no outlines** — a 724×1448 viewBox rendered into ~200px shrank `stroke-width:1` to a fraction of a pixel, so a cold-start figure read as an empty silhouette (now `vector-effect="non-scaling-stroke"`, untrained fill from `--bg-4`); (3) **finishing a workout left stale numbers** — `closeOverlay()` restored the page without re-rendering, so the dashboard still showed `STREAK 0 / SESSIONS 0` (new `window.refreshCurrentPage()`). **Videos: 65 → 1002 of 1057 (95%), and they play in the app.** The modal no longer hides the player behind "CLICK TO LOAD VIDEO" — the youtube-nocookie iframe embeds inline with a link out for clips whose owner disabled embedding. New `tools/resolve-youtube.mjs` resolves ids from YouTube's **public search results page** — no API key, no quota (the Data API's 100-units-per-search cap is why the key-based importer never ran) — accepting a result only when the title matches the movement and does not contradict its equipment; 54 exercises failed that gate and keep the search card rather than getting a wrong video. `tools/verify-videos.mjs` then checked all 1003 via oEmbed: **1002 alive and consistent, 1 dead cleared**, and it is now hardened so only a definitive HTTP status can condemn an id — a network error is reported as *unreachable* and never acted on. |
