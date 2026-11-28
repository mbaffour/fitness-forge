// ═══════════════════════════════════════════
//   FITNESS FORGE — Project 500 (Train → Project 500)
// ═══════════════════════════════════════════
//
// A 52-week Army Fitness Test program built on the app's existing pieces: the
// live logger runs every strength block (with the prescription shown beside
// each lift), runs go into the Cardio log, swims and soccer into Activity,
// weight and waist into Body & Metrics, resting HR into a custom metric. What
// Project 500 keeps for itself is what nothing else holds: the schedule,
// test results, readiness check-ins and a compact log of prescribed-vs-done —
// compact because the app's per-set history keeps 200 sessions and a year of
// this program is ~260.
//
// All maths lives in engine/project500.js (unit-tested); this file renders it.

import { state, save, formatWeight, toStoredWeight, toDisplayWeight, weightUnitLabel, weightInputStep,
         addCardioEntry, addActivityEntry, addBodyCheckIn, addMetricDef, addMetricEntry, localDateStr,
         distUnitLabel, toStoredDist, toDisplayDist } from '../store.js';
import * as E from '../engine/project500.js';
import { P500, DAY_TEMPLATES, CFT, RUN_LEVELS } from '../data/project500.js';
import { AFT, bandForAge, scoreTest, scoreEvent, validateRows, eventDef } from '../data/aft-standards.js';
import { EXERCISES } from '../data/exercises.js';
import { suggestNextSet } from '../engine/overload.js';
import { programProfile } from './program-coach.js';
import { pageHeader, sectionHead, segGroup, toast } from './ui.js';
import { exThumbHTML } from './modal.js';
import { insigniaSVG, medalSVG } from './achievements.js';
import { cue, fxBurst, countUp } from './feedback.js';
import { initMetricChart } from './charts.js';

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const P = () => state.p500;
const today = () => localDateStr();
const fmtDate = (d, o = { weekday: 'short', month: 'short', day: 'numeric' }) => (E.isYMD(d) ? E.parseYMD(d).toLocaleDateString('en-US', o) : '—');
const EV_ICON = { mdl: '🏋', hrp: '💪', sdc: '🏃', plk: '🧱', tmr: '⏱' };

let _tab = 'overview';
let _day = null;            // date shown on the Today tab
let _reviewWeek = null;
let _chartEv = 'tmr';
let _testKind = 'check';
let _testPick = null;       // events pre-selected from a test day

function rerender() { window.refreshCurrentPage?.(); }

// ── UNITS ────────────────────────────────────────────────────────────────────
function fmtEvent(id, raw) {
  if (raw == null) return '—';
  if (id === 'mdl') return formatWeight(raw);
  if (id === 'hrp') return `${raw} reps`;
  return E.fmtTime(raw);
}
function parseEvent(id, v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  if (id === 'mdl') { const n = Number(s); return n > 0 ? Math.round(toStoredWeight(n) * 10) / 10 : NaN; }
  if (id === 'hrp') { const n = Number(s); return Number.isInteger(n) && n >= 0 && n <= 300 ? n : NaN; }
  const t = E.parseTime(s);
  return t == null ? NaN : t;
}
const inputVal = (id, raw) => (raw == null ? '' : id === 'mdl' ? toDisplayWeight(raw) : id === 'hrp' ? raw : E.fmtTime(raw));

// ── SCORING CONTEXT ──────────────────────────────────────────────────────────
const activeTable = (p = P()) => E.activeTable(p);
const catLabel = (p) => (p.standard.band && (p.standard.std === 'combat' || p.standard.sex)
  ? `${p.standard.std} · ${p.standard.std === 'combat' ? 'sex-neutral' : p.standard.sex} · ${p.standard.band}` : null);
function scoreOf(results, p = P()) { return scoreTest(results, activeTable(p).table, p.standard.std); }

// ── LOG HOOK: sessions saved by the live logger ──────────────────────────────
window.addEventListener('forge:session-saved', (e) => {
  const s = e.detail?.session;
  const p = P();
  if (!s?.p500 || !p || !E.isYMD(s.p500.date)) return;
  const { date, tpl, week } = s.p500;
  const working = (s.exercises || []).flatMap((x) => (x.sets || []).filter((st) => st.completed && !st.warmup));
  p.log.push({ date, block: s.workoutType === 'mobility' ? 'any' : 'lift', tpl: DAY_TEMPLATES[tpl] ? tpl : null, week, at: s.date, ref: s.id,
    prescribed: (s.exercises || []).map((x) => ({ exId: x.exId, sets: x.prescribed?.sets ?? x.targetSets, reps: x.prescribed?.reps ?? x.targetReps, weight: x.prescribed?.weight ?? null, sub: !!x.prescribed?.sub })),
    actual: { sets: working.length, volume: Math.round(s.totalVolume || 0), min: s.durationMinutes || 0 } });
  // Monday's heavy deadlift drives the working weight.
  const dl = (s.exercises || []).find((x) => x.exId === 'trap_dl' || x.exId === 'deadlift');
  if (tpl === 'lower' && dl) {
    const plan = E.dayPlan(p, date) || {};
    const lift = (p.lifts.trap_dl = p.lifts.trap_dl || { work: null, hist: [] });
    lift.hist = lift.hist || [];
    const ready = (p.readiness || []).find((r) => r.date === date);
    const rs = E.readinessScore(ready);
    const sets = (dl.sets || []).filter((st) => st.completed && !st.warmup);
    if (!lift.work) {
      const reps = Number(dl.prescribed?.reps) || 5;
      const top = Math.max(0, ...sets.filter((st) => Number(st.reps) >= reps).map((st) => Number(st.weight) || 0));
      if (top > 0) { lift.hist.push({ date, from: null, to: top, change: 0, reason: 'First logged working weight — the program builds from here.' }); lift.work = top; }
    } else {
      const r = E.progressDeadlift({ work: lift.work, prescribedSets: dl.prescribed?.sets || dl.targetSets, targetReps: dl.prescribed?.reps || 5, sets,
        plan, flags: { pain: !!ready?.pain, ill: !!ready?.ill, poorRecovery: rs?.level === 'red' } });
      lift.hist.push({ date, from: lift.work, to: r.next, change: r.change, reason: r.reason });
      lift.work = r.next;
      setTimeout(() => toast(`Deadlift ${r.change > 0 ? `+${r.change} lb` : r.change < 0 ? `${r.change} lb` : 'held'} — next heavy day ${r.next} lb`, { type: r.change >= 0 ? 'green' : 'fire', ms: 5000 }), 1800);
    }
  }
  save();
});

// ── PAGE ─────────────────────────────────────────────────────────────────────
export function renderProject500() {
  const p = P();
  const tabs = [{ id: 'overview', label: 'Overview' }, { id: 'today', label: 'Today' }, { id: 'calendar', label: 'Calendar' },
                { id: 'tests', label: 'Tests' }, { id: 'review', label: 'Review' }, { id: 'setup', label: 'Setup' }];
  if (!p || p.status === 'setup') {
    return `${pageHeader('Project 500', { eyebrow: 'Train · 52-week military readiness', sub: 'A year-long plan toward a 500/500 Army Fitness Test — built around a real schedule' })}
${introHTML()}${setupHTML(true)}`;
  }
  const body = { overview: overviewHTML, today: todayHTML, calendar: calendarHTML, tests: testsHTML, review: reviewHTML, setup: () => setupHTML(false) }[_tab] || overviewHTML;
  return `${pageHeader('Project 500', { eyebrow: 'Train · 52-week military readiness', sub: headerSub(p) })}
<div class="p5-tabs">${segGroup(tabs, _tab, "p5Tab('%')")}</div>
<div class="p5-body">${body()}</div>`;
}
window.p5Tab = (t) => { _tab = t; rerender(); document.querySelector('.p5-tabs')?.scrollIntoView?.({ block: 'nearest' }); };

function headerSub(p) {
  const wi = E.weekInfo(p, today());
  if (p.status === 'paused') return 'Paused — the schedule waits for you';
  if (wi?.pre) return `Starts ${fmtDate(p.startDate)} — ${E.daysBetween(today(), p.startDate)} day${E.daysBetween(today(), p.startDate) === 1 ? '' : 's'} to go`;
  if (wi?.done) return 'Program complete';
  if (!wi?.week) return 'Paused this week';
  const ph = P500.phases[wi.phase - 1];
  return `Week ${wi.week} of 52 · Phase ${ph.n}: ${ph.name}${wi.deload ? ' · deload' : ''}${wi.ret ? ' · return week' : ''}`;
}

function introHTML() {
  return `
<div class="card p5-intro">
  <div class="p5-intro-grid">
    ${P500.phases.map((ph) => `<div class="p5-phase-chip"><span class="label">Phase ${ph.n} · weeks ${ph.weeks[0]}–${ph.weeks[1]}</span><b>${esc(ph.name)}</b><span class="mono fire">${ph.score}${ph.n === 4 ? '' : '+'}</span><span class="muted fs11">${esc(ph.focus)}</span></div>`).join('')}
  </div>
  <p class="muted fs12">Five training days, an active-recovery day and a rest day each week. A deload every fourth week, event checks in deload weeks, and a full simulated AFT every twelve. Loads, paces and holds come from <b>your</b> results, not the calendar.</p>
</div>`;
}

// ── OVERVIEW ─────────────────────────────────────────────────────────────────
function ring(pct, label, sub, { size = 132, cls = '' } = {}) {
  const r = size / 2 - 8, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, pct || 0));
  return `<div class="p5-ring ${cls}" style="width:${size}px;height:${size}px">
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="gm-ring-track" stroke-width="8"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="gm-ring-fill" stroke-width="8" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - f)).toFixed(1)}" style="--c:${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    </svg>
    <div class="p5-ring-in"><b class="mono">${label}</b><span class="label">${sub}</span></div>
  </div>`;
}

function currentScore(p) {
  const latest = E.latestResults(p);
  const results = Object.fromEntries(Object.entries(latest).map(([k, v]) => [k, { raw: v.raw }]));
  return { results, sc: scoreOf(results, p), latest };
}

function overviewHTML() {
  const p = P(), t = today();
  const wi = E.weekInfo(p, t) || {};
  const week = wi.week || 0;
  const { sc, latest } = currentScore(p);
  const obj = E.objectivesMet(p);
  const end = E.programEndDate(p);
  const daysLeft = end ? Math.max(0, E.daysBetween(t, end)) : null;
  const phase = P500.phases[(wi.phase || 1) - 1];
  const rv = week ? E.weekReview(p, week, t, ctx()) : null;
  const doneAll = p.log.length;
  const R = E.serviceRecord(p, t);
  return `
${serviceHTML(p, R, rv)}
<div class="card p5-hero">
  ${sc.total != null ? ring(sc.total / 500, sc.total, '/ 500 AFT') : ring(obj / 20, `${obj}/20`, 'objectives')}
  <div class="p5-hero-mid">
    <div class="label">${wi.pre ? 'Starts' : wi.done ? 'Complete' : `Week ${week} of 52`}</div>
    <div class="p5-hero-title">${wi.pre ? fmtDate(p.startDate, { weekday: 'long', month: 'long', day: 'numeric' }) : `Phase ${phase.n} · ${esc(phase.name)}`}</div>
    <div class="gm-bar gm-bar-anim"><i style="width:${Math.min(100, (week / 52) * 100).toFixed(1)}%"></i></div>
    <div class="p5-hero-meta muted fs12"><span>${daysLeft != null ? `${daysLeft} days remaining` : ''}</span><span>Target this phase: <b class="fire">${phase.score}${phase.n < 4 ? '+' : ''}</b></span></div>
  </div>
  <div class="p5-hero-stats">
    <div><span class="label">This week</span><b class="mono">${rv ? `${rv.completed}/${rv.scheduled}` : '—'}</b></div>
    <div><span class="label">AFT score</span><b class="mono">${sc.total != null ? sc.total : '—'}</b></div>
    <div><span class="label">Objectives</span><b class="mono">${obj}/20</b></div>
    <div><span class="label">Sessions</span><b class="mono">${doneAll}</b></div>
  </div>
</div>
${sc.total == null ? `<div class="p5-note">${catLabel(p) ? `AFT points need the official scoring table for your category (${esc(catLabel(p))}). <button class="p5-link" onclick="p5Tab('tests')">Load it on Tests →</button>` : `Pick your scoring category on <button class="p5-link" onclick="p5Tab('tests')">Tests</button> to score results.`} ${Object.values(E.targetsFor(p)).some(Boolean) ? 'Until then, progress is shown against your targets.' : `<button class="p5-link" onclick="p5Tab('setup')">Set your targets</button> to unlock phase milestones and objectives.`}</div>` : ''}
${todayCardHTML(true)}
${rv ? weekStripHTML(rv) : ''}
${sectionHead('The five events', 'Official AFT order')}
<div class="p5-events">${AFT.events.map((ev) => eventCardHTML(p, ev, latest)).join('')}</div>
${sectionHead('Progress vs plan', 'Actual results against the phase milestones')}
<div class="card">
  <div class="p5-chart-pick">${segGroup(AFT.events.map((ev) => ({ id: ev.id, label: ev.short })), _chartEv, "p5Chart('%')")}</div>
  <div class="chart-wrap" style="height:240px"><canvas id="p5-chart" aria-label="Actual results versus projected milestones"></canvas></div>
  <div class="muted fs11 p5-chart-note">Dashed: the milestone path (baseline → end of each phase). Solid: your tests and event checks.</div>
</div>
${sectionHead('Objectives', 'Five per phase — earned by real results')}
${objectivesHTML(p)}
${sectionHead('Service record', `${R.name} · ${R.points} pts`)}
${ladderHTML(R)}
<div class="g2 p5-two">
  <div>${sectionHead('Upcoming tests')}${upcomingHTML(p, t)}</div>
  <div>${sectionHead('Recovery + adjustments')}${recoveryHTML(p, t, rv)}</div>
</div>
${sectionHead('Personal bests')}
${bestsHTML(p)}`;
}
window.p5Chart = (id) => { _chartEv = id; rerender(); };

function ctx() {
  return { sessions: state.sessions, cardio: state.cardioLog, activity: state.activityLog, sleep: state.sleepLog, prs: state.prs };
}

const STATUS_LABEL = { done: 'Done', partial: 'Part done', missed: 'Missed', today: 'Today', upcoming: 'Upcoming', rest: 'Rest', moved: 'Moved', paused: 'Paused' };
function weekStripHTML(rv) {
  return `<div class="p5-strip" role="list" aria-label="This week">${rv.days.map((d) => {
    const pl = d.plan || {};
    const st = pl.kind === 'moved' ? 'moved' : d.status;
    const tag = pl.test ? 'test' : pl.deload ? 'deload' : '';
    return `<button class="p5-day is-${st} ${tag ? `is-${tag}` : ''} ${pl.date === today() ? 'is-now' : ''}" role="listitem" onclick="p5Open('${pl.date}')" aria-label="${esc(fmtDate(pl.date))}: ${esc(pl.name || st)} — ${STATUS_LABEL[st] || st}">
      <span class="label">${fmtDate(pl.date, { weekday: 'short' })}</span><span class="p5-day-ic">${pl.icon || '·'}</span><span class="fs10">${STATUS_LABEL[st] || ''}</span></button>`;
  }).join('')}</div>`;
}
window.p5Open = (d) => { if (!E.isYMD(d)) return; _day = d; _tab = 'today'; rerender(); };

function trendSVG(p, id) {
  const pts = [];
  if (p.baseline?.[id] > 0 && !p.baseline.sub?.[id]) pts.push([p.baseline.date, p.baseline[id]]);
  for (const t of [...p.tests].sort((a, b) => (a.date < b.date ? -1 : 1))) { const r = t.events?.[id]; if (r && !r.sub) pts.push([t.date, r.raw]); }
  if (pts.length < 2) return '<span class="muted fs10">Trend appears after two results</span>';
  const lower = id === 'sdc' || id === 'tmr';
  const vs = pts.map((x) => (lower ? -x[1] : x[1]));
  const lo = Math.min(...vs), hi = Math.max(...vs), span = hi - lo || 1;
  const W = 120, H = 30;
  const xy = vs.map((v, i) => `${((i / (vs.length - 1)) * W).toFixed(1)},${(H - 3 - ((v - lo) / span) * (H - 6)).toFixed(1)}`);
  return `<svg class="p5-spark" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><polyline points="${xy.join(' ')}" fill="none" stroke="var(--fire)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${xy.at(-1).split(',')[0]}" cy="${xy.at(-1).split(',')[1]}" r="2.8" fill="var(--fire)"/></svg>`;
}

function eventCardHTML(p, ev, latest) {
  const cur = latest[ev.id]?.raw ?? null;
  const base = p.baseline?.[ev.id] && !p.baseline.sub?.[ev.id] ? p.baseline[ev.id] : null;
  const target = E.targetsFor(p)[ev.id];
  const wi = E.weekInfo(p, today()) || {};
  const ms = E.milestonesFor(p)[(wi.phase || 1) - 1][ev.id];
  const tier = E.eventTiers(p)[ev.id];
  const pts = cur != null ? scoreEvent(ev.id, cur, activeTable(p).table) : null;
  const prog = E.progressTo(ev.id, base, cur, target);
  const lower = ev.id === 'sdc' || ev.id === 'tmr';
  const imp = cur != null && base != null ? (lower ? base - cur : cur - base) : null;
  const met = E.meets(ev.id, cur, ms);
  const tq = ev.id === 'tmr' && cur ? E.twoMileEquivalents(cur) : null;
  return `
<div class="card p5-ev ${E.meets(ev.id, cur, target) ? 'is-maxed' : ''}">
  <div class="p5-ev-head"><span class="p5-ev-ic" aria-hidden="true" title="${E.TIER_NAMES[tier.tier]} tier">${tier.tier ? medalSVG({ tier: tier.tier, icon: EV_ICON[ev.id] }, { size: 30 }) : EV_ICON[ev.id]}</span><div><div class="label">${ev.order} · ${esc(ev.short)}</div><div class="p5-ev-cur mono">${fmtEvent(ev.id, cur)}</div></div>
    <div class="p5-ev-pts">${pts != null ? `<b class="mono">${pts}</b><span class="label">pts</span>` : ''}</div></div>
  ${tq ? `<div class="muted fs11 mono">${E.fmtTime(tq.pace)}/mi · ${tq.mph} mph on a treadmill</div>` : ''}
  <div class="gm-bar gm-bar-sm"><i style="width:${((prog || 0) * 100).toFixed(1)}%"></i></div>
  <div class="p5-ev-grid fs11">
    <span class="muted">Baseline</span><span class="mono">${fmtEvent(ev.id, base)}</span>
    <span class="muted">Phase goal</span><span class="mono ${met ? 'p5-ok' : ''}">${fmtEvent(ev.id, ms)}${met ? ' ✓' : ''}</span>
    <span class="muted">Final target</span><span class="mono">${fmtEvent(ev.id, target)}</span>
    <span class="muted">Improvement</span><span class="mono ${imp > 0 ? 'p5-ok' : ''}">${!imp ? '—' : `${imp > 0 ? '+' : imp < 0 ? '−' : ''}${ev.id === 'mdl' ? formatWeight(Math.abs(imp)) : ev.id === 'hrp' ? Math.abs(imp) : E.fmtTime(Math.abs(imp))}`}</span>
  </div>
  ${trendSVG(p, ev.id)}
  <div class="p5-ev-tier fs10"><span class="label">${E.TIER_NAMES[tier.tier]}</span>${[1, 2, 3, 4].map((k) => `<i class="${k <= tier.tier ? 'on' : ''}"></i>`).join('')}</div>
</div>`;
}

function objectivesHTML(p) {
  const wi = E.weekInfo(p, today()) || {};
  return `<div class="p5-obj">${E.objectives(p).map((ph) => `
  <div class="card p5-obj-ph ${ph.phase === wi.phase ? 'is-now' : ''}">
    <div class="p5-obj-head"><span class="label">Phase ${ph.phase}</span><b>${esc(ph.name)}</b><span class="mono ${ph.items.every((i) => i.met) ? 'p5-ok' : 'muted'}">${ph.items.filter((i) => i.met).length}/5</span></div>
    <div class="p5-obj-row">${ph.items.map((i) => `<span class="p5-medal ${i.met ? 'is-met' : ''}" title="${esc(eventDef(i.id).short)}: ${i.target == null ? 'needs a target and a starting result' : esc(fmtEvent(i.id, i.target))}${i.met ? ' — met' : ''}"><i aria-hidden="true">${i.met ? '★' : EV_ICON[i.id]}</i><span class="fs10 mono">${i.target == null ? '—' : esc(fmtEvent(i.id, i.target)).replace(' reps', '')}</span></span>`).join('')}</div>
  </div>`).join('')}</div>`;
}

function upcomingHTML(p, t) {
  const out = [];
  for (let d = t, n = 0; n < 120 && out.length < 4; d = E.addDays(d, 1), n++) {
    const pl = E.dayPlan(p, d);
    if (pl?.kind === 'plan' && pl.test) out.push(pl);
    if (pl?.kind === 'done') break;
  }
  if (!out.length) return '<div class="card muted fs12">No tests scheduled ahead.</div>';
  return `<div class="card p5-list">${out.map((pl) => `<button class="p5-row" onclick="p5Open('${pl.date}')"><span>${pl.icon}</span><span><b>${esc(pl.name)}</b><span class="muted fs11">Week ${pl.week} · ${fmtDate(pl.date)}</span></span><span class="muted fs11">${E.daysBetween(t, pl.date) === 0 ? 'today' : `in ${E.daysBetween(t, pl.date)} d`}</span></button>`).join('')}</div>`;
}

function recoveryHTML(p, t, rv) {
  const r = (p.readiness || []).find((x) => x.date === t);
  const rs = E.readinessScore(r);
  const sleep = (state.sleepLog || []).find((s) => s.durationHours > 0);
  const recs = (rv?.recs || []).slice(0, 4);
  return `<div class="card">
    <div class="p5-ready ${rs ? `is-${rs.level}` : ''}">
      <span class="p5-ready-dot" aria-hidden="true"></span>
      <div><b>${rs ? `Readiness ${rs.score}` : 'No check-in today'}</b><div class="muted fs12">${rs ? esc(rs.advice) : 'A 20-second check-in tunes today’s session.'}</div></div>
      <button class="btn btn-ghost btn-sm" onclick="p5Open('${t}')">${rs ? 'Update' : 'Check in'}</button>
    </div>
    ${sleep ? `<div class="muted fs11 p5-sleep">Last sleep logged: ${sleep.durationHours.toFixed(1)} h (${esc(sleep.date)})</div>` : ''}
    ${recs.length ? `<ul class="p5-recs">${recs.map((x) => `<li class="is-${x.level}">${esc(x.text)}</li>`).join('')}</ul>` : '<div class="muted fs12">Recommendations appear once this week has some logged training.</div>'}
  </div>`;
}

function bestsHTML(p) {
  const best = E.bestResults(p);
  const dl = p.lifts?.trap_dl;
  return `<div class="card p5-bests">${AFT.events.map((ev) => `<div><span class="label">${esc(ev.short)}</span><b class="mono">${fmtEvent(ev.id, best[ev.id]?.raw)}</b><span class="muted fs10">${best[ev.id] ? fmtDate(best[ev.id].date, { month: 'short', day: 'numeric' }) : ''}</span></div>`).join('')}
    <div><span class="label">Deadlift working weight</span><b class="mono">${dl?.work ? formatWeight(dl.work) : '—'}</b><span class="muted fs10">${dl?.hist?.length ? esc(dl.hist.at(-1).reason) : 'Set by your first heavy day'}</span></div></div>`;
}

// Charts, called by the shell after the page renders.
export function scheduleP500Page() {
  const p = P();
  if (!p || _tab !== 'overview' || !document.getElementById('p5-chart')) return;
  const id = _chartEv;
  const toY = (raw) => (id === 'mdl' ? toDisplayWeight(raw) : id === 'hrp' ? raw : raw / 60);
  const unit = id === 'mdl' ? weightUnitLabel() : id === 'hrp' ? 'reps' : 'min';
  const ms = (d) => E.parseYMD(d).getTime();
  const proj = [];
  const base = p.baseline?.[id] > 0 && !p.baseline.sub?.[id] ? p.baseline[id] : null;
  if (base) proj.push({ x: ms(p.baseline.date < p.startDate ? p.baseline.date : p.startDate), y: toY(base) });
  const mss = E.milestonesFor(p);
  P500.phases.forEach((ph, i) => { const m = E.weekStartDate(p, ph.weeks[1]); if (m && mss[i][id] != null) proj.push({ x: ms(E.addDays(m, 6)), y: toY(mss[i][id]) }); });
  const act = [];
  if (base) act.push({ x: ms(p.baseline.date), y: toY(base) });
  for (const t of [...p.tests].sort((a, b) => (a.date < b.date ? -1 : 1))) { const r = t.events?.[id]; if (r && !r.sub) act.push({ x: ms(t.date), y: toY(r.raw) }); }
  const xs = [...proj, ...act].map((q) => q.x);
  if (!xs.length) return;
  initMetricChart('p5-chart', { xMin: Math.min(...xs), xMax: Math.max(...xs),
    datasets: [{ label: 'Milestone path', points: proj, color: '--text-3', kind: 'goal', unit, decimals: id === 'hrp' ? 0 : 1 },
               { label: 'Your results', points: act, color: '--fire', kind: 'line', unit, decimals: id === 'hrp' ? 0 : 2 }] });
}

// ── TODAY ────────────────────────────────────────────────────────────────────
function todayCardHTML(compact) {
  const p = P(), t = today();
  const st = E.dayStatus(p, t, t);
  const pl = st.plan;
  if (!pl) return '';
  if (pl.kind === 'pre') return `<div class="card card--active p5-today"><div class="label">Before the start</div><b>Baseline week</b><div class="muted fs12">Fill in what you know on Setup, spread any tests over several days, and keep your usual training. Day 1 is ${fmtDate(p.startDate)}.</div></div>`;
  if (pl.kind === 'paused') return `<div class="card p5-today"><div class="label">Paused</div><b>Program paused</b><button class="btn btn-fire btn-sm" onclick="p5Resume()">Resume</button></div>`;
  if (pl.kind !== 'plan' && pl.kind !== 'moved') return '';
  return `
<div class="card card--active p5-today is-${st.status}">
  <span class="p5-today-ic" aria-hidden="true">${pl.icon}</span>
  <div class="p5-today-body">
    <div class="label">Today · week ${pl.week}${pl.deload ? ' · deload' : ''}${pl.ret ? ' · return week' : ''}</div>
    <b class="p5-today-name">${esc(pl.kind === 'moved' ? `Moved to ${fmtDate(pl.movedTo)}` : pl.name)}</b>
    <div class="muted fs12">${esc(pl.dur)} · ${STATUS_LABEL[st.status] || ''}</div>
  </div>
  ${compact ? `<button class="btn btn-fire btn-sm" onclick="p5Open('${t}')">${st.status === 'done' ? 'View' : 'Open'}</button>` : ''}
</div>`;
}

function liftItems(p, plan) {
  const prof = programProfile(state.profile || {}, state.bodyLog || []);
  return E.liftPrescription(p, plan).map((it) => {
    if (it.weight == null && it.key !== 'dl' && !it.timed) {
      const s = suggestNextSet(it.exId, it.reps, state.sessions || [], prof, state.settings?.progression || 'double');
      if (s?.weight && !s.isBodyweight) return { ...it, weight: s.weight, auto: true };
    }
    return it;
  });
}

function todayHTML() {
  const p = P(), t = today();
  const d = E.isYMD(_day) ? _day : t;
  const st = E.dayStatus(p, d, t);
  const pl = st.plan;
  const nav = `<div class="p5-daynav"><button class="btn btn-ghost btn-sm" onclick="p5Open('${E.addDays(d, -1)}')" aria-label="Previous day">‹</button>
    <b>${d === t ? 'Today' : fmtDate(d, { weekday: 'long', month: 'short', day: 'numeric' })}</b>
    <button class="btn btn-ghost btn-sm" onclick="p5Open('${E.addDays(d, 1)}')" aria-label="Next day">›</button>${d !== t ? `<button class="p5-link" onclick="p5Open('${t}')">Back to today</button>` : ''}</div>`;
  const ready = d === t ? readinessFormHTML(p, t) : '';
  if (!pl || pl.kind === 'pre') return `${nav}${ready}<div class="card muted">Project 500 starts ${fmtDate(p.startDate)}. Until then, use Setup and Tests to record a baseline.</div>`;
  if (pl.kind === 'paused') return `${nav}<div class="card"><b>Paused</b><p class="muted fs12">Nothing is scheduled while the program is paused. A pause of ten days or more is followed by a lighter return week.</p><button class="btn btn-fire" onclick="p5Resume()">Resume program</button></div>`;
  if (pl.kind === 'done') return `${nav}<div class="card"><b>The 52 weeks are complete.</b></div>`;
  if (pl.kind === 'moved') return `${nav}${ready}<div class="card"><b>${esc(DAY_TEMPLATES[(p.overrides[d] || {}).tpl]?.name || 'Rest')}</b><p class="muted fs12">This day’s session was moved to ${fmtDate(pl.movedTo)}.</p><button class="btn btn-ghost btn-sm" onclick="p5Open('${pl.movedTo}')">Go to ${fmtDate(pl.movedTo)}</button> <button class="btn btn-ghost btn-sm" onclick="p5ResetWeek('${d}')">Undo moves this week</button></div>`;
  const rs = d === t ? E.readinessScore((p.readiness || []).find((x) => x.date === t)) : null;
  const lifts = liftItems(p, pl);
  const run = E.runPrescription(p, pl);
  const rec = E.recoveryPrescription(pl, p);
  const blocks = [];
  if (rs && rs.level !== 'green' && pl.load !== 'rest') blocks.push(`<div class="p5-note is-${rs.level}">${esc(rs.advice)}${rs.level === 'red' ? ` <button class="p5-link" onclick="p5MakeRecovery('${d}')">Make today a recovery day</button>` : ''}</div>`);
  if (pl.test) blocks.push(`<div class="card p5-block"><div class="label">Assessment</div><b>${esc(pl.name)}</b>
    <p class="muted fs12">${pl.tpl === 'aft' ? 'All five events in the official order, with full recovery between them. Only do it if you are healthy and have trained consistently — otherwise run the event checks instead.' : 'Warm up well, then give each event an honest, technically clean effort. Record the result on Tests.'}</p>
    <button class="btn btn-fire" onclick="p5StartTest('${d}')">🎯 Record results</button></div>`);
  if (run) blocks.push(runBlockHTML(p, pl, run, d));
  if (lifts.length && !pl.test) blocks.push(liftBlockHTML(pl, lifts, d));
  if (rec || pl.tpl === 'soccer') blocks.push(activityBlockHTML(pl, rec, d));
  if (pl.tpl === 'rest') blocks.push(`<div class="card p5-block"><b>Rest + weekly review</b><p class="muted fs12">Optional easy walk and gentle mobility. Then look back at the week.</p><button class="btn btn-ghost btn-sm" onclick="p5ReviewWeek(${pl.week})">Open weekly review →</button></div>`);
  const opts = st.status === 'missed' ? E.rescheduleOptions(p, d, t) : [];
  const weekDays = Array.from({ length: 7 }, (_, i) => E.addDays(E.mondayOf(d), i)).filter((x) => x !== d && E.dayPlan(p, x)?.kind === 'plan');
  return `${nav}${ready}
<div class="card card--active p5-dayhead is-${st.status}">
  <span class="p5-today-ic" aria-hidden="true">${pl.icon}</span>
  <div><div class="label">Week ${pl.week} · Phase ${pl.phase}${pl.deload ? ' · Deload (lighter volume)' : ''}${pl.ret ? ' · Return week' : ''}${pl.movedFrom ? ` · moved from ${fmtDate(pl.movedFrom, { weekday: 'short' })}` : ''}</div>
    <b class="p5-today-name">${esc(pl.name)}</b><div class="muted fs12">${esc(pl.dur)} · <span class="p5-st is-${st.status}">${STATUS_LABEL[st.status] || ''}</span></div></div>
</div>
${opts.length ? `<div class="p5-note">Missed — this fits on ${opts.map((o) => `<button class="p5-link" onclick="p5Move('${d}','${o}')">${fmtDate(o)}</button>`).join(' or ')} without stacking hard days.</div>` : st.status === 'missed' ? '<div class="p5-note">Missed. No day left this week takes it without stacking hard sessions, so let it go — the plan carries on and loads are not raised off a missed session.</div>' : ''}
${blocks.join('')}
${doneEntriesHTML(p, d)}
<details class="card p5-adjust"><summary class="label">Adjust this day</summary>
  <div class="p5-adjust-row">
    ${weekDays.length ? `<label class="fs12">Move to <select id="p5-move-to" class="p5-in">${weekDays.map((x) => `<option value="${x}">${fmtDate(x)} — ${esc(E.dayPlan(p, x).name)}</option>`).join('')}</select></label><button class="btn btn-ghost btn-sm" onclick="p5Move('${d}', document.getElementById('p5-move-to').value)">Move</button>` : ''}
    ${pl.tpl !== 'recover' ? `<button class="btn btn-ghost btn-sm" onclick="p5MakeRecovery('${d}')">Make it a recovery day</button>` : ''}
    ${pl.tpl === 'military' ? `<button class="btn btn-ghost btn-sm" onclick="p5SetTpl('${d}','soccer')">Swap for soccer</button>` : pl.tpl === 'soccer' ? `<button class="btn btn-ghost btn-sm" onclick="p5SetTpl('${d}','military')">Swap for military conditioning</button>` : ''}
    ${p.overrides?.[d] ? `<button class="btn btn-ghost btn-sm" onclick="p5ResetWeek('${d}')">Restore this week’s plan</button>` : ''}
  </div>
  <p class="muted fs11">Sessions move within their week and swap places rather than stack, so a week never gains two hard days in a row.</p>
</details>`;
}

function liftBlockHTML(pl, items, d) {
  return `<div class="card p5-block"><div class="label">Strength${pl.deload ? ' · deload volume' : ''}</div>
  <div class="p5-lifts">${items.map((it) => {
    const ex = EXERCISES[it.exId] || {};
    return `<div class="p5-lift"><button class="p5-lift-name" onclick="openExDetail('${it.exId}')" title="Demo, steps and video">${exThumbHTML({ id: it.exId, ...ex })}<span>${esc(ex.name || it.exId)}${it.sub ? ' <span class="tag t-dim">substitute</span>' : ''}</span></button>
      <span class="mono p5-lift-rx">${it.sets} × ${esc(it.reps)}${it.weight ? ` @ ${formatWeight(it.weight)}` : ''}${it.rir ? ` <span class="muted">RIR ${esc(it.rir)}</span>` : ''}</span>
      ${it.note ? `<span class="muted fs11 p5-lift-note">${esc(it.note)}</span>` : ''}</div>`;
  }).join('')}</div>
  <button class="btn btn-fire" onclick="p5StartLift('${d}')">⚡ Start strength block</button>
  <div class="muted fs11">The logger shows each prescription, saves every set as you go, and lets you swap (⇄) any movement for one your kit allows.</div></div>`;
}

function runBlockHTML(p, pl, run, d) {
  const u = distUnitLabel();
  let what = '';
  if (run.kind === 'intervals') {
    const dist = run.dist >= 1600 ? '1 mile' : `${run.dist} m`;
    what = `<b>${run.warmMin} min easy jog, then ${run.reps} × ${dist}</b> ${run.split ? `in <b class="mono">${E.fmtTime(run.split)}</b> each` : ''} (${esc(run.paceLabel)}), ${E.fmtTime(run.rest)} recovery between. ${run.coolMin} min cool-down walk.`;
  } else if (run.kind === 'easy' || run.kind === 'tempo') {
    what = `<b>${run.min} min ${run.kind === 'tempo' ? 'tempo' : 'easy'} run</b>${run.easyPace ? ` around <span class="mono">${E.fmtTime(run.easyPace)}/mi</span>` : ''}${run.warmMin ? ` with a ${run.warmMin} min walk either side` : ''}.`;
  } else if (run.kind === 'trial') what = '<b>2-mile time trial</b>, logged as a test result.';
  return `<div class="card p5-block"><div class="label">Run</div><p class="fs13">${what}</p>
  ${run.runWalk ? `<p class="muted fs12">Run/walk option: ${esc(run.runWalk)} — swap in whenever continuous running is too much.</p>` : ''}
  ${run.alt ? `<p class="muted fs12">${esc(run.alt)}</p>` : ''}
  <p class="muted fs11">${esc(run.note || '')}</p>
  <div class="p5-btns">${run.kind === 'intervals' ? `<button class="btn btn-ghost btn-sm" onclick="p5Timer(${run.split ? Math.max(15, Math.round(run.split / 5) * 5) : 90}, ${run.rest}, ${run.reps})">⏲ Interval timer</button>` : ''}</div>
  <details class="p5-form" ${run.kind === 'trial' ? 'open' : ''}><summary class="label">Log this run</summary>
    <div class="p5-fields">
      <label>Distance (${u})<input id="p5r-dist" class="p5-in" type="number" step="0.01" min="0" inputmode="decimal" ${run.kind === 'trial' ? `value="${toDisplayDist(2)}"` : ''}></label>
      <label>Time (m:ss or h:mm:ss)<input id="p5r-time" class="p5-in" placeholder="31:00" inputmode="numeric"></label>
      <label>Where<select id="p5r-surf" class="p5-in"><option>Outdoor</option><option>Treadmill</option><option>Track</option></select></label>
      <label>Avg HR<input id="p5r-hr" class="p5-in" type="number" min="30" max="230" inputmode="numeric"></label>
      <label>Max HR<input id="p5r-mhr" class="p5-in" type="number" min="30" max="230" inputmode="numeric"></label>
      <label>Cadence (spm)<input id="p5r-cad" class="p5-in" type="number" min="60" max="250" inputmode="numeric"></label>
      <label>Elevation gain (ft)<input id="p5r-elev" class="p5-in" type="number" min="0" max="20000" inputmode="numeric"></label>
      <label>Effort (RPE 1–10)<input id="p5r-rpe" class="p5-in" type="number" min="1" max="10" inputmode="numeric"></label>
      <label class="p5-wide">Interval splits (comma-separated m:ss)<input id="p5r-splits" class="p5-in" placeholder="2:20, 2:18, 2:19, 2:17"></label>
      <label class="p5-wide">Notes<input id="p5r-notes" class="p5-in" maxlength="300"></label>
      ${run.kind === 'trial' || pl.tpl === 'checkRun' ? `<label class="p5-check p5-wide"><input type="checkbox" id="p5r-test" checked> Record as my 2-mile result (official only on a measured 2-mile course)</label>` : ''}
    </div>
    <button class="btn btn-fire btn-sm" onclick="p5LogRun('${d}')">Save run</button>
  </details></div>`;
}

function activityBlockHTML(pl, rec, d) {
  const soccer = pl.tpl === 'soccer';
  const opts = soccer ? ['Soccer'] : rec.options;
  return `<div class="card p5-block"><div class="label">${soccer ? 'Soccer' : 'Active recovery'}</div>
  <p class="fs13">${soccer ? 'A soccer game or club training session — it counts as this week’s conditioning, not extra work.' : `<b>${rec.min}–${rec.min + 5} min easy ${opts[0].toLowerCase()}</b> (or ${opts.slice(1).join(' / ').toLowerCase()}), then 5 min each of hip, ankle and shoulder mobility.`}</p>
  <details class="p5-form"><summary class="label">Log it</summary>
    <div class="p5-fields">
      <label>Activity<select id="p5a-type" class="p5-in">${opts.map((o) => `<option>${o}</option>`).join('')}</select></label>
      <label>Minutes<input id="p5a-min" class="p5-in" type="number" min="1" max="600" inputmode="numeric" value="${soccer ? 60 : rec.min}"></label>
      <label>Intensity<select id="p5a-int" class="p5-in"><option>Low</option><option ${soccer ? 'selected' : ''}>Moderate</option><option>High</option><option>Max</option></select></label>
      <label>Avg HR<input id="p5a-hr" class="p5-in" type="number" min="30" max="230" inputmode="numeric"></label>
      <label>Effort (RPE 1–10)<input id="p5a-rpe" class="p5-in" type="number" min="1" max="10" inputmode="numeric"></label>
      <label class="p5-wide">Notes<input id="p5a-notes" class="p5-in" maxlength="300"></label>
    </div>
    <button class="btn btn-fire btn-sm" onclick="p5LogActivity('${d}')">Save</button>
  </details>
  ${soccer ? '' : `<button class="btn btn-ghost btn-sm" onclick="p5StartLift('${d}')">🧘 Start mobility routine</button>`}</div>`;
}

function doneEntriesHTML(p, d) {
  const es = (p.log || []).map((e, i) => ({ e, i })).filter(({ e }) => e.date === d);
  if (!es.length) return '';
  const name = { lift: 'Strength block', run: 'Run', activity: 'Activity', test: 'Test', any: 'Session' };
  return `<div class="card p5-done"><div class="label">Logged for this day</div>${es.map(({ e, i }) => `<div class="p5-done-row"><span class="p5-ok">✓</span><span>${name[e.block] || e.block}${e.actual ? ` <span class="muted fs11 mono">${[e.actual.sets ? `${e.actual.sets} sets` : '', e.actual.volume ? formatWeight(e.actual.volume) : '', e.actual.miles ? `${toDisplayDist(e.actual.miles)} ${distUnitLabel()}` : '', e.actual.min ? `${e.actual.min} min` : ''].filter(Boolean).join(' · ')}</span>` : ''}</span>
    <button class="p5-link" onclick="p5Unlog(${i})" title="Remove from Project 500 (the workout itself stays in your history)">Unmark</button></div>`).join('')}</div>`;
}

function readinessFormHTML(p, t) {
  const r = (p.readiness || []).find((x) => x.date === t) || {};
  const rs = E.readinessScore(r.date ? r : null);
  const sel = (id, lo, hi, v, label) => `<label>${label}<select id="${id}" class="p5-in"><option value="">—</option>${Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).map((n) => `<option ${Number(v) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`;
  return `<details class="card p5-readiness" ${r.date ? '' : 'open'}><summary><span class="label">Readiness check-in</span>${rs ? ` <span class="p5-pill is-${rs.level}">${rs.score}</span>` : ''}</summary>
    <div class="p5-fields">
      ${sel('p5q-sleep', 1, 5, r.sleepQ, 'Sleep quality (1–5)')}${sel('p5q-sore', 1, 10, r.soreness, 'Soreness (1–10)')}
      ${sel('p5q-energy', 1, 10, r.energy, 'Energy (1–10)')}${sel('p5q-stress', 1, 10, r.stress, 'Stress (1–10)')}
      <label class="p5-check"><input type="checkbox" id="p5q-pain" ${r.pain ? 'checked' : ''}> Pain or injury</label>
      <label class="p5-check"><input type="checkbox" id="p5q-ill" ${r.ill ? 'checked' : ''}> Feeling ill</label>
    </div>
    <button class="btn btn-ghost btn-sm" onclick="p5SaveReady()">Save check-in</button>
    <span class="muted fs11">Sleep hours come from the Sleep log. Pain or illness pauses all progression.</span>
  </details>`;
}

// ── TODAY ACTIONS ────────────────────────────────────────────────────────────
window.p5SaveReady = () => {
  const p = P(); if (!p) return;
  const n = (id) => { const v = document.getElementById(id)?.value; return v ? Number(v) : null; };
  const r = { date: today(), sleepQ: n('p5q-sleep'), soreness: n('p5q-sore'), energy: n('p5q-energy'), stress: n('p5q-stress'),
              pain: !!document.getElementById('p5q-pain')?.checked, ill: !!document.getElementById('p5q-ill')?.checked, note: '' };
  p.readiness = (p.readiness || []).filter((x) => x.date !== r.date);
  p.readiness.push(r);
  save(); cue('select');
  const rs = E.readinessScore(r);
  toast(rs ? `Readiness ${rs.score} — ${rs.advice}` : 'Check-in saved', { type: rs?.level === 'green' ? 'green' : 'fire', ms: 4000 });
  rerender();
};

window.p5StartLift = (d) => {
  const p = P(); const pl = E.dayPlan(p, d);
  if (!pl || pl.kind !== 'plan') return;
  const mobility = ['recovery', 'recover', 'rest'].includes(pl.tpl);
  const items = liftItems(p, pl);
  if (!items.length) return;
  const exercises = items.map((it) => ({ id: it.exId, name: EXERCISES[it.exId]?.name, sets: it.sets, reps: it.reps,
    prescribed: { sets: it.sets, reps: it.reps, weight: it.auto ? null : it.weight, rir: it.rir || '', note: it.note || '', sub: !!it.sub } }));
  window.startActiveWorkout(`p500-${d}`, `P500 W${pl.week} · ${pl.name}`, exercises, mobility ? 'mobility' : 'strength',
    { p500: { date: d, tpl: pl.tpl, week: pl.week } });
};

window.p5Timer = (work, rest, rounds) => {
  const t = state.settings.timer && typeof state.settings.timer === 'object' ? state.settings.timer : { cfg: {} };
  t.cfg = t.cfg || {};
  t.mode = 'intervals';
  t.cfg.intervals = { work: Math.min(1800, Math.max(5, work)), rest: Math.min(900, Math.max(0, rest)), rounds: Math.min(60, Math.max(1, rounds)), sets: 1, setRest: 60 };
  state.settings.timer = t;
  save();
  window.navigate?.('timer');
  toast(`Timer set: ${rounds} × ${E.fmtTime(work)} work / ${E.fmtTime(rest)} rest`, { type: 'green' });
};

function bad(id, msg) { const el = document.getElementById(id); el?.classList.add('input-error'); setTimeout(() => el?.classList.remove('input-error'), 500); toast(msg, { type: 'danger' }); cue('error'); }
const whenOn = (d) => { const now = new Date(); return d === today() ? now.toISOString() : new Date(`${d}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`).toISOString(); };

window.p5LogRun = (d) => {
  const p = P(); const pl = E.dayPlan(p, d); if (!p || !pl) return;
  const v = (id) => document.getElementById(id)?.value?.trim() || '';
  const dist = Number(v('p5r-dist'));
  const sec = E.parseTime(v('p5r-time'));
  if (!(dist > 0) || dist > 100) return bad('p5r-dist', 'Enter the distance you ran.');
  if (!(sec > 0) || sec > 86400) return bad('p5r-time', 'Enter your time as m:ss or h:mm:ss.');
  const num = (id, lo, hi) => { if (v(id) === '') return null; const x = Number(v(id)); return x >= lo && x <= hi ? x : null; };
  const splits = v('p5r-splits') ? v('p5r-splits').split(/[,\s]+/).map(E.parseTime).filter((x) => x > 0).slice(0, 40) : [];
  const miles = Math.round(toStoredDist(dist) * 1000) / 1000;
  const entry = { date: whenOn(d), type: 'run', distanceMiles: miles, durationMinutes: Math.round(sec / 6) / 10, avgHR: num('p5r-hr', 30, 230),
    maxHR: num('p5r-mhr', 30, 230), cadence: num('p5r-cad', 60, 250), elevGainFt: num('p5r-elev', 0, 20000), rpe: num('p5r-rpe', 1, 10),
    surface: ['Outdoor', 'Treadmill', 'Track'].includes(v('p5r-surf')) ? v('p5r-surf') : 'Outdoor', splits, source: 'manual', p500: d, notes: v('p5r-notes') };
  addCardioEntry(entry);
  p.log.push({ date: d, block: 'run', tpl: pl.tpl, week: pl.week, at: entry.date, actual: { miles, min: Math.round(sec / 60) } });
  const two = Math.abs(miles - 2) <= 0.05;
  if (document.getElementById('p5r-test')?.checked && two) {
    const before = E.objectivesMet(p);
    p.tests.push({ id: Date.now(), date: d, kind: 'check', events: { tmr: { raw: Math.round(sec) } }, note: entry.surface === 'Treadmill' ? 'Treadmill' : '' });
    p.log.push({ date: d, block: 'test', tpl: pl.tpl, week: pl.week, at: entry.date });
    celebrateObjectives(before, p);
  } else if (document.getElementById('p5r-test')?.checked && !two) {
    toast('Saved as a run — a 2-mile result needs a distance of 2.0 miles.', { type: 'fire', ms: 4500 });
  }
  save(); cue('setDone');
  const pace = E.pacePerMile(sec, miles);
  toast(`Run saved · ${E.fmtTime(pace)}/mi · ${E.mph(sec, miles).toFixed(1)} mph`, { type: 'green' });
  rerender();
};

window.p5LogActivity = (d) => {
  const p = P(); const pl = E.dayPlan(p, d); if (!p || !pl) return;
  const v = (id) => document.getElementById(id)?.value?.trim() || '';
  const min = Number(v('p5a-min'));
  if (!(min >= 1) || min > 600) return bad('p5a-min', 'Enter the minutes.');
  const type = ['Swimming', 'Cycling', 'Walking', 'Soccer'].includes(v('p5a-type')) ? v('p5a-type') : 'Walking';
  const rpe = Number(v('p5a-rpe'));
  const hr = Number(v('p5a-hr'));
  addActivityEntry({ type, durationMin: min, intensity: ['Low', 'Moderate', 'High', 'Max'].includes(v('p5a-int')) ? v('p5a-int') : 'Moderate', date: d,
    hr: hr >= 30 && hr <= 230 ? hr : null, rpe: rpe >= 1 && rpe <= 10 ? rpe : null, source: 'manual', p500: d,
    notes: v('p5a-notes') });
  p.log.push({ date: d, block: 'activity', tpl: pl.tpl, week: pl.week, at: new Date().toISOString(), actual: { min } });
  save(); cue('setDone');
  toast(`${type} saved — counts toward this week`, { type: 'green' });
  rerender();
};

window.p5Unlog = (i) => {
  const p = P(); if (!p || !p.log[i]) return;
  if (!confirm('Unmark this from Project 500? The workout itself stays in your history.')) return;
  p.log.splice(i, 1); save(); rerender();
};
window.p5Move = (from, to) => {
  const p = P(); if (!p) return;
  const r = E.moveSession(p, from, to);
  if (!r.ok) return toast(r.reason, { type: 'danger' });
  save(); toast(`Moved to ${fmtDate(to)}`, { type: 'green' }); _day = to; rerender();
};
window.p5MakeRecovery = (d) => {
  const p = P(); if (!p) return;
  p.overrides[d] = { ...(p.overrides[d] || {}), tpl: 'recover', recovery: true };
  save(); toast('Recovery day — easy movement and mobility only', { type: 'green' }); rerender();
};
window.p5SetTpl = (d, tpl) => {
  const p = P(); if (!p || !['soccer', 'military'].includes(tpl)) return;
  p.overrides[d] = { ...(p.overrides[d] || {}), tpl };
  save(); rerender();
};
window.p5ResetWeek = (d) => {
  const p = P(); if (!p || !E.isYMD(d)) return;
  const m = E.mondayOf(d);
  for (let i = 0; i < 7; i++) delete p.overrides[E.addDays(m, i)];
  save(); rerender();
};
window.p5StartTest = (d) => {
  const pl = E.dayPlan(P(), d);
  _testKind = pl?.tpl === 'aft' ? 'aft' : 'check';
  _testPick = { date: d, events: pl?.test || null };
  _tab = 'tests'; rerender();
  setTimeout(() => document.getElementById('p5-testform')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
};
window.p5ReviewWeek = (w) => { _reviewWeek = w; _tab = 'review'; rerender(); };

// ── CALENDAR ─────────────────────────────────────────────────────────────────
function calendarHTML() {
  const p = P(), t = today();
  const wiNow = E.weekInfo(p, t) || {};
  const rows = [];
  for (let w = 1; w <= P500.weeks; w++) {
    const mon = E.weekStartDate(p, w);
    if (!mon) break;
    const ph = E.phaseOf(w);
    rows.push(`<div class="p5-cal-row ${w === wiNow.week ? 'is-now' : ''} ph-${ph}">
      <button class="p5-cal-wk" onclick="p5ReviewWeek(${w})" title="Week ${w} review"><b class="mono">W${w}</b><span class="fs10 muted">${E.isDeload(w) ? (P500.fullTestWeeks.includes(w) ? 'AFT' : 'deload') : fmtDate(mon, { month: 'short', day: 'numeric' })}</span></button>
      ${Array.from({ length: 7 }, (_, i) => { const d = E.addDays(mon, i); const s = E.dayStatus(p, d, t); const pl = s.plan || {};
        const st = pl.kind === 'moved' ? 'moved' : pl.kind === 'paused' ? 'paused' : s.status;
        return `<button class="p5-cell is-${st} ${pl.test ? 'is-test' : ''} ${pl.deload ? 'is-deload' : ''} ${pl.tpl === 'recover' ? 'is-recover' : ''} ${d === t ? 'is-now' : ''}" onclick="p5Open('${d}')" aria-label="${esc(fmtDate(d))}: ${esc(pl.name || st)}, ${STATUS_LABEL[st] || st}">${pl.icon || ''}</button>`; }).join('')}
    </div>`);
  }
  return `
<div class="card p5-cal-ctl">
  <label class="fs12">Start date <input type="date" id="p5-start" class="p5-in" value="${p.startDate}"></label>
  <button class="btn btn-ghost btn-sm" onclick="p5SetStart()">Change start</button>
  ${p.status === 'paused' ? '<button class="btn btn-fire btn-sm" onclick="p5Resume()">▶ Resume</button>' : '<button class="btn btn-ghost btn-sm" onclick="p5Pause()">⏸ Pause program</button>'}
  <button class="btn btn-ghost btn-sm" onclick="p5ExportICS()">📅 Add to my calendar (.ics)</button>
  <label class="fs12">Session time <input type="time" id="p5-time" class="p5-in" value="${esc(p.prefs.time)}" onchange="p5SetTime(this.value)"></label>
</div>
<div class="p5-legend fs11">${[['done', 'Done'], ['partial', 'Part done'], ['missed', 'Missed'], ['upcoming', 'Upcoming'], ['moved', 'Moved'], ['deload', 'Deload'], ['test', 'Assessment'], ['recover', 'Recovery'], ['paused', 'Paused']].map(([k, l]) => `<span><i class="p5-cell is-${k} ${k === 'test' ? 'is-test' : ''} ${k === 'deload' ? 'is-deload is-upcoming' : ''} ${k === 'recover' ? 'is-recover' : ''}"></i>${l}</span>`).join('')}</div>
<div class="p5-cal-head" aria-hidden="true"><span></span>${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x) => `<span class="label">${x}</span>`).join('')}</div>
<div class="p5-cal">${rows.join('')}</div>
<p class="muted fs11">The calendar file sets a 15-minute reminder before each session at your chosen time. Re-export after moving sessions — your calendar app keeps its own copy.</p>`;
}

window.p5SetStart = () => {
  const p = P(); const v = document.getElementById('p5-start')?.value;
  if (!E.isYMD(v)) return bad('p5-start', 'Pick a valid date.');
  if (p.log.length && !confirm('Change the start date? Logged sessions keep their dates; the week numbers around them will shift.')) return;
  p.startDate = v; save(); toast(`Program starts ${fmtDate(v)}`, { type: 'green' }); rerender();
};
window.p5SetTime = (v) => { const p = P(); if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v || '')) return; p.prefs.time = v; save(); };
window.p5Pause = () => {
  const p = P(); if (!p || p.status === 'paused') return;
  p.status = 'paused'; p.pauses.push({ from: today(), to: null });
  save(); toast('Paused. When you resume, a long break is followed by a lighter return week.', { ms: 4500 }); rerender();
};
window.p5Resume = () => {
  const p = P(); if (!p) return;
  const open = p.pauses.find((x) => x.to == null);
  if (open) {
    const end = E.addDays(today(), -1);
    if (end < open.from) p.pauses = p.pauses.filter((x) => x !== open); else open.to = end;
  }
  p.status = 'active'; save(); toast('Resumed — welcome back', { type: 'green' }); rerender();
};
window.p5ExportICS = () => {
  const p = P(); if (!p) return;
  const from = today() > p.startDate ? today() : p.startDate;
  const blob = new Blob([E.toICS(p, from)], { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'project-500.ics';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Calendar file downloaded — open it to add the sessions', { type: 'green' });
};

// ── TESTS ────────────────────────────────────────────────────────────────────
function testsHTML() {
  const p = P();
  const { key, table } = activeTable(p);
  const tests = [...p.tests].sort((a, b) => (a.date < b.date ? 1 : -1));
  const last = tests[0];
  const pick = _testPick?.events;
  const date = _testPick?.date && E.isYMD(_testPick.date) ? _testPick.date : today();
  return `
<div class="card p5-std">
  <div class="p5-fields">
    <label>Standard<select id="p5s-std" class="p5-in" onchange="p5SetStd()">${Object.entries(AFT.standards).map(([k, s]) => `<option value="${k}" ${p.standard.std === k ? 'selected' : ''}>${s.label}</option>`).join('')}</select></label>
    <label>Sex<select id="p5s-sex" class="p5-in" onchange="p5SetStd()" ${p.standard.std === 'combat' ? 'disabled' : ''}><option value="">—</option><option value="male" ${p.standard.sex === 'male' ? 'selected' : ''}>Male</option><option value="female" ${p.standard.sex === 'female' ? 'selected' : ''}>Female</option></select></label>
    <label>Age band<select id="p5s-band" class="p5-in" onchange="p5SetStd()"><option value="">—</option>${AFT.ageBands.map((b) => `<option ${p.standard.band === b ? 'selected' : ''}>${b}</option>`).join('')}</select></label>
  </div>
  <div class="p5-tbl-status ${table ? 'is-ok' : ''}">${!key ? 'Choose your category to score results — the Army’s tables differ by age band (and by sex on the general standard).' : table ? `✓ Scoring table loaded for ${esc(key)} (${Object.keys(table).length}/5 events)` : `No official scoring table for ${esc(key)} yet — results are recorded and compared with your targets, but not given AFT points. Load the table below.`}</div>
  <div class="muted fs11">Pass rules (Army Directive 2025-06): general — 60+ points in every event; combat — 60+ in every event and 350+ overall. <a href="${AFT.sources[0].url}" target="_blank" rel="noopener noreferrer">Source</a></div>
</div>
${last ? resultHTML(p, last, tests) : ''}
<div class="card p5-testform" id="p5-testform">
  <div class="p5-testform-head"><b>Record results</b>${segGroup([{ id: 'check', label: 'Event check' }, { id: 'aft', label: 'Full AFT' }], _testKind, "p5TestKind('%')")}</div>
  <p class="muted fs12">${_testKind === 'aft' ? 'All five events, one session, in the official order. Only results on the real movement are scored.' : 'Any of the five events on their own — a training performance, recorded separately from full assessments.'}</p>
  <label class="fs12">Date <input type="date" id="p5t-date" class="p5-in" value="${date}"></label>
  <div class="p5-test-rows">${AFT.events.map((ev) => `
    <div class="p5-test-row ${pick && !pick.includes(ev.id) && _testKind !== 'aft' ? 'is-dim' : ''}">
      <span class="p5-test-n mono">${ev.order}</span>
      <label class="p5-test-l">${esc(ev.name)}<span class="muted fs11">${ev.id === 'mdl' ? weightUnitLabel() : ev.id === 'hrp' ? 'reps in 2 min' : 'm:ss'}</span></label>
      <input id="p5t-${ev.id}" class="p5-in" ${ev.id === 'mdl' || ev.id === 'hrp' ? 'type="number" inputmode="numeric" min="0"' : 'placeholder="m:ss" inputmode="numeric"'} ${ev.id === 'mdl' ? `step="${weightInputStep()}"` : ''}>
      <label class="p5-check fs11"><input type="checkbox" id="p5t-${ev.id}-sub"> substitute</label>
    </div>`).join('')}</div>
  <label class="fs12 p5-wide">Notes <input id="p5t-note" class="p5-in" maxlength="300" placeholder="Conditions, equipment, how it felt"></label>
  <button class="btn btn-fire" onclick="p5SaveTest()">Save results</button>
  <div class="muted fs11">“Substitute” = a different movement (e.g. a conventional deadlift or standard push-ups). It is kept in your history but never gets an official score.</div>
</div>
${tests.length ? historyHTML(p, tests) : ''}
${cftHTML(p)}
<details class="card p5-import"><summary class="label">Scoring tables</summary>
  <p class="muted fs12">AFT points come from the Army’s official scoring scales, not a formula. This build ships without them: the official PDF could not be retrieved when it was made, and unofficial copies disagree. Paste the rows for your category from the <a href="${AFT.sources[1].url}" target="_blank" rel="noopener noreferrer">official AFT Scoring Scales</a> — one line per point value: <code>points, deadlift lb, push-ups, SDC m:ss, plank m:ss, 2-mile m:ss</code>. Leave a cell blank if that point value has no entry. The table is checked (every event must improve with points) and saved to <b>${esc(key || 'your category (choose it above)')}</b>.</p>
  <textarea id="p5-tbl" class="p5-in p5-tbl" rows="6" placeholder="100, 350, 62, 1:30, 3:30, 13:25&#10;99, …"></textarea>
  <div class="p5-btns"><button class="btn btn-ghost btn-sm" onclick="p5ImportTable()">Check + save table</button>${p.tables?.[key] ? `<button class="btn btn-ghost btn-sm" onclick="p5DropTable()">Remove imported table</button>` : ''}</div>
</details>`;
}
window.p5TestKind = (k) => { _testKind = k === 'aft' ? 'aft' : 'check'; rerender(); };
window.p5SetStd = () => {
  const p = P();
  const std = document.getElementById('p5s-std')?.value, sex = document.getElementById('p5s-sex')?.value, band = document.getElementById('p5s-band')?.value;
  if (AFT.standards[std]) p.standard.std = std;
  p.standard.sex = ['male', 'female'].includes(sex) ? sex : null;
  p.standard.band = AFT.ageBands.includes(band) ? band : null;
  save(); rerender();
};

function resultHTML(p, t, tests) {
  const results = Object.fromEntries(Object.entries(t.events).map(([k, v]) => [k, v]));
  const sc = scoreOf(results, p);
  const prev = tests.find((x) => x !== t && x.date <= t.date && x.kind === t.kind);
  const best = E.bestResults(p);
  const base = p.baseline || {};
  const ranked = sc.events.filter((e) => e.raw != null && !e.sub).map((e) => ({ ...e, rel: e.points != null ? e.points / 100 : E.progressTo(e.id, base[e.id], e.raw, E.targetsFor(p)[e.id]) ?? 0 }))
    .sort((a, b) => b.rel - a.rel);
  return `<div class="card p5-result ${t.kind === 'aft' ? 'is-aft' : ''}">
    <div class="p5-result-head">
      ${sc.total != null ? ring(sc.total / 500, `<span data-p5count="${sc.total}">${sc.total}</span>`, '/ 500', { size: 110 }) : ''}
      <div><div class="label">${t.kind === 'aft' ? 'Latest full AFT' : 'Latest event check'} · ${fmtDate(t.date)}</div>
        ${sc.total != null ? `<b class="p5-result-total">${sc.pass === true ? '<span class="p5-ok">PASS</span>' : sc.pass === false ? '<span class="p5-bad">Below standard</span>' : ''} · ${500 - sc.total} from a perfect score</b>` : `<b>${Object.keys(t.events).length} event${Object.keys(t.events).length === 1 ? '' : 's'} recorded</b>`}
        ${ranked.length > 1 && ranked[0].rel !== ranked.at(-1).rel ? `<div class="muted fs12">Strongest: ${esc(eventDef(ranked[0].id).short)} · Weakest: ${esc(eventDef(ranked.at(-1).id).short)}</div>` : ''}</div>
    </div>
    <div class="p5-result-rows">${sc.events.filter((e) => e.raw != null).map((e) => {
      const pv = prev?.events?.[e.id];
      const lower = e.id === 'sdc' || e.id === 'tmr';
      const d = pv && !pv.sub && !e.sub ? (lower ? pv.raw - e.raw : e.raw - pv.raw) : null;
      const isPB = best[e.id]?.raw === e.raw && !e.sub;
      return `<div class="p5-rr"><span>${EV_ICON[e.id]} ${esc(eventDef(e.id).short)}${e.sub ? ' <span class="tag t-dim">substitute</span>' : ''}${isPB ? ' <span class="tag t-green">best</span>' : ''}</span>
        <span class="mono">${fmtEvent(e.id, e.raw)}</span>
        <span class="mono">${e.points != null ? `${e.points} pts` : e.sub ? 'not scored' : '—'}</span>
        <span class="mono fs11 ${d > 0 ? 'p5-ok' : d < 0 ? 'p5-bad' : 'muted'}">${d == null ? '' : `${d > 0 ? '▲' : d < 0 ? '▼' : '='} ${e.id === 'mdl' ? formatWeight(Math.abs(d)) : e.id === 'hrp' ? Math.abs(d) : E.fmtTime(Math.abs(d))}`}</span>
        <div class="gm-bar gm-bar-sm p5-rr-bar"><i style="width:${e.points != null ? e.points : ((E.progressTo(e.id, base[e.id], e.raw, E.targetsFor(p)[e.id]) || 0) * 100).toFixed(0)}%"></i></div></div>`;
    }).join('')}</div>
  </div>`;
}

function historyHTML(p, tests) {
  return `${sectionHead('History', 'Assessments and event checks')}<div class="card p5-hist"><div class="p5-hist-scroll"><table class="tbl w100"><thead><tr><th>Date</th><th>Type</th>${AFT.events.map((e) => `<th>${esc(e.short)}</th>`).join('')}<th>Total</th><th></th></tr></thead><tbody>
    ${tests.map((t) => { const sc = scoreOf(t.events, p); return `<tr><td class="mono">${esc(t.date)}</td><td>${t.kind === 'aft' ? '<b>AFT</b>' : 'Check'}</td>${AFT.events.map((ev) => { const r = t.events[ev.id]; const e = sc.events.find((x) => x.id === ev.id); return `<td class="mono">${r ? `${fmtEvent(ev.id, r.raw)}${r.sub ? '*' : ''}${e?.points != null ? `<span class="muted fs10"> ${e.points}</span>` : ''}` : ''}</td>`; }).join('')}<td class="mono">${sc.total ?? ''}</td><td><button class="p5-link" onclick="p5DelTest(${t.id})" aria-label="Delete">✕</button></td></tr>`; }).join('')}
  </tbody></table></div><div class="muted fs10">* substitute movement — recorded, not scored</div></div>`;
}

// The announcement itself comes from the Forge Rank celebration queue, which
// diffs Project 500 progress after every save; here the result card just
// throws sparks when an objective falls.
function celebrateObjectives(before, p) {
  if (E.objectivesMet(p) <= before) return;
  setTimeout(() => { const host = document.querySelector('.p5-result') || document.querySelector('.p5-body'); if (host) fxBurst(host, { kind: 'sparks', count: 40, power: 1.1 }); }, 350);
}

window.p5SaveTest = () => {
  const p = P(); if (!p) return;
  const date = document.getElementById('p5t-date')?.value;
  if (!E.isYMD(date)) return bad('p5t-date', 'Pick the test date.');
  const events = {};
  for (const ev of AFT.events) {
    const raw = parseEvent(ev.id, document.getElementById(`p5t-${ev.id}`)?.value);
    if (raw == null) continue;
    if (!Number.isFinite(raw)) return bad(`p5t-${ev.id}`, `Check the ${ev.short} result.`);
    events[ev.id] = { raw, sub: !!document.getElementById(`p5t-${ev.id}-sub`)?.checked };
  }
  const n = Object.keys(events).length;
  if (!n) return bad('p5t-mdl', 'Enter at least one result.');
  if (_testKind === 'aft' && n < 5) return toast('A full AFT needs all five events — or save these as an event check.', { type: 'danger' });
  const before = E.objectivesMet(p);
  const t = { id: Date.now(), date, kind: _testKind, events, note: (document.getElementById('p5t-note')?.value || '').replace(/[<>"]/g, '').slice(0, 300) };
  p.tests.push(t);
  const pl = E.dayPlan(p, date);
  if (pl?.kind === 'plan') p.log.push({ date, block: 'test', tpl: pl.tpl, week: pl.week, at: new Date().toISOString() });
  _testPick = null;
  save();
  cue(_testKind === 'aft' ? 'achievement' : 'setDone');
  rerender();
  // Reveal: count the total up and throw sparks off the result card.
  const el = document.querySelector('[data-p5count]');
  if (el) countUp(el, Number(el.dataset.p5count), { ms: 1200 });
  const card = document.querySelector('.p5-result');
  if (card) setTimeout(() => fxBurst(card, { kind: _testKind === 'aft' ? 'confetti' : 'sparks', count: _testKind === 'aft' ? 70 : 24 }), 200);
  celebrateObjectives(before, p);
};
window.p5DelTest = (id) => {
  const p = P(); if (!p) return;
  if (!confirm('Delete this result?')) return;
  p.tests = p.tests.filter((t) => t.id !== id); save(); rerender();
};

window.p5ImportTable = () => {
  const p = P(); if (!p) return;
  const txt = document.getElementById('p5-tbl')?.value || '';
  const cols = ['mdl', 'hrp', 'sdc', 'plk', 'tmr'];
  const rows = Object.fromEntries(cols.map((c) => [c, []]));
  let lines = 0;
  for (const line of txt.split(/\n+/)) {
    const cells = line.split(/[,\t;]/).map((x) => x.trim());
    if (!cells[0] || !/^\d{1,3}$/.test(cells[0])) continue;
    lines++;
    const pts = Number(cells[0]);
    cols.forEach((c, i) => {
      const v = cells[i + 1];
      if (!v) return;
      const raw = c === 'mdl' || c === 'hrp' ? Number(v) : E.parseTime(v);
      if (raw != null && Number.isFinite(raw)) rows[c].push([pts, raw]);
    });
  }
  if (!lines) return bad('p5-tbl', 'No rows found — each line starts with a point value.');
  const { key } = activeTable(p);
  if (!key) return bad('p5-tbl', 'Choose your category above first — tables are per age band.');
  const clean = {}, rejected = [];
  for (const c of cols) { if (!rows[c].length) continue; const v = validateRows(c, rows[c]); if (v) clean[c] = v; else rejected.push(eventDef(c).short); }
  if (rejected.length) return bad('p5-tbl', `Rejected: ${rejected.join(', ')} — values must improve as points go up, one row per point value.`);
  if (!Object.keys(clean).length) return bad('p5-tbl', 'No usable rows.');
  p.tables[key] = { ...(p.tables[key] || {}), ...clean };
  save(); toast(`Table saved for ${key}: ${Object.keys(clean).length} event${Object.keys(clean).length === 1 ? '' : 's'}`, { type: 'green' }); rerender();
};
window.p5DropTable = () => { const p = P(); const { key } = activeTable(p); if (!key) return; if (!confirm(`Remove the imported table for ${key}?`)) return; delete p.tables[key]; save(); rerender(); };

// ── COMBAT FIELD TEST (optional) ─────────────────────────────────────────────
function cftHTML(p) {
  const u = E.cftUnlocked(p, today());
  const best = (p.cft || []).reduce((b, c) => (!b || c.totalSec < b.totalSec ? c : b), null);
  return `${sectionHead('Combat Field Test', 'Optional stretch goal')}
<div class="card p5-cft ${u.unlocked ? '' : 'is-locked'}">
  <div class="p5-cft-head"><span class="p5-cft-ic" aria-hidden="true">${u.unlocked ? '🎖' : '🔒'}</span>
    <div><b>Seven events, one clock</b><div class="muted fs12">Official limit ${E.fmtTime(CFT.limitSec)}${p.prefs.cftGoal ? ` · your goal ${E.fmtTime(p.prefs.cftGoal)}` : ''}${best ? ` · best <b class="mono">${E.fmtTime(best.totalSec)}</b>` : ''}</div></div></div>
  <ol class="p5-cft-list fs12">${CFT.events.map((e) => `<li>${esc(e.name)}</li>`).join('')}</ol>
  <div class="muted fs11">Sequence per the Army’s April 2026 announcement — <a href="${CFT.source.url}" target="_blank" rel="noopener noreferrer">check current guidance</a> before you train for it; event details can change.</div>
  ${u.unlocked ? `<details class="p5-form"><summary class="label">Log a practice run</summary>
    <div class="p5-fields"><label>Date<input type="date" id="p5c-date" class="p5-in" value="${today()}"></label><label>Total time (m:ss)<input id="p5c-total" class="p5-in" placeholder="27:40"></label>
    ${CFT.events.map((e) => `<label>${esc(e.name.split(' — ')[0])} split<input id="p5c-${e.id}" class="p5-in" placeholder="m:ss"></label>`).join('')}
    <label class="p5-wide">Notes<input id="p5c-note" class="p5-in" maxlength="300"></label></div>
    <button class="btn btn-fire btn-sm" onclick="p5SaveCft()">Save</button></details>
    ${(p.cft || []).length ? `<div class="p5-cft-hist">${[...p.cft].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6).map((c) => `<span class="mono fs12 ${c.totalSec <= (p.prefs.cftGoal || 0) ? 'p5-ok' : c.totalSec <= CFT.limitSec ? '' : 'p5-bad'}">${esc(c.date)} · ${E.fmtTime(c.totalSec)}</span>`).join('')}</div>` : ''}`
  : `<div class="p5-note">Unlocks for demanding practice once you have: ${u.need.map(esc).join(' · ')}.</div>`}
</div>`;
}
window.p5SaveCft = () => {
  const p = P(); if (!p || !E.cftUnlocked(p, today()).unlocked) return;
  const date = document.getElementById('p5c-date')?.value;
  const total = E.parseTime(document.getElementById('p5c-total')?.value);
  if (!E.isYMD(date)) return bad('p5c-date', 'Pick a date.');
  if (!(total >= 60) || total > 7200) return bad('p5c-total', 'Enter the total time as m:ss.');
  const splits = {};
  for (const e of CFT.events) { const v = E.parseTime(document.getElementById(`p5c-${e.id}`)?.value); if (v > 0) splits[e.id] = v; }
  p.cft.push({ id: Date.now(), date, totalSec: total, splits, note: (document.getElementById('p5c-note')?.value || '').replace(/[<>"]/g, '').slice(0, 300) });
  const goal = p.prefs.cftGoal || 0;
  save(); cue(total <= goal ? 'achievement' : 'setDone');
  toast(total <= goal ? `Under ${E.fmtTime(goal)} — your goal is met!` : total <= CFT.limitSec ? 'Inside the 30-minute limit' : 'Logged — over the 30-minute limit, keep building', { type: total <= CFT.limitSec ? 'green' : 'fire' });
  rerender();
};

// ── REVIEW ───────────────────────────────────────────────────────────────────
function reviewHTML() {
  const p = P(), t = today();
  const wiNow = E.weekInfo(p, t) || {};
  const w = Math.max(1, Math.min(52, _reviewWeek || wiNow.week || 1));
  const rv = E.weekReview(p, w, t, ctx());
  if (!rv) return '<div class="card muted">No review available.</div>';
  const next = w < 52 ? E.weekStartDate(p, w + 1) : null;
  const u = distUnitLabel();
  return `
<div class="p5-daynav"><button class="btn btn-ghost btn-sm" onclick="p5ReviewWeek(${w - 1})" ${w <= 1 ? 'disabled' : ''} aria-label="Previous week">‹</button>
  <b>Week ${w} · ${fmtDate(rv.mon, { month: 'short', day: 'numeric' })} – ${fmtDate(rv.sun, { month: 'short', day: 'numeric' })}</b>
  <button class="btn btn-ghost btn-sm" onclick="p5ReviewWeek(${w + 1})" ${w >= 52 ? 'disabled' : ''} aria-label="Next week">›</button></div>
${weekStripHTML(rv)}
<div class="p5-tiles">
  ${[['Sessions', `${rv.completed}/${rv.scheduled}`], ['Training time', `${Math.round(rv.minutes)} min`], ['Lifting volume', formatWeight(rv.volume)],
     ['Running', `${toDisplayDist(rv.runMiles)} ${u}`], ['Avg pace', rv.runPace ? `${E.fmtTime(u === 'km' ? rv.runPace / 1.609344 : rv.runPace)}/${u}` : '—'],
     ['Swim', `${Math.round(rv.swimMin)} min`], ['Soccer', `${rv.soccer.length} session${rv.soccer.length === 1 ? '' : 's'}`], ['PRs', rv.prs.length],
     ['Sleep', rv.avgSleep != null ? `${rv.avgSleep.toFixed(1)} h` : '—'], ['Soreness', rv.soreness != null ? `${rv.soreness.toFixed(1)}/10` : '—']]
    .map(([l, v]) => `<div class="card p5-tile"><span class="label">${l}</span><b class="mono">${v}</b></div>`).join('')}
</div>
${rv.tests.length ? `<div class="card fs12">🎯 ${rv.tests.length} test${rv.tests.length === 1 ? '' : 's'} recorded: ${rv.tests.map((x) => Object.entries(x.events).map(([k, v]) => `${eventDef(k).short} ${fmtEvent(k, v.raw)}`).join(', ')).join(' · ')}</div>` : ''}
${sectionHead('Recommendations', 'From what you logged')}
<div class="card">${rv.recs.length ? `<ul class="p5-recs">${rv.recs.map((x) => `<li class="is-${x.level}">${esc(x.text)}${x.move ? ` <button class="p5-link" onclick="p5Move('${x.move.from}','${x.move.to}')">Move it</button>` : ''}</li>`).join('')}</ul>` : '<span class="muted fs12">Nothing logged yet this week.</span>'}</div>
${next ? `${sectionHead(`Week ${w + 1}`, E.isDeload(w + 1) ? 'Deload week' : '')}<div class="card p5-list">${Array.from({ length: 7 }, (_, i) => E.dayPlan(p, E.addDays(next, i))).map((pl) => pl && pl.kind === 'plan' ? `<button class="p5-row" onclick="p5Open('${pl.date}')"><span>${pl.icon}</span><span><b>${esc(pl.name)}</b><span class="muted fs11">${fmtDate(pl.date)} · ${esc(pl.dur)}</span></span></button>` : '').join('')}</div>` : ''}`;
}

window.p5TargetsFromTable = () => {
  const { table } = activeTable(); if (!table) return;
  const fill = (id, v, fmt) => { const el = document.getElementById(id); if (el && !el.value && v != null) el.value = fmt(v); };
  fill('p5u-t-mdl', E.table100(table, 'mdl'), (x) => toDisplayWeight(x));
  fill('p5u-t-hrp', E.table100(table, 'hrp'), (x) => x);
  for (const id of ['sdc', 'plk', 'tmr']) fill(`p5u-t-${id}`, E.table100(table, id), E.fmtTime);
  toast('Filled from the table — save to keep them', { type: 'green' });
};

// ── SERVICE RECORD (the gamified spine of Project 500) ───────────────────────
function serviceHTML(p, R, rv) {
  const wk = rv ? R.weeks.find((w) => w.week === rv.week) : null;
  const need = rv ? Math.min(rv.scheduled, Math.max(4, rv.scheduled - 1)) : 0;
  const done = rv ? rv.completed : 0;
  const c = 2 * Math.PI * 22;
  return `
<div class="card p5-svc">
  <button class="p5-svc-id" onclick="p5Tab('overview');document.getElementById('p5-ladder')?.scrollIntoView({behavior:'smooth',block:'center'})" aria-label="Service grade ${esc(R.name)}">
    <span class="p5-svc-ins">${insigniaSVG(R, { size: 64 })}</span>
    <span class="p5-svc-who"><span class="label">Service grade · ${R.points} pts</span><b>${esc(R.name)}</b>
      <span class="gm-bar gm-bar-sm"><i style="width:${(R.pct * 100).toFixed(1)}%"></i></span>
      <span class="muted fs11">${R.next ? `${R.next.min - R.points} pts to ${esc(R.next.name)}` : 'Top grade reached'}</span></span>
  </button>
  <div class="p5-svc-mission">
    <span class="p5-mring"><svg viewBox="0 0 52 52" width="52" height="52" aria-hidden="true"><circle cx="26" cy="26" r="22" class="gm-ring-track" stroke-width="5"/><circle cx="26" cy="26" r="22" class="gm-ring-fill ${wk?.met ? 'is-met' : ''}" stroke-width="5" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - Math.min(1, need ? done / need : 0))).toFixed(1)}" style="--c:${c.toFixed(1)}" transform="rotate(-90 26 26)"/></svg><b class="mono">${done}/${need || '—'}</b></span>
    <span><span class="label">Weekly mission</span><b>${wk?.met ? 'Complete ✓' : rv ? `${Math.max(0, need - done)} session${need - done === 1 ? '' : 's'} to go` : 'Starts week 1'}</b>
      <span class="muted fs11">${R.streak > 1 ? `🔥 ${R.streak} in a row · ` : ''}+75 XP · ${R.missions} complete</span></span>
  </div>
  <div class="p5-svc-points muted fs11">Objective 4 · mission 2 · full AFT 3 · event check 1</div>
</div>`;
}
function ladderHTML(R) {
  return `<div class="card p5-ladder" id="p5-ladder" role="list">${E.GRADES.map((g, i) => `<div class="p5-rung ${i < R.index ? 'is-done' : i === R.index ? 'is-here' : ''}" role="listitem" aria-label="${esc(g.name)}, ${g.min} points">
    <span class="p5-rung-ins">${insigniaSVG({ ...g, index: i }, { size: i === R.index ? 46 : 34 })}</span><span class="p5-rung-name">${esc(g.abbr)}</span><span class="mono fs10 muted">${g.min}</span></div>`).join('<span class="p5-rung-link" aria-hidden="true"></span>')}</div>`;
}

// ── SETUP / BASELINE ─────────────────────────────────────────────────────────
function setupHTML(first) {
  const p = P() || E.newProgram();
  const b = p.baseline || {};
  const prof = state.profile || {};
  const lastW = (state.bodyLog || []).find((e) => Number(e.weight) > 0);
  const band = p.standard.band || bandForAge(prof.age);
  const sex = p.standard.sex || (['male', 'female'].includes(prof.sex) ? prof.sex : null);
  const tg = p.targets || {};
  const { table } = activeTable(p);
  const eq = p.prefs.equip || {};
  const chk = (k, l) => `<label class="p5-check"><input type="checkbox" id="p5e-${k}" ${eq[k] !== false ? 'checked' : ''}> ${l}</label>`;
  const numIn = (id, v, attrs = '') => `<input id="${id}" class="p5-in" type="number" inputmode="decimal" ${attrs} value="${v ?? ''}">`;
  return `
<div class="card p5-setup">
  ${first ? '<div class="label">Set up your program</div><p class="muted fs12">Every field is optional except the start date. Skip anything you have not measured — nothing is ever filled in for you, and you can add results later on Tests.</p>' : ''}
  <h3 class="p5-h3">Program</h3>
  <div class="p5-fields">
    <label>Start date<input type="date" id="p5u-start" class="p5-in" value="${p.startDate}"></label>
    <label>Preferred session time<input type="time" id="p5u-time" class="p5-in" value="${esc(p.prefs.time)}"></label>
    <label>Saturday default<select id="p5u-sat" class="p5-in"><option value="military" ${p.prefs.sat !== 'soccer' ? 'selected' : ''}>Military conditioning</option><option value="soccer" ${p.prefs.sat === 'soccer' ? 'selected' : ''}>Soccer</option></select></label>
    <label>Scoring standard<select id="p5u-std" class="p5-in">${Object.entries(AFT.standards).map(([k, s]) => `<option value="${k}" ${p.standard.std === k ? 'selected' : ''}>${s.label}</option>`).join('')}</select></label>
    <label>Sex (for general tables)<select id="p5u-sex" class="p5-in"><option value="">—</option><option value="male" ${sex === 'male' ? 'selected' : ''}>Male</option><option value="female" ${sex === 'female' ? 'selected' : ''}>Female</option></select></label>
    <label>Age band<select id="p5u-band" class="p5-in"><option value="">—</option>${AFT.ageBands.map((x) => `<option ${band === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
  </div>
  <div class="p5-equip"><span class="label">Equipment you can use</span>${chk('trapbar', 'Trap / hex bar')}${chk('sled', 'Sled')}${chk('pool', 'Pool')}${chk('dumbbells', 'Dumbbells')}</div>
  <h3 class="p5-h3">Body + recovery <span class="muted fs11">(optional)</span></h3>
  <div class="p5-fields">
    <label>Body weight (${weightUnitLabel()})${numIn('p5u-weight', b.weight ? toDisplayWeight(b.weight) : lastW ? toDisplayWeight(lastW.weight) : '', 'min="50" step="0.1"')}</label>
    <label>Height (cm)${numIn('p5u-height', b.height ?? (prof.height >= 100 && prof.height <= 250 ? Math.round(prof.height) : ''), 'min="100" max="250"')}</label>
    <label>Waist (in)${numIn('p5u-waist', b.waist, 'min="15" max="100" step="0.1"')}</label>
    <label>Resting heart rate${numIn('p5u-rhr', b.rhr, 'min="25" max="150"')}</label>
    <label>Max heart rate (if known)${numIn('p5u-mhr', b.maxHr, 'min="100" max="230"')}</label>
    <label>Current running<select id="p5u-run" class="p5-in"><option value="">—</option>${RUN_LEVELS.map((r) => `<option value="${r.id}" ${b.runLevel === r.id ? 'selected' : ''}>${esc(r.label)}</option>`).join('')}</select></label>
    <label class="p5-wide">Injuries or limitations<input id="p5u-inj" class="p5-in" maxlength="500" value="${esc(b.injuries || '')}"></label>
  </div>
  <h3 class="p5-h3">Performance baseline <span class="muted fs11">(optional — spread over several days)</span></h3>
  <p class="muted fs12">Don’t max out on a lift you are not practised at. For the deadlift, give a weight you can lift <b>safely for 3 good reps</b> — not a true max. Leave blanks for anything you have not done; the program starts conservatively and the first event checks fill them in.</p>
  <div class="p5-fields">
    <label>Safe 3-rep trap-bar deadlift (${weightUnitLabel()})${numIn('p5u-dl3', b.dl3 ? toDisplayWeight(b.dl3) : '', `min="0" step="${weightInputStep()}"`)}</label>
    <label>Hand-release push-ups (2 min)${numIn('p5u-hrp', b.hrp, 'min="0" max="300" inputmode="numeric"')}</label>
    <label>Plank max (m:ss)<input id="p5u-plk" class="p5-in" placeholder="2:00" value="${b.plk ? E.fmtTime(b.plk) : ''}"></label>
    <label>2-mile run (m:ss)<input id="p5u-tmr" class="p5-in" placeholder="18:30" value="${b.tmr ? E.fmtTime(b.tmr) : ''}"></label>
    <label>Sprint-drag-carry (m:ss)<input id="p5u-sdc" class="p5-in" placeholder="2:20" value="${b.sdc ? E.fmtTime(b.sdc) : ''}"></label>
  </div>
  <h3 class="p5-h3">Your targets <span class="muted fs11">(optional — the year’s finish line)</span></h3>
  <p class="muted fs12">Set where each event should end up. Phase milestones are worked out from your own starting point: each phase closes a quarter of the gap. Leave a target blank to use the 100-point value from a loaded scoring table.</p>
  <div class="p5-fields">
    <label>Deadlift, 3 reps (${weightUnitLabel()})${numIn('p5u-t-mdl', tg.mdl ? toDisplayWeight(tg.mdl) : '', `min="0" step="${weightInputStep()}"`)}</label>
    <label>Hand-release push-ups${numIn('p5u-t-hrp', tg.hrp, 'min="1" max="300" inputmode="numeric"')}</label>
    <label>Sprint-drag-carry (m:ss)<input id="p5u-t-sdc" class="p5-in" placeholder="m:ss" value="${tg.sdc ? E.fmtTime(tg.sdc) : ''}"></label>
    <label>Plank (m:ss)<input id="p5u-t-plk" class="p5-in" placeholder="m:ss" value="${tg.plk ? E.fmtTime(tg.plk) : ''}"></label>
    <label>2-mile run (m:ss)<input id="p5u-t-tmr" class="p5-in" placeholder="m:ss" value="${tg.tmr ? E.fmtTime(tg.tmr) : ''}"></label>
    <label>Combat Field Test goal (m:ss)<input id="p5u-cft" class="p5-in" placeholder="m:ss" value="${p.prefs.cftGoal ? E.fmtTime(p.prefs.cftGoal) : ''}"></label>
  </div>
  ${table ? `<button class="btn btn-ghost btn-sm" onclick="p5TargetsFromTable()">Fill blanks with the table’s 100-point values</button>` : ''}
  <div class="p5-btns"><button class="btn btn-fire" onclick="p5SaveSetup(${first ? 1 : 0})">${first ? 'Start Project 500' : 'Save changes'}</button>
  ${!first ? `<button class="btn btn-ghost btn-sm" onclick="p5SetDlWork()">Set deadlift working weight…</button><button class="btn btn-danger btn-sm" onclick="p5Reset()">Remove Project 500</button>` : ''}</div>
  ${!first ? '<p class="muted fs11">Removing Project 500 deletes its schedule, tests and check-ins. Workouts, runs and activities you logged stay in your history.</p>' : ''}
</div>`;
}

window.p5SaveSetup = (first) => {
  const p = state.p500 || E.newProgram();
  const v = (id) => document.getElementById(id)?.value?.trim() ?? '';
  const start = v('p5u-start');
  if (!E.isYMD(start)) return bad('p5u-start', 'Pick a start date.');
  const num = (id, lo, hi) => { const s = v(id); if (s === '') return null; const n = Number(s); return n >= lo && n <= hi ? n : NaN; };
  const time = (id, lo, hi) => { const s = v(id); if (s === '') return null; const n = E.parseTime(s); return n != null && n >= lo && n <= hi ? n : NaN; };
  const f = {
    weight: num('p5u-weight', 1, 2000), height: num('p5u-height', 100, 250), waist: num('p5u-waist', 15, 100), rhr: num('p5u-rhr', 25, 150),
    maxHr: num('p5u-mhr', 100, 230), dl3: num('p5u-dl3', 1, 3000), hrp: num('p5u-hrp', 0, 300),
    plk: time('p5u-plk', 1, 3600), tmr: time('p5u-tmr', 300, 7200), sdc: time('p5u-sdc', 20, 1800),
    tmdl: num('p5u-t-mdl', 1, 3000), thrp: num('p5u-t-hrp', 1, 300), tsdc: time('p5u-t-sdc', 20, 1800), tplk: time('p5u-t-plk', 1, 3600),
    ttmr: time('p5u-t-tmr', 300, 7200), cft: time('p5u-cft', 300, 3600),
  };
  const ids = { tmdl: 'p5u-t-mdl', thrp: 'p5u-t-hrp', tsdc: 'p5u-t-sdc', tplk: 'p5u-t-plk', ttmr: 'p5u-t-tmr', cft: 'p5u-cft', weight: 'p5u-weight', height: 'p5u-height', waist: 'p5u-waist', rhr: 'p5u-rhr', maxHr: 'p5u-mhr', dl3: 'p5u-dl3', hrp: 'p5u-hrp', plk: 'p5u-plk', tmr: 'p5u-tmr', sdc: 'p5u-sdc' };
  for (const [k, x] of Object.entries(f)) if (Number.isNaN(x)) return bad(ids[k], 'That value is out of range — check it or leave it blank.');
  const weightLb = f.weight != null ? Math.round(toStoredWeight(f.weight) * 10) / 10 : null;
  const dl3Lb = f.dl3 != null ? Math.round(toStoredWeight(f.dl3) * 10) / 10 : null;
  p.startDate = start;
  p.prefs.time = /^([01]\d|2[0-3]):[0-5]\d$/.test(v('p5u-time')) ? v('p5u-time') : p.prefs.time;
  p.prefs.sat = v('p5u-sat') === 'soccer' ? 'soccer' : 'military';
  p.prefs.equip = Object.fromEntries(['trapbar', 'sled', 'pool', 'dumbbells'].map((k) => [k, !!document.getElementById(`p5e-${k}`)?.checked]));
  if (AFT.standards[v('p5u-std')]) p.standard.std = v('p5u-std');
  p.standard.sex = ['male', 'female'].includes(v('p5u-sex')) ? v('p5u-sex') : null;
  p.standard.band = AFT.ageBands.includes(v('p5u-band')) ? v('p5u-band') : null;
  p.targets = Object.fromEntries([['mdl', f.tmdl != null ? Math.round(toStoredWeight(f.tmdl)) : null], ['hrp', f.thrp], ['sdc', f.tsdc], ['plk', f.tplk], ['tmr', f.ttmr]].filter(([, x]) => x != null));
  p.prefs.cftGoal = f.cft;
  const prevB = p.baseline || {};
  const b = { date: prevB.date || today() };
  if (weightLb) b.weight = weightLb;
  for (const k of ['height', 'waist', 'rhr', 'maxHr', 'hrp', 'plk', 'tmr', 'sdc']) if (f[k] != null) b[k] = f[k];
  if (dl3Lb) b.dl3 = dl3Lb;
  if (RUN_LEVELS.some((r) => r.id === v('p5u-run'))) b.runLevel = v('p5u-run');
  if (v('p5u-inj')) b.injuries = v('p5u-inj').replace(/[<>"]/g, '').slice(0, 500);
  p.baseline = b;
  // The deadlift starts from the safe 3-rep weight unless one is already set.
  p.lifts.trap_dl = p.lifts.trap_dl || { work: null, hist: [] };
  if (!p.lifts.trap_dl.work && b.dl3) {
    p.lifts.trap_dl.work = E.deadliftStart(b);
    p.lifts.trap_dl.hist.push({ date: today(), from: null, to: p.lifts.trap_dl.work, change: 0, reason: `Start: ~88% of your safe 3-rep weight (${b.dl3} lb), 2–3 reps in reserve.` });
  }
  // Body data goes where the rest of the app reads it — once, and only what
  // was actually entered (and changed).
  const waistChanged = f.waist != null && f.waist !== prevB.waist;
  const weightChanged = weightLb != null && weightLb !== prevB.weight && !(state.bodyLog || []).some((e) => e.date?.slice(0, 10) === today() && Number(e.weight) === weightLb);
  if (weightChanged || waistChanged) addBodyCheckIn({ date: new Date().toISOString(), ...(weightChanged ? { weight: weightLb } : {}), ...(waistChanged ? { measurements: { waist: f.waist } } : {}), notes: 'Project 500 baseline', source: 'manual' });
  if (f.rhr != null && f.rhr !== prevB.rhr) {
    let id = Object.entries(state.metricDefs || {}).find(([, d]) => d.name.toLowerCase() === 'resting heart rate')?.[0];
    if (!id) id = addMetricDef({ name: 'Resting heart rate', unit: 'bpm', dir: 'down', decimals: 0 });
    if (id) addMetricEntry(id, f.rhr, new Date().toISOString());
  }
  if (b.height && state.profile && !(state.profile.height > 0)) state.profile.height = b.height;
  if (first) p.status = 'active';
  state.p500 = p;
  save(); cue(first ? 'start' : 'select');
  toast(first ? `Project 500 is set — day 1 is ${fmtDate(start)}` : 'Saved', { type: 'green' });
  if (first) _tab = 'overview';
  rerender();
};
window.p5SetDlWork = () => {
  const p = P(); if (!p) return;
  const cur = p.lifts?.trap_dl?.work;
  const v = prompt(`Deadlift working weight for heavy days (${weightUnitLabel()}). The program progresses from here.`, cur ? toDisplayWeight(cur) : '');
  if (v == null) return;
  const n = Number(v);
  if (!(n > 0) || n > 1500) return toast('Enter a weight.', { type: 'danger' });
  const lb = Math.round(toStoredWeight(n) / 5) * 5;
  p.lifts.trap_dl = p.lifts.trap_dl || { hist: [] };
  p.lifts.trap_dl.hist = p.lifts.trap_dl.hist || [];
  p.lifts.trap_dl.hist.push({ date: today(), from: cur || null, to: lb, change: cur ? lb - cur : 0, reason: 'Set by hand.' });
  p.lifts.trap_dl.work = lb; p.lifts.trap_dl.manual = true;
  save(); toast(`Working weight ${formatWeight(lb)}`, { type: 'green' }); rerender();
};
window.p5Reset = () => {
  if (!confirm('Remove Project 500? Its schedule, tests and check-ins are deleted. Your logged workouts, runs and activities stay.')) return;
  state.p500 = null; _tab = 'overview'; save(); rerender();
};

// ── DASHBOARD CARD (Today page) ──────────────────────────────────────────────
export function p500DashCardHTML() {
  const p = P();
  if (!p || p.status === 'setup') return '';
  const t = today();
  const st = E.dayStatus(p, t, t);
  const pl = st.plan;
  if (!pl || pl.kind === 'done') return '';
  const wi = E.weekInfo(p, t) || {};
  const label = pl.kind === 'pre' ? `Starts ${fmtDate(p.startDate)}` : pl.kind === 'paused' ? 'Paused' : `W${pl.week} · ${pl.name}`;
  return `<button class="card p5-dash" onclick="navigate('project500')">
    <span class="p5-dash-ic" aria-hidden="true">${insigniaSVG(E.serviceRecord(p, t), { size: 34 })}</span>
    <span class="p5-dash-body"><span class="label">Project 500${wi.week ? ` · Phase ${wi.phase}` : ''}</span><b>${esc(label)}</b>
      <span class="muted fs11">${pl.kind === 'plan' ? `${STATUS_LABEL[st.status] || ''} · ${esc(pl.dur)} · ` : ''}${esc(E.serviceRecord(p, t).abbr)} · ${E.objectivesMet(p)}/20 objectives</span></span>
    <span class="p5-dash-go" aria-hidden="true">›</span></button>`;
}
