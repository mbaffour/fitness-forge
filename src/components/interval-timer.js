// ═══════════════════════════════════════════
//   FITNESS FORGE — Interval Timer
//   Tabata · EMOM · AMRAP · Intervals ·
//   Stopwatch · Countdown
// ═══════════════════════════════════════════
//
// Time is read from timestamps, never counted in ticks. A phone that locks, or
// a tab the browser throttles to one tick a second, comes back to the right
// phase and the right second — `setInterval` counting would drift and stall.
// Everything is a list of phases worked out up front; where you are is just
// "how much running time has passed" looked up against that list.
//
// The timer keeps running when you leave the page: a small pill above the tab
// bar shows the phase and seconds and takes you back.

import { state, save, localDateStr } from '../store.js';
import { cue, acquireWakeLock, releaseWakeLock, fxBurst, reducedMotion } from './feedback.js';
import { pageHeader, segGroup, toast } from './ui.js';

const MODES = [
  { id: 'tabata',    label: 'Tabata' },
  { id: 'emom',      label: 'EMOM' },
  { id: 'amrap',     label: 'AMRAP' },
  { id: 'intervals', label: 'Intervals' },
  { id: 'stopwatch', label: 'Stopwatch' },
  { id: 'countdown', label: 'Countdown' },
];

const ABOUT = {
  tabata:    'Hard work, short rest, repeated. The classic is 20s on, 10s off, eight rounds — four minutes that feel like forty.',
  emom:      'Every minute on the minute: do the reps when the minute starts, rest whatever is left. Faster reps buy you more rest.',
  amrap:     'As many rounds as possible before the clock runs out. Tap +1 each time you finish a round.',
  intervals: 'Your own work and rest. Add sets with a longer break between them for circuits.',
  stopwatch: 'Counts up. Lap it for splits — rounds “for time”, a run, a carry.',
  countdown: 'A plain countdown — a plank, a hold, a rest you want to respect.',
};

// Field definitions per mode: [key, label, min, max, step, unit]
const FIELDS = {
  tabata:    [['work', 'Work', 5, 300, 5, 's'], ['rest', 'Rest', 0, 300, 5, 's'], ['rounds', 'Rounds', 1, 50, 1, ''], ['sets', 'Sets', 1, 10, 1, ''], ['setRest', 'Rest between sets', 0, 600, 15, 's']],
  emom:      [['every', 'Every', 15, 600, 15, 's'], ['rounds', 'Rounds', 1, 60, 1, '']],
  amrap:     [['duration', 'Time cap', 60, 7200, 60, 's']],
  intervals: [['work', 'Work', 5, 1800, 5, 's'], ['rest', 'Rest', 0, 900, 5, 's'], ['rounds', 'Rounds', 1, 60, 1, ''], ['sets', 'Sets', 1, 10, 1, ''], ['setRest', 'Rest between sets', 0, 900, 15, 's']],
  stopwatch: [['cap', 'Time cap (0 = none)', 0, 7200, 60, 's']],
  countdown: [['duration', 'Duration', 5, 7200, 5, 's']],
};

const DEFAULTS = {
  tabata:    { work: 20, rest: 10, rounds: 8, sets: 1, setRest: 60 },
  emom:      { every: 60, rounds: 10 },
  amrap:     { duration: 720 },
  intervals: { work: 40, rest: 20, rounds: 10, sets: 1, setRest: 60 },
  stopwatch: { cap: 0 },
  countdown: { duration: 60 },
};

const PRESETS = {
  tabata:    [['Classic 20/10 × 8', { work: 20, rest: 10, rounds: 8, sets: 1 }], ['Double Tabata', { work: 20, rest: 10, rounds: 8, sets: 2, setRest: 60 }], ['Tabata × 4', { work: 20, rest: 10, rounds: 8, sets: 4, setRest: 60 }]],
  emom:      [['EMOM 10', { every: 60, rounds: 10 }], ['EMOM 20', { every: 60, rounds: 20 }], ['E2MOM × 6', { every: 120, rounds: 6 }]],
  amrap:     [['AMRAP 8', { duration: 480 }], ['AMRAP 12', { duration: 720 }], ['AMRAP 20', { duration: 1200 }]],
  intervals: [['40 / 20 × 10', { work: 40, rest: 20, rounds: 10, sets: 1 }], ['30 / 30 × 12', { work: 30, rest: 30, rounds: 12, sets: 1 }], ['45 / 15 × 8 · 3 sets', { work: 45, rest: 15, rounds: 8, sets: 3, setRest: 90 }]],
  stopwatch: [['No cap', { cap: 0 }], ['20-min cap', { cap: 1200 }]],
  countdown: [['1 min', { duration: 60 }], ['3 min', { duration: 180 }], ['10 min', { duration: 600 }]],
};

const PREP = 10;   // seconds of "get ready" before the first work phase
const fmt = (sec) => {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
};
const clampNum = (v, min, max) => Math.max(min, Math.min(max, Math.round(Number(v) || 0)));

// ── CONFIG (persisted per mode in settings.timer) ───────────────────────────
function store() {
  const t = state.settings.timer && typeof state.settings.timer === 'object' ? state.settings.timer : {};
  if (!MODES.some((m) => m.id === t.mode)) t.mode = 'tabata';
  if (!t.cfg || typeof t.cfg !== 'object') t.cfg = {};
  state.settings.timer = t;
  return t;
}
function cfgFor(mode) {
  const saved = store().cfg[mode] || {};
  const out = { ...DEFAULTS[mode] };
  for (const [k, , min, max] of FIELDS[mode]) if (saved[k] != null) out[k] = clampNum(saved[k], min, max);
  return out;
}

// ── PHASES ──────────────────────────────────────────────────────────────────
function buildPhases(mode, c) {
  const P = [];
  if (mode !== 'stopwatch') P.push({ kind: 'prep', dur: PREP });
  if (mode === 'tabata' || mode === 'intervals') {
    for (let s = 1; s <= c.sets; s++) {
      for (let r = 1; r <= c.rounds; r++) {
        P.push({ kind: 'work', dur: c.work, round: r, rounds: c.rounds, set: s, sets: c.sets });
        const lastInSet = r === c.rounds;
        if (!lastInSet && c.rest > 0) P.push({ kind: 'rest', dur: c.rest, round: r, rounds: c.rounds, set: s, sets: c.sets });
      }
      if (s < c.sets && c.setRest > 0) P.push({ kind: 'setrest', dur: c.setRest, set: s, sets: c.sets });
    }
  } else if (mode === 'emom') {
    for (let r = 1; r <= c.rounds; r++) P.push({ kind: 'work', dur: c.every, round: r, rounds: c.rounds });
  } else if (mode === 'amrap' || mode === 'countdown') {
    P.push({ kind: 'work', dur: c.duration });
  }
  let t = 0;
  for (const p of P) { p.start = t; t += p.dur; }
  return P;
}
const totalOf = (P) => (P.length ? P[P.length - 1].start + P[P.length - 1].dur : 0);

// ── RUN STATE ───────────────────────────────────────────────────────────────
// Module-level so the timer survives navigating away and back.
let R = null;   // { mode, cfg, phases, total, t0, pausedAt, pausedMs, idx, beeped, rounds, laps, done, stopped }
let _raf = 0, _iv = 0;

function elapsed() {
  if (!R) return 0;
  const now = R.pausedAt ?? performance.now();
  return Math.max(0, (now - R.t0 - R.pausedMs) / 1000);
}

function phaseAt(t) {
  const P = R.phases;
  for (let i = 0; i < P.length; i++) if (t < P[i].start + P[i].dur) return i;
  return P.length;   // finished
}

const LABEL = { prep: 'Get ready', work: 'Work', rest: 'Rest', setrest: 'Set rest' };
function phaseLabel(p) {
  if (!p) return 'Done';
  if (R.mode === 'emom' && p.kind === 'work') return `Minute ${p.round}`;
  if (R.mode === 'amrap' && p.kind === 'work') return 'AMRAP';
  if (R.mode === 'countdown' && p.kind === 'work') return 'Go';
  return LABEL[p.kind];
}

function start() {
  const t = store();
  const mode = t.mode;
  const c = cfgFor(mode);
  const phases = buildPhases(mode, c);
  R = { mode, cfg: c, phases, total: totalOf(phases), t0: performance.now(), pausedAt: null, pausedMs: 0,
        idx: -1, beeped: {}, rounds: 0, laps: [], done: false, startedWall: Date.now() };
  acquireWakeLock();
  cue('start');
  loop();
  render();
}

function stop(finished = false) {
  if (!R) return;
  R.done = true;
  R.finished = finished;
  // A session that ended while the screen was off is noticed late; it still
  // lasted exactly as long as its plan, not until the phone was picked up.
  R.endElapsed = finished && R.mode !== 'stopwatch' ? Math.min(elapsed(), R.total)
    : finished && R.cfg.cap ? Math.min(elapsed(), R.cfg.cap) : elapsed();
  R.pausedAt = R.pausedAt ?? performance.now();
  cancelAnimationFrame(_raf); clearInterval(_iv); _raf = 0; _iv = 0;
  releaseWakeLock();
  _title(null);
  _mini(null);
  render();
}

function togglePause() {
  if (!R || R.done) return;
  if (R.pausedAt == null) { R.pausedAt = performance.now(); cue('select'); }
  else { R.pausedMs += performance.now() - R.pausedAt; R.pausedAt = null; cue('select'); }
  render();
}

// Skip to the start of the next phase by moving the clock, not the index — so
// everything downstream (beeps, rounds, totals) stays consistent.
function skip() {
  if (!R || R.done || R.mode === 'stopwatch') return;
  const i = phaseAt(elapsed());
  const p = R.phases[i];
  if (!p) return;
  R.t0 -= (p.start + p.dur - elapsed()) * 1000 + 1;
  cue('select');
}

function tick() {
  if (!R || R.done) return;
  const t = elapsed();
  if (R.mode === 'stopwatch') {
    if (R.cfg.cap && t >= R.cfg.cap) { cue('finish'); stop(true); return; }
    _paint(t); return;
  }
  const i = phaseAt(t);
  if (i >= R.phases.length) {
    cue('finish');
    if (!reducedMotion()) fxBurst({ x: innerWidth / 2, y: innerHeight / 2 }, { kind: 'confetti', count: 70 });
    stop(true); return;
  }
  const p = R.phases[i];
  if (i !== R.idx) {
    // Phase boundary. If several passed while the screen was off, only the
    // current one is announced.
    R.idx = i;
    if (R.pausedAt == null) {
      if (p.kind === 'work') cue('go');
      else if (p.kind === 'rest' || p.kind === 'setrest') cue('rest');
      const ring = document.querySelector('.it-ring');
      if (ring && p.kind === 'work' && !reducedMotion()) fxBurst(ring, { kind: 'sparks', count: 16, power: 0.8 });
    }
    _flash(p.kind);
  }
  // 3-2-1 before every phase change, once each.
  const left = p.start + p.dur - t;
  const sec = Math.ceil(left);
  const k = `${i}:${sec}`;
  if (sec <= 3 && sec >= 1 && !R.beeped[k] && R.pausedAt == null && p.dur > 4) { R.beeped[k] = true; cue('tick'); }
  // EMOM / long work: a halfway nudge on work phases of a minute or more.
  if (p.kind === 'work' && p.dur >= 60 && R.mode !== 'amrap' && R.mode !== 'countdown') {
    const hk = `${i}:half`;
    if (!R.beeped[hk] && t - p.start >= p.dur / 2 && R.pausedAt == null) { R.beeped[hk] = true; cue('warmup'); }
  }
  // AMRAP: a minute-left warning.
  if (R.mode === 'amrap' && p.kind === 'work' && left <= 60 && !R.beeped.min && p.dur > 90) { R.beeped.min = true; cue('transition'); }
  _paint(t);
}

function loop() {
  cancelAnimationFrame(_raf); clearInterval(_iv);
  const f = () => { tick(); if (R && !R.done) _raf = requestAnimationFrame(f); };
  _raf = requestAnimationFrame(f);
  // rAF stops when the tab is hidden; this keeps beeps and the title going.
  _iv = setInterval(tick, 250);
}

// ── VIEW ────────────────────────────────────────────────────────────────────
const RING_R = 108, RING_C = 2 * Math.PI * RING_R;

function _paint(t) {
  const root = document.getElementById('it-run');
  const isStop = R.mode === 'stopwatch';
  // From the clock, not R.idx: the first paint happens before the first tick.
  const i = isStop ? 0 : Math.min(phaseAt(t), R.phases.length - 1);
  const p = isStop ? { kind: 'work', dur: R.cfg.cap || 60, start: 0 } : R.phases[i];
  const left = isStop ? t : p.start + p.dur - t;
  const frac = isStop ? (R.cfg.cap ? t / R.cfg.cap : (t % 60) / 60) : 1 - (left / p.dur);
  const label = isStop ? (R.pausedAt != null ? 'Paused' : 'Running') : (R.pausedAt != null ? 'Paused' : phaseLabel(p));
  _title(`${fmt(isStop ? t : left)} ${label.toUpperCase()}`);
  _mini({ time: fmt(isStop ? t : left), label, kind: isStop ? 'work' : p.kind });
  if (!root) return;
  root.dataset.kind = isStop ? 'work' : p.kind;
  root.classList.toggle('is-paused', R.pausedAt != null);
  const set = (sel, v) => { const el = root.querySelector(sel); if (el && el.textContent !== v) el.textContent = v; };
  set('.it-time', fmt(isStop ? t : left));
  set('.it-phase', label);
  const arc = root.querySelector('.it-arc');
  if (arc) arc.style.strokeDashoffset = String(RING_C * (1 - Math.max(0, Math.min(1, frac))));
  if (!isStop) {
    const sub = p.round ? `Round ${p.round} / ${p.rounds}${p.sets > 1 ? ` · Set ${p.set} / ${p.sets}` : ''}`
      : p.kind === 'setrest' ? `Set ${p.set} done · ${p.sets - p.set} to go` : p.kind === 'prep' ? 'Starting soon' : '';
    set('.it-sub', sub);
    const nx = R.phases[i + 1];
    set('.it-next', nx ? `Next: ${phaseLabel(nx)} ${fmt(nx.dur)}` : 'Last one — finish strong');
    const tot = root.querySelector('.it-total i');
    if (tot) tot.style.width = `${Math.min(100, (t / R.total) * 100).toFixed(1)}%`;
    set('.it-remaining', `${fmt(Math.max(0, R.total - t))} left`);
  } else {
    set('.it-sub', R.laps.length ? `Lap ${R.laps.length + 1}` : '');
    set('.it-next', R.cfg.cap ? `Cap ${fmt(R.cfg.cap)}` : 'No time cap');
  }
}

function _flash(kind) {
  const root = document.getElementById('it-run');
  if (!root || reducedMotion()) return;
  root.classList.remove('it-flash'); void root.offsetWidth; root.classList.add('it-flash');
}

let _baseTitle = null;
function _title(txt) {
  if (_baseTitle == null) _baseTitle = document.title;
  document.title = txt ? `${txt} · Forge` : _baseTitle;
}

// Floating pill while the timer runs and you are on another page.
function _mini(info) {
  let el = document.getElementById('it-mini');
  const onPage = document.getElementById('page-timer')?.classList.contains('active');
  if (!info || onPage) { if (el) el.remove(); return; }
  if (!el) {
    el = document.createElement('button');
    el.id = 'it-mini';
    el.className = 'it-mini';
    el.setAttribute('aria-label', 'Back to the timer');
    el.onclick = () => window.navigate?.('timer');
    document.body.appendChild(el);
  }
  el.dataset.kind = info.kind;
  const txt = `⏱ ${info.time} · ${info.label}`;
  if (el.textContent !== txt) el.textContent = txt;
}

function fieldHTML(mode, c) {
  return FIELDS[mode].map(([k, label, min, max, step, unit]) => `
    <div class="it-field">
      <span class="label">${label}</span>
      <div class="it-stepper">
        <button class="bs-x it-step" onclick="itStep('${k}', -1)" aria-label="Less ${label.toLowerCase()}" ${c[k] <= min ? 'disabled' : ''}>−</button>
        <span class="mono it-val">${unit === 's' ? (c[k] === 0 && k === 'cap' ? 'none' : fmt(c[k])) : c[k]}</span>
        <button class="bs-x it-step" onclick="itStep('${k}', 1)" aria-label="More ${label.toLowerCase()}" ${c[k] >= max ? 'disabled' : ''}>＋</button>
      </div>
    </div>`).join('');
}

function setupHTML() {
  const t = store();
  const mode = t.mode;
  const c = cfgFor(mode);
  const P = buildPhases(mode, c);
  const total = totalOf(P);
  return `
<div class="card it-setup">
  ${segGroup(MODES, mode, "itMode('%')")}
  <p class="muted fs13 it-about">${ABOUT[mode]}</p>
  <div class="it-presets">${PRESETS[mode].map(([name], i) => `<button class="seg-btn" onclick="itPreset(${i})">${name}</button>`).join('')}</div>
  <div class="it-fields">${fieldHTML(mode, c)}</div>
  <div class="it-summary">
    ${mode === 'stopwatch' ? '<span class="muted fs12">Counts up from zero</span>'
      : `<span class="mono">${fmt(total)}</span><span class="muted fs12">total, including a ${PREP}s get-ready</span>`}
  </div>
  <button class="btn btn-fire it-start" onclick="itStart()">▶ Start ${MODES.find((m) => m.id === mode).label}</button>
</div>`;
}

function runHTML() {
  const amrap = R.mode === 'amrap', sw = R.mode === 'stopwatch';
  return `
<div class="card it-runcard" id="it-run" data-kind="prep">
  <div class="it-ring-wrap">
    <svg class="it-ring" viewBox="0 0 240 240" aria-hidden="true">
      <circle cx="120" cy="120" r="${RING_R}" class="it-track"/>
      <circle cx="120" cy="120" r="${RING_R}" class="it-arc" style="stroke-dasharray:${RING_C.toFixed(1)};stroke-dashoffset:${RING_C.toFixed(1)}"/>
    </svg>
    <div class="it-center" role="timer" aria-live="off">
      <div class="it-phase label">Get ready</div>
      <div class="it-time display">0:00</div>
      <div class="it-sub muted fs12"></div>
    </div>
  </div>
  <div class="it-next muted fs12"></div>
  ${sw ? '' : `<div class="gm-bar it-total"><i style="width:0%"></i></div><div class="it-remaining muted fs11"></div>`}
  ${amrap ? `<button class="btn btn-fire it-round" onclick="itRound()">＋1 round <span class="mono" id="it-rounds">${R.rounds}</span></button>` : ''}
  ${sw ? `<button class="btn btn-fire it-round" onclick="itLap()">Lap</button><div class="it-laps" id="it-laps">${_lapsHTML()}</div>` : ''}
  <div class="it-controls">
    <button class="btn btn-secondary" onclick="itPause()">${R.pausedAt != null ? '▶ Resume' : '❚❚ Pause'}</button>
    ${sw ? '' : '<button class="btn btn-secondary" onclick="itSkip()">⏭ Skip</button>'}
    <button class="btn btn-danger" onclick="itStop()">■ Stop</button>
  </div>
  <div class="muted fs11 it-hint">Space to pause · the timer keeps running if you leave this page</div>
</div>`;
}

function _lapsHTML() {
  if (!R?.laps.length) return '';
  return R.laps.map((l, i) => `<div class="it-lap"><span class="muted">Lap ${i + 1}</span><span class="mono">${fmt(l.split)}</span><span class="mono muted">${fmt(l.at)}</span></div>`).reverse().join('');
}

function doneHTML() {
  const mins = Math.max(1, Math.round((R.endElapsed || 0) / 60));
  const name = MODES.find((m) => m.id === R.mode).label;
  const workRounds = R.phases.filter((p) => p.kind === 'work').length;
  const doneRounds = R.mode === 'amrap' ? R.rounds : R.mode === 'stopwatch' ? R.laps.length
    : R.phases.filter((p) => p.kind === 'work' && p.start + p.dur <= (R.endElapsed || 0) + 0.5).length;
  return `
<div class="card it-done ${R.finished ? 'is-finished' : ''}">
  <div class="label">${R.finished ? 'Complete' : 'Stopped'}</div>
  <div class="display it-done-title">${name} · ${fmt(R.endElapsed || 0)}</div>
  <div class="muted fs13">${R.mode === 'amrap' ? `${R.rounds} round${R.rounds === 1 ? '' : 's'} in ${fmt(R.cfg.duration)}`
    : R.mode === 'stopwatch' ? `${R.laps.length} lap${R.laps.length === 1 ? '' : 's'}`
    : R.mode === 'countdown' ? 'Held to the end' : `${doneRounds} of ${workRounds} work rounds`}</div>
  ${R.logged ? '<div class="fs13" style="color:var(--green)">✓ Logged — counts toward your daily fire and XP</div>'
    : (R.endElapsed || 0) >= 30 ? `<button class="btn btn-fire" onclick="itLog()">Log this session (${mins} min)</button>` : ''}
  <div class="it-controls">
    <button class="btn btn-secondary" onclick="itAgain()">↻ Again</button>
    <button class="btn btn-secondary" onclick="itReset()">Change settings</button>
  </div>
</div>`;
}

export function renderTimer() {
  return `
${pageHeader('Timer', { eyebrow: 'Train', sub: 'Tabata, EMOM, AMRAP, intervals, a stopwatch and a countdown — with sound and haptics' })}
<div id="it-root">${!R ? setupHTML() : R.done ? doneHTML() : runHTML()}</div>`;
}

function render() {
  const root = document.getElementById('it-root');
  if (root) root.innerHTML = !R ? setupHTML() : R.done ? doneHTML() : runHTML();
  if (R && !R.done) _paint(elapsed());
}

// Called after the page renders (main.js CHART_PAGES hook).
export function scheduleTimerPage() {
  setTimeout(() => { _mini(null); if (R && !R.done) _paint(elapsed()); }, 0);
}

// ── HANDLERS ────────────────────────────────────────────────────────────────
window.itMode = (m) => {
  if (!MODES.some((x) => x.id === m)) return;
  store().mode = m; save(); cue('select'); render();
};
window.itStep = (k, dir) => {
  const t = store(); const mode = t.mode;
  const f = FIELDS[mode].find((x) => x[0] === k);
  if (!f) return;
  const [, , min, max, step] = f;
  const c = cfgFor(mode);
  // Bigger jumps once the numbers get big, so a 20-minute AMRAP is not 20 taps.
  const big = f[5] === 's' && c[k] >= (dir > 0 ? 300 : 360) ? 60 : step;
  c[k] = clampNum(c[k] + dir * big, min, max);
  t.cfg[mode] = c; save(); cue('select'); render();
};
window.itPreset = (i) => {
  const t = store(); const mode = t.mode;
  const p = PRESETS[mode][i];
  if (!p) return;
  t.cfg[mode] = { ...cfgFor(mode), ...p[1] }; save(); cue('select'); render();
};
window.itStart = () => start();
window.itPause = () => togglePause();
window.itSkip = () => skip();
window.itStop = () => {
  if (!R || R.done) return;
  if (elapsed() > 20 && !confirm('Stop the timer?')) return;
  stop(false);
};
window.itRound = () => {
  if (!R || R.done || R.pausedAt != null) return;
  R.rounds++;
  const el = document.getElementById('it-rounds'); if (el) el.textContent = R.rounds;
  cue('setDone');
  fxBurst(document.querySelector('.it-round'), { kind: 'sparks', count: 12, power: 0.7 });
};
window.itLap = () => {
  if (!R || R.done) return;
  const t = elapsed();
  const prev = R.laps.length ? R.laps[R.laps.length - 1].at : 0;
  R.laps.push({ at: t, split: t - prev });
  const el = document.getElementById('it-laps'); if (el) el.innerHTML = _lapsHTML();
  cue('setDone');
};
window.itAgain = () => { R = null; start(); };
window.itReset = () => { R = null; render(); };
window.itLog = () => {
  if (!R || !R.done || R.logged) return;
  const mins = Math.max(1, Math.round((R.endElapsed || 0) / 60));
  const name = MODES.find((m) => m.id === R.mode).label;
  const notes = R.mode === 'amrap' ? `${R.rounds} rounds` : R.mode === 'stopwatch' && R.laps.length ? `${R.laps.length} laps` : '';
  const h = state.hiitState;
  if (!Array.isArray(h.logs)) h.logs = [];
  // Logged as a HIIT session, so it shows in HIIT history and counts toward
  // the daily fire, active minutes and XP like any other workout.
  h.logs.unshift({ date: localDateStr(), type: `${name} (timer)`, mins, cals: Math.round(mins * 8.5), weight: null, notes, energy: 0, effort: 0, ts: Date.now() });
  const ok = save();
  R.logged = ok !== false;
  toast(R.logged ? `✓ ${name} logged — ${mins} min` : '⚠ Not saved — storage unavailable', { type: R.logged ? 'green' : 'danger' });
  render();
};

// Space toggles pause while the timer page is in front (not while typing).
document.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || !R || R.done) return;
  if (!document.getElementById('page-timer')?.classList.contains('active')) return;
  if (/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement?.tagName || '')) return;
  e.preventDefault(); togglePause();
});
