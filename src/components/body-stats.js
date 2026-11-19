// ═══════════════════════════════════════════
//   FITNESS FORGE — Body & Metrics
//   Bodyweight with a smoothed trend + goal,
//   measurements, and any custom metric a person
//   wants to watch — all plotted on a time axis.
// ═══════════════════════════════════════════

import {
  state, save, addBodyCheckIn, updateBodyCheckIn, deleteBodyCheckIn, setGoalWeight,
  addMetricDef, deleteMetricDef, addMetricEntry, deleteMetricEntry, weightUnitLabel, cleanText,
} from '../store.js';
import { initMetricChart } from './charts.js';
import { pageHeader, sectionHead, segGroup, toast } from './ui.js';
import { cue } from './feedback.js';

const LBS_PER_KG = 2.20462;
const DAY = 864e5;
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ── UNITS ────────────────────────────────────────────────────────────────────
// Weight is stored in lbs and measurements in inches, always; only display
// converts. Measurements follow the weight unit: someone weighing in kg wants
// their waist in cm.
const kgMode   = () => state.settings?.weightUnit === 'kg';
const wUnit    = () => weightUnitLabel();
const dispW    = (lbs) => (kgMode() ? lbs / LBS_PER_KG : lbs);
const storeW   = (v) => (kgMode() ? v * LBS_PER_KG : v);
const lenUnit  = () => (kgMode() ? 'cm' : 'in');
const dispLen  = (inch) => (kgMode() ? inch * 2.54 : inch);
const storeLen = (v) => (kgMode() ? v / 2.54 : v);

export const MEASURES = [
  ['chest', 'Chest', 'up'], ['waist', 'Waist', 'down'], ['hips', 'Hips', 'none'],
  ['leftArm', 'Left arm', 'up'], ['rightArm', 'Right arm', 'up'],
  ['leftThigh', 'Left thigh', 'up'], ['neck', 'Neck', 'none'],
];

// Quick-add templates for custom metrics.
const PRESETS = [
  { name: 'Resting heart rate', unit: 'bpm',   dir: 'down', decimals: 0 },
  { name: 'Steps',              unit: 'steps', dir: 'up',   decimals: 0 },
  { name: 'HRV',                unit: 'ms',    dir: 'up',   decimals: 0 },
  { name: 'Blood pressure (sys)', unit: 'mmHg', dir: 'down', decimals: 0 },
  { name: 'Energy',             unit: '/10',   dir: 'up',   decimals: 0 },
  { name: 'Mood',               unit: '/10',   dir: 'up',   decimals: 0 },
  { name: 'Soreness',           unit: '/10',   dir: 'down', decimals: 0 },
  { name: 'Water',              unit: 'L',     dir: 'up',   decimals: 1 },
];

const RANGES = [
  { id: '1m', label: '1M', days: 30 }, { id: '3m', label: '3M', days: 91 },
  { id: '6m', label: '6M', days: 182 }, { id: '1y', label: '1Y', days: 365 },
  { id: 'all', label: 'ALL', days: null },
];

// ── DATES ────────────────────────────────────────────────────────────────────
// A bare 'YYYY-MM-DD' (sleep, nutrition) must be read as a LOCAL date:
// Date.parse treats it as UTC midnight, which is the previous evening anywhere
// west of Greenwich and would file Tuesday's sleep under Monday.
function parseWhen(d) {
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split('-').map(Number);
    return new Date(y, m - 1, day, 12).getTime();
  }
  const t = Date.parse(d);
  return Number.isFinite(t) ? t : NaN;
}
const localKey = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const noonOf = (key) => parseWhen(key);
const todayKey = () => localKey(Date.now());

// One point per local day. Several weigh-ins on one day average; training
// volume sums. Returns ascending [{x: local-noon ms, y}].
function daily(items, agg = 'avg') {
  const by = new Map();
  for (const { t, v } of items) {
    if (!Number.isFinite(t) || !Number.isFinite(v)) continue;
    const k = localKey(t);
    const b = by.get(k) || { s: 0, n: 0 };
    b.s += v; b.n += 1; by.set(k, b);
  }
  return [...by.entries()].map(([k, b]) => ({ x: noonOf(k), y: agg === 'sum' ? b.s : b.s / b.n }))
    .sort((a, b) => a.x - b.x);
}

// ── SERIES ───────────────────────────────────────────────────────────────────
const goalLbs = () => (Number.isFinite(state.settings?.goalWeight) && state.settings.goalWeight > 0 ? state.settings.goalWeight : null);

// Which way is "better" for bodyweight: towards the goal. Judged from the
// TREND (what the goal card reports), not the last noisy scale reading — that
// flipped the colours on the day a reading dipped past a goal the trend had
// not reached. Within the "reached" tolerance neither way is better.
function weightDir(points) {
  const g = goalLbs();
  if (!g || !points.length) return 'none';
  const now = trendOf(points)[points.length - 1].y;
  const goal = dispW(g);
  if (Math.abs(goal - now) < (kgMode() ? 0.25 : 0.5)) return 'none';
  return goal < now ? 'down' : 'up';
}

// Plausible stored values (canonical lbs / % / inches) — a little wider than
// the form accepts. A restored or hand-edited save can hold anything, and one
// 1e308 "weigh-in" turned the trend into a 300-digit number and flattened the
// chart; such a value is shown as missing rather than plotted.
const okW   = (v) => Number(v) >= 20 && Number(v) <= 1500;
const okBF  = (v) => Number(v) >= 1 && Number(v) <= 80;
const okLen = (v) => Number(v) >= 1 && Number(v) <= 150;
const validWeight = (e) => e && okW(e.weight) && Number.isFinite(parseWhen(e.date));

// key → { key, name, unit, dir, decimals, points, custom? }
export function seriesFor(key) {
  if (key === 'weight') {
    const points = daily(state.bodyLog.filter(validWeight).map((e) => ({ t: parseWhen(e.date), v: dispW(Number(e.weight)) })));
    return { key, name: 'Bodyweight', unit: wUnit(), dir: weightDir(points), decimals: 1, points };
  }
  if (key === 'bodyfat') {
    return { key, name: 'Body fat', unit: '%', dir: 'down', decimals: 1,
      points: daily(state.bodyLog.filter((e) => okBF(e?.bodyFatPct)).map((e) => ({ t: parseWhen(e.date), v: Number(e.bodyFatPct) }))) };
  }
  if (key.startsWith('m:')) {
    const id = key.slice(2);
    const m = MEASURES.find(([mid]) => mid === id);
    if (!m) return null;
    return { key, name: m[1], unit: lenUnit(), dir: m[2], decimals: 1,
      points: daily(state.bodyLog.filter((e) => okLen(e?.measurements?.[id]))
        .map((e) => ({ t: parseWhen(e.date), v: dispLen(Number(e.measurements[id])) }))) };
  }
  if (key === 'sleep') {
    return { key, name: 'Sleep', unit: 'h', dir: 'up', decimals: 1,
      points: daily((state.sleepLog || []).filter((e) => Number(e?.durationHours) > 0)
        .map((e) => ({ t: parseWhen(e.date), v: Number(e.durationHours) }))) };
  }
  if (key === 'calories' || key === 'protein') {
    return { key, name: key === 'calories' ? 'Calories' : 'Protein', unit: key === 'calories' ? 'kcal' : 'g',
      dir: key === 'protein' ? 'up' : 'none', decimals: 0,
      points: daily((state.nutritionLog || []).filter((d) => Number(d?.[key]) > 0)
        .map((d) => ({ t: parseWhen(d.date), v: Number(d[key]) }))) };
  }
  if (key === 'volume') {
    return { key, name: 'Training volume', unit: wUnit(), dir: 'up', decimals: 0,
      points: daily((state.sessions || []).filter((s) => Number(s?.totalVolume) > 0)
        .map((s) => ({ t: parseWhen(s.date), v: dispW(Number(s.totalVolume)) })), 'sum') };
  }
  if (key.startsWith('c:')) {
    const id = key.slice(2);
    const d = Object.prototype.hasOwnProperty.call(state.metricDefs || {}, id) ? state.metricDefs[id] : null;
    if (!d) return null;
    return { key, name: d.name, unit: d.unit, dir: d.dir, decimals: d.decimals, custom: id,
      points: daily((state.metricLog || []).filter((e) => e.metric === id)
        .map((e) => ({ t: parseWhen(e.date), v: Number(e.value) }))) };
  }
  return null;
}

// Every series that has something to show, plus every custom metric (which
// may be empty — it was just created and is waiting for its first value).
export function seriesCatalog() {
  const keys = ['weight', 'bodyfat', ...MEASURES.map(([id]) => `m:${id}`), 'sleep', 'calories', 'protein', 'volume'];
  const builtins = keys.map(seriesFor).filter((s) => s && s.points.length);
  const custom = Object.keys(state.metricDefs || {}).map((id) => seriesFor(`c:${id}`)).filter(Boolean);
  return [...builtins, ...custom];
}

// ── MATHS ────────────────────────────────────────────────────────────────────
// Scale weight swings 1–2% day to day with water and food in the gut, so the
// number that means something is a smoothed trend. Exponential smoothing with
// a 10%-per-day weight (the Hacker's Diet method), made time-aware so a
// three-day gap counts as three days of decay rather than one.
export function trendOf(points) {
  let tr = null, prev = null;
  return points.map((p) => {
    if (tr == null) tr = p.y;
    else {
      const days = Math.max(1, (p.x - prev) / DAY);
      tr += (1 - Math.pow(0.9, days)) * (p.y - tr);
    }
    prev = p.x;
    return { x: p.x, y: tr };
  });
}

// Value of a step series at time t (last point at or before t).
function valueAt(points, t) {
  let v = null;
  for (const p of points) { if (p.x <= t) v = p.y; else break; }
  return v;
}

// Least-squares slope, per week, over the trend points in the last `days`.
// Needs a real span — two weigh-ins a day apart say nothing about a rate.
export function weeklyRate(trend, days = 28) {
  if (!trend.length) return null;
  const end = trend[trend.length - 1].x;
  const pts = trend.filter((p) => p.x >= end - days * DAY);
  if (pts.length < 3 || pts[pts.length - 1].x - pts[0].x < 6 * DAY) return null;
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p.x, 0) / n;
  const my = pts.reduce((s, p) => s + p.y, 0) / n;
  let num = 0, den = 0;
  for (const p of pts) { num += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2; }
  return den ? (num / den) * 7 * DAY : null;
}

// Pearson r over days both series have a value. n < 5 is noise, not signal.
export function correlate(a, b) {
  const bm = new Map(b.map((p) => [localKey(p.x), p.y]));
  const pairs = a.map((p) => [p.y, bm.get(localKey(p.x))]).filter(([, y]) => y != null);
  const n = pairs.length;
  if (n < 5) return { n, r: null };
  const mx = pairs.reduce((s, [x]) => s + x, 0) / n;
  const my = pairs.reduce((s, [, y]) => s + y, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of pairs) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  return { n, r: sxx && syy ? sxy / Math.sqrt(sxx * syy) : null };
}

const fmt = (v, dec = 1) => (v == null || !Number.isFinite(v) ? '—'
  : v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }));
// A change that rounds to zero at the precision shown IS zero: printing 0.004
// as "+0.0" in a good/bad colour reports a move nobody can see.
const atDec = (v, dec) => Math.round(v * 10 ** dec) / 10 ** dec;
const signed = (v, dec = 1) => {
  if (v == null || !Number.isFinite(v)) return '—';
  const r = atDec(v, dec);
  return `${r > 0 ? '+' : r < 0 ? '−' : '±'}${fmt(Math.abs(r), dec)}`;
};

// Good / bad / neutral colouring for a change, given which way is better.
function toneOf(delta, dir, dec = 1) {
  if (delta == null || !Number.isFinite(delta) || atDec(delta, dec) === 0 || dir === 'none') return 'var(--text-2)';
  return (delta < 0) === (dir === 'down') ? 'var(--green)' : 'var(--ember)';
}

function rangeDays() { return (RANGES.find((r) => r.id === state.settings?.metricsRange) || RANGES[1]).days; }
function rangeId()   { return (RANGES.find((r) => r.id === state.settings?.metricsRange) || RANGES[1]).id; }
function inRange(points) {
  const d = rangeDays();
  if (d == null) return points;
  const from = Date.now() - d * DAY;
  return points.filter((p) => p.x >= from);
}

function plotKeys() {
  const cat = seriesCatalog();
  const has = (k) => k && cat.some((s) => s.key === k);
  const want = state.settings?.metricsPlot || [];
  const primary = has(want[0]) ? want[0] : (cat[0]?.key || 'weight');
  const compare = has(want[1]) && want[1] !== primary ? want[1] : '';
  return { primary, compare, cat };
}

// ── WEIGHT SUMMARY ───────────────────────────────────────────────────────────
export function weightSummary() {
  const s = seriesFor('weight');
  const trend = trendOf(s.points);
  if (!trend.length) return { s, trend, now: null };
  const last = trend[trend.length - 1];
  const now = last.y;
  const at = (days) => {
    const t = last.x - days * DAY;
    if (s.points[0].x > t) return null;          // no data that far back
    return now - valueAt(trend, t);
  };
  const rate = weeklyRate(trend);
  const g = goalLbs() != null ? dispW(goalLbs()) : null;
  let eta = null, toGo = null, progress = null;
  if (g != null) {
    toGo = g - now;
    const start = s.points[0].y;
    if (Math.abs(start - g) > 0.05) progress = Math.max(0, Math.min(1, (start - now) / (start - g)));
    if (Math.abs(toGo) < (kgMode() ? 0.25 : 0.5)) eta = 'reached';
    else if (rate != null && Math.abs(rate) < (kgMode() ? 0.025 : 0.05)) eta = 'flat';
    else if (rate != null && Math.sign(rate) === Math.sign(toGo)) {
      // The trend is as of the last weigh-in, so the projection starts there.
      const days = (toGo / rate) * 7;
      eta = days < 3 * 365 ? new Date(last.x + days * DAY) : 'far';
    } else if (rate != null) eta = 'away';
  }
  return { s, trend, now, scale: s.points[s.points.length - 1].y, lastAt: last.x,
           d7: at(7), d30: at(30), rate, goal: g, toGo, eta, progress };
}

// ── RENDER ───────────────────────────────────────────────────────────────────
let _editId = null;        // check-in being edited
let _showAll = false;      // full history
let _addOpen = false;      // add-metric form open

export function renderBodyStats() {
  const W = weightSummary();
  const { primary, compare, cat } = plotKeys();
  return `
${pageHeader('Body & Metrics', { eyebrow: 'Body Metrics', sub: 'Bodyweight, measurements and anything else you want to watch — plotted over time' })}

<div class="g2 bs-top">
  ${_weightCardHTML(W)}
  ${_checkInCardHTML()}
</div>

${sectionHead('Chart', 'Pick a metric · compare two')}
${_chartHTML(primary, compare, cat)}

${sectionHead('Metrics', 'Tap one to plot it')}
${_metricsGridHTML(cat, primary)}

${_historyHTML()}
`;
}

function _weightCardHTML(W) {
  const u = wUnit();
  if (W.now == null) {
    const p = Number(state.profile?.weight) > 0 ? dispW(Number(state.profile.weight)) : null;
    return `
<div class="card card-fire">
  <div class="label">Trend weight</div>
  <div class="bs-big bs-dim">${p != null ? fmt(p, 1) : '—'}</div>
  <div class="muted fs12 mt8">${p != null ? `${u} · from your profile. ` : ''}Log a check-in to start the trend.</div>
  ${_goalRowHTML(W)}
</div>`;
  }
  const ago = Math.round((Date.now() - W.lastAt) / DAY);
  const when = ago <= 0 ? 'today' : ago === 1 ? 'yesterday' : `${ago} days ago`;
  const rateTxt = W.rate == null ? '—' : `${signed(W.rate, kgMode() ? 2 : 1)}`;
  return `
<div class="card card-fire">
  <div class="label">Trend weight</div>
  <div class="bs-bigrow"><span class="display bs-big">${fmt(W.now, 1)}</span><span class="bs-unit">${u}</span></div>
  <div class="muted fs12">Last weigh-in ${fmt(W.scale, 1)} ${u}, ${when}. The trend smooths out day-to-day water swings.</div>
  <div class="bs-deltas">
    <div><div class="label">7 days</div><div class="mono" style="color:${toneOf(W.d7, W.s.dir)}">${signed(W.d7)}</div></div>
    <div><div class="label">30 days</div><div class="mono" style="color:${toneOf(W.d30, W.s.dir)}">${signed(W.d30)}</div></div>
    <div><div class="label">Per week</div><div class="mono" style="color:${toneOf(W.rate, W.s.dir, kgMode() ? 2 : 1)}">${rateTxt}</div></div>
  </div>
  ${_goalRowHTML(W)}
</div>`;
}

function _goalRowHTML(W) {
  const u = wUnit();
  if (W.goal == null) {
    return `
<div class="bs-goal">
  <div class="label">Goal weight</div>
  <div class="bs-goal-form">
    <input type="number" id="bs-goal" class="form-input" inputmode="decimal" step="0.1" placeholder="${u}" aria-label="Goal weight (${u})">
    <button class="btn btn-ghost btn-sm" onclick="bsSetGoal()">Set goal</button>
  </div>
</div>`;
  }
  let etaTxt = '';
  if (W.eta === 'reached') etaTxt = '<span style="color:var(--green)">✓ Goal reached</span>';
  else if (W.eta === 'away') etaTxt = 'Trend is moving away from the goal';
  else if (W.eta === 'flat') etaTxt = 'Trend is flat — no date to project yet';
  else if (W.eta === 'far') etaTxt = 'At this pace, more than 3 years out';
  else if (W.eta instanceof Date) etaTxt = `On pace for ~${W.eta.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: W.eta.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined })}`;
  else if (W.now != null) etaTxt = 'A few more weigh-ins to estimate a date';
  return `
<div class="bs-goal">
  <div class="bs-goal-head">
    <div class="label">Goal · ${fmt(W.goal, 1)} ${u}</div>
    <button class="bs-link" onclick="bsClearGoal()" aria-label="Clear goal weight">change</button>
  </div>
  ${W.now != null ? `
  <div class="bs-bar"><i style="width:${Math.round((W.progress ?? 0) * 100)}%"></i></div>
  <div class="muted fs12">${W.eta === 'reached' ? '' : `${fmt(Math.abs(W.toGo), 1)} ${u} to go · `}${etaTxt}</div>` : ''}
</div>`;
}

function _checkInCardHTML() {
  const e = _editId != null ? state.bodyLog.find((x) => x?.id === _editId) : null;
  const val = (v, conv = (x) => x) => (v != null && v !== '' && Number(v) > 0 ? +conv(Number(v)).toFixed(1) : '');
  const date = e ? localKey(parseWhen(e.date)) : todayKey();
  const lu = lenUnit();
  const hasM = e && e.measurements && Object.keys(e.measurements).length;
  return `
<div class="card${e ? ' card--active' : ''}" id="bs-checkin">
  <div class="label" style="margin-bottom:10px">${e ? 'Edit check-in' : 'Add check-in'}</div>
  <div class="bs-form">
    <div class="bs-form-row">
      <label class="bs-field"><span class="label">Date</span>
        <input type="date" id="checkin-date" class="form-input" value="${date}" max="${todayKey()}"></label>
      <label class="bs-field"><span class="label">Weight (${wUnit()})</span>
        <input type="number" id="checkin-weight" class="form-input" inputmode="decimal" step="0.1"
          value="${val(e?.weight, dispW)}" placeholder="${(() => { const last = state.bodyLog.find((x) => Number(x?.weight) > 0); return last ? `last ${fmt(dispW(Number(last.weight)), 1)}` : (kgMode() ? 'e.g. 80.0' : 'e.g. 175.0'); })()}"></label>
    </div>
    <div class="bs-form-row">
      <label class="bs-field"><span class="label">Body fat %</span>
        <input type="number" id="checkin-bf" class="form-input" inputmode="decimal" step="0.1" value="${val(e?.bodyFatPct)}" placeholder="optional"></label>
      <label class="bs-field"><span class="label">Notes</span>
        <input type="text" id="checkin-notes" class="form-input" maxlength="200" value="${esc(e?.notes || '')}" placeholder="e.g. morning, fasted"></label>
    </div>
    <details${hasM ? ' open' : ''}>
      <summary class="label bs-summary">+ Measurements (${lu})</summary>
      <div class="measurement-grid" style="margin-top:10px">
        ${MEASURES.map(([id, label]) => `
          <label class="bs-field"><span class="label">${label}</span>
            <input type="number" id="m-${id}" class="form-input" inputmode="decimal" step="0.1"
              value="${val(e?.measurements?.[id], dispLen)}" placeholder="—"></label>`).join('')}
      </div>
    </details>
    <div class="bs-actions">
      <button class="btn btn-fire" style="flex:1" onclick="saveBodyCheckIn()">${e ? 'Update check-in' : 'Save check-in'}</button>
      ${e ? '<button class="btn btn-ghost" onclick="bsCancelEdit()">Cancel</button>' : ''}
    </div>
  </div>
</div>`;
}

function _chartHTML(primary, compare, cat) {
  if (!cat.length) {
    return `<div class="card tc bs-empty"><div class="dim fs13">Nothing to plot yet. Save a check-in above, or add a metric below.</div></div>`;
  }
  const P = seriesFor(primary);
  const opt = (k, sel) => cat.map((s) => `<option value="${s.key}"${s.key === sel ? ' selected' : ''}>${esc(s.name)}${s.unit ? ` (${esc(s.unit)})` : ''}</option>`).join('');
  const pts = inRange(P.points);
  let stats = '';
  if (pts.length) {
    const ys = pts.map((p) => p.y);
    const first = pts[0].y, last = pts[pts.length - 1].y;
    const d = P.decimals;
    stats = `
<div class="bs-stats">
  <div><span class="label">Latest</span><b class="mono">${fmt(last, d)}</b></div>
  <div><span class="label">Change</span><b class="mono" style="color:${toneOf(last - first, P.dir, d)}">${pts.length > 1 ? signed(last - first, d) : '—'}</b></div>
  <div><span class="label">Avg</span><b class="mono">${fmt(ys.reduce((a, b) => a + b, 0) / ys.length, d)}</b></div>
  <div><span class="label">Low</span><b class="mono">${fmt(Math.min(...ys), d)}</b></div>
  <div><span class="label">High</span><b class="mono">${fmt(Math.max(...ys), d)}</b></div>
  <div><span class="label">Entries</span><b class="mono">${pts.length}</b></div>
</div>`;
  }
  let corr = '';
  if (compare) {
    const C = seriesFor(compare);
    const { n, r } = correlate(inRange(P.points), inRange(C.points));
    if (r == null) corr = `<div class="bs-corr muted fs12">${n} shared day${n === 1 ? '' : 's'} in range — need 5 to compare ${esc(P.name)} with ${esc(C.name)}.</div>`;
    else {
      const a = Math.abs(+r.toFixed(2));   // judge the r we print: 0.198 shows as 0.20
      const strength = a >= 0.7 ? 'strong' : a >= 0.4 ? 'moderate' : a >= 0.2 ? 'weak' : 'no clear';
      const way = a < 0.2 ? '' : r > 0 ? ' — they tend to rise together' : ' — when one rises the other tends to fall';
      corr = `<div class="bs-corr fs12"><b class="mono">r = ${r.toFixed(2)}</b> over ${n} shared days: ${strength} relationship${way}. Correlation, not cause.</div>`;
    }
  }
  const custom = P.custom ? _logPanelHTML(P) : '';
  return `
<div class="card bs-chart-card">
  <div class="bs-controls">
    <label class="bs-field"><span class="label">Metric</span>
      <select class="form-input" id="bs-primary" onchange="bsPlot(this.value)">${opt(primary, primary)}</select></label>
    <label class="bs-field"><span class="label">Compare with</span>
      <select class="form-input" id="bs-compare" onchange="bsCompare(this.value)"><option value="">— none —</option>${opt(compare, compare).replace(`<option value="${primary}"`, `<option disabled value="${primary}"`)}</select></label>
  </div>
  ${segGroup(RANGES, rangeId(), "bsSetRange('%')")}
  ${pts.length ? `<div class="chart-wrap" style="height:260px;margin-top:12px"><canvas id="bs-chart" aria-label="${esc(P.name)} chart" role="img"></canvas></div>`
    : `<div class="bs-nodata muted fs13">No ${esc(P.name.toLowerCase())} entries in this range${P.points.length ? ' — try a longer one' : ''}.</div>`}
  ${stats}${corr}
  ${custom}
</div>`;
}

function _logPanelHTML(P) {
  const id = P.custom;
  const entries = (state.metricLog || []).filter((e) => e.metric === id).slice(0, 8);
  return `
<div class="bs-log">
  <div class="label">Log ${esc(P.name)}</div>
  <div class="bs-form-row">
    <label class="bs-field"><span class="label">Date</span><input type="date" id="bs-mdate" class="form-input" value="${todayKey()}" max="${todayKey()}"></label>
    <label class="bs-field"><span class="label">Value${P.unit ? ` (${esc(P.unit)})` : ''}</span>
      <input type="number" id="bs-mval" class="form-input" inputmode="decimal" step="any" placeholder="0" onkeydown="if(event.key==='Enter')bsLogMetric('${id}')"></label>
    <button class="btn btn-fire bs-logbtn" onclick="bsLogMetric('${id}')">Log</button>
  </div>
  ${entries.length ? `<div class="bs-entries">${entries.map((e) => `
    <div class="bs-entry"><span class="mono muted fs12">${new Date(parseWhen(e.date)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
      <span class="mono">${fmt(e.value, P.decimals)} ${esc(P.unit)}</span>
      <button class="bs-x" onclick="bsDeleteMetricEntry(${e.id})" aria-label="Delete entry">✕</button></div>`).join('')}</div>` : ''}
  <button class="btn btn-danger btn-sm" style="margin-top:10px" onclick="bsDeleteMetric('${id}')">Delete metric</button>
</div>`;
}

function _spark(points, color) {
  const pts = points.slice(-40);
  if (pts.length < 2) return '<svg class="bs-spark" viewBox="0 0 100 28"></svg>';
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const sx = (x) => (x1 === x0 ? 50 : ((x - x0) / (x1 - x0)) * 100);
  const sy = (y) => (y1 === y0 ? 14 : 26 - ((y - y0) / (y1 - y0)) * 24);
  return `<svg class="bs-spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">
    <polyline fill="none" stroke="${color}" stroke-width="1.5" vector-effect="non-scaling-stroke" points="${pts.map((p) => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ')}"/></svg>`;
}

function _metricsGridHTML(cat, primary) {
  const cards = cat.map((s) => {
    const pts = inRange(s.points);
    const last = s.points.length ? s.points[s.points.length - 1].y : null;
    const delta = pts.length > 1 ? pts[pts.length - 1].y - pts[0].y : null;
    const on = s.key === primary ? ' is-on' : '';
    return `
<button class="bs-metric${on}" onclick="bsPlot('${s.key}')" aria-pressed="${!!on}">
  <span class="bs-metric-head"><span class="label">${esc(s.name)}</span>${s.custom ? '<span class="tag t-fire bs-tag">custom</span>' : ''}</span>
  <span class="bs-metric-val"><b class="mono">${fmt(last, s.decimals)}</b> <span class="muted fs11">${esc(s.unit)}</span></span>
  <span class="mono fs11" style="color:${toneOf(delta, s.dir, s.decimals)}">${delta != null ? `${signed(delta, s.decimals)} in range`
    : pts.length ? '1 entry in range' : s.points.length ? 'None in range' : 'No entries yet'}</span>
  ${_spark(pts, s.key === primary ? 'var(--fire)' : 'var(--steel)')}
</button>`;
  }).join('');
  return `<div class="bs-metrics">${cards}
  <button class="bs-metric bs-add" onclick="bsToggleAdd()" aria-expanded="${_addOpen}"><span class="bs-add-plus">＋</span><span class="label">Add metric</span>
    <span class="muted fs11">Resting HR, steps, HRV, mood…</span></button>
</div>
${_addOpen ? _addMetricHTML() : ''}`;
}

function _addMetricHTML() {
  const have = new Set(Object.values(state.metricDefs || {}).map((d) => d.name.toLowerCase()));
  return `
<div class="card bs-addform" id="bs-addform">
  <div class="label" style="margin-bottom:8px">Quick add</div>
  <div class="seg">${PRESETS.map((p, i) => have.has(p.name.toLowerCase()) ? ''
    : `<button class="seg-btn" onclick="bsAddPreset(${i})">${esc(p.name)}</button>`).join('')}</div>
  <div class="label" style="margin:16px 0 8px">Or make your own</div>
  <div class="bs-form-row">
    <label class="bs-field"><span class="label">Name</span><input type="text" id="bs-mname" class="form-input" maxlength="40" placeholder="e.g. Grip strength"></label>
    <label class="bs-field"><span class="label">Unit</span><input type="text" id="bs-munit" class="form-input" maxlength="12" placeholder="e.g. kg"></label>
    <label class="bs-field"><span class="label">Better when</span>
      <select id="bs-mdir" class="form-input"><option value="up">Higher</option><option value="down">Lower</option><option value="none">Neither</option></select></label>
  </div>
  <div class="bs-actions"><button class="btn btn-fire" onclick="bsAddMetric()">Create metric</button>
    <button class="btn btn-ghost" onclick="bsToggleAdd()">Cancel</button></div>
</div>`;
}

function _historyHTML() {
  const log = state.bodyLog.filter((e) => e && Number.isFinite(parseWhen(e.date)));
  if (!log.length) return '';
  const used = MEASURES.filter(([id]) => log.some((e) => okLen(e.measurements?.[id])));
  const rows = _showAll ? log : log.slice(0, 15);
  const lu = lenUnit();
  return `
${sectionHead('Check-in history', `${log.length} entr${log.length === 1 ? 'y' : 'ies'}`)}
<div class="card bs-hist">
  <table class="tbl w100">
    <thead><tr><th>Date</th><th>Weight</th><th>BF%</th>${used.map(([, l]) => `<th>${l}</th>`).join('')}<th>Notes</th><th></th></tr></thead>
    <tbody>${rows.map((e) => `
      <tr${e.id === _editId ? ' class="is-editing"' : ''}>
        <td class="mono muted fs11">${new Date(parseWhen(e.date)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</td>
        <td class="mono fire">${okW(e.weight) ? fmt(dispW(Number(e.weight)), 1) : '—'}</td>
        <td class="mono muted fs11">${okBF(e.bodyFatPct) ? fmt(Number(e.bodyFatPct), 1) : '—'}</td>
        ${used.map(([id]) => `<td class="mono muted fs11">${okLen(e.measurements?.[id]) ? fmt(dispLen(Number(e.measurements[id])), 1) + lu : '—'}</td>`).join('')}
        <td class="muted fs11 bs-note">${esc(e.notes || '')}</td>
        <td class="bs-rowbtns"><button class="bs-x" onclick="bsEditCheckIn(${Number(e.id)})" aria-label="Edit check-in">✎</button><button class="bs-x" onclick="bsDeleteCheckIn(${Number(e.id)})" aria-label="Delete check-in">✕</button></td>
      </tr>`).join('')}
    </tbody>
  </table>
  ${log.length > 15 ? `<button class="btn btn-ghost btn-sm" style="margin-top:12px" onclick="bsToggleHistory()">${_showAll ? 'Show fewer' : `Show all ${log.length}`}</button>` : ''}
</div>`;
}

// ── CHART DRAWING ────────────────────────────────────────────────────────────
function _drawSeries(canvasId, primaryKey, compareKey, { range = true } = {}) {
  const P = seriesFor(primaryKey);
  if (!P) return;
  const pick = range ? inRange : (x) => x;
  const datasets = [];
  let pts = pick(P.points);
  if (!pts.length) return;
  if (primaryKey === 'weight') {
    // Trend over the FULL history, then clipped — smoothing restarted at the
    // range edge would snap to whatever that day's reading happened to be.
    const tr = pick(trendOf(P.points));
    datasets.push({ label: 'Scale', points: pts, color: '--fire', kind: 'raw', unit: P.unit, decimals: 1 });
    datasets.push({ label: 'Trend', points: tr, color: '--fire', kind: 'trend', unit: P.unit, decimals: 1 });
  } else {
    datasets.push({ label: P.name, points: pts, color: '--fire', kind: 'line', unit: P.unit, decimals: P.decimals });
  }
  let xMin = pts[0].x, xMax = pts[pts.length - 1].x;
  const d = range ? rangeDays() : null;
  if (d != null) { xMin = Math.min(xMin, Date.now() - d * DAY); xMax = Math.max(xMax, Date.now()); }
  if (xMax - xMin < DAY) { xMin -= DAY; xMax += DAY; }
  if (primaryKey === 'weight' && goalLbs() != null) {
    const g = dispW(goalLbs());
    datasets.push({ label: 'Goal', points: [{ x: xMin, y: g }, { x: xMax, y: g }], color: '--green', kind: 'goal', unit: P.unit, decimals: 1 });
  }
  if (compareKey) {
    const C = seriesFor(compareKey);
    const cp = C ? pick(compareKey === 'weight' ? trendOf(C.points) : C.points) : [];
    if (cp.length) datasets.push({ label: C.name, points: cp, color: _compareColor(), kind: 'line', axis: 'y2', unit: C.unit, decimals: C.decimals });
  }
  initMetricChart(canvasId, { datasets, xMin, xMax });
}

// The compared series must not wear the primary's colour. Some themes alias
// tokens (instrument sets --steel to its --fire cyan), which drew both lines
// identically and made a two-series chart unreadable.
function _compareColor() {
  const cv = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim().toLowerCase();
  // …nor the goal line's (steel sets --steel to its --green).
  const taken = new Set([cv('--fire'), cv('--green')]);
  return ['--steel', '--ember', '--text-2'].find((t) => cv(t) && !taken.has(cv(t))) || '--text-2';
}

// Used by Analytics for its bodyweight panel.
export function drawWeightChart(canvasId) { _drawSeries(canvasId, 'weight', '', { range: false }); }

export function scheduleBodyCharts() {
  setTimeout(() => {
    const { primary, compare } = plotKeys();
    if (document.getElementById('bs-chart')) _drawSeries('bs-chart', primary, compare);
  }, 0);
}

function refreshBodyPage() {
  const el = document.getElementById('page-body');
  if (!el) return;
  el.innerHTML = renderBodyStats();
  scheduleBodyCharts();
}

// ── HANDLERS ─────────────────────────────────────────────────────────────────
function _bad(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.classList.remove('input-error'); void el.offsetWidth; el.classList.add('input-error'); el.focus(); }
  cue('error');
  toast(msg, { type: 'danger' });
  return false;
}
const _num = (id) => { const v = document.getElementById(id)?.value; return v === '' || v == null ? null : parseFloat(v); };

function _dateFrom(id) {
  const key = document.getElementById(id)?.value || todayKey();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !Number.isFinite(parseWhen(key))) return null;
  if (key > todayKey()) return 'future';
  // Today keeps the real time of day; a back-dated entry is filed at local noon
  // so no timezone can push it onto a neighbouring day.
  return key === todayKey() ? new Date().toISOString() : new Date(parseWhen(key)).toISOString();
}

window.saveBodyCheckIn = () => {
  const date = _dateFrom('checkin-date');
  if (!date) return _bad('checkin-date', 'Pick a valid date');
  if (date === 'future') return _bad('checkin-date', 'A check-in can’t be in the future');
  const wIn = _num('checkin-weight');
  const bf = _num('checkin-bf');
  // Editing shows stored values rounded to one decimal in the display unit.
  // Saving an untouched field must keep the stored number, not the rounded
  // display one converted back — or every edit in kg/cm nudged the check-in
  // (182.5 lbs → 182.54, 42 in → 42.01) without the person changing anything.
  const prev = _editId != null ? state.bodyLog.find((x) => x?.id === _editId) : null;
  const shown = (stored, conv) => (Number(stored) > 0 ? +conv(Number(stored)).toFixed(1) : null);
  const measurements = {};
  for (const [id, label] of MEASURES) {
    const v = _num(`m-${id}`);
    if (v == null) continue;
    if (prev && v === shown(prev.measurements?.[id], dispLen)) { measurements[id] = Number(prev.measurements[id]); continue; }
    const inch = storeLen(v);
    if (!Number.isFinite(inch) || inch < 2 || inch > 100) return _bad(`m-${id}`, `${label} looks off — check the number (${lenUnit()})`);
    measurements[id] = Math.round(inch * 100) / 100;
  }
  let weight = null;
  if (wIn != null) {
    const lbs = storeW(wIn);
    if (!Number.isFinite(lbs) || lbs < 50 || lbs > 1000) {
      return _bad('checkin-weight', kgMode() ? 'Weight should be between 23 and 450 kg' : 'Weight should be between 50 and 1000 lbs');
    }
    weight = prev && wIn === shown(prev.weight, dispW) ? Number(prev.weight) : Math.round(lbs * 100) / 100;
  }
  if (bf != null && (!Number.isFinite(bf) || bf < 2 || bf > 75)) return _bad('checkin-bf', 'Body fat should be between 2 and 75%');
  if (weight == null && bf == null && !Object.keys(measurements).length) {
    return _bad('checkin-weight', 'Enter a weight, body fat or at least one measurement');
  }
  const notes = (document.getElementById('checkin-notes')?.value || '').trim();
  const entry = { date, weight, bodyFatPct: bf ?? null, measurements, notes };
  let ok;
  if (_editId != null) {
    // Keep the original time of day when the date was not changed.
    if (prev && localKey(parseWhen(prev.date)) === localKey(parseWhen(date))) entry.date = prev.date;
    ok = updateBodyCheckIn(_editId, entry);
    _editId = null;
  } else ok = addBodyCheckIn(entry);
  cue('select');
  toast(ok === false ? '⚠ Not saved — storage is unavailable' : '✓ Check-in saved', { type: ok === false ? 'danger' : 'green' });
  refreshBodyPage();
};

window.bsEditCheckIn = (id) => {
  _editId = id;
  refreshBodyPage();
  document.getElementById('bs-checkin')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
};
window.bsCancelEdit = () => { _editId = null; refreshBodyPage(); };
window.bsDeleteCheckIn = (id) => {
  const e = state.bodyLog.find((x) => x?.id === id);
  if (!e) return;
  const d = new Date(parseWhen(e.date)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (!confirm(`Delete the ${d} check-in?`)) return;
  if (_editId === id) _editId = null;
  deleteBodyCheckIn(id);
  toast('Check-in deleted');
  refreshBodyPage();
};
window.bsToggleHistory = () => { _showAll = !_showAll; refreshBodyPage(); };

window.bsSetGoal = () => {
  const v = _num('bs-goal');
  const lbs = v == null ? NaN : storeW(v);
  if (!Number.isFinite(lbs) || lbs < 50 || lbs > 1000) return _bad('bs-goal', 'Enter a goal weight in ' + wUnit());
  setGoalWeight(lbs);
  cue('select');
  refreshBodyPage();
};
window.bsClearGoal = () => { setGoalWeight(null); refreshBodyPage(); setTimeout(() => document.getElementById('bs-goal')?.focus(), 0); };

window.bsSetRange = (r) => {
  if (!RANGES.some((x) => x.id === r)) return;
  state.settings.metricsRange = r; save(); refreshBodyPage();
};
window.bsPlot = (key) => {
  if (!seriesFor(String(key))) return;
  const cur = plotKeys();
  state.settings.metricsPlot = [key, cur.compare === key ? '' : cur.compare];
  save(); refreshBodyPage();
  cue('select');
};
window.bsCompare = (key) => {
  const cur = plotKeys();
  state.settings.metricsPlot = [cur.primary, key && seriesFor(String(key)) ? key : ''];
  save(); refreshBodyPage();
};

window.bsToggleAdd = () => {
  _addOpen = !_addOpen; refreshBodyPage();
  if (_addOpen) document.getElementById('bs-addform')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};
function _created(id) {
  if (!id) return;
  _addOpen = false;
  state.settings.metricsPlot = [`c:${id}`, ''];
  save();
  refreshBodyPage();
  toast(`✓ ${state.metricDefs[id].name} added — log your first value`, { type: 'green' });
  setTimeout(() => { const el = document.getElementById('bs-mval'); el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); el?.focus(); }, 50);
}
window.bsAddPreset = (i) => {
  const p = PRESETS[i];
  if (!p || Object.values(state.metricDefs).some((d) => d.name.toLowerCase() === p.name.toLowerCase())) return;
  _created(addMetricDef(p));
};
window.bsAddMetric = () => {
  const name = (document.getElementById('bs-mname')?.value || '').trim();
  if (!name) return _bad('bs-mname', 'Give the metric a name');
  // Compare the name as it will be STORED: cleaning turns " into ″, so a raw
  // comparison let the same name be created twice.
  const key = cleanText(name, 40).toLowerCase();
  if (Object.values(state.metricDefs).some((d) => d.name.toLowerCase() === key)) return _bad('bs-mname', 'You already track a metric with that name');
  _created(addMetricDef({ name, unit: (document.getElementById('bs-munit')?.value || '').trim(),
    dir: document.getElementById('bs-mdir')?.value || 'none', decimals: 1 }));
};
window.bsLogMetric = (id) => {
  const v = _num('bs-mval');
  if (v == null || !Number.isFinite(v) || Math.abs(v) >= 1e7) return _bad('bs-mval', 'Enter a number');
  const date = _dateFrom('bs-mdate');
  if (!date) return _bad('bs-mdate', 'Pick a valid date');
  if (date === 'future') return _bad('bs-mdate', 'That date is in the future');
  const ok = addMetricEntry(id, v, date);
  cue('select');
  toast(ok ? '✓ Logged' : '⚠ Not saved', { type: ok ? 'green' : 'danger' });
  refreshBodyPage();
  setTimeout(() => document.getElementById('bs-mval')?.focus(), 0);
};
window.bsDeleteMetricEntry = (id) => { deleteMetricEntry(id); refreshBodyPage(); };
window.bsDeleteMetric = (id) => {
  const d = state.metricDefs[id];
  if (!d) return;
  const n = state.metricLog.filter((e) => e.metric === id).length;
  if (!confirm(`Delete “${d.name}”${n ? ` and its ${n} logged value${n === 1 ? '' : 's'}` : ''}? This can’t be undone.`)) return;
  deleteMetricDef(id);
  state.settings.metricsPlot = ['weight', ''];
  save();
  refreshBodyPage();
};
