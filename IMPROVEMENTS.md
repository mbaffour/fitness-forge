# Improvements

This document summarizes the fixes and new features added in this change set.
All changes are additive or minimal and preserve existing behavior. Data is
still stored exactly as before (weights in lbs, same localStorage schema).

## Fixes

### 1. Offline charts now work (Chart.js vendored locally)
Previously `index.html` loaded Chart.js from a CDN and the service worker's
`PRECACHE` list did not include it (and the fetch handler skips cross-origin
opaque responses), so every chart failed once the app was offline.

- Vendored the exact library used before, **Chart.js v4.4.0** (UMD build), to
  `src/vendor/chart.umd.min.js`.
- `index.html` now references the local file instead of the jsDelivr CDN.
- Added `./src/vendor/chart.umd.min.js` to the service worker `PRECACHE`.
- Bumped the SW cache constant `forge-v10` -> `forge-v11` so the new asset is
  picked up and stale caches are cleared on activate.

Files: `index.html`, `sw.js`, `src/vendor/chart.umd.min.js` (new).

### 2. Dead code removed in sleep scoring
`_calcSleepScore` in `src/store.js` had a no-op ternary
(`state.sleepLog.length >= 3 ? 10 : 10`) that always returned 10 regardless of
the condition. It is now a real **consistency score** (`_calcSleepConsistency`):
it compares the night's duration against the mean of the last few logged nights
and awards 0-10 points based on how stable the duration is (0h off -> 10 pts,
2h+ off -> 0 pts). With fewer than two prior entries there is no baseline, so it
awards the full 10 points to avoid penalizing new users. The overall score stays
in the same 0-100 range, so existing displays are unaffected.

File: `src/store.js`.

## New features

### 1. Weight-unit toggle (kg / lbs)
`settings.weightUnit` already existed in state but had **no UI control and was
never applied** anywhere. Added a real, additive, display-only unit system:

- New shared helpers `formatWeight(lbs, withLabel)` and `weightUnitLabel()` in
  `src/store.js`. Weights remain **stored in lbs**; conversion happens only at
  display time, so the overload engine, PR records, and existing data are
  untouched (zero migration, zero corruption risk).
- New **Weight Units** selector in Settings -> Workout Settings
  (`src/components/pages.js`), handled by `window.setWeightUnit` in
  `src/main.js`, which persists the choice and re-renders the current page.
- Wired the display-only, derived weight readouts to honor the unit:
  - Active workout: session volume bar, logged set values, PR tag, PR toast,
    and session summary (`src/components/active-workout.js`).
  - Achievements: Personal Records cards (`src/components/achievements.js`).
  - Workout log / progress: per-session volume and profile bodyweight readouts
    (`src/components/pages.js`).

Scope note: weight **input fields** (e.g. the set-weight box and the Body Stats
check-in) intentionally remain in lbs — the stored unit — to avoid any risk of
misinterpreting typed values. Only read-only/derived displays convert. This
keeps the feature low-risk and impossible to corrupt saved data. Charts (which
render numeric axes) were left in lbs for the same reason.

## Already present (verified, not re-implemented)

Two of the suggested "nice to have" features already exist in the codebase and
work, so they were left as-is to keep the diff focused:

- **Rest timer between sets** — `src/components/active-workout.js` already shows
  a floating rest-timer bar that auto-starts after each logged set (pause,
  +30s / -15s, skip) and is configurable in Settings ("Default Rest Time").
- **One-click full JSON backup export + import** — `src/components/pages.js`
  already provides "Save Backup" (`exportData`) and "Restore Backup"
  (`importData`) plus per-log CSV exports, in Settings -> Backup & Restore.

---

## v2.9 — More exercises, progressive-overload mode & fun graphics

### 1. 24 new exercises
Added machine/cable staples and gap-fillers so all 12 muscle groups have several
selectable options across equipment tiers — including previously thin areas
(forearms, adductors/abductors, rear delts, direct core variety). New ids are wired
into the generator pools (`src/engine/generator.js`) and classified in the overload
engine (`src/engine/overload.js`: `BW_EXERCISES`, isolation list, cold-start
`multipliers`). Files: `src/data/exercises.js`, `generator.js`, `overload.js`.

### 2. Progressive-overload mode (targets every muscle group over 3 sessions/week)
- **Guaranteed-coverage 3-day split.** New `buildFullBodyOverload(equip, level, goal,
  phase, variant)` fills group-priority slots (reusing `getExercisesForGroup`) so the
  union of variants A/B/C covers all 12 groups (most 2×/week). The onboarding 3-day
  option now routes "Full Body A/B/C" through it instead of the generic `buildFullBody`.
- **New Overload page** (`src/components/overload-mode.js`, added to the Train nav).
  Shows a rotating A→B→C session, each lift's next weight/rep target from the existing
  `suggestNextSet()` engine (with its rationale), a weekly muscle-coverage heatmap, and
  progress rings. "Start Workout" reuses the existing active-workout overlay, so all
  logging/PR/rest-timer behavior is unchanged. Rotation index persists via a new
  `state.overloadState` (merged like `hiitState`, zero migration).

### 3. Fun graphics ("go bold", within the design system)
- Reusable animated exercise preview extracted from the modal (`exPreviewHTML` in
  `modal.js`) and shown inline on Overload and Workout cards.
- Muscle-group color chips + icons on exercise rows/cards (from `MUSCLE_GROUPS`).
- Weekly muscle-coverage heatmap (CSS grid, tinted by training frequency; honestly
  reflects equipment gaps by checking exercise availability).
- Animated `conic-gradient` progress rings.
- Celebratory confetti + pop animation on new PRs (`active-workout.js`).
All colors use CSS vars; new styles appended to `src/style.css`.

### 4. Housekeeping
- `sw.js`: precache the new module and bump the cache to `forge-v12`.

---

## v3.0 — UI/UX redesign + equipment-specific workouts

Informed by competitor research (BetterMe, Home Workout, Fitbod, Hevy, Strong) and
a codebase UI audit. All changes preserve the localStorage schema (migrated additively).

### Design-system foundation
- Defined previously-undefined tokens `--surface` and `--ff-display` (they were
  referenced but missing → transparent surfaces / non–Fira-Code numerals) and added
  a spacing scale `--s-1..--s-8` + matching utility classes.
- New `src/components/ui.js` shared render helpers (card, statTile, sectionHead,
  segGroup, hubTabs, primaryBtn, muscleChip, chipRow, emptyState); consolidated the
  two duplicate muscleChip helpers.
- New CSS components: segmented control, hero card, streak strip, equipment chips,
  bottom tab bar, quiz, coach-marks.

### Responsive navigation & IA
- Consolidated 17 nav items into **5 hubs** (Today / Train / Log / Progress / Profile)
  via `PAGE_META` + `HUBS` in `main.js`. Desktop keeps a grouped sidebar; mobile gets
  a **bottom tab bar**; both render from one IA, with **hub sub-tabs** at the top of
  multi-page hubs. `body.session-active` hides all nav chrome during a workout.
- Fixed dead `navigate('log')` links (dashboard stat + session-summary toast).

### Screen redesigns
- **Onboarding**: name is now optional with a "Skip — continue as guest" affordance
  (no accounts/sign-in). `displayName()` in `store.js` defaults to "Athlete" everywhere.
- **Dashboard**: hero "Today's Workout" card + single CTA, a 7-day streak strip, and a
  quick-actions card.
- **Workout player**: ghosted "Last session" line per exercise (confirm-not-type) and
  a haptic (`navigator.vibrate`) rest-timer completion in addition to the beep.

### Equipment-specific workouts
- Item-level `requires:[]` on every exercise + subset-match `getExercisesForItems`;
  `getExercisesForGroup` now accepts a preset string OR an owned-item set (so the
  generator and Freestyle keep working unchanged).
- New kettlebell and resistance-band exercises.
- New **Equipment** page: location presets + individual item chips → a full-body
  session filtered to exactly what you own, with an honest coverage heatmap; **saved
  gym profiles** (`store.js` gymProfiles) switchable Fitbod-style; also linked from Settings.

### Housekeeping
- Precache `ui.js` + `equipment.js`; bump SW cache to `forge-v13`.
