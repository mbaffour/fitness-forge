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

### Audio + haptic feedback (v3.0)
Previously only the strength rest-timer beeped (and buzzed). Added a shared
`src/components/feedback.js` `cue(type)` utility (WebAudio tones + `navigator.vibrate`)
wired into every feedback surface:
- **HIIT interval timer**: work→rest and rest→next cues, a 3-2-1 countdown tick, and
  a finish fanfare (`hiit.js`).
- **Strength rest timer**: soft ticks for the final 3 seconds + the existing finish cue.
- **Set completion**: a short tick + light buzz on each logged set.
- **PR**: a triumphant chime + buzz (supersedes the set cue).

New **Sound** and **Haptics** toggles in Settings → Workout Settings (default ON,
`settings.sound` / `settings.haptics`); `cue()` no-ops when muted or unsupported.
Precache `feedback.js`; SW cache bumped to `forge-v14`.

### Older-page theme polish (v3.2)
Swept the remaining log/track pages so the whole app is consistent under the new
expressive themes. The audit-flagged issue was hardcoded colors that ignored the
theme: the sleep score heatmap, the activity minutes heatmap, and the HIIT
work/rest badges + alert now use `color-mix(... var(--token) ...)` instead of fixed
`rgba()`, so they adapt to heat/instrument/vivid/day. All older pages already used
the themed heading classes (`.page-title`/`.display`/`.sec-head`), so Forge Heat's
gradient titles and glow apply automatically. Verified all 10 pages render across
heat/instrument/vivid with no console errors and full light-theme legibility.
SW cache bumped to `forge-v15`.

---

## v3.3 — Library, plate math, wake lock, consistency heatmap

### Fixes
1. **Real PWA icons.** `icons/icon-192.png` and `icons/icon-512.png` were 70-byte
   placeholder files, so installing the PWA produced a broken/blank icon. Replaced
   with real PNGs (flat fire-orange dumbbell on the `--bg` dark panel, drawn to the
   design tokens; content sits inside the maskable safe zone). Icons added to the
   SW precache.
2. **Plate-calc float display** — loadable weight rounded to 2 decimals (no more
   `99.999999998 kg`).

### New features
1. **Exercise Library page** (`src/components/library.js`, Train hub). Live search
   plus equipment, difficulty, and muscle-group filters over the full exercise DB;
   cards show the animated preview and open the existing detail modal. Search
   input re-renders only the results list so typing never loses focus.
2. **Plate calculator + warm-up ramp** (in `active-workout.js`). A 🏋 button beside
   every weight input opens a calculator showing the per-side plate breakdown for
   the target weight (bar selectable: 45/35/15 lb or 20/15/10 kg; standard plate
   sets per unit; honest "not loadable, closest is X" note) plus a warm-up ramp
   (empty bar ×10 → 55%×5 → 70%×3 → 85%×1 → work), all rounded to loadable
   increments. Fully display-unit aware — respects Settings → Weight Units.
3. **Screen wake lock** (`feedback.js`: `acquireWakeLock`/`releaseWakeLock`).
   The screen stays on during an active workout session and while the HIIT
   interval timer runs; reacquired automatically when the tab becomes visible
   again, released on session end/cancel and modal close. Silent no-op where
   unsupported.
4. **Training-consistency heatmap** (Progress page). GitHub-style 16-week grid
   counting every logged training day (workouts/sessions, cardio, activity, HIIT),
   tinted through `color-mix` on `--fire` so it adapts to every theme; today is
   outlined in `--forge-green`.
5. **URL hash routing** (`main.js`). The address bar tracks the current page
   (`#library`), so refresh restores the page, deep links work, and the browser
   back/forward buttons navigate the app. Guarded against event loops; onboarding
   is unaffected.
6. **Rest countdown in the tab title.** If you switch tabs mid-rest, the title
   shows `⏱ 42s rest — Fitness Forge`; the original title is restored when rest
   ends or the timer is skipped.

### Housekeeping
- SW precache: + `library.js`, + both icons; cache bumped `forge-v16` → `forge-v17`.
- All new styles use CSS vars/`color-mix` only — no hardcoded colors.

---

## v3.4 — Big exercise library (licensed) + tutorials + installable-PWA polish

### Exercise library: 141 → 900 (public-domain import)
- `tools/import-free-exercise-db.mjs` (committed generator, not shipped) transforms the
  **free-exercise-db** dataset (github.com/yuhonas/free-exercise-db, Unlicense/public
  domain) into our exercise shape — mapping muscles→our 12 groups, equipment→`requires[]`
  items + legacy `equip[]`, level→`diff`, mechanic→`type`, instructions→`cues`, id→`imgKey`.
- Output `src/data/exercises-library.js` (`LIBRARY_EXERCISES`, 791 entries) is merged in
  `exercises.js` **without** overriding the 141 curated entries (dedup by imgKey/name;
  curated win). Generated programs still draw only from the curated backbone; the imports
  are discoverable via the Library / Freestyle / Equipment browse.
- **Lyfta and other proprietary apps were NOT scraped** — only reuse-licensed sources.
  In-app attribution added to the Library footer.

### Library performance
The Library now renders at most **60 cards** (with a "N more — refine" note) so the
900-exercise DB stays fast on mobile (render dropped from ~910KB/multi-second to ~59KB/~240ms).

### Tutorials for every exercise
Imported exercises have no embedded video, so the detail modal shows a **"Find video
tutorials on YouTube"** link (a YouTube *search* for "<name> proper form technique") —
real tutorials by linking, not rehosting. Curated exercises keep their click-to-load embed.

### Installable-PWA polish
The app was already an installable PWA; made it obvious and clean on phones:
- iOS meta (`apple-mobile-web-app-capable`, status-bar style, title) so "Add to Home
  Screen" opens full-screen on iPhone.
- In-app **Install App** button in Settings (Android `beforeinstallprompt`), with iOS
  "Add to Home Screen" instructions as the fallback; hidden once running standalone.
- `theme-color` (meta + manifest) aligned to the default Heat theme and updated live in
  `applyTheme()` so the phone status bar matches the active theme.
- Precache `exercises-library.js`; SW cache → `forge-v18`.

---

## v3.5 — Correctness, logging depth, analytics & cross-app import

Feature-inspired by the open-source **openGym** project (AGPL). Fitness Forge is a
clean-room reimplementation in vanilla JS — **no openGym code was copied** and the
project stays MIT-licensed. Exercise data remains free-exercise-db (public domain).

### Correctness (highest priority)
Weight **display** was unit-aware but weight **inputs** were not — a kg-mode user
typing "60" stored 60 lbs, silently corrupting volume, PRs and estimated-1RM. Added
`toStoredWeight` / `toDisplayWeight` / `weightInputStep` in `store.js` and routed the
set-weight box, body-stats check-in, and onboarding + manual-builder bodyweight through
them. Inputs now label and convert to the display unit; storage stays canonical lbs.

### Workout logger overhaul (`active-workout.js`, `engine/overload.js`)
- **Editable / deletable** logged sets (inline edit, delete + renumber).
- **Warm-up sets** — per-set toggle, excluded from volume, PRs, progression and set counts.
- **Supersets** — link adjacent exercises; alternate with no rest between paired sets.
- **Mid-session add / remove** exercise (searchable picker over the 900-exercise library).
- **Time-based logging** for holds/carries (seconds + inline count-up timer).
- **Per-side logging** for unilateral moves (volume counts both limbs).
- Rest bar shows the **next-up** exercise/set; fixed the `addSetRow` no-op.

### Custom exercises (`store.js`, `data/exercises.js`, `library.js`)
Create your own exercises (name / type / level / equipment / muscle groups), persisted
locally and merged into the shared `EXERCISES` map at boot so they work everywhere.

### Strength analytics (`analytics.js`, `charts.js`)
Weekly training-volume trend, estimated-1RM progression for your most-trained lift, a
PR timeline, and a muscle map with Balance / Fatigue / Strength views.

### Onboarding tour + local rest alerts (`main.js`, `feedback.js`)
A first-run coach tour (finally using the orphaned coach-mark CSS), replayable from
Settings; and opt-in local rest-timer notifications (Notification API + service worker,
fully offline) that fire only when the app is backgrounded.

### Import from other apps (`import-workouts.js`)
Import workout history from **Strong, Hevy or FitNotes** CSV exports — robust parser,
format auto-detection, fuzzy exercise-name matching to the library, unit normalization,
warm-up preservation, and PR detection, wired into Settings → Backup & Restore.

### Polish
Shared `toast()` helper (replaces hiit.js's ad-hoc toast); empty-state CTAs on the
dashboard, body-stats and HIIT dead-ends; hardcoded-color token hygiene. SW precache
adds `import-workouts.js`; cache bumped to `forge-v19`.

### Anatomical muscle map + animated exercise GIFs (v3.5 follow-up)
- **Anatomical muscle map**: the Analytics muscle map now renders SVG front/back
  body silhouettes with each muscle region heat-tinted by the same
  Balance / Fatigue / Strength data (hand-drawn in-house, flat, fully on-token —
  no images). The chip grid stays as the numeric legend.
- **Animated exercise demos**: ~430 exercises show a real animation GIF in the
  detail modal. The media is © Gym visual, hosted in
  hasaneyldrm/exercises-dataset where it is redistributed **with the rights
  holder's written permission**; Fitness Forge stores **URLs only**
  (`src/data/exercise-gifs.js`, generated by `tools/import-gifs.mjs`), hotlinks
  at runtime, shows the required "© Gym visual" attribution, and falls back to
  the public-domain crossfade when offline. Name matching uses curated overrides
  for all staple lifts + equipment-aware fuzzy matching with variant-word
  penalties (a wrong animation is worse than none; unmatched lifts keep the
  static preview). SW bumped to `forge-v20`.
