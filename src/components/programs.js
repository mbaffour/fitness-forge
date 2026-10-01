// ═══════════════════════════════════════════
//   FITNESS FORGE — Goal Programs
//   Browse targeted plans (skills, lifts, physique, event prep, health),
//   run one week by week, and tick off milestones as you go.
// ═══════════════════════════════════════════

import { state, save, getOwnedItems, formatWeight } from '../store.js';
import { EXERCISES } from '../data/exercises.js';
import { PROGRAMS, PROGRAM_CATEGORIES, getProgram, CHALLENGES, getChallenge } from '../data/programs.js';
import { toast } from './ui.js';
import { cue } from './feedback.js';
import { exThumbHTML } from './modal.js';
import { programProgress as progress, sessionKey, requiredItems, sessionMinutes, prescribedSession } from './program-tools.js';
import { programArt } from './program-art.js';
import { programVisualsHTML } from './program-visuals.js';
import { programSuggestion, programProfile } from './program-coach.js';

let _tab = 'programs';   // programs | challenges
let _cat = 'all';        // catalog filter
let _viewWeek = null;
let _query = '';
let _days = 'all';
let _available = false;
let _peek = null;        // program id expanded in the catalog

// ── ACTIVE PROGRAM STATE ─────────────────────────────────────────────────────
// state.goalProgram = { id, startedAt, done: ['w1d0', 'w1d1', …] }
function trainingProfile() { return programProfile(state.profile || {}, state.bodyLog || []); }
function active() { return state.goalProgram || null; }


// Equipment the user is missing for a program.
function missingItems(prog) {
  const owned = new Set(getOwnedItems());
  return requiredItems(prog, EXERCISES).filter(i => !owned.has(i));
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
  const viewWeek = Math.min(p.week, _viewWeek || p.week);

  const rows = prog.sessions.map((base, i) => {
    const s = prescribedSession(prog, i, viewWeek, trainingProfile());
    const key = sessionKey(viewWeek, i);
    const isDone = (gp.done || []).includes(key);
    return `
    <div class="pg-day ${isDone ? 'is-done' : ''}">
      <div class="pg-day-main">
        <div class="pg-day-name">${isDone ? '✓ ' : ''}${s.label}</div>
        <div class="pg-day-meta">${s.exercises.length} exercises · ~${sessionMinutes(s)} min · ${s.exercises.map(e => EXERCISES[e.id]?.name).filter(Boolean).slice(0, 2).join(', ')}…</div>
      </div>
      ${isDone
        ? `<button class="btn btn-ghost btn-sm" onclick="programUndoSession(${i}, ${viewWeek})">Undo</button>`
        : `<button class="btn btn-fire btn-sm" onclick="programStartSession(${i}, ${viewWeek})">⚡ Start</button>`}
    </div>`;
  }).join('');

  const miles = (prog.milestones || []).map((m, i) => {
    const at = Number(m.match(/Week\s+(\d+)/i)?.[1]) || Math.round(((i + 1) / prog.milestones.length) * prog.weeks);
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

    <div class="pg-bar" role="progressbar" aria-label="Program completion" aria-valuenow="${p.pct}" aria-valuemin="0" aria-valuemax="100">
      <i style="width:${p.pct}%"></i>
    </div>
    <div class="pg-stats">
      <span>Week <b>${p.week}</b> / ${prog.weeks}</span>
      <span><b>${p.done}</b> / ${p.total} sessions</span>
      <span><b>${p.pct}%</b></span>
    </div>

    ${prog.overload ? `<div class="pg-coach">
      <div class="pg-coach-head"><b>${prog.overload === 'linear' ? 'Linear progression' : 'Double progression'}</b><span class="tag t-fire">${prescribedSession(prog, 0, viewWeek, trainingProfile()).deload ? 'Recovery week' : 'Build week'}</span></div>
      <div class="pg-cycle"><span>01 · Log working sets</span><span>02 · Build reps / load</span><span>03 · Recover every 4th week</span></div>
      <p>${prog.schedule}</p>
      ${prog.personalized ? `<p>${trainingProfile().weight ? `Starting estimates use your latest recorded bodyweight: ${formatWeight(trainingProfile().weight)}. Experience: ${trainingProfile().level}. Calibrate after your first set.` : 'Add your bodyweight in Profile or Body Stats for an initial load estimate. Start with a comfortable load until then.'} Reps follow your training goal and experience.</p>` : ''}
      <p>${prescribedSession(prog, 0, viewWeek, trainingProfile()).deload ? 'About half the normal sets. Keep the last working load and leave 3–4 reps in reserve.' : 'Leave about two reps in reserve. The logger suggests your next target from saved working sets.'}</p>
    </div>` : ''}
    ${programVisualsHTML(prog, EXERCISES, trainingProfile(), viewWeek)}
    <div class="pg-week-strip" aria-label="Program weeks">
      ${Array.from({ length: prog.weeks }, (_, i) => i + 1).map(w => `<button class="pg-week ${w === viewWeek ? 'is-current' : ''} ${w < p.week || complete ? 'is-complete' : ''}"
        onclick="programViewWeek(${w})" ${w > p.week ? 'disabled' : ''} aria-label="View week ${w}" aria-pressed="${w === viewWeek}">${w < p.week || complete ? '✓' : w}<span>W${w}</span></button>`).join('')}
    </div>
    ${complete ? `<div class="pg-done-banner">🏆 Program complete — ${prog.goal}. Pick a new target below.</div>` : ''}
    <div class="sec-head" style="margin:18px 0 10px">Week ${viewWeek} sessions</div>
    <div class="pg-days">${rows}</div>

    ${miles ? `<div class="sec-head" style="margin:18px 0 10px">Milestones</div><div class="pg-miles">${miles}</div>` : ''}
    <div class="pg-note">${prog.progression}</div>
  </div>`;
}

// ── TARGETS ──────────────────────────────────────────────────────────────────
// A program session used to list "4 × 8-10" and nothing else, so the one thing
// you needed at the rack — what to put on the bar — was the one thing missing.
function programLoad(e, prog = null) {
  const sug = programSuggestion(e.id, e.reps, state.sessions || [], trainingProfile(),
    prog?.overload ? { programProgression: prog.overload, targetSets: e.sets } : null,
    state.settings?.progression || 'double');
  if (sug.isBodyweight) return 'BW';
  if (sug.weight == null) return '';
  const ex = EXERCISES[e.id];
  const perHand = (ex?.requires || []).some(r => r === 'dumbbells' || r === 'kettlebell')
    && !/goblet|single[- ]?arm|one[- ]?arm|suitcase|swing|halo/i.test(ex?.name || '');
  return `${formatWeight(sug.weight)}${perHand ? '/hand' : ''}`;
}

// Best set you have actually logged for a movement — reps, or seconds for a
// timed hold. Used to anchor a challenge ramp to your real capacity.
function personalBest(exId, unit) {
  if (!exId) return null;
  const timed = unit === 'seconds';
  let best = 0;
  for (const sess of state.sessions || []) {
    for (const e of sess.exercises || []) {
      if (e.exId !== exId) continue;
      for (const set of e.sets || []) {
        if (!set.completed || set.warmup) continue;
        const v = timed ? (set.seconds || 0) : (set.reps || 0);
        if (v > best) best = v;
      }
    }
  }
  return best || null;
}

// The authored ramp is one fixed curve for everyone: day 1 of the 30-day
// push-up asks 11 reps whether you can do 5 or 40 — impossible for one person
// and trivial for weeks for the other. Scale the author's curve to the person.
//
// Anchor on the FINISH, not day 1. The authored curves grow ~5x over 30 days;
// scaling by day 1 keeps that multiple, which sent someone already doing 40
// push-ups to a 134-rep set. Aiming the last day at ~2.2x your current best
// gives a hard but real finish, and day 1 falls out around half of what you
// can do today. With no history the authored numbers stand, and the card says so.
const CHALLENGE_END_MULTIPLE = 2.2;

function challengeScale(c) {
  const best = personalBest(c.exId, c.unit);
  if (!best) return 1;
  const designedEnd = c.target(c.days - 1) || 1;
  const k = (best * CHALLENGE_END_MULTIPLE) / designedEnd;
  return Math.min(3, Math.max(0.4, k));   // one freak set must not warp the ramp
}

function challengeTarget(c, dayIdx, scale) {
  const k = scale ?? challengeScale(c);
  return Math.max(1, Math.round(c.target(dayIdx) * k));
}

// ── CATALOG ──────────────────────────────────────────────────────────────────
function cardHTML(prog) {
  const missing = missingItems(prog);
  const open = _peek === prog.id;
  const isActive = active()?.id === prog.id;
  const detail = open ? `
    <div class="pg-detail" id="pg-detail-${prog.id}">
      ${programVisualsHTML(prog, EXERCISES, trainingProfile(), 1)}
      ${prog.overload ? `<div class="pg-coach"><div class="pg-coach-head"><b>${prog.overload === 'linear' ? 'Linear progression' : 'Double progression'}</b><span class="tag t-fire">${prog.level}</span></div><p>${prog.schedule}</p><p>Every fourth week: fewer sets, hold the working load and recover.</p></div>` : ''}
      <div class="pg-note">Leave a rest day between demanding sessions. Warm up for five minutes, then use lighter rehearsal sets. Start at the lower end of each rep range and keep two reps in reserve.${prog.foundation ? ' Foundation plans adjust set counts by week.' : ''}</div>
      ${prog.sessions.map((_, index) => prescribedSession(prog, index, 1, trainingProfile())).map(s => `
        <div class="pg-sess">
          <div class="pg-sess-name">${s.label}</div>
          ${s.exercises.map(e => `
            <div class="pg-sess-ex">
              <span class="pg-sess-name">${exThumbHTML({ id: e.id, ...EXERCISES[e.id] })}${EXERCISES[e.id]?.name || e.id}</span>
              <span class="pg-sess-right">
                <span class="pg-sess-rx">${e.sets} × ${e.reps}${(() => { const l = programLoad(e, prog); return l ? ` · ${l}` : ''; })()}</span>
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
    <div class="pg-card-head" onclick="programPeek('${prog.id}')" role="button" tabindex="0" aria-expanded="${open}" aria-controls="pg-detail-${prog.id}"
         onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();programPeek('${prog.id}')}">
      <div class="pg-art-wrap">${programArt(prog.cat)}</div>
      <div class="pg-card-main">
        <div class="pg-card-name">${prog.name}</div>
        <div class="pg-card-meta">${prog.weeks} weeks · ${prog.days}×/week · ~${sessionMinutes(prescribedSession(prog, 0, 1, trainingProfile()))} min</div>
        <div class="pg-card-blurb">${prog.blurb}</div>
        ${missing.length ? `<div class="pg-missing">Needs ${missing.map(i => ITEM_LABEL[i] || i).join(', ')}</div>` : '<div class="pg-ready">✓ Matches your equipment</div>'}
      </div>
      <div class="pg-chev" aria-hidden="true">${open ? '▲' : '▼'}</div>
    </div>
    ${detail || `<div id="pg-detail-${prog.id}" hidden></div>`}
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
      const chScale = challengeScale(c);
      const chBest  = personalBest(c.exId, c.unit);
      const dots = Array.from({ length: c.days }, (_, i) =>
        `<span class="ch-dot ${done.includes(i) ? 'is-done' : i === day - 1 && !complete ? 'is-now' : ''}" title="Day ${i + 1}: ${challengeTarget(c, i, chScale)} ${c.unit}"></span>`).join('');
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
              <div class="ch-target">${challengeTarget(c, day - 1, chScale)} <span>${c.unit}</span></div>
            </div>
            <div class="ch-today-actions">
              ${c.exId ? `<button class="bm-demo" onclick="openExDetail('${c.exId}')" title="How to do it">▶</button>` : ''}
              <button class="btn ${todayDone ? 'btn-secondary' : 'btn-fire'} btn-sm" onclick="challengeTick()">
                ${todayDone ? '✓ Done today' : 'Mark done'}
              </button>
            </div>
          </div>
          ${c.exId ? `<div class="ch-basis">${chBest
            ? `Scaled to your best logged set — ${chBest} ${c.unit}. Ends at ${challengeTarget(c, c.days - 1, chScale)}.`
            : `Default ramp. Log ${EXERCISES[c.exId]?.name || 'this movement'} once and it re-anchors to what you can actually do.`}</div>` : ''}`}
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
            <div class="pg-card-meta">${c.days} days · ends at ${challengeTarget(c, c.days - 1)} ${c.unit}</div>
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
    const done = ac.done.length >= c.days;
    cue(done ? 'achievement' : 'milestone');
    if (done) toast(`🏆 ${c.name} complete — ${c.reward}!`);
    // Stamp the dot that was just claimed, after the re-render below.
    setTimeout(() => {
      const dot = document.querySelectorAll('.ch-dot')[i];
      if (dot) { dot.classList.add('just-done'); setTimeout(() => dot.classList.remove('just-done'), 430); }
    }, 30);
  }
  save(); rerender();
};
window.programsTab = (t) => { _tab = t; rerender(); };

export function renderPrograms() {
  const list = filteredPrograms();
  const chips = [{ id: 'all', label: 'All', icon: '◆' }, ...PROGRAM_CATEGORIES].map(c => `
    <button class="seg-btn ${_cat === c.id ? 'active' : ''}" onclick="programFilter('${c.id}')">${c.icon} ${c.label}</button>`).join('');

  return `
  <div class="page-header pg-header">
    <div class="label" style="margin-bottom:6px">Train with a target</div>
    <h1 class="display page-title">PROGRAMS</h1>
    <div class="page-sub">Build a routine around your goal, your equipment and your week. Preview the sessions, then train with a clear next step.</div>
  </div>

  <div class="seg" style="margin-bottom:16px">
    <button class="seg-btn ${_tab === 'programs' ? 'active' : ''}" onclick="programsTab('programs')">🗺 Programs</button>
    <button class="seg-btn ${_tab === 'challenges' ? 'active' : ''}" onclick="programsTab('challenges')">🏅 Challenges</button>
  </div>

  ${_tab === 'challenges' ? challengeHTML() : `
  ${activeHTML()}

  <div class="sec-head" style="margin:20px 0 12px">${active() ? 'Switch program' : 'Choose your goal'}</div>
  <div class="seg pg-seg" style="margin-bottom:14px">${chips}</div>
  <div class="pg-toolbar">
    <label class="pg-search-label">Search programs
      <input type="search" class="lib-search" id="pg-search" value="${_query.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}" placeholder="Try strength, core or foundation" oninput="programSearch(this.value)">
    </label>
    <label class="pg-days-label">Days / week
      <select onchange="programDays(this.value)" aria-label="Training days per week">
        ${['all','2','3','4','5','6'].map(d => `<option value="${d}" ${_days === d ? 'selected' : ''}>${d === 'all' ? 'Any' : d}</option>`).join('')}
      </select>
    </label>
    <label class="pg-equipment-label"><input type="checkbox" onchange="programAvailable(this.checked)" ${_available ? 'checked' : ''}> My equipment only</label>
  </div>
  <div id="pg-results">${catalogHTML(list)}</div>`}`;
}


function filteredPrograms() {
  return PROGRAMS.filter(p => (_cat === 'all' || p.cat === _cat) &&
    (_days === 'all' || p.days === Number(_days)) &&
    (!_available || missingItems(p).length === 0) &&
    (!_query || `${p.name} ${p.blurb} ${p.goal} ${p.cat}`.toLowerCase().includes(_query)));
}
function catalogHTML(list) {
  return `<div class="pg-result-count" role="status">${list.length} program${list.length === 1 ? '' : 's'} · session times are estimates</div>
    ${list.length ? `<div class="pg-grid">${list.map(cardHTML).join('')}</div>`
      : '<div class="card pg-empty">No programs match these filters. Try another goal or fewer filters.<button class="btn btn-secondary btn-sm" onclick="programResetFilters()">Reset filters</button></div>'}`;
}
window.programSearch = value => {
  _query = String(value || '').trim().toLowerCase();
  const el = document.getElementById('pg-results');
  if (el) el.innerHTML = catalogHTML(filteredPrograms());
};
window.programDays = value => { _days = value; rerender(); };
window.programAvailable = value => { _available = !!value; rerender(); };
window.programResetFilters = () => { _query = ''; _days = 'all'; _available = false; _cat = 'all'; rerender(); };
// ── HANDLERS ─────────────────────────────────────────────────────────────────
function rerender() {
  const el = document.getElementById('page-programs');
  if (el) el.innerHTML = renderPrograms();
  else if (typeof window.navigate === 'function') window.navigate('programs', false);
}

window.programViewWeek = week => { _viewWeek = week; rerender(); };
window.programFilter = (cat) => { _cat = cat; _peek = null; rerender(); };
window.programPeek   = (id)  => { _peek = _peek === id ? null : id; rerender(); };

window.programStart = (id) => {
  const prog = getProgram(id);
  if (!prog) return;
  _viewWeek = null;
  state.goalProgram = { id, startedAt: Date.now(), done: [] };
  save();
  _peek = null;
  cue('start');
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

window.programStartSession = (idx, week = null) => {
  const gp = active();
  const prog = gp && getProgram(gp.id);
  if (!prog) return;
  const p = progress(gp, prog);
  if (p.done >= p.total) return;
  const viewWeek = Math.min(p.week, Math.max(1, Number(week) || p.week));
  const sess = prescribedSession(prog, idx, viewWeek, trainingProfile());
  if (!sess) return;
  const exercises = sess.exercises.map(e => ({
    id: e.id,
    name: EXERCISES[e.id]?.name || e.id,
    sets: e.sets,
    reps: e.reps,
    muscle: EXERCISES[e.id]?.muscle || '',
  }));
  // Progress is earned only when working sets are saved.
  const key = sessionKey(viewWeek, idx);
  window.startActiveWorkout(`program-${prog.id}-${key}`, `${prog.name.toUpperCase()} · ${sess.label.toUpperCase()}`, exercises, 'strength', prog.overload ? {
    programId: prog.id, programWeek: viewWeek, programDeload: sess.deload,
    programProgression: prog.overload, programRestSeconds: prog.restSeconds,
  } : null);
};

window.programUndoSession = (idx, week = null) => {
  const gp = active();
  const prog = gp && getProgram(gp.id);
  if (!prog) return;
  const p = progress(gp, prog);
  const key = sessionKey(Number(week) || p.week, idx);
  gp.done = (gp.done || []).filter(k => k !== key);
  save();
  rerender();
};
