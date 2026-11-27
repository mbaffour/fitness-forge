// ═══════════════════════════════════════════
//   FITNESS FORGE — Army Fitness Test standards
// ═══════════════════════════════════════════
//
// Kept apart from the Project 500 training program on purpose: when the Army
// changes the test, or the person moves into a new age band, this file (or a
// table imported in the app) changes and the program does not.
//
// What is VERIFIED here, and from where:
//   • Events, their order, and the two standards (general vs combat) and their
//     pass rules — Army Directive 2025-06 (read in full, 27 Nov 2026).
//   • The Combat Field Test sequence and 30-minute limit — the Army's
//     22 Apr 2026 announcement (army.mil/article/291880) and its coverage.
//
// What is NOT shipped: the point tables. They live only in the official
// "AFT Scoring Scales" PDF (effective 1 June 2025), which could not be fetched
// from army.mil when this was built, and third-party calculators disagree with
// one another. Rather than guess — the brief forbids estimating scores — the
// app scores an event only when a table for that standard / sex / age band is
// present, either added to TABLES below or imported in the app.

export const AFT = {
  id: 'aft-2025-06',
  name: 'Army Fitness Test',
  effective: '2025-06-01',
  sources: [
    { label: 'Army Directive 2025-06 — Army Fitness Test', url: 'https://armypubs.army.mil/epubs/DR_pubs/DR_a/ARN43586-ARMY_DIR_2025-06-000-WEB-1.pdf',
      covers: 'events, general and combat standards, pass rules' },
    { label: 'AFT Scoring Scales, effective 1 June 2025 (army.mil)', url: 'https://www.army.mil/e2/downloads/rv7/aft/AFT_Scoring_Scales_250601.pdf',
      covers: 'point tables per event, sex and age band' },
  ],
  // Official sequence. `better` says which direction scores higher.
  events: [
    { id: 'mdl', order: 1, name: '3-Repetition Maximum Deadlift', short: 'Deadlift',  unit: 'lb',   better: 'higher', exId: 'trap_dl' },
    { id: 'hrp', order: 2, name: 'Hand-Release Push-Up',          short: 'Push-ups',  unit: 'reps', better: 'higher', exId: 'hr_pushup', note: '2 minutes' },
    { id: 'sdc', order: 3, name: 'Sprint-Drag-Carry',             short: 'Sprint-drag-carry', unit: 'time', better: 'lower', exId: 'sdc' },
    { id: 'plk', order: 4, name: 'Plank',                         short: 'Plank',     unit: 'time', better: 'higher', exId: 'plank' },
    { id: 'tmr', order: 5, name: 'Two-Mile Run',                  short: '2-mile run', unit: 'time', better: 'lower' },
  ],
  standards: {
    general: { label: 'General', normedBy: 'sex and age', perEvent: 60, total: null,
               rule: 'At least 60 points in every event.' },
    combat:  { label: 'Combat',  normedBy: 'age only (sex-neutral)', perEvent: 60, total: 350,
               rule: 'At least 60 points in every event and 350 overall.' },
  },
  ageBands: ['17-21', '22-26', '27-31', '32-36', '37-41', '42-46', '47-51', '52-56', '57-61', '62+'],
};

// Point tables. Key: `${standard}:${sex}:${band}` — combat tables are
// sex-neutral, so their sex is 'any'. Each event maps to rows of
// [points, raw] in canonical units (lb, reps, seconds), any order.
// A raw result between two rows earns the LOWER row's points: you have to meet
// a listed standard to be credited with it. No interpolation, ever.
export const TABLES = {};

export function tableKey(standard, sex, band) {
  return `${standard}:${standard === 'combat' ? 'any' : sex}:${band}`;
}

export function bandForAge(age) {
  const a = Number(age);
  if (!Number.isFinite(a) || a < 17) return null;
  if (a >= 62) return '62+';
  return AFT.ageBands.find((b) => { const [lo, hi] = b.split('-').map(Number); return a >= lo && a <= hi; }) || null;
}

export const eventDef = (id) => AFT.events.find((e) => e.id === id) || null;

// Validate one event's rows: integers 0–100, finite non-negative raws, and the
// table must be monotonic — more points never ask for a worse result. A table
// that fails is rejected whole rather than half-used.
export function validateRows(eventId, rows) {
  const ev = eventDef(eventId);
  if (!ev || !Array.isArray(rows) || !rows.length) return null;
  const clean = [];
  for (const r of rows) {
    if (!Array.isArray(r) || r.length < 2) return null;
    const pts = Number(r[0]), raw = Number(r[1]);
    if (!Number.isInteger(pts) || pts < 0 || pts > 100 || !Number.isFinite(raw) || raw < 0 || raw > 100000) return null;
    clean.push([pts, raw]);
  }
  clean.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < clean.length; i++) {
    if (clean[i][0] === clean[i - 1][0]) return null;
    const worse = ev.better === 'higher' ? clean[i][1] < clean[i - 1][1] : clean[i][1] > clean[i - 1][1];
    if (worse) return null;
  }
  return clean;
}

// Points for a raw result, or null when there is no table to score against.
export function scoreEvent(eventId, raw, table) {
  const ev = eventDef(eventId);
  const rows = table?.[eventId];
  const v = Number(raw);
  if (!ev || !Array.isArray(rows) || !rows.length || !Number.isFinite(v)) return null;
  let best = 0;
  for (const [pts, need] of rows) {
    const met = ev.better === 'higher' ? v >= need : v <= need;
    if (met && pts > best) best = pts;
  }
  return best;
}

// Whole-test result. `results` maps event id → { raw, sub } where `sub` marks a
// substitute movement: those are recorded but never scored as official.
export function scoreTest(results, table, standard = 'general') {
  const std = AFT.standards[standard] || AFT.standards.general;
  const events = AFT.events.map((ev) => {
    const r = results?.[ev.id];
    const has = r && r.raw != null && Number.isFinite(Number(r.raw));
    const points = has && !r.sub ? scoreEvent(ev.id, r.raw, table) : null;
    return { id: ev.id, raw: has ? Number(r.raw) : null, sub: !!r?.sub, points };
  });
  const complete = events.every((e) => e.raw != null && !e.sub);
  const scored = events.every((e) => e.points != null);
  const total = scored ? events.reduce((a, e) => a + e.points, 0) : null;
  let pass = null;
  if (complete && scored) pass = events.every((e) => e.points >= std.perEvent) && (std.total == null || total >= std.total);
  return { events, total, complete, scored, pass, standard };
}
