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
