// ═══════════════════════════════════════════
//   FITNESS FORGE — App State
//   All user data comes from onboarding quiz
//   or manual builder. Zero hardcoded values.
// ═══════════════════════════════════════════

import { upsertExercise, removeExercise, EQUIP_ITEMS } from './data/exercises.js';
import { sanitizeP500 } from './engine/project500.js';

const KEY = 'fitness_forge_v1';

// Declared up here, not beside the metric functions that use them: the boot
// scrub below runs at module evaluation and calls those (hoisted) functions,
// and a `const` declared further down is still in its temporal dead zone then.
// That exact ReferenceError once disabled the scrub silently (v3.35).
const METRIC_DIRS = new Set(['up', 'down', 'none']);
const METRIC_LOG_MAX = 5000;
const _idSeq = { n: 0 };

const defaultState = {
  onboarded:    false,
  profile:      null,   // set after quiz
  program:      null,   // generated or manual
  currentPhase: 1,
  currentWeek:  1,
  workoutLog:   [],     // [{ id, date, day, label, phase, week, completed, notes, sessionId?, totalVolume?, duration? }]
  sessions:     [],     // per-set workout logs
  cardioLog:    [],     // cardio entries
  nutritionLog: [],     // one object per day
  bodyLog:      [],     // weight + measurement check-ins
  achievements: [],     // unlocked achievements
  prs:          {},     // { exId: { weight, reps, date, e1rm } }
  streak:       { current: 0, longest: 0, lastSessionDate: null },
  settings:     { weightUnit: 'lbs', distanceUnit: 'miles', restSeconds: 90, theme: 'heat', sound: true, haptics: true, restNotify: false, tourDone: false, progression: 'double' },
  // ── v2.7 additions ──
  fastingLog:  [],      // [{ id, date, protocol, plannedHours, startTime, endTime, actualHours, completed }]
  activeFast:  null,    // { startTime: ISO, protocol: '16:8', plannedHours: 16 } | null
  sleepLog:    [],      // [{ id, date, bedtime, wakeTime, durationHours, quality, feeling, notes, score }]
  activityLog: [],      // [{ id, date, type, durationMin, intensity, met, calories, distance, hr, notes }]
  // ── v2.8 additions ──
  hiitState: {
    currentWeek:        0,
    completedWorkouts:  {},
    completedExercises: {},
    totalMins:          0,
    streak:             0,
    lastWorkoutDate:    null,
    logs:               [],
    migrated:           false,
  },
  // ── v2.9 additions ──
  overloadState: { nextVariant: 0 },   // rotating A(0) → B(1) → C(2) index for Overload mode
  // ── v3.0 additions ──
  gymProfiles:  [],     // [{ id, name, items:[itemId,...] }] — saved equipment setups
  activeGymId:  null,   // id of the active gym profile (Fitbod-style)
  // ── v3.4 additions ──
  customExercises: {},  // { id: {name, muscle, groups[], equip[], type, diff, requires[]} } — user-created
  // ── v3.8 additions ──
  bodyMapTray: [],      // exercises stacked from the Body Map trainer, pending "Start session"
  goalProgram: null,    // { id, startedAt, done:[] } — active curated goal program
  bodyMapSel:  [],      // muscle-group ids currently targeted on the Body Map
  challenge:   null,    // { id, startedAt, done:[dayIndex] } — active daily challenge
  // ── v3.37 additions ──
  metricDefs:  {},      // { m_id: { name, unit, dir:'up'|'down'|'none', decimals } } — user-defined metrics
  metricLog:   [],      // [{ id, metric, value, date }] — values logged against metricDefs
  // ── v3.38 additions ──
  gamify:      { seen: null },  // what the celebration layer has already shown (XP itself is derived, never stored)
  // ── v3.42 additions ──
  p500:        null,  // Project 500 — program, tests, log, readiness (engine/project500.js; sanitised on load)
};

// A deep copy. `{ ...defaultState }` shared every array and nested object with
// defaultState itself, so a first-run user's workouts were pushed INTO the
// defaults — and "Reset All Data" then restored the same arrays, still full.
function freshState() { return JSON.parse(JSON.stringify(defaultState)); }

export const state = (() => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Merge with defaultState so new keys are always present
      // Coerce every collection to the shape the app expects. The merge below
      // fills in MISSING keys, but a key present with the wrong type sailed
      // through: a `nutritionLog` saved as an object threw
      // `.find is not a function` during shell construction, so whole pages
      // were never created at all — a blank app, not just a blank page.
      const arr = (v) => (Array.isArray(v) ? v.filter((x) => x != null) : []);
      const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
      for (const k of ['workoutLog', 'sessions', 'cardioLog', 'nutritionLog', 'bodyLog',
                       'achievements', 'fastingLog', 'sleepLog', 'activityLog',
                       'gymProfiles', 'bodyMapTray', 'bodyMapSel', 'metricLog']) {
        parsed[k] = arr(parsed[k]);
      }
      for (const k of ['prs', 'customExercises', 'metricDefs', 'gamify']) parsed[k] = obj(parsed[k]);

      return {
        ...defaultState,
        ...parsed,
        streak:    { ...defaultState.streak,    ...(parsed.streak    || {}) },
        settings:  { ...defaultState.settings,  ...(parsed.settings  || {}) },
        prs:       parsed.prs,
        hiitState: { ...defaultState.hiitState, ...(parsed.hiitState || {}) },
        overloadState: { ...defaultState.overloadState, ...(parsed.overloadState || {}) },
        gymProfiles: parsed.gymProfiles,
        activeGymId: parsed.activeGymId ?? null,
        customExercises: parsed.customExercises,
        bodyMapTray: parsed.bodyMapTray,
        goalProgram: parsed.goalProgram ?? null,
        bodyMapSel: parsed.bodyMapSel,
        challenge: parsed.challenge ?? null,
        metricDefs: parsed.metricDefs,
        gamify: parsed.gamify,
        metricLog: parsed.metricLog,
        p500: sanitizeP500(parsed.p500),
      };
    }
    return freshState();
  } catch {
    return freshState();
  }
})();

// Persist. Returns false when the write did not land.
//
// This used to be `try { ... } catch {}` — every failure swallowed. When
// localStorage is full the workout you just finished is silently dropped while
// the summary still reads "✓ SAVED TO YOUR LOG", and it is gone on reload.
// Silent data loss is the worst outcome this app can produce, so a failed
// write is now reported: callers get `false`, and a `forge:save-failed` event
// lets the shell warn the user without store.js having to import any UI.
let _lastSaveOk = true;

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    window.dispatchEvent?.(new CustomEvent('forge:saved'));
    if (!_lastSaveOk) {
      _lastSaveOk = true;
      window.dispatchEvent?.(new CustomEvent('forge:save-recovered'));
    }
    return true;
  } catch (err) {
    _lastSaveOk = false;
    try {
      window.dispatchEvent?.(new CustomEvent('forge:save-failed', {
        detail: { name: err?.name || 'Error', message: err?.message || String(err) },
      }));
    } catch { /* dispatch must never mask the original failure */ }
    return false;
  }
}

// True when the most recent write failed — the UI uses this to avoid claiming
// something was saved when it was not.
export function saveOk() { return _lastSaveOk; }

// Rough size of what we are persisting, in bytes. Used to warn before the
// wall rather than at it.
export function stateBytes() {
  try { return JSON.stringify(state).length; } catch { return 0; }
}

function _deepClean(v, depth) {
  if (v == null || depth > 16) return v;
  if (typeof v === 'string') return /[<>"\u0000]/.test(v) ? cleanText(v, 100000) : v;
  if (typeof v === 'object') for (const k of Object.keys(v)) v[k] = _deepClean(v[k], depth + 1);
  return v;
}

// One-time sweep of free text already in storage. A payload that arrived via
// an imported backup before input cleaning existed would otherwise keep firing
// on every page load.
(function scrubExistingText() {
  try {
    // Every string, everywhere. The targeted passes below only ever covered
    // the fields a form writes, but a restored backup controls ALL of state —
    // `profile.goal`, a log entry's `phase`, a PR's `reps`, `streak.current`,
    // the program's day labels — and each of those is interpolated into
    // innerHTML somewhere. All of them executed. Nothing the app writes itself
    // contains `<`, `>` or `"`, so this is a no-op for honest data.
    _deepClean(state, 0);
    // Numbers that are rendered raw must be numbers.
    const int = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(Math.max(n, lo), hi) : d; };
    state.currentPhase = int(state.currentPhase, 1, 4, 1);
    state.currentWeek  = int(state.currentWeek, 1, 52, 1);
    state.streak.current = int(state.streak.current, 0, 100000, 0);
    state.streak.longest = int(state.streak.longest, 0, 100000, 0);
    // Ids that reach single-quoted or unquoted inline handlers. Cleaning text
    // cannot help there — an apostrophe or a bracket is enough — so validate.
    state.sessions.forEach((s) => {
      if (s && Array.isArray(s.exercises)) s.exercises = s.exercises.filter((x) => x && isValidId(x.exId));
    });
    state.bodyMapSel = state.bodyMapSel.filter(isValidId);
    state.gymProfiles = state.gymProfiles.filter((g) => g && Number.isFinite(g.id) && Array.isArray(g.items));
    if (state.activeGymId != null && !Number.isFinite(state.activeGymId)) state.activeGymId = null;
    if (state.profile) state.profile.name = cleanText(state.profile.name, 60);
    (state.gymProfiles || []).forEach((g) => { g.name = cleanText(g.name, 40); });
    // Keys first: these two maps are keyed by exercise id and those ids reach
    // inline handlers verbatim. Then each custom record is reduced to the
    // fields this app actually writes.
    state.prs = pruneIdMap(state.prs);
    state.customExercises = pruneIdMap(state.customExercises);
    for (const [id, ex] of Object.entries(state.customExercises)) {
      const clean = cleanCustomExercise(ex);
      if (clean) state.customExercises[id] = clean; else delete state.customExercises[id];
    }
    for (const list of ['sessions', 'workoutLog', 'cardioLog', 'bodyLog', 'sleepLog', 'activityLog']) {
      (state[list] || []).forEach((e) => {
        if (!e || typeof e !== 'object') return;
        if (e.notes != null) e.notes = cleanText(e.notes, 2000);
        if (e.label != null) e.label = cleanText(e.label, 120);
        if (e.workoutLabel != null) e.workoutLabel = cleanText(e.workoutLabel, 120);
        if (e.type != null) e.type = cleanText(e.type, 60);
        (e.exercises || []).forEach((x) => { if (x?.exName != null) x.exName = cleanText(x.exName, 120); });
      });
    }
    // Food items live in `entries`. This used to clean `meals`, a key the app
    // never writes, so a food name like `<img onerror=…>` kept firing on every
    // load of the Nutrition page.
    (state.nutritionLog || []).forEach((d) => {
      for (const list of ['entries', 'meals']) {
        (d?.[list] || []).forEach((m) => {
          if (m?.name != null) m.name = cleanText(m.name, 120);
          if (m?.meal != null) m.meal = cleanText(m.meal, 30);
        });
      }
    });
    // 5:2 used to store its weekly plan AS the active fast (plannedHours 0),
    // which hid the timer for every protocol with no way back. Move it out.
    if (state.activeFast?.protocol === '5:2') {
      state.settings.fasting52Days = Array.isArray(state.activeFast.fasting52Days) ? state.activeFast.fasting52Days : [];
      state.activeFast = null;
    }
    // A sleep entry from an import, an older build or a hand-edited backup can
    // lack its derived fields; the status bar then read "Sleep: undefined/100"
    // and the Sleep page printed "undefined" / "NaN". Re-derive what is missing.
    (state.sleepLog || []).forEach((e) => {
      if (!e || typeof e !== 'object') return;
      const hhmm = /^\d{1,2}:\d{2}$/;
      if (!Number.isFinite(e.durationHours)) {
        e.durationHours = hhmm.test(e.bedtime) && hhmm.test(e.wakeTime) ? _calcSleepDuration(e.bedtime, e.wakeTime) : 0;
      }
      if (!Number.isFinite(e.score)) e.score = e.durationHours > 0 ? _calcSleepScore(e.durationHours, e.quality) : 0;
    });
    // Newest first, by date — the order every reader assumes.
    const byDateDesc = (x, y) => String(y?.date || '').localeCompare(String(x?.date || ''));
    state.sleepLog?.sort(byDateDesc);
    state.activityLog?.sort(byDateDesc);
    // Check-ins are edited and deleted by id, and the id reaches an inline
    // handler — a restored entry without a numeric one could not be touched.
    const seen = new Set();
    state.bodyLog.forEach((e) => {
      if (!e || typeof e !== 'object') return;
      if (!Number.isFinite(Number(e.id)) || seen.has(Number(e.id))) e.id = _uid();
      else e.id = Number(e.id);
      seen.add(e.id);
    });
    _sortBodyLog();
    // Metric ids reach inline handlers just as exercise ids do.
    state.metricDefs = cleanMetricDefs(state.metricDefs);
    state.metricLog = cleanMetricLog(state.metricLog, state.metricDefs);
  } catch (err) {
    // Never let a scrub failure stop the app booting — but never let one pass
    // unnoticed either. This catch previously hid a ReferenceError that
    // disabled the key sanitiser completely.
    console.error('[forge] boot scrub failed — stored data may not be sanitised:', err);
  }
})();

// ── CUSTOM EXERCISES ──
// Merge any persisted custom exercises into the shared EXERCISES map at boot so
// they show up everywhere (library, generator, active workout) like built-ins.
for (const [id, ex] of Object.entries(state.customExercises || {})) upsertExercise(id, ex);

export function addCustomExercise(ex) {
  const base = (ex.name || 'custom').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || 'exercise';
  let id = `custom_${base}`, n = 2;
  while (state.customExercises[id]) id = `custom_${base}_${n++}`;
  const record = {
    name:   cleanText(ex.name, 80) || 'Custom Exercise',
    muscle: cleanText(ex.muscle, 60) || '',
    groups: ex.groups || [],
    equip:  ex.equip  || ['full_gym'],
    requires: _customRequires(ex),
    type:   ex.type   || 'compound',
    diff:   ex.diff   || 'int',
    cues:   (ex.cues || []).map((c) => cleanText(c, 200)),
  };
  state.customExercises[id] = record;
  upsertExercise(id, record);
  save();
  return id;
}

export function deleteCustomExercise(id) {
  delete state.customExercises[id];
  removeExercise(id);
  save();
}

// ── WEIGHT UNIT (display only) ──
// All weights are STORED in lbs. This is a display-layer preference so the
// existing data and overload engine (which compute in lbs) stay untouched.
const LBS_PER_KG = 2.20462;

export function weightUnitLabel() {
  return state.settings?.weightUnit === 'kg' ? 'kg' : 'lbs';
}

// Convert a lbs value to the user's chosen display unit and append the label.
// Returns e.g. "185 lbs" or "84 kg". Pass withLabel=false for the number only.
export function formatWeight(lbs, withLabel = true) {
  if (lbs == null || lbs === '' || isNaN(lbs)) return withLabel ? `– ${weightUnitLabel()}` : '–';
  const kg = state.settings?.weightUnit === 'kg';
  const val = kg ? Math.round(lbs / LBS_PER_KG) : Math.round(lbs);
  const num = val.toLocaleString();
  return withLabel ? `${num} ${kg ? 'kg' : 'lbs'}` : num;
}

// Inverse of the display conversion: take a number the user TYPED in the current
// display unit and return the canonical lbs value to store. In lbs mode this is
// the identity; in kg mode it multiplies back up. Without this, a kg-mode user
// typing "60" would silently store 60 lbs and corrupt volume, PRs, and e1RM.
export function toStoredWeight(displayVal) {
  const n = parseFloat(displayVal);
  if (isNaN(n)) return NaN;
  return clampWeight(state.settings?.weightUnit === 'kg' ? n * LBS_PER_KG : n);
}

// ── FREE TEXT ────────────────────────────────────────────────────────────────
// Every page in this app builds its markup with template literals and assigns
// it via innerHTML, across ~93 interpolation sites. Any user string reaching
// one of those unescaped is an injection: a profile name of
// `<img src=x onerror=…>` executed on every page that greets you by name.
//
// That is not merely self-inflicted — the app imports JSON backups and
// third-party CSV (Strong / Hevy / FitNotes), so a tampered file would run
// script in this origin with access to every workout, measurement and note
// the user has stored.
//
// Escaping at 93 output sites is easy to regress the moment someone adds the
// 94th. Instead the handful of free-text fields are cleaned once, here, at the
// only doors they can enter through. Angle brackets cannot start a tag and
// double quotes cannot break out of an attribute; apostrophes, accents and
// everything else a real gym or exercise name needs are preserved.
export function cleanText(v, max = 200) {
  if (v == null) return v;
  return String(v)
    .replace(/[<>]/g, '')        // no tag can be formed
    .replace(/"/g, '\u2033')     // double prime — looks right, cannot close an attribute
    .replace(/\u0000/g, '')
    .slice(0, max);
}

// An exercise id, validated. Every one of the 1077 ids in the library is
// [A-Za-z0-9_] and at most 61 characters, and ids generated for custom
// exercises are forced into that shape — so anything else did not come from
// this app.
//
// This matters because `cleanText` cleans VALUES, and ids arrive as object
// KEYS: `prs` and `customExercises` are both maps keyed by exercise id, and
// those keys are interpolated straight into single-quoted inline handlers
// (`onclick="openExDetail('${id}')"`) on the Achievements, Analytics and
// Library pages. A key is not free text and is never cleaned, so a restored
// backup containing `prs: { "\"><img src=x onerror=…>": {…} }` executed on
// load. `cleanText` would not have saved it either: it deliberately keeps
// apostrophes, which is all you need to break out of a single-quoted handler.
// The pattern is inline rather than a module-level `const`: the boot scrub
// calls this through a hoisted function declaration long before a `const`
// further down the file has initialised, and the resulting TDZ ReferenceError
// was swallowed whole by the scrub's catch — the sanitiser silently did
// nothing while every test still passed.
export function isValidId(k) { return typeof k === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(k); }

// Drop every entry of an id-keyed map whose key is not a plausible id.
// Dropping rather than cleaning is deliberate: a mangled key would point at no
// exercise anyway, so there is nothing to preserve, and silently rewriting it
// could collide with a real entry.
export function pruneIdMap(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
  const out = Object.create(null);
  for (const [k, v] of Object.entries(obj)) if (isValidId(k)) out[k] = v;
  return Object.assign({}, out);
}

// A custom exercise, reduced to the fields this app writes. An imported record
// is otherwise merged into the shared EXERCISES map wholesale, so a tampered
// backup could add an `imgKey` of `" onerror=…` — which lands inside the
// double-quoted `src` of every thumbnail built for it.
// Custom exercises created before the form asked for a piece of kit were all
// saved with `requires: []`, which the engine reads as bodyweight — no weight
// field in the logger. Recover a loaded default from the preset they picked.
function _customRequires(ex) {
  const req = Array.isArray(ex.requires) ? ex.requires.filter((x) => typeof x === 'string').slice(0, 20) : [];
  if (req.length) return req;
  const preset = Array.isArray(ex.equip) ? ex.equip[0] : null;
  if (preset === 'dumbbells' || preset === 'home_basic') return ['dumbbells'];
  if (preset === 'full_gym') return ['barbell'];
  return [];
}

export function cleanCustomExercise(ex) {
  if (!ex || typeof ex !== 'object') return null;
  const str = (v, n) => (v == null ? '' : cleanText(v, n));
  const arr = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 20) : []);
  return {
    name:     str(ex.name, 80) || 'Custom Exercise',
    muscle:   str(ex.muscle, 60),
    groups:   arr(ex.groups),
    equip:    arr(ex.equip).length ? arr(ex.equip) : ['full_gym'],
    requires: _customRequires(ex),
    type:     ex.type === 'isolation' ? 'isolation' : 'compound',
    diff:     ['beg', 'int', 'adv'].includes(ex.diff) ? ex.diff : 'int',
    cues:     arr(ex.cues).map((c) => cleanText(c, 200)),
  };
}

// ── SANITISERS ───────────────────────────────────────────────────────────────
// A number input is not validation: `min="0"` does not stop a typed or pasted
// "-500", and nothing stopped "1e308". Both reached storage. The negative one
// produced negative volume; the huge one made session volume Infinity, which
// JSON.stringify writes as null — so the session's total volume was gone for
// good — and it registered a 1e308 PR that no future set could ever beat,
// permanently freezing progression for that lift.
//
// Every path that records a set funnels through these, so the logger, the
// edit-set form and the CSV importer are all covered.
export const MAX_WEIGHT_LB = 5000;    // ~2.3x the heaviest ratified deadlift
export const MAX_REPS      = 300;     // a very high bodyweight set; beyond this it is a typo
const MAX_SECONDS   = 24 * 3600;

export function clampWeight(lbs) {
  const n = Number(lbs);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, MAX_WEIGHT_LB);
}

export function clampReps(reps) {
  const n = Math.round(Number(reps));
  if (!Number.isFinite(n) || n < 1) return 0;   // 0 = reject, caller re-prompts
  return Math.min(n, MAX_REPS);
}

export function clampSeconds(sec) {
  const n = Math.round(Number(sec));
  if (!Number.isFinite(n) || n < 1) return 0;
  return Math.min(n, MAX_SECONDS);
}

// Convert a stored lbs value into a number to PREFILL a display-unit input with
// (rounded to the nearest loadable step, no unit label). Complements formatWeight.
export function toDisplayWeight(lbs) {
  if (lbs == null || lbs === '' || isNaN(lbs)) return '';
  const kg = state.settings?.weightUnit === 'kg';
  const val = kg ? lbs / LBS_PER_KG : lbs;
  const step = kg ? 0.5 : 1;
  return Math.round(val / step) * step;
}

// ── DISTANCE ──
// Stored canonically in MILES (cardioLog.distanceMiles, activityLog.distance);
// shown in the unit picked in Settings. `settings.distanceUnit` existed from the
// start but nothing read it and there was no control, so km users got miles.
const KM_PER_MILE = 1.609344;
const _km = () => state.settings?.distanceUnit === 'km';
export function distUnitLabel() { return _km() ? 'km' : 'mi'; }
export function toDisplayDist(mi) {
  const n = Number(mi);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round((_km() ? n * KM_PER_MILE : n) * 100) / 100;
}
export function toStoredDist(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return NaN;
  return _km() ? n / KM_PER_MILE : n;
}

// Sensible increment for a weight input in the current unit (kg plates are finer).
export function weightInputStep() {
  return state.settings?.weightUnit === 'kg' ? 2.5 : 5;
}

// ── EXISTING FUNCTIONS ──

export function setProfile(profile) {
  if (profile && typeof profile === 'object') profile.name = cleanText(profile.name, 60);
  state.profile = profile;
  save();
}

export function setProgram(program) {
  state.program = program;
  state.onboarded = true;
  state.currentPhase = 1;
  state.currentWeek = 1;
  save();
}

export function setPhase(n) {
  state.currentPhase = n;
  save();
}

export function setWeek(n) {
  state.currentWeek = n;
  save();
}

export function logWorkout(entry) {
  if (entry && typeof entry === 'object') {
    if (entry.notes != null) entry.notes = cleanText(entry.notes, 2000);
    if (entry.label != null) entry.label = cleanText(entry.label, 120);
    if (entry.type  != null) entry.type  = cleanText(entry.type, 60);
  }
  state.workoutLog.unshift({ id: Date.now(), ...entry });
  if (state.workoutLog.length > 500) state.workoutLog.length = 500;
  save();
}

export function clearLog() {
  state.workoutLog = [];
  save();
}

export function resetAll() {
  for (const id of Object.keys(state.customExercises || {})) removeExercise(id);
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, freshState());
  try { localStorage.removeItem(KEY); } catch { /* storage blocked: state is reset in memory regardless */ }
}

// ── NEW: PROFILE ──

export function updateProfile(patches) {
  if (!state.profile) state.profile = {};
  Object.assign(state.profile, patches);
  save();
}

// ── DISPLAY NAME (guest / free mode safe) ──
// Name is optional; default gracefully everywhere it's shown.
export function displayName() {
  const n = (state.profile?.name || '').trim();
  return n || 'Athlete';
}

// ── GYM / EQUIPMENT PROFILES (v3.0) ──

// The active owned-item list. Falls back to the profile's onboarding preset
// (mapped to items) so equipment works even before any profile is saved.
// full_gym is derived from EQUIP_ITEMS rather than listed again: this copy had
// already drifted from the one in exercises.js, so any item added there was
// silently missing from "full gym" here.
const _PRESET_ITEMS = {
  bodyweight: [],
  dumbbells:  ['dumbbells','bench'],
  home_basic: ['dumbbells','resistance_bands','pull_up_bar','bench'],
  full_gym:   EQUIP_ITEMS.map(i => i.id),
};

export function getOwnedItems() {
  const active = state.gymProfiles.find(p => p.id === state.activeGymId);
  if (active) return active.items.slice();
  return (_PRESET_ITEMS[state.profile?.equipment] || _PRESET_ITEMS.full_gym).slice();
}

export function saveGymProfile(name, items) {
  const id = Date.now();
  const label = cleanText(name, 40) || `Setup ${state.gymProfiles.length + 1}`;
  state.gymProfiles.push({ id, name: label, items: items.slice() });
  state.activeGymId = id;
  save();
  return id;
}

export function setActiveGym(id) {
  state.activeGymId = id;
  save();
}

export function renameGymProfile(id, name) {
  const gp = state.gymProfiles.find(p => p.id === id);
  const label = cleanText(name, 40);
  if (!gp || !label) return false;
  gp.name = label;
  save();
  return true;
}

export function deleteGymProfile(id) {
  state.gymProfiles = state.gymProfiles.filter(p => p.id !== id);
  if (state.activeGymId === id) state.activeGymId = state.gymProfiles[0]?.id ?? null;
  save();
}

// ── OVERLOAD MODE (rotating A/B/C variant) ──

export function getOverloadVariant() {
  return ((state.overloadState?.nextVariant || 0) % 3 + 3) % 3;
}

export function advanceOverloadVariant() {
  if (!state.overloadState) state.overloadState = { nextVariant: 0 };
  state.overloadState.nextVariant = (getOverloadVariant() + 1) % 3;
  save();
}

// ── NEW: SESSIONS (per-set workout logs) ──

// Returns false if the session did not reach storage, so the caller can say so
// instead of showing a success summary for data that was dropped.
export function logSession(session) {
  const safe = {
    ...session,
    workoutLabel: cleanText(session.workoutLabel, 120),
    notes: cleanText(session.notes, 2000),
    exercises: (session.exercises || []).map((e) => ({ ...e, exName: cleanText(e.exName, 120) })),
  };
  state.sessions.unshift({ id: Date.now(), ...safe });
  if (state.sessions.length > 200) state.sessions.length = 200;
  // Also create a workoutLog entry
  logWorkout({
    date: session.date,
    label: safe.workoutLabel,
    type: session.workoutType || 'strength',
    phase: state.currentPhase,
    week: state.currentWeek,
    sessionId: session.id,
    totalVolume: session.totalVolume,
    duration: session.durationMinutes,
    notes: cleanText(session.notes, 2000) || '',
  });
  save();
}

export function getSessionsForExercise(exId, limit = 10) {
  return state.sessions
    .filter(s => s.exercises?.some(e => e.exId === exId))
    .slice(0, limit);
}

// ── NEW: CARDIO LOG ──

export function addCardioEntry(entry) {
  if (entry && typeof entry === 'object') {
    if (entry.notes != null) entry.notes = cleanText(entry.notes, 2000);
    if (entry.type  != null) entry.type  = cleanText(entry.type, 60);
    if (entry.distanceMiles != null) entry.distanceMiles = clampAmount(entry.distanceMiles, 1000, 2) || null;
    if (entry.durationMinutes != null) {
      entry.durationMinutes = clampAmount(entry.durationMinutes, 1440, 1);
      entry.durationSeconds = Math.round(entry.durationMinutes * 60);
    }
    if (entry.avgHR != null) entry.avgHR = clampAmount(entry.avgHR, 250, 0) || null;
  }
  state.cardioLog.unshift({ id: _uniqueId(state.cardioLog), ...entry });
  if (state.cardioLog.length > 200) state.cardioLog.length = 200;
  updateStreak();
  save();
}

export function removeCardioEntry(id) {
  state.cardioLog = state.cardioLog.filter(e => e.id !== id);
  save();
}

// ── LOG-HUB HELPERS ──

// The calendar day in the user's own timezone. `toISOString().slice(0,10)` is
// the UTC day: in Los Angeles everything logged after 4pm landed on tomorrow
// (and today's food log emptied itself mid-afternoon); in Tokyo breakfast was
// filed under yesterday.
export function localDateStr(d = new Date()) {
  const dt = d instanceof Date ? d : new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

// A finite number in [0, max], rounded to `dp` decimals; anything else is 0.
// `min="0"` on an input stops neither a typed "-500" nor "1e308".
export function clampAmount(v, max, dp = 1) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const f = 10 ** dp;
  return Math.round(Math.min(n, max) * f) / f;
}

// Date.now() collides when two entries are written in the same millisecond
// (a double-tapped button), and then deleting one deletes both.
function _uniqueId(list) {
  let id = Date.now();
  while (list.some(e => e?.id === id)) id++;
  return id;
}

// ── NEW: NUTRITION ──

// Streak days are LOCAL calendar days, like every log page. They used to be
// UTC days, so in Los Angeles an evening session counted toward tomorrow and
// the streak disagreed with the 7-day strip for a third of every day.
function todayStr() {
  return localDateStr();
}

export function getTodayNutrition() {
  const today = localDateStr();
  if (!Array.isArray(state.nutritionLog)) state.nutritionLog = [];
  let day = state.nutritionLog.find(d => d?.date === today);
  // A day that came from an older save or a restored backup may be missing
  // fields the page reads unguarded — `today.entries.length` threw and blanked
  // the whole Nutrition page. Normalise whatever we found, not just new days.
  if (day) {
    if (!Array.isArray(day.entries)) day.entries = [];
    for (const k of ['calories', 'protein', 'carbs', 'fat', 'water']) {
      if (!Number.isFinite(day[k])) day[k] = 0;
    }
    if (!day.target) day.target = _calcNutritionTarget();
  }
  if (!day) {
    day = {
      date: today,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      entries: [],
      water: 0,
      target: _calcNutritionTarget(),
    };
    state.nutritionLog.unshift(day);
    if (state.nutritionLog.length > 90) state.nutritionLog.length = 90;
    save();
  }
  return day;
}

function _calcNutritionTarget() {
  const tdee = state.profile?.tdee;
  const goal = state.profile?.goal;
  if (!tdee) return { calories: 2000, protein: 150, carbs: 200, fat: 67 };
  const cal = goal === 'lose_fat' ? Math.round(tdee - 400) : goal === 'build_muscle' ? Math.round(tdee + 250) : Math.round(tdee);
  const protein = Math.round((state.profile?.weight || 160) * 0.85);
  const fat = Math.round(cal * 0.27 / 9);
  const carbs = Math.round((cal - protein * 4 - fat * 9) / 4);
  return { calories: cal, protein, carbs: Math.max(carbs, 50), fat };
}

const _MACRO_MAX = { calories: 10000, protein: 1000, carbs: 1000, fat: 1000 };

// Totals are re-derived and rounded rather than accumulated: repeated
// `+= 3.3` / `-= 8` left fat at 0.30000000000000007g after a delete.
function _addMacros(day, item, sign) {
  for (const k of Object.keys(_MACRO_MAX)) {
    const v = (Number(day[k]) || 0) + sign * (Number(item[k]) || 0);
    day[k] = Math.max(0, Math.round(v * 10) / 10);
  }
}

export function addFoodEntry(entry) {
  const day = getTodayNutrition();
  const item = {
    id: _uniqueId(day.entries),
    time: new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}),
    name: cleanText(entry.name || 'Food item', 120),
    meal: cleanText(entry.meal || 'Snack', 30),
  };
  for (const [k, max] of Object.entries(_MACRO_MAX)) item[k] = clampAmount(entry[k], max, k === 'calories' ? 0 : 1);
  day.entries.unshift(item);
  _addMacros(day, item, 1);
  save();
  return day;
}

export function removeFoodEntry(entryId) {
  const day = getTodayNutrition();
  const idx = day.entries.findIndex(e => e.id === entryId);
  if (idx < 0) return;
  const item = day.entries[idx];
  _addMacros(day, item, -1);
  day.entries.splice(idx, 1);
  save();
}

export function logWater(glasses) {
  const day = getTodayNutrition();
  day.water = Math.max(0, Math.min(Math.round(Number(glasses) || 0), 30));
  save();
}

// ── NEW: BODY LOG ──

// Newest first, by the date the check-in is FOR — not when it was typed. A
// check-in can be back-dated ("I weighed in yesterday"), so insertion order is
// no longer date order and everything reading bodyLog[0] as "latest" would lie.
function _sortBodyLog() {
  state.bodyLog.sort((a, b) => (Date.parse(b?.date) || 0) - (Date.parse(a?.date) || 0));
}

const BODY_LOG_MAX = 1500;   // ~4 years of daily weigh-ins; entries are ~100 bytes

export function addBodyCheckIn(entry) {
  if (entry && typeof entry === 'object') {
    if (entry.notes != null) entry.notes = cleanText(entry.notes, 2000);
    if (entry.label != null) entry.label = cleanText(entry.label, 120);
    if (entry.type  != null) entry.type  = cleanText(entry.type, 60);
  }
  state.bodyLog.unshift({ id: _uid(), ...entry });
  _sortBodyLog();
  if (state.bodyLog.length > BODY_LOG_MAX) state.bodyLog.length = BODY_LOG_MAX;
  return save();
}

export function updateBodyCheckIn(id, patch) {
  const e = state.bodyLog.find((x) => x?.id === id);
  if (!e) return false;
  if (patch.notes != null) patch.notes = cleanText(patch.notes, 2000);
  Object.assign(e, patch);
  _sortBodyLog();
  return save();
}

export function deleteBodyCheckIn(id) {
  const n = state.bodyLog.length;
  state.bodyLog = state.bodyLog.filter((x) => x?.id !== id);
  if (state.bodyLog.length === n) return false;
  return save();
}

// Goal bodyweight, canonical lbs (or null to clear).
export function setGoalWeight(lbs) {
  const n = Number(lbs);
  state.settings.goalWeight = Number.isFinite(n) && n > 0 ? Math.min(n, 1500) : null;
  return save();
}

// ── CUSTOM METRICS (v3.37) ──
// Anything a person wants to watch over time that the app does not already
// track: resting heart rate, steps, HRV, blood pressure, energy, mood. Each is a
// definition plus a flat log of dated values, plotted on the Body & Metrics page.

function _uid() { return Date.now() * 100 + (_idSeq.n++ % 100); }

function _cleanMetricDef(d) {
  if (!d || typeof d !== 'object') return null;
  const name = cleanText(String(d.name ?? '').trim(), 40);
  if (!name) return null;
  const dec = Number(d.decimals);
  return {
    name,
    unit: cleanText(String(d.unit ?? '').trim(), 12) || '',
    dir: METRIC_DIRS.has(d.dir) ? d.dir : 'none',
    decimals: Number.isInteger(dec) && dec >= 0 && dec <= 2 ? dec : 1,
  };
}

export function cleanMetricDefs(defs) {
  const out = {};
  for (const [id, d] of Object.entries(pruneIdMap(defs))) {
    if (!id.startsWith('m_')) continue;
    const c = _cleanMetricDef(d);
    if (c) out[id] = c;
  }
  return out;
}

export function cleanMetricLog(log, defs) {
  if (!Array.isArray(log)) return [];
  return log.filter((e) => e && typeof e === 'object'
      && Object.prototype.hasOwnProperty.call(defs, e.metric)
      && Number.isFinite(Number(e.value)) && Math.abs(Number(e.value)) < 1e7
      && Number.isFinite(Date.parse(e.date)))
    .map((e) => ({ id: Number.isFinite(Number(e.id)) ? Number(e.id) : _uid(),
                   metric: e.metric, value: Number(e.value), date: String(e.date) }));
}

export function addMetricDef(def) {
  const clean = _cleanMetricDef(def);
  if (!clean) return null;
  const base = clean.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || 'metric';
  let id = `m_${base}`, n = 2;
  while (state.metricDefs[id]) id = `m_${base}_${n++}`;
  state.metricDefs[id] = clean;
  save();
  return id;
}

export function deleteMetricDef(id) {
  if (!Object.prototype.hasOwnProperty.call(state.metricDefs, id)) return false;
  delete state.metricDefs[id];
  state.metricLog = state.metricLog.filter((e) => e.metric !== id);
  return save();
}

export function addMetricEntry(metric, value, date) {
  const v = Number(value);
  if (!Object.prototype.hasOwnProperty.call(state.metricDefs, metric)) return false;
  if (!Number.isFinite(v) || Math.abs(v) >= 1e7) return false;
  if (!Number.isFinite(Date.parse(date))) return false;
  state.metricLog.unshift({ id: _uid(), metric, value: v, date });
  state.metricLog.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  if (state.metricLog.length > METRIC_LOG_MAX) state.metricLog.length = METRIC_LOG_MAX;
  return save();
}

export function deleteMetricEntry(id) {
  const n = state.metricLog.length;
  state.metricLog = state.metricLog.filter((e) => e.id !== id);
  return state.metricLog.length !== n && save();
}

// ── NEW: PERSONAL RECORDS ──

export function recordPR(exId, weight, reps, date) {
  const e1rm = Math.round(weight * (1 + reps / 30));
  const prev = state.prs[exId];
  if (!prev || e1rm > prev.e1rm) {
    state.prs[exId] = { weight, reps, date: date || new Date().toISOString(), e1rm };   // date: imported history keeps its own
    // Store the description unit-neutrally (no frozen 'lbs') so it stays correct
    // if the user later switches display units. The unit-aware weight is shown
    // from state.prs via formatWeight() at display time.
    awardAchievement(`pr_${exId}`, `New PR: ${exId.replace(/_/g,' ')}`, `${weight} × ${reps} reps`);
    save();
    return true;
  }
  return false;
}

// ── NEW: ACHIEVEMENTS ──

export function awardAchievement(id, label, desc) {
  if (state.achievements.find(a => a.id === id)) return false;
  state.achievements.push({ id, label, desc, unlockedAt: new Date().toISOString() });
  save();
  return true;
}

// ── NEW: STREAKS ──

export function updateStreak() {
  const today = todayStr();
  const last  = state.streak.lastSessionDate;
  if (last === today) return; // already counted today

  const yesterday = _localYesterday();
  if (last === yesterday) {
    state.streak.current += 1;
  } else if (last !== today) {
    state.streak.current = 1;
  }
  if (state.streak.current > state.streak.longest) {
    state.streak.longest = state.streak.current;
  }
  state.streak.lastSessionDate = today;

  // Award streak achievements
  if (state.streak.current === 3)  awardAchievement('streak_3',  '3-Day Streak',  'Train 3 days in a row');
  if (state.streak.current === 7)  awardAchievement('streak_7',  'Week Warrior',  '7-day streak');
  if (state.streak.current === 30) awardAchievement('streak_30', 'Iron Will',     '30-day streak');

  save();
}

// The streak as it stands TODAY. `streak.current` only changes when a session
// is logged, so after a week off it still read "5 days" on the dashboard. A
// streak is alive only if the last session was today or yesterday (local days,
// same convention as updateStreak).
// Calendar arithmetic, not `now - 24h`: across a DST change 24 hours back can
// land on the same local day (or skip one).
function _localYesterday() {
  const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - 1);
  return localDateStr(d);
}

export function currentStreak() {
  const s = state.streak || {};
  const last = s.lastSessionDate;
  if (!last) return 0;
  return last === todayStr() || last === _localYesterday() ? (Number(s.current) || 0) : 0;
}

export function checkFirstSession() {
  if (state.sessions.length === 1) awardAchievement('first_session', 'First Rep', 'Log your first workout session');
  if (state.sessions.length === 10) awardAchievement('ten_sessions', 'Ten Down', 'Log 10 workout sessions');
  if (state.sessions.length === 50) awardAchievement('fifty_sessions', 'Half Century', 'Log 50 workout sessions');
}

// ── FASTING ──

export function startFast(protocol, plannedHours) {
  state.activeFast = { startTime: new Date().toISOString(), protocol, plannedHours };
  save();
}

export function endFast() {
  if (!state.activeFast) return null;
  const start  = new Date(state.activeFast.startTime);
  const end    = new Date();
  const actual = parseFloat(((end - start) / 3600000).toFixed(2));
  const entry  = {
    id: Date.now(),
    date: localDateStr(start),
    protocol: state.activeFast.protocol,
    plannedHours: state.activeFast.plannedHours,
    startTime: state.activeFast.startTime,
    endTime: end.toISOString(),
    actualHours: actual,
    completed: actual >= state.activeFast.plannedHours * 0.9,
  };
  state.fastingLog.unshift(entry);
  if (state.fastingLog.length > 200) state.fastingLog.length = 200;
  state.activeFast = null;
  save();
  return entry;
}

// Abandon the running fast without logging it — a mis-tap on Start otherwise
// leaves a permanent 0h "Partial" row in the history.
export function cancelFast() {
  state.activeFast = null;
  save();
}

export function getActiveFast() {
  return state.activeFast;
}

// ── SLEEP ──

export function addSleepEntry(entry) {
  if (entry && typeof entry === 'object') {
    if (entry.notes != null) entry.notes = cleanText(entry.notes, 2000);
    if (entry.label != null) entry.label = cleanText(entry.label, 120);
    if (entry.type  != null) entry.type  = cleanText(entry.type, 60);
  }
  const dur   = _calcSleepDuration(entry.bedtime, entry.wakeTime);
  const score = _calcSleepScore(dur, entry.quality);
  const full  = { id: _uniqueId(state.sleepLog), ...entry, durationHours: dur, score };
  // Keep newest night first. A back-dated entry used to be unshifted to the
  // front, so the chart ran out of order and the status bar's "last sleep"
  // was whichever entry was typed last, not the latest night.
  const at = state.sleepLog.findIndex(e => !(String(e?.date || '') > String(full.date || '')));
  state.sleepLog.splice(at < 0 ? state.sleepLog.length : at, 0, full);
  if (state.sleepLog.length > 365) state.sleepLog.length = 365;
  save();
  return full;
}

export function removeSleepEntry(id) {
  state.sleepLog = state.sleepLog.filter(e => e.id !== id);
  save();
}

function _calcSleepDuration(bedtime, wakeTime) {
  const [bh, bm] = bedtime.split(':').map(Number);
  const [wh, wm] = wakeTime.split(':').map(Number);
  let mins = (wh * 60 + wm) - (bh * 60 + bm);
  if (mins < 0) mins += 1440; // midnight crossing
  return parseFloat((mins / 60).toFixed(2));
}

function _calcSleepScore(durationHours, quality) {
  const durPts  = Math.min(Math.round((durationHours / 7) * 40), 40);
  const qualPts = Math.round(((quality || 3) / 5) * 40);
  const consPts = _calcSleepConsistency(durationHours);
  return Math.min(durPts + qualPts + consPts, 100);
}

// Consistency (0–10 pts): rewards a stable sleep duration versus recent nights.
// Compares this night to the mean of the last few logged durations — the closer
// it is, the more points. With fewer than 2 prior entries there is no baseline,
// so award the full 10 to avoid penalising new users.
function _calcSleepConsistency(durationHours) {
  const recent = state.sleepLog.slice(0, 6).map(e => e.durationHours).filter(h => typeof h === 'number');
  if (recent.length < 2) return 10;
  const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
  const deviation = Math.abs(durationHours - mean);
  // 0h off → 10 pts, 2h+ off → 0 pts (linear in between).
  return Math.max(0, Math.round(10 - (deviation / 2) * 10));
}

// ── ACTIVITY ──

const _MET_VALUES = {
  Walking: 3.5, Running: 9.8, Cycling: 6.8, Soccer: 7.0, Basketball: 6.5,
  Swimming: 7.0, Weightlifting: 3.5, HIIT: 8.0, Yoga: 2.5, Hiking: 5.3,
};
const _INTENSITY_MUL = { Low: 0.8, Moderate: 1.0, High: 1.2, Max: 1.4 };

export function addActivityEntry(entry) {
  if (entry && typeof entry === 'object') {
    if (entry.notes != null) entry.notes = cleanText(entry.notes, 2000);
    if (entry.label != null) entry.label = cleanText(entry.label, 120);
    if (entry.type  != null) entry.type  = cleanText(entry.type, 60);
  }
  entry.durationMin = clampAmount(entry.durationMin, 1440, 0);
  if (entry.distance != null) entry.distance = clampAmount(entry.distance, 1000, 2) || null;
  if (entry.hr != null) entry.hr = clampAmount(entry.hr, 250, 0) || null;
  const calories = entry.calories != null && entry.calories !== ''
    ? clampAmount(entry.calories, 20000, 0)
    : _calcActivityCalories(entry);
  const full = { id: _uniqueId(state.activityLog), ...entry, calories };
  // Newest day first, so back-dated entries group under their own date.
  const at = state.activityLog.findIndex(e => !(String(e?.date || '') > String(full.date || '')));
  state.activityLog.splice(at < 0 ? state.activityLog.length : at, 0, full);
  if (state.activityLog.length > 500) state.activityLog.length = 500;
  updateStreak();
  save();
  return full;
}

export function removeActivityEntry(id) {
  state.activityLog = state.activityLog.filter(e => e.id !== id);
  save();
}

function _calcActivityCalories(entry) {
  const met    = _MET_VALUES[entry.type] || 5.0;
  const intMul = _INTENSITY_MUL[entry.intensity] || 1.0;
  const weightLbs = state.profile?.weight || 154;
  const weightKg  = weightLbs * 0.453592;
  return Math.round(met * intMul * weightKg * ((entry.durationMin || 30) / 60));
}
