// ═══════════════════════════════════════════
//   FITNESS FORGE — Project 500 engine
// ═══════════════════════════════════════════
//
// Pure functions: schedule, prescriptions, adaptive progression, running maths,
// readiness, weekly review. No store, no DOM — every function takes the
// program state `p` (state.p500) and, where it needs history, a `ctx` of the
// person's logs, so all of it runs under Node for tests.
//
// Principles from the brief, enforced here rather than hoped for:
//   • The calendar suggests; the person's results decide. Loads, paces and
//     holds come from what was actually logged or tested, never the week number.
//   • Never increase anything while pain, injury or illness is reported.
//   • Never raise running volume and intensity in the same week.
//   • Missed sessions are moved only where they do not stack hard work.

import { P500, DAY_TEMPLATES, WEEK_TEMPLATE, CFT, RUN_LEVELS } from '../data/project500.js';
import { AFT, validateRows } from '../data/aft-standards.js';

// ── DATES (local calendar days as 'YYYY-MM-DD') ──────────────────────────────
const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const isYMD = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s + 'T12:00:00'));
export const parseYMD = (s) => new Date(s + 'T12:00:00');
export const addDays = (s, n) => { const d = parseYMD(s); d.setDate(d.getDate() + n); return ymd(d); };
export const weekdayIdx = (s) => (parseYMD(s).getDay() + 6) % 7;          // Monday = 0
export const mondayOf = (s) => addDays(s, -weekdayIdx(s));
export const daysBetween = (a, b) => Math.round((parseYMD(b) - parseYMD(a)) / 864e5);

// ── RUNNING MATHS ────────────────────────────────────────────────────────────
export const METERS_PER_MILE = 1609.344;
export function fmtTime(sec) {
  if (sec == null || !Number.isFinite(Number(sec))) return '—';
  const s = Math.round(Number(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}
// "13:25", "1:02:10", "90" (seconds), "1:30" → seconds. null when unreadable.
export function parseTime(v) {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : null;
  const s = String(v ?? '').trim();
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  const m = s.match(/^(?:(\d+):)?(\d{1,2}):(\d{2}(?:\.\d+)?)$/);
  if (!m) return null;
  const sec = (Number(m[1] || 0) * 3600) + Number(m[2]) * 60 + Number(m[3]);
  return Number(m[3]) < 60 && Number(m[2]) < 60 ? sec : null;
}
export const pacePerMile = (sec, miles) => (miles > 0 && sec > 0 ? sec / miles : null);
export const mph = (sec, miles) => (miles > 0 && sec > 0 ? miles / (sec / 3600) : null);
// A 2-mile time → its mile pace and the treadmill speed that holds it.
export function twoMileEquivalents(sec) {
  if (!(sec > 0)) return null;
  return { pace: sec / 2, mph: Math.round(mph(sec, 2) * 10) / 10 };
}
// Heart-rate zones as % of max. Max HR is the person's own if they gave one,
// else 220 − age, labelled as an estimate.
export const HR_ZONES = [[1, 0.5, 0.6, 'Recovery'], [2, 0.6, 0.7, 'Easy'], [3, 0.7, 0.8, 'Aerobic'], [4, 0.8, 0.9, 'Threshold'], [5, 0.9, 1.01, 'Max']];
export function maxHR({ maxHr, age } = {}) {
  if (Number(maxHr) > 100) return { bpm: Number(maxHr), estimate: false };
  if (Number(age) > 0) return { bpm: 220 - Number(age), estimate: true };
  return null;
}
export function hrZone(bpm, max) {
  if (!(bpm > 0) || !(max > 0)) return null;
  const f = bpm / max;
  const z = HR_ZONES.find(([, lo, hi]) => f >= lo && f < hi);
  return z ? { zone: z[0], name: z[3] } : f < 0.5 ? { zone: 0, name: 'Below zones' } : null;
}

const round5 = (x) => Math.round(x / 5) * 5;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// ── PROGRAM STATE ────────────────────────────────────────────────────────────
export function newProgram({ start = P500.defaultStart, time = P500.defaultTime } = {}) {
  return {
    v: 1, status: 'setup', startDate: isYMD(start) ? start : P500.defaultStart,
    pauses: [], overrides: {}, standard: { std: 'general', sex: 'male', band: '27-31' },
    prefs: { time, sat: 'military', equip: { trapbar: true, sled: true, pool: true } },
    baseline: null, lifts: {}, tests: [], cft: [], log: [], readiness: [], tables: {},
  };
}

// Everything in state.p500 can arrive from a restored backup, so it is rebuilt
// field by field from what this app writes: dates must be real calendar days,
// ids numbers, templates known, numbers in range, tables monotonic. Free text
// is short and stripped of markup characters. Anything else is dropped.
const TEXT = (v, max = 300) => (typeof v === 'string' ? v.replace(/[<>"\u0000]/g, '').slice(0, max) : '');
const NUM = (v, lo, hi) => { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? n : null; };
const EVENT_MAX = { mdl: [1, 1500], hrp: [0, 300], sdc: [20, 1800], plk: [1, 3600], tmr: [300, 7200] };
function cleanEvents(ev) {
  const out = {};
  for (const [id, [lo, hi]] of Object.entries(EVENT_MAX)) {
    const r = ev?.[id];
    const raw = NUM(r?.raw, lo, hi);
    if (raw != null) out[id] = { raw, sub: !!r.sub, ...(r.note ? { note: TEXT(r.note, 120) } : {}) };
  }
  return out;
}
export function sanitizeP500(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const p = newProgram({ start: isYMD(raw.startDate) ? raw.startDate : P500.defaultStart });
  p.status = ['setup', 'active', 'paused', 'complete'].includes(raw.status) ? raw.status : 'setup';
  p.pauses = (Array.isArray(raw.pauses) ? raw.pauses : []).filter((x) => x && isYMD(x.from) && (x.to == null || (isYMD(x.to) && x.to >= x.from)))
    .map((x) => ({ from: x.from, to: x.to ?? null })).slice(0, 100);
  for (const [d, o] of Object.entries(raw.overrides && typeof raw.overrides === 'object' ? raw.overrides : {})) {
    if (!isYMD(d) || !o || typeof o !== 'object') continue;
    const c = {};
    if (DAY_TEMPLATES[o.tpl]) c.tpl = o.tpl;
    if (isYMD(o.movedTo)) c.movedTo = o.movedTo;
    if (isYMD(o.movedFrom)) c.movedFrom = o.movedFrom;
    if (o.recovery) c.recovery = true;
    if (Object.keys(c).length) p.overrides[d] = c;
  }
  const st = raw.standard || {};
  p.standard = { std: ['general', 'combat'].includes(st.std) ? st.std : 'general', sex: ['male', 'female'].includes(st.sex) ? st.sex : 'male',
                 band: AFT.ageBands.includes(st.band) ? st.band : '27-31' };
  const pr = raw.prefs || {};
  p.prefs = { time: /^([01]\d|2[0-3]):[0-5]\d$/.test(pr.time) ? pr.time : P500.defaultTime, sat: pr.sat === 'soccer' ? 'soccer' : 'military',
              equip: Object.fromEntries(['trapbar', 'sled', 'pool', 'dumbbells', 'hrp'].filter((k) => typeof pr.equip?.[k] === 'boolean').map((k) => [k, pr.equip[k]])) };
  const b = raw.baseline;
  if (b && typeof b === 'object' && isYMD(b.date)) {
    p.baseline = { date: b.date, ...Object.fromEntries(Object.entries(cleanEvents(Object.fromEntries(['mdl', 'hrp', 'sdc', 'plk', 'tmr'].map((k) => [k, { raw: b[k] }])))).map(([k, v]) => [k, v.raw])) };
    const dl3 = NUM(b.dl3, 1, 1500); if (dl3) p.baseline.dl3 = dl3;
    for (const [k, lo, hi] of [['weight', 50, 1000], ['height', 100, 250], ['waist', 15, 100], ['rhr', 25, 150], ['maxHr', 100, 230]]) { const v = NUM(b[k], lo, hi); if (v != null) p.baseline[k] = v; }
    if (RUN_LEVELS.some((r) => r.id === b.runLevel)) p.baseline.runLevel = b.runLevel;
    if (b.injuries) p.baseline.injuries = TEXT(b.injuries, 500);
    if (b.sub && typeof b.sub === 'object') p.baseline.sub = Object.fromEntries(Object.keys(EVENT_MAX).filter((k) => b.sub[k]).map((k) => [k, true]));
  }
  const dl = raw.lifts?.trap_dl;
  if (dl && typeof dl === 'object') {
    const work = NUM(dl.work, 45, 1500);
    p.lifts.trap_dl = { work, manual: !!dl.manual, hist: (Array.isArray(dl.hist) ? dl.hist : []).filter((h) => h && isYMD(h.date))
      .map((h) => ({ date: h.date, from: NUM(h.from, 0, 1500), to: NUM(h.to, 0, 1500), change: NUM(h.change, -1500, 1500) ?? 0, reason: TEXT(h.reason, 200) })).slice(-200) };
  }
  p.tests = (Array.isArray(raw.tests) ? raw.tests : []).filter((t) => t && isYMD(t.date) && Number.isFinite(Number(t.id)))
    .map((t) => ({ id: Number(t.id), date: t.date, kind: ['aft', 'check'].includes(t.kind) ? t.kind : 'check', events: cleanEvents(t.events), note: TEXT(t.note, 500) }))
    .filter((t) => Object.keys(t.events).length).slice(-500);
  p.cft = (Array.isArray(raw.cft) ? raw.cft : []).filter((c) => c && isYMD(c.date) && Number.isFinite(Number(c.id)) && NUM(c.totalSec, 60, 7200))
    .map((c) => ({ id: Number(c.id), date: c.date, totalSec: Number(c.totalSec), splits: Object.fromEntries(CFT.events.map((e) => [e.id, NUM(c.splits?.[e.id], 1, 7200)]).filter(([, v]) => v != null)), note: TEXT(c.note, 500) })).slice(-200);
  const BLOCKS = ['lift', 'run', 'activity', 'test', 'any'];
  p.log = (Array.isArray(raw.log) ? raw.log : []).filter((e) => e && isYMD(e.date) && BLOCKS.includes(e.block))
    .map((e) => ({ date: e.date, block: e.block, tpl: DAY_TEMPLATES[e.tpl] ? e.tpl : null, week: NUM(e.week, 1, 52), at: TEXT(e.at, 40),
                   ref: Number.isFinite(Number(e.ref)) ? Number(e.ref) : null, prescribed: Array.isArray(e.prescribed) ? e.prescribed.slice(0, 20).map((x) => ({
                     exId: /^[A-Za-z0-9_]{1,80}$/.test(x?.exId) ? x.exId : null, sets: NUM(x?.sets, 0, 20), reps: TEXT(String(x?.reps ?? ''), 30), weight: NUM(x?.weight, 0, 1500), sub: !!x?.sub })).filter((x) => x.exId) : null,
                   actual: e.actual && typeof e.actual === 'object' ? { sets: NUM(e.actual.sets, 0, 500), volume: NUM(e.actual.volume, 0, 1e7), min: NUM(e.actual.min, 0, 1440), miles: NUM(e.actual.miles, 0, 200), note: TEXT(e.actual.note, 200) } : null }))
    .slice(-2000);
  p.readiness = (Array.isArray(raw.readiness) ? raw.readiness : []).filter((r) => r && isYMD(r.date))
    .map((r) => ({ date: r.date, sleepQ: NUM(r.sleepQ, 1, 5), soreness: NUM(r.soreness, 1, 10), energy: NUM(r.energy, 1, 10), stress: NUM(r.stress, 1, 10), pain: !!r.pain, ill: !!r.ill, note: TEXT(r.note, 300) }))
    .slice(-800);
  for (const [k, tbl] of Object.entries(raw.tables && typeof raw.tables === 'object' ? raw.tables : {})) {
    if (!/^(general|combat):(male|female|any):[0-9+-]{3,5}$/.test(k) || !tbl || typeof tbl !== 'object') continue;
    const clean = {};
    for (const ev of AFT.events) { const rows = validateRows(ev.id, tbl[ev.id]); if (rows) clean[ev.id] = rows; }
    if (Object.keys(clean).length) p.tables[k] = clean;
  }
  return p;
}

// ── SCHEDULE ─────────────────────────────────────────────────────────────────
// Weeks are Monday-based calendar weeks; week 1 is the week containing the
// start date. Pausing stops the clock: a calendar week paused for four or more
// days is not counted, so the program resumes where it left off and weekdays
// stay aligned. The week after a pause of ten days or more is a return week.
function pausedOn(p, date) {
  return (p.pauses || []).some((x) => date >= x.from && (x.to == null || date <= x.to));
}
function calWeekPaused(p, monday) {
  let n = 0;
  for (let i = 0; i < 7; i++) if (pausedOn(p, addDays(monday, i))) n++;
  return n >= 4;
}
export function weekInfo(p, date) {
  if (!p || !isYMD(p.startDate) || !isYMD(date)) return null;
  const m0 = mondayOf(p.startDate), m = mondayOf(date);
  const cal = daysBetween(m0, m) / 7;
  if (date < p.startDate) return { pre: true, week: 0, cal };
  if (calWeekPaused(p, m)) return { paused: true, week: null, cal };
  let paused = 0;
  for (let c = 0; c < cal; c++) if (calWeekPaused(p, addDays(m0, c * 7))) paused++;
  const week = cal + 1 - paused;
  if (week > P500.weeks) return { done: true, week, cal };
  // Return week: the counted week straight after a pause of ≥ 10 days.
  const prevPausedDays = (() => { let n = 0; for (let d = 1; d <= 60 && pausedOn(p, addDays(m, -d)); d++) n++; return n; })();
  return { week, cal, phase: phaseOf(week), deload: isDeload(week), ret: prevPausedDays >= 10,
           fullTest: P500.fullTestWeeks.includes(week), check: isDeload(week) && !P500.fullTestWeeks.includes(week) };
}
export const phaseOf = (week) => clamp(Math.ceil(week / 13), 1, 4);
export const isDeload = (week) => week > 0 && week % P500.deloadEvery === 0;
export const weekStartDate = (p, week) => {
  // The Monday of a program week, walking past paused calendar weeks.
  let m = mondayOf(p.startDate), counted = 0;
  for (let guard = 0; guard < 160; guard++, m = addDays(m, 7)) {
    if (calWeekPaused(p, m)) continue;
    if (++counted === week) return m;
  }
  return null;
};
export function programEndDate(p) { const m = weekStartDate(p, P500.weeks); return m ? addDays(m, 6) : null; }

// The default template for a date before overrides.
function baseTemplate(p, date, wi) {
  const dow = weekdayIdx(date);
  let tpl = WEEK_TEMPLATE[dow];
  if (tpl === 'military' && p.prefs?.sat === 'soccer') tpl = 'soccer';
  if (wi.fullTest) {
    // Test week: lighter lifting early, easy running, the full test on Saturday.
    if (dow === 1) tpl = 'aerobic';
    if (dow === 4) tpl = 'recovery';
    if (dow === 5) tpl = 'aft';
  } else if (wi.check) {
    if (dow === 1) tpl = 'checkA';
    if (dow === 4) tpl = 'checkRun';
    if (dow === 5 && wi.phase >= 2 && p.prefs?.sat !== 'soccer') tpl = 'checkSdc';
  }
  return tpl;
}

// What is planned on a date, after moves and overrides.
export function dayPlan(p, date) {
  const wi = weekInfo(p, date);
  if (!wi) return null;
  if (wi.pre) return { date, kind: 'pre' };
  if (wi.done) return { date, kind: 'done', week: wi.week };
  if (wi.paused || pausedOn(p, date)) return { date, kind: 'paused', week: wi.week };
  const o = p.overrides?.[date] || null;
  let tpl = baseTemplate(p, date, wi), moved = null, movedFrom = null;
  if (o?.tpl && DAY_TEMPLATES[o.tpl]) tpl = o.tpl;
  if (o?.movedTo) moved = o.movedTo;
  if (o?.movedFrom) movedFrom = o.movedFrom;
  const t = DAY_TEMPLATES[tpl];
  return { date, kind: moved ? 'moved' : 'plan', week: wi.week, phase: wi.phase, deload: wi.deload, ret: wi.ret,
           fullTest: wi.fullTest, check: wi.check, tpl, name: t.name, dur: t.dur, load: t.load, icon: t.icon,
           test: t.test || null, movedTo: moved, movedFrom, recovery: !!o?.recovery };
}

// Move a session to another day of the same program week. If the target day
// holds a session, the two swap — nothing is ever stacked.
export function moveSession(p, from, to) {
  const a = dayPlan(p, from), b = dayPlan(p, to);
  if (!a || !b || a.kind !== 'plan' || b.kind !== 'plan' || from === to) return { ok: false, reason: 'Pick a day in the active program.' };
  if (mondayOf(from) !== mondayOf(to)) return { ok: false, reason: 'Sessions move within their own week, so the week’s balance stays intact.' };
  const ov = (p.overrides = p.overrides || {});
  const aT = a.tpl, bT = b.tpl;
  ov[to] = { ...(ov[to] || {}), tpl: aT, movedFrom: from };
  if (bT === 'rest' || bT === 'recover') ov[from] = { ...(ov[from] || {}), tpl: 'rest', movedTo: to };
  else ov[from] = { ...(ov[from] || {}), tpl: bT, movedFrom: to };
  return { ok: true };
}
export function resetDay(p, date) { if (p.overrides) delete p.overrides[date]; }

// Where could a missed session go? The same week, a later easy or rest day,
// with no neighbour that loads the same thing — never two leg/hinge days or two
// hard runs back to back.
export function rescheduleOptions(p, missedDate, today) {
  const a = dayPlan(p, missedDate);
  if (!a || a.kind !== 'plan') return [];
  const stress = new Set(DAY_TEMPLATES[a.tpl].stress);
  const sun = addDays(mondayOf(missedDate), 6);
  const out = [];
  for (let d = addDays(today > missedDate ? today : missedDate, 0); d <= sun; d = addDays(d, 1)) {
    if (d === missedDate) continue;
    const t = dayPlan(p, d);
    if (!t || t.kind !== 'plan' || !['easy', 'rest'].includes(t.load) || t.test) continue;
    const near = [addDays(d, -1), addDays(d, 1)].map((x) => (x === missedDate ? null : dayPlan(p, x)));
    const clash = near.some((n) => n && n.kind === 'plan' && DAY_TEMPLATES[n.tpl].stress.some((s) => stress.has(s)));
    if (!clash) out.push(d);
  }
  return out;
}

// ── BEST RESULTS ─────────────────────────────────────────────────────────────
// Best raw per event from tests (baseline included), substitutes excluded.
// `before` limits to results on or before a date.
export function bestResults(p, { before = null, officialOnly = false } = {}) {
  const best = {};
  const better = { mdl: 'higher', hrp: 'higher', plk: 'higher', sdc: 'lower', tmr: 'lower' };
  const consider = (id, raw, date, src) => {
    const v = Number(raw);
    if (!Number.isFinite(v) || v <= 0) return;
    if (before && date > before) return;
    const cur = best[id];
    if (!cur || (better[id] === 'higher' ? v > cur.raw : v < cur.raw)) best[id] = { raw: v, date, src };
  };
  if (p.baseline?.date && !officialOnly) for (const id of Object.keys(better)) {
    const v = p.baseline[id];
    if (v != null && !p.baseline.sub?.[id]) consider(id, v, p.baseline.date, 'baseline');
  }
  for (const t of p.tests || []) {
    if (officialOnly && t.kind !== 'aft') continue;
    for (const [id, r] of Object.entries(t.events || {})) if (r && !r.sub) consider(id, r.raw, t.date, t.kind);
  }
  return best;
}
// The latest (not best) result — what training should be based on today.
export function latestResults(p) {
  const out = {};
  const all = [...(p.tests || [])].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (p.baseline?.date) for (const id of ['mdl', 'hrp', 'sdc', 'plk', 'tmr']) if (p.baseline[id] > 0 && !p.baseline.sub?.[id]) out[id] = { raw: p.baseline[id], date: p.baseline.date };
  for (const t of all) for (const [id, r] of Object.entries(t.events || {})) if (r && !r.sub && r.raw > 0) out[id] = { raw: r.raw, date: t.date };
  return out;
}

// ── PRESCRIPTIONS ────────────────────────────────────────────────────────────
// Deadlift scheme per phase; Monday is the heavy day, Thursday the lighter one.
export const DL_SCHEME = { 1: [4, 5], 2: [4, 4], 3: [4, 3], 4: [4, 3] };
export function volumeFactor(plan) { return plan.ret ? 0.6 : plan.deload ? 0.65 : 1; }
const lessSets = (sets, plan) => Math.max(plan.deload || plan.ret ? 1 : 2, Math.round(sets * volumeFactor(plan)));

export function deadliftWork(p) { const w = Number(p.lifts?.trap_dl?.work); return w > 0 ? w : null; }
// First working weight from the baseline: a safe 3-rep weight, so the 5-rep
// working sets start a little under it, at 2–3 reps in reserve.
export function deadliftStart(baseline) {
  const dl3 = Number(baseline?.dl3);
  return dl3 > 0 ? Math.max(45, round5(dl3 * 0.88)) : null;
}

function weekInPhase(week) { return ((week - 1) % 13) + 1; }

export function liftPrescription(p, plan) {
  const work = deadliftWork(p);
  const [s, r] = DL_SCHEME[plan.phase] || DL_SCHEME[1];
  const heavy = plan.tpl === 'lower';
  const mult = (plan.ret ? 0.85 : plan.deload ? 0.9 : 1) * (heavy ? 1 : 0.85);
  const sub = p.prefs?.equip?.trapbar === false;
  const dl = { exId: sub ? 'deadlift' : 'trap_dl', sub, sets: heavy ? lessSets(s, plan) : lessSets(3, plan), reps: String(r),
               weight: work ? Math.max(45, round5(work * mult)) : null, rir: '2–3', key: 'dl',
               note: work ? (heavy ? 'Heavy day' : 'Lighter than Monday — crisp reps') : 'No working weight yet: pick a load you could lift 7–8 times, log it, and the program takes over.' };
  const best = latestResults(p);
  const wip = weekInPhase(plan.week);
  const pct = Math.min(0.65, 0.5 + 0.015 * (wip - 1));
  const hrpBest = best.hrp?.raw;
  const hrp = (sets) => ({ exId: p.prefs?.equip?.hrp === false ? 'pushup' : 'hr_pushup', sets: lessSets(sets, plan),
    reps: hrpBest ? String(Math.max(3, Math.round(hrpBest * (plan.deload || plan.ret ? 0.45 : pct)))) : '6–10',
    note: hrpBest ? `Sub-max: about ${Math.round((plan.deload ? 0.45 : pct) * 100)}% of your best ${hrpBest}. Stop 2–3 reps short of failure.` : 'Stop 2–3 reps before failure. Test your max at the next event check.' });
  const plkBest = best.plk?.raw;
  const hold = plkBest ? clamp(round5(plkBest * (plan.deload || plan.ret ? 0.45 : pct)), 20, Math.max(20, plkBest - 10)) : null;
  const plank = { exId: 'plank', sets: lessSets(3, plan), reps: hold ? `${hold}s` : '30–60s', timed: true,
                  note: hold ? `Holds at ~${Math.round(pct * 100)}% of your best ${fmtTime(plkBest)} — form first.` : 'Stop the hold when form breaks.' };
  const v = (exId, sets, reps, extra = {}) => ({ exId, sets: lessSets(sets, plan), reps: String(reps), ...extra });
  if (plan.tpl === 'lower') return [dl, v(p.prefs?.equip?.dumbbells === false ? 'fx_Bodyweight_Walking_Lunge' : 'squat_db', 3, 10), v('rdl_bb', 3, 8), v('lunge_db', 2, '10/leg'), v('calfr_bb', 3, 15), plank];
  if (plan.tpl === 'full') return [dl, v('bench_db', 3, 10), v('lat_pull', 3, 10), v('bss', 3, '8/leg'), v('farmer', 4, '25 m', { timed: true }), hrp(3)];
  if (plan.tpl === 'speed') return [hrp(4), v('side_plank', 3, '30s/side', { timed: true })];
  if (plan.tpl === 'aerobic') return [plank, v('deadbug', 3, '10/side')];
  if (plan.tpl === 'military') {
    const sledOk = p.prefs?.equip?.sled !== false;
    const dist = plan.phase >= 2 ? '50 m' : '25 m';
    const items = [v('fx_Wind_Sprints', 4, `${dist} accel`, { timed: true }), v('lat_shuffle', 4, dist, { timed: true }), v('farmer', 4, dist, { timed: true }),
                   v(sledOk ? 'fx_Sled_Drag___Harness' : 'farmer', 3, dist, { timed: true, sub: !sledOk })];
    if (plan.phase >= 3) items.push(v('sdc', plan.phase >= 4 ? 3 : 2, 'full SDC', { timed: true, note: 'Practice rounds with full recovery between. Log each round’s time.' }));
    return items;
  }
  if (plan.tpl === 'recovery' || plan.tpl === 'recover' || plan.tpl === 'rest') {
    return [v('fx_Standing_Hip_Circles', 1, '5 min', { timed: true }), v('ff_ankle_rock', 1, '5 min', { timed: true }),
            v('fx_Shoulder_Circles', 1, '5 min', { timed: true })];
  }
  return [];
}

// Running prescription. Volume and intensity never rise in the same week:
// pace updates come from a new result (tests sit in deload weeks), and the
// interval count steps up a week later.
export function runPrescription(p, plan) {
  const latest = latestResults(p);
  const cur = latest.tmr?.raw || null;                          // current 2-mile, seconds
  const goal = P500.phases[plan.phase - 1].milestones.tmr;
  const mile = cur ? cur / 2 : null;
  const lvl = RUN_LEVELS.find((r) => r.id === p.baseline?.runLevel) || null;
  const wip = weekInPhase(plan.week);
  const step = wip <= 5 ? 0 : wip <= 9 ? 1 : 2;
  const f = volumeFactor(plan);
  if (plan.tpl === 'speed') {
    let reps, dist, rest, paceSec, label;
    if (plan.phase === 1) { reps = [4, 5, 6][step]; dist = 400; rest = 120; paceSec = mile ? mile * 0.97 : null; label = 'controlled, not all-out'; }
    else if (plan.phase === 2) { reps = [4, 5, 5][step]; dist = 800; rest = 150; paceSec = mile; label = 'at your current 2-mile pace'; }
    else if (plan.phase === 3) { reps = [6, 7, 8][step]; dist = 400; rest = 90; paceSec = goal / 2; label = 'at this phase’s goal pace'; }
    else { reps = [2, 3, 3][step]; dist = 1609; rest = 180; paceSec = goal / 2; label = 'at goal race pace'; }
    reps = Math.max(2, Math.round(reps * f));
    const split = paceSec ? paceSec * (dist / METERS_PER_MILE) : null;
    const beginner = lvl && (lvl.id === 'none' || lvl.id === 'runwalk') && plan.phase === 1;
    return { kind: 'intervals', warmMin: 10, coolMin: 8, reps, dist, rest, split, paceLabel: label,
             alt: beginner ? `Run/walk alternative: ${reps} × 90 s brisk run, 2 min walk between.` : null,
             note: cur ? `Built from your latest 2-mile, ${fmtTime(cur)}.` : 'No 2-mile result yet — run by feel at a hard-but-controlled effort; the first time trial sets your paces.' };
  }
  if (plan.tpl === 'aerobic') {
    const start = lvl?.easyMin || 25;
    const cap = [35, 45, 50, 50][plan.phase - 1];
    // +2 min per counted week (≈ ≤ 10%), held flat in deload and test weeks.
    const raw = Math.min(cap, start + 2 * (plan.week - 1 - Math.floor((plan.week - 1) / 4)));
    const min = Math.round(raw * f);
    const easyPace = mile ? mile * 1.25 : null;
    return { kind: 'easy', warmMin: 5, coolMin: 5, min, easyPace, runWalk: lvl?.runWalk && plan.phase === 1 ? lvl.runWalk : null,
             note: 'Conversational effort — you could speak in sentences.' };
  }
  if (plan.tpl === 'military') {
    const min = Math.round([15, 20, 20, 20][plan.phase - 1] + Math.min(5, step * 2.5));
    return { kind: plan.phase >= 3 ? 'tempo' : 'easy', min: Math.round(min * f),
             note: plan.phase >= 3 ? 'Third run of the week: comfortably hard tempo. Skip it if recovery is poor.' : 'Easy jog to open the session.' };
  }
  if (plan.tpl === 'checkRun' || plan.tpl === 'aft') return { kind: 'trial', dist: 2, note: 'Even pace: the first mile should feel controlled.' };
  return null;
}

export function recoveryPrescription(plan, p) {
  if (plan.tpl !== 'recovery' && plan.tpl !== 'recover') return null;
  return { min: plan.tpl === 'recover' ? 20 : 25, options: p.prefs?.equip?.pool === false ? ['Cycling', 'Walking'] : ['Swimming', 'Cycling', 'Walking'] };
}

// ── ADAPTIVE DEADLIFT PROGRESSION ────────────────────────────────────────────
// After a heavy (Monday) session. `sets` are the completed working sets of the
// deadlift; RIR is reps in reserve as logged.
export function progressDeadlift({ work, prescribedSets, targetReps, sets, plan, flags = {} }) {
  if (!(work > 0)) return { next: null, change: 0, reason: 'No working weight set yet.' };
  if (flags.pain || flags.ill) return { next: work, change: 0, reason: 'Pain or illness reported — load held. Nothing increases until you feel right.' };
  if (plan?.deload || plan?.ret) return { next: work, change: 0, reason: 'Deload / return week — the working weight carries over unchanged.' };
  const working = (sets || []).filter((s) => s && s.completed && !s.warmup && Number(s.weight) >= work * 0.95);
  const reps = Number(targetReps) || 5;
  if (working.length < prescribedSets || working.some((s) => Number(s.reps) < reps)) {
    const next = Math.max(45, round5(work * 0.95));
    return { next, change: next - work, reason: `Not every set reached ${reps} reps at ${work} lb — back off ~5% and rebuild.` };
  }
  const rirs = working.map((s) => s.rir).filter((r) => r != null && Number.isFinite(Number(r))).map(Number);
  if (flags.poorRecovery) return { next: work, change: 0, reason: 'All reps done, but recovery is poor this week — hold the weight.' };
  if (!rirs.length) return { next: work + 5, change: 5, reason: 'All sets done (no RIR logged) — the smallest step, +5 lb.' };
  const min = Math.min(...rirs);
  if (min >= 3) return { next: work + 10, change: 10, reason: `All sets done with ${min}+ reps in reserve — +10 lb.` };
  if (min >= 2) return { next: work + 5, change: 5, reason: 'All sets done at 2 reps in reserve — +5 lb.' };
  return { next: work, change: 0, reason: 'Completed, but close to the limit — hold the weight and own it.' };
}

// ── READINESS ────────────────────────────────────────────────────────────────
// A daily check-in: sleep quality 1–5, soreness/energy/stress 1–10, flags.
export function readinessScore(r) {
  if (!r) return null;
  if (r.pain || r.ill) return { score: 0, level: 'red', advice: r.ill ? 'Illness reported: rest or an easy walk only. No intensity.' : 'Pain reported: no intensity today. Mobility only; if it persists, see a professional.' };
  const parts = [];
  if (r.sleepQ > 0) parts.push((r.sleepQ - 1) / 4);
  if (r.soreness > 0) parts.push(1 - (r.soreness - 1) / 9);
  if (r.energy > 0) parts.push((r.energy - 1) / 9);
  if (r.stress > 0) parts.push(1 - (r.stress - 1) / 9);
  if (!parts.length) return null;
  const score = Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100);
  const level = score >= 65 ? 'green' : score >= 40 ? 'amber' : 'red';
  const advice = level === 'green' ? 'Train as planned.' : level === 'amber' ? 'Train, but drop one set per lift and keep 3+ reps in reserve.' : 'Swap today for recovery: easy movement and mobility.';
  return { score, level, advice };
}

// ── TARGETS + OBJECTIVES ─────────────────────────────────────────────────────
export function meets(id, raw, target) {
  if (!(raw > 0) || !(target > 0)) return false;
  return id === 'sdc' || id === 'tmr' ? raw <= target : raw >= target;
}
// Progress 0–1 from baseline toward a target (lower-is-better aware).
export function progressTo(id, base, cur, target) {
  if (!(cur > 0) || !(target > 0)) return null;
  if (meets(id, cur, target)) return 1;
  if (!(base > 0) || base === target) return meets(id, cur, target) ? 1 : 0;
  const f = (cur - base) / (target - base);
  return clamp(f, 0, 1);
}
// 20 objectives: each phase's five milestones. Met by the best real result.
export function objectives(p) {
  const best = bestResults(p);
  return P500.phases.map((ph) => ({ phase: ph.n, name: ph.name, items: Object.entries(ph.milestones).map(([id, target]) => ({
    id, target, met: meets(id, best[id]?.raw, target), best: best[id]?.raw ?? null })) }));
}
export const objectivesMet = (p) => objectives(p).reduce((a, ph) => a + ph.items.filter((i) => i.met).length, 0);

export function cftUnlocked(p, today) {
  const best = bestResults(p);
  const wi = weekInfo(p, today);
  const why = [];
  if (!(best.tmr?.raw <= CFT.unlock.tmr)) why.push(`2-mile under ${fmtTime(CFT.unlock.tmr)}`);
  if (!(best.hrp?.raw >= CFT.unlock.hrp)) why.push(`${CFT.unlock.hrp} hand-release push-ups`);
  if (!((wi?.week || 0) > CFT.unlock.weeks || wi?.done)) why.push(`Phase 1 complete (week ${CFT.unlock.weeks})`);
  return { unlocked: !why.length, need: why };
}

// ── DAY STATUS + WEEKLY REVIEW ───────────────────────────────────────────────
// Which blocks a session needs before it counts as done.
export const REQUIRED_BLOCKS = {
  lower: ['lift'], speed: ['run', 'lift'], recovery: ['any'], full: ['lift'], aerobic: ['run', 'lift'],
  military: ['lift'], soccer: ['activity'], rest: [], recover: ['any'], checkA: ['test'], checkRun: ['test'],
  checkSdc: ['test'], aft: ['test'],
};
export function dayStatus(p, date, today) {
  const plan = dayPlan(p, date);
  if (!plan || plan.kind !== 'plan') return { plan, status: plan?.kind || 'none' };
  const entries = (p.log || []).filter((e) => e.date === date);
  const need = REQUIRED_BLOCKS[plan.tpl] || [];
  if (!need.length) return { plan, status: entries.length ? 'done' : 'rest', entries };
  const have = new Set(entries.map((e) => e.block));
  const got = need.filter((b) => (b === 'any' ? entries.length > 0 : have.has(b))).length;
  if (got === need.length) return { plan, status: 'done', entries };
  if (got > 0) return { plan, status: 'partial', entries };
  if (date < today) return { plan, status: 'missed', entries };
  if (date === today) return { plan, status: 'today', entries };
  return { plan, status: 'upcoming', entries };
}

// ctx: { sessions, cardio, activity, sleep, prs } — the app's own logs.
export function weekReview(p, week, today, ctx = {}) {
  const mon = weekStartDate(p, week);
  if (!mon) return null;
  const days = Array.from({ length: 7 }, (_, i) => dayStatus(p, addDays(mon, i), today));
  const sun = addDays(mon, 6);
  const inWeek = (iso) => { const d = typeof iso === 'string' ? iso.slice(0, 10) : ''; return d >= mon && d <= sun; };
  const localDay = (iso) => { const t = Date.parse(iso); return Number.isFinite(t) ? ymd(new Date(t)) : null; };
  const inW = (iso) => { const d = localDay(iso); return d && d >= mon && d <= sun; };
  const scheduled = days.filter((d) => d.plan?.kind === 'plan' && (REQUIRED_BLOCKS[d.plan.tpl] || []).length).length;
  const completed = days.filter((d) => d.status === 'done').length;
  const partial = days.filter((d) => d.status === 'partial').length;
  const missed = days.filter((d) => d.status === 'missed').map((d) => d.plan);
  const sessions = (ctx.sessions || []).filter((s) => inW(s.date));
  const cardio = (ctx.cardio || []).filter((c) => inW(c.date));
  const activity = (ctx.activity || []).filter((a) => inWeek(a.date) || inW(a.date));
  const runs = cardio.filter((c) => c.type === 'run');
  const runMiles = runs.reduce((a, r) => a + (Number(r.distanceMiles) || 0), 0);
  const runSec = runs.filter((r) => r.distanceMiles > 0).reduce((a, r) => a + (Number(r.durationMinutes) || 0) * 60, 0);
  const pacedMiles = runs.filter((r) => r.distanceMiles > 0 && r.durationMinutes > 0).reduce((a, r) => a + Number(r.distanceMiles), 0);
  const minutes = sessions.reduce((a, s) => a + (Number(s.durationMinutes) || 0), 0)
    + cardio.reduce((a, c) => a + (Number(c.durationMinutes) || 0), 0) + activity.reduce((a, x) => a + (Number(x.durationMin) || 0), 0);
  const volume = sessions.reduce((a, s) => a + (Number(s.totalVolume) || 0), 0);
  const swimMin = cardio.filter((c) => c.type === 'swim').reduce((a, c) => a + (Number(c.durationMinutes) || 0), 0)
    + activity.filter((x) => x.type === 'Swimming').reduce((a, x) => a + (Number(x.durationMin) || 0), 0);
  const soccer = activity.filter((x) => x.type === 'Soccer');
  const prs = Object.entries(ctx.prs || {}).filter(([, r]) => inW(r?.date)).map(([id, r]) => ({ id, ...r }));
  const tests = (p.tests || []).filter((t) => t.date >= mon && t.date <= sun);
  const ready = (p.readiness || []).filter((r) => r.date >= mon && r.date <= sun);
  const sleeps = (ctx.sleep || []).filter((s) => s.date >= mon && s.date <= sun && s.durationHours > 0);
  const avgSleep = sleeps.length ? sleeps.reduce((a, s) => a + s.durationHours, 0) / sleeps.length : null;
  const avg = (k) => { const v = ready.map((r) => Number(r[k])).filter((x) => x > 0); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const pain = ready.some((r) => r.pain), ill = ready.some((r) => r.ill);
  const lift = (p.lifts?.trap_dl?.hist || []).filter((h) => h.date >= mon && h.date <= sun).pop() || null;
  const recs = recommendations({ p, week, completed, scheduled, missed, avgSleep, soreness: avg('soreness'), energy: avg('energy'), pain, ill, soccer, lift, today });
  return { week, mon, sun, days, scheduled, completed, partial, missed, minutes, volume, runMiles,
           runPace: pacedMiles > 0 ? runSec / pacedMiles : null, runs: runs.length, swimMin, soccer, prs, tests,
           avgSleep, soreness: avg('soreness'), energy: avg('energy'), stress: avg('stress'), pain, ill, recs };
}

// Plain rules over recorded data — each recommendation says why.
export function recommendations({ p, week, completed, scheduled, missed, avgSleep, soreness, energy, pain, ill, soccer, lift, today }) {
  const out = [];
  if (pain || ill) out.push({ level: 'red', text: `${ill ? 'Illness' : 'Pain'} was reported this week, so nothing progresses next week. Return gradually; if pain persists, get it checked.` });
  if (scheduled && completed / scheduled < 0.6) out.push({ level: 'amber', text: `${completed} of ${scheduled} sessions done. Repeat this week’s loads rather than progressing — consistency first.` });
  else if (scheduled && completed === scheduled) out.push({ level: 'green', text: `Every scheduled session done (${completed}/${scheduled}). Progress as prescribed.` });
  if (avgSleep != null && avgSleep < 6.5) out.push({ level: 'amber', text: `Sleep averaged ${avgSleep.toFixed(1)} h. Below ~7 h, keep 3+ reps in reserve and skip the optional third run.` });
  if (soreness != null && soreness >= 7) out.push({ level: 'amber', text: `Soreness averaged ${soreness.toFixed(1)}/10 — drop one set per lift on Monday and Thursday.` });
  if (energy != null && energy <= 3) out.push({ level: 'amber', text: `Energy averaged ${energy.toFixed(1)}/10 — consider an extra recovery day mid-week.` });
  const hardSoccer = (soccer || []).filter((s) => ['High', 'Max'].includes(s.intensity) || Number(s.rpe) >= 8);
  if (hardSoccer.length) out.push({ level: 'amber', text: 'A hard soccer session counted as your conditioning — keep Monday’s deadlift at its current weight if your legs are heavy.' });
  if (lift) out.push({ level: lift.change > 0 ? 'green' : lift.change < 0 ? 'amber' : 'info', text: `Deadlift: ${lift.reason} Next heavy day ${lift.to} lb.` });
  for (const m of missed || []) {
    const opts = rescheduleOptions(p, m.date, today);
    out.push({ level: 'info', text: opts.length ? `Missed ${m.name} (${m.date}) — it fits on ${opts[0]} without stacking hard days.` : `Missed ${m.name} (${m.date}) — no slot this week avoids back-to-back hard days, so let it go; the plan carries on.`, move: opts[0] ? { from: m.date, to: opts[0] } : null });
  }
  const next = week + 1;
  if (next <= P500.weeks && isDeload(next)) out.push({ level: 'info', text: `Week ${next} is a deload${P500.fullTestWeeks.includes(next) ? ' with a full simulated AFT on Saturday' : ' with event checks'}: less volume, sharper results.` });
  return out;
}

// ── ICS EXPORT (reminders through the person's own calendar) ─────────────────
export function toICS(p, fromDate, { weeks = 52 } = {}) {
  const time = /^\d{2}:\d{2}$/.test(p.prefs?.time || '') ? p.prefs.time : P500.defaultTime;
  const [hh, mm] = time.split(':');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Fitness Forge//Project 500//EN', 'CALSCALE:GREGORIAN'];
  const end = programEndDate(p);
  let n = 0;
  for (let d = fromDate; end && d <= end && n < weeks * 7; d = addDays(d, 1), n++) {
    const plan = dayPlan(p, d);
    if (!plan || plan.kind !== 'plan' || plan.tpl === 'rest') continue;
    const dt = d.replace(/-/g, '');
    const durMin = plan.tpl === 'aft' ? 120 : plan.load === 'easy' ? 40 : 60;
    const endMin = Number(hh) * 60 + Number(mm) + durMin;
    const dtEnd = `${dt}T${pad(Math.floor(endMin / 60) % 24)}${pad(endMin % 60)}00`;
    lines.push('BEGIN:VEVENT', `UID:p500-${dt}@fitness-forge`, `DTSTAMP:${dt}T000000`, `DTSTART:${dt}T${hh}${mm}00`, `DTEND:${dtEnd}`,
      `SUMMARY:P500 W${plan.week}: ${plan.name}${plan.deload ? ' (deload)' : ''}`,
      'BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', 'DESCRIPTION:Project 500 session', 'END:VALARM', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
