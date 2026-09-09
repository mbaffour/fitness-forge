// ═══════════════════════════════════════════
//   FITNESS FORGE — Goal Programs
//   Browse targeted plans (skills, lifts, physique, event prep, health),
//   run one week by week, and tick off milestones as you go.
// ═══════════════════════════════════════════

import { state, save, getOwnedItems } from '../store.js';
import { EXERCISES } from '../data/exercises.js';
import { PROGRAMS, PROGRAM_CATEGORIES, getProgram, CHALLENGES, getChallenge } from '../data/programs.js';
import { toast } from './ui.js';

let _tab = 'programs';   // programs | challenges
let _cat = 'all';        // catalog filter
let _peek = null;        // program id expanded in the catalog

// ── ACTIVE PROGRAM STATE ─────────────────────────────────────────────────────
// state.goalProgram = { id, startedAt, done: ['w1d0', 'w1d1', …] }
function active() { return state.goalProgram || null; }

function progress(gp, prog) {
  const perWeek = prog.sessions.length;
  const total = perWeek * prog.weeks;
  const done = (gp.done || []).length;
  const week = Math.min(prog.weeks, Math.floor(done / perWeek) + 1);
  return { done, total, perWeek, week, pct: total ? Math.round((done / total) * 100) : 0 };
}

const sessionKey = (week, idx) => `w${week}d${idx}`;

// Equipment the user is missing for a program.
function missingItems(prog) {
  const owned = new Set(getOwnedItems());
  return (prog.requires || []).filter(i => !owned.has(i));
}

const ITEM_LABEL = {
  barbell: 'Barbell', dumbbells: 'Dumbbells', bench: 'Bench', kettlebell: 'Kettlebell',
  resistance_bands: 'Bands', cable: 'Cable', pull_up_bar: 'Pull-up bar', machine: 'Machine',
  rings_trx: 'Rings/TRX', ab_wheel: 'Ab wheel',
};

// ── ACTIVE PROGRAM CARD ──────────────────────────────────────────────────────
function activeHTML() {
  const gp = active();
  if (!gp) return '';
  const prog = getProgram(gp.id);
  if (!prog) return '';
  const p = progress(gp, prog);
  const complete = p.done >= p.total;

  const rows = prog.sessions.map((s, i) => {
    const key = sessionKey(p.week, i);
    const isDone = (gp.done || []).includes(key);
    return `
    <div class="pg-day ${isDone ? 'is-done' : ''}">
      <div class="pg-day-main">
        <div class="pg-day-name">${isDone ? '✓ ' : ''}${s.label}</div>
        <div class="pg-day-meta">${s.exercises.length} exercises · ${s.exercises.map(e => EXERCISES[e.id]?.name).filter(Boolean).slice(0, 2).join(', ')}…</div>
      </div>
      ${isDone
        ? `<button class="btn btn-ghost btn-sm" onclick="programUndoSession(${i})">Undo</button>`
        : `<button class="btn btn-fire btn-sm" onclick="programStartSession(${i})">⚡ Start</button>`}
    </div>`;
  }).join('');

  const miles = (prog.milestones || []).map((m, i) => {
    const at = Math.round(((i + 1) / prog.milestones.length) * prog.weeks);
    const hit = p.week > at || complete;
    return `<div class="pg-mile ${hit ? 'is-hit' : ''}">${hit ? '✓' : '○'} ${m}</div>`;
  }).join('');

  return `
  <div class="card pg-active">
    <div class="pg-active-head">
      <div>
        <div class="label" style="margin-bottom:4px">Active program</div>
        <div class="pg-active-name">${prog.icon} ${prog.name.toUpperCase()}</div>
        <div class="dim fs12" style="margin-top:4px">Goal — ${prog.goal}</div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="programQuit()">Change</button>
    </div>

    <div class="pg-bar" role="progressbar" aria-valuenow="${p.pct}" aria-valuemin="0" aria-valuemax="100">
      <i style="width:${p.pct}%"></i>
    </div>
    <div class="pg-stats">
      <span>Week <b>${p.week}</b> / ${prog.weeks}</span>
      <span><b>${p.done}</b> / ${p.total} sessions</span>
      <span><b>${p.pct}%</b></span>
    </div>

    ${complete ? `
    <div class="pg-done-banner">🏆 Program complete — ${prog.goal}. Pick a new target below.</div>` : `
    <div class="sec-head" style="margin:18px 0 10px">Week ${p.week} sessions</div>
    <div class="pg-days">${rows}</div>`}

    ${miles ? `<div class="sec-head" style="margin:18px 0 10px">Milestones</div><div class="pg-miles">${miles}</div>` : ''}
    <div class="pg-note">${prog.progression}</div>
  </div>`;
}

// ── CATALOG ──────────────────────────────────────────────────────────────────
function cardHTML(prog) {
  const missing = missingItems(prog);
  const open = _peek === prog.id;
  const isActive = active()?.id === prog.id;
  const detail = open ? `
    <div class="pg-detail">
      ${prog.sessions.map(s => `
        <div class="pg-sess">
          <div class="pg-sess-name">${s.label}</div>
          ${s.exercises.map(e => `
            <div class="pg-sess-ex">
              <span>${EXERCISES[e.id]?.name || e.id}</span>
              <span class="pg-sess-right">
                <span class="pg-sess-rx">${e.sets} × ${e.reps}</span>
                <button class="bm-demo" onclick="event.stopPropagation();openExDetail('${e.id}')"
                        title="How to do it — demo, form cues and video tutorial"
                        aria-label="How to do this exercise">▶</button>
              </span>
            </div>`).join('')}
        </div>`).join('')}
      <div class="pg-note">${prog.progression}</div>
    </div>` : '';

  return `
  <div class="card pg-card ${open ? 'is-open' : ''}">
    <div class="pg-card-head" onclick="programPeek('${prog.id}')" role="button" tabindex="0"
         onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();programPeek('${prog.id}')}">
      <div class="pg-icon">${prog.icon}</div>
      <div class="pg-card-main">
        <div class="pg-card-name">${prog.name}</div>
        <div class="pg-card-meta">${prog.weeks} weeks · ${prog.days}×/week</div>
        <div class="pg-card-blurb">${prog.blurb}</div>
        ${missing.length ? `<div class="pg-missing">Needs ${missing.map(i => ITEM_LABEL[i] || i).join(', ')}</div>` : ''}
      </div>
      <div class="pg-chev">${open ? '▲' : '▼'}</div>
    </div>
    ${detail}
    <div class="pg-card-actions">
      ${isActive
        ? `<button class="btn btn-secondary btn-sm" disabled>Currently active</button>`
        : `<button class="btn btn-fire btn-sm" onclick="programStart('${prog.id}')">Start ${prog.weeks}-week program</button>`}
    </div>
  </div>`;
}

// ── CHALLENGES ───────────────────────────────────────────────────────────────
// state.challenge = { id, startedAt, done: [dayIndex, …] }
function activeChallenge() { return state.challenge || null; }

function challengeHTML() {
  const ac = activeChallenge();
  if (ac) {
    const c = getChallenge(ac.id);
    if (c) {
      const done = ac.done || [];
      const day = Math.min(c.days, done.length + 1);
      const pct = Math.round((done.length / c.days) * 100);
      const complete = done.length >= c.days;
      const todayDone = done.includes(day - 1);
      const dots = Array.from({ length: c.days }, (_, i) =>
        `<span class="ch-dot ${done.includes(i) ? 'is-done' : i === day - 1 && !complete ? 'is-now' : ''}" title="Day ${i + 1}: ${c.target(i)} ${c.unit}"></span>`).join('');
      return `
      <div class="card ch-active">
        <div class="pg-active-head">
          <div>
            <div class="label" style="margin-bottom:4px">Active challenge</div>
            <div class="pg-active-name">${c.icon} ${c.name.toUpperCase()}</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="challengeQuit()">Quit</button>
        </div>
        <div class="pg-bar"><i style="width:${pct}%"></i></div>
        <div class="pg-stats">
          <span>Day <b>${Math.min(day, c.days)}</b> / ${c.days}</span>
          <span><b>${done.length}</b> done</span>
          <span><b>${pct}%</b></span>
        </div>
        <div class="ch-dots">${dots}</div>
        ${complete ? `
          <div class="pg-done-banner">🏆 Challenge complete — <b>${c.reward}</b> earned.</div>`
        : `
          <div class="ch-today">
            <div>
              <div class="label" style="margin-bottom:4px">Today · day ${day}</div>
              <div class="ch-target">${c.target(day - 1)} <span>${c.unit}</span></div>
            </div>
            <div class="ch-today-actions">
              ${c.exId ? `<button class="bm-demo" onclick="openExDetail('${c.exId}')" title="How to do it">▶</button>` : ''}
              <button class="btn ${todayDone ? 'btn-secondary' : 'btn-fire'} btn-sm" onclick="challengeTick()">
                ${todayDone ? '✓ Done today' : 'Mark done'}
              </button>
            </div>
          </div>`}
      </div>`;
    }
  }
  return `
  <div class="pg-grid">
    ${CHALLENGES.map(c => `
      <div class="card pg-card">
        <div class="pg-card-head" style="cursor:default">
          <div class="pg-icon">${c.icon}</div>
          <div class="pg-card-main">
            <div class="pg-card-name">${c.name}</div>
            <div class="pg-card-meta">${c.days} days · ends at ${c.target(c.days - 1)} ${c.unit}</div>
            <div class="pg-card-blurb">${c.blurb}</div>
            <div class="ch-reward">🏅 ${c.reward}</div>
          </div>
        </div>
        <div class="pg-card-actions">
          <button class="btn btn-fire btn-sm" onclick="challengeStart('${c.id}')">Start ${c.days}-day challenge</button>
        </div>
      </div>`).join('')}
  </div>`;
}

window.challengeStart = (id) => {
  const c = getChallenge(id);
  if (!c) return;
  state.challenge = { id, startedAt: Date.now(), done: [] };
  save(); rerender();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  toast(`${c.name} started — ${c.days} days`);
};
window.challengeQuit = () => { state.challenge = null; save(); rerender(); };
window.challengeTick = () => {
  const ac = activeChallenge(); const c = ac && getChallenge(ac.id);
  if (!c) return;
  ac.done = ac.done || [];
  const day = Math.min(c.days, ac.done.length + 1);
  const i = day - 1;
  if (ac.done.includes(i)) ac.done = ac.done.filter(x => x !== i);
  else {
    ac.done.push(i);
    if (ac.done.length >= c.days) toast(`🏆 ${c.name} complete — ${c.reward}!`);
  }
  save(); rerender();
};
window.programsTab = (t) => { _tab = t; rerender(); };

export function renderPrograms() {
  const list = _cat === 'all' ? PROGRAMS : PROGRAMS.filter(p => p.cat === _cat);
  const chips = [{ id: 'all', label: 'All', icon: '◆' }, ...PROGRAM_CATEGORIES].map(c => `
    <button class="seg-btn ${_cat === c.id ? 'active' : ''}" onclick="programFilter('${c.id}')">${c.icon} ${c.label}</button>`).join('');

  return `
  <div class="page-header">
    <div class="label" style="margin-bottom:6px">Train with a target</div>
    <h1 class="display page-title">PROGRAMS</h1>
    <div class="page-sub">Finite plans for a specific goal — plus short daily challenges when you want a streak to chase.</div>
  </div>

  <div class="seg" style="margin-bottom:16px">
    <button class="seg-btn ${_tab === 'programs' ? 'active' : ''}" onclick="programsTab('programs')">🗺 Programs</button>
    <button class="seg-btn ${_tab === 'challenges' ? 'active' : ''}" onclick="programsTab('challenges')">🏅 Challenges</button>
  </div>

  ${_tab === 'challenges' ? challengeHTML() : `
  ${activeHTML()}

  <div class="sec-head" style="margin:20px 0 12px">${active() ? 'Switch program' : 'Choose your goal'}</div>
  <div class="seg pg-seg" style="margin-bottom:14px">${chips}</div>
  <div class="pg-grid">${list.map(cardHTML).join('')}</div>`}`;
}

// ── HANDLERS ─────────────────────────────────────────────────────────────────
function rerender() {
  const el = document.getElementById('page-programs');
  if (el) el.innerHTML = renderPrograms();
  else if (typeof window.navigate === 'function') window.navigate('programs', false);
}

window.programFilter = (cat) => { _cat = cat; _peek = null; rerender(); };
window.programPeek   = (id)  => { _peek = _peek === id ? null : id; rerender(); };

window.programStart = (id) => {
  const prog = getProgram(id);
  if (!prog) return;
  state.goalProgram = { id, startedAt: Date.now(), done: [] };
  save();
  _peek = null;
  rerender();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  toast(`${prog.name} started — ${prog.weeks} weeks, ${prog.days}×/week`);
};

window.programQuit = () => {
  state.goalProgram = null;
  save();
  rerender();
  toast('Program cleared');
};

window.programStartSession = (idx) => {
  const gp = active();
  const prog = gp && getProgram(gp.id);
  if (!prog) return;
  const sess = prog.sessions[idx];
  if (!sess) return;
  const p = progress(gp, prog);
  const exercises = sess.exercises.map(e => ({
    id: e.id,
    name: EXERCISES[e.id]?.name || e.id,
    sets: e.sets,
    reps: e.reps,
    muscle: EXERCISES[e.id]?.muscle || '',
  }));
  // Mark done up-front so the week advances even if the log is closed early.
  const key = sessionKey(p.week, idx);
  if (!gp.done.includes(key)) { gp.done.push(key); save(); }
  window.startActiveWorkout(`program-${prog.id}-${key}`, `${prog.name.toUpperCase()} · ${sess.label.toUpperCase()}`, exercises, 'strength');
};

window.programUndoSession = (idx) => {
  const gp = active();
  const prog = gp && getProgram(gp.id);
  if (!prog) return;
  const p = progress(gp, prog);
  const key = sessionKey(p.week, idx);
  const done = gp.done || [];
  if (done.includes(key)) {
    gp.done = done.filter(k => k !== key);
  } else {
    // Completing a week advances p.week, so the row's key no longer matches and
    // undo silently did nothing. Fall back to reversing the most recent session.
    gp.done = done.slice(0, -1);
  }
  save();
  rerender();
};
