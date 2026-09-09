// ═══════════════════════════════════════════
//   FITNESS FORGE — Body Map trainer
//   Tap a muscle on the figure → see its best exercises with progressive-
//   overload targets (starting weights on a cold start), then either start an
//   instant targeted workout or stack several muscles into one session.
// ═══════════════════════════════════════════

import { state, getOwnedItems, formatWeight, save } from '../store.js';
import { MUSCLE_GROUPS, EXERCISES, getExercisesForItems } from '../data/exercises.js';
import { renderBodyFigures, muscleLoadData } from './analytics.js';
import { suggestNextSet } from '../engine/overload.js';
import { toast } from './ui.js';

// Building session ("add to session" mode) — persists across taps within a
// visit; cleared on start or by the user. Kept in state so a mid-build reload
// doesn't lose it.
function tray() { return state.bodyMapTray || (state.bodyMapTray = []); }

const GROUP = (id) => MUSCLE_GROUPS.find(g => g.id === id);
const _open = { group: null, showAll: false };   // currently expanded muscle panel

// Default set/rep prescription for an exercise picked off the map.
function prescribe(ex) {
  const iso = ex.type === 'isolation';
  return { sets: iso ? 3 : 4, reps: iso ? '10-15' : '8-12' };
}

// Top N available exercises for a muscle group, compounds first.
function pickForGroup(groupId, n = 8) {
  const level = state.profile?.level || 'intermediate';
  const list = getExercisesForItems(groupId, getOwnedItems(), level);
  // Exercises you've actually logged surface first — they carry real history,
  // so their targets are progressed rather than cold-start estimates.
  const logged = new Set();
  for (const sess of state.sessions || [])
    for (const e of sess.exercises || [])
      if ((e.sets || []).some(st => st.completed && !st.warmup)) logged.add(e.exId);
  // Recognizable staples first: curated exercises (hand-authored short ids with
  // form cues) rank above the bulk-imported free-exercise-db / workout-guide
  // entries (fx_/wg_ ids). Then primary-group match, compound, then name.
  list.sort((a, b) => {
    const ap = a.groups?.[0] === groupId ? 0 : 1;
    const bp = b.groups?.[0] === groupId ? 0 : 1;
    if (ap !== bp) return ap - bp;
    const al = logged.has(a.id) ? 0 : 1;
    const bl = logged.has(b.id) ? 0 : 1;
    if (al !== bl) return al - bl;
    const ac = /^(fx_|wg_)/.test(a.id) ? 1 : 0;
    const bc = /^(fx_|wg_)/.test(b.id) ? 1 : 0;
    if (ac !== bc) return ac - bc;
    const at = a.type === 'compound' ? 0 : 1;
    const bt = b.type === 'compound' ? 0 : 1;
    if (at !== bt) return at - bt;
    return (a.name || '').localeCompare(b.name || '');
  });
  return n === Infinity ? list : list.slice(0, n);
}

// Concrete per-set plan for one exercise: every working set gets a stated
// weight and rep count, straight off the progressive-overload engine (which
// falls back to a bodyweight-derived starting weight with no history).
function setPlan(ex) {
  const { sets, reps } = prescribe(ex);
  const scheme = state.settings?.progression || 'double';
  const sug = suggestNextSet(ex.id, reps, state.sessions || [], state.profile || {}, scheme);
  const r = sug.reps != null ? sug.reps : parseInt(reps, 10) || 10;
  return {
    sets, reps, weight: sug.weight,
    isBodyweight: !!sug.isBodyweight,
    isColdStart: !!sug.isColdStart,
    perSet: Array.from({ length: sets }, () => ({
      w: sug.isBodyweight || sug.weight == null ? null : sug.weight,
      r,
    })),
  };
}

// "135 lb × 8" / "BW × 12" — the headline load for an exercise.
function loadText(plan) {
  if (plan.isBodyweight || plan.weight == null) return `BW × ${plan.perSet[0]?.r ?? plan.reps}`;
  return `${formatWeight(plan.weight)} × ${plan.perSet[0].r}`;
}

// Days since this muscle group was last trained (null = never).
function daysSinceTrained(groupId) {
  let latest = null;
  for (const s of state.sessions || []) {
    const hit = (s.exercises || []).some(e => (EXERCISES[e.exId]?.groups || []).includes(groupId)
      && (e.sets || []).some(st => st.completed && !st.warmup));
    if (!hit) continue;
    const t = new Date(s.date).getTime();
    if (!latest || t > latest) latest = t;
  }
  if (!latest) return null;
  return Math.floor((Date.now() - latest) / 86400000);
}

// Fitbod-style freshness read-out for the panel header.
function recoveryText(groupId) {
  const d = daysSinceTrained(groupId);
  if (d == null) return { label: 'Fresh · never trained', tone: 'fresh' };
  if (d <= 0)    return { label: 'Trained today · needs rest', tone: 'worked' };
  if (d === 1)   return { label: 'Trained yesterday · recovering', tone: 'worked' };
  if (d <= 3)    return { label: `Trained ${d}d ago · recovering`, tone: 'recovering' };
  return { label: `Trained ${d}d ago · fresh`, tone: 'fresh' };
}

// Shape an exercise for the active-workout logger.
function toSessionExercise(ex) {
  const { sets, reps } = prescribe(ex);
  return { id: ex.id, name: ex.name, sets, reps, muscle: ex.muscle || GROUP(ex.groups?.[0])?.label || '' };
}

// ── PANEL (opened on tap) ────────────────────────────────────────────────────
function panelHTML(groupId) {
  const g = GROUP(groupId);
  if (!g) return '';
  const all = pickForGroup(groupId, Infinity);
  const EXPANDED_MAX = 30;
  const picks = _open.showAll ? all.slice(0, EXPANDED_MAX) : all.slice(0, 8);
  const rec = recoveryText(groupId);
  const head = `
    <div class="bm-panel-head">
      <div>
        <div class="bm-panel-title">${g.icon} ${g.label}</div>
        <div class="bm-recov bm-${rec.tone}">${rec.label}</div>
      </div>
      <button class="modal-close" onclick="bodyMapClosePanel()" aria-label="Close">✕</button>
    </div>`;
  if (!all.length) {
    return `
    <div class="bm-panel card">${head}
      <div class="dim fs13 p-4 tc">No exercises for ${g.label} with your current equipment.
        <div class="mt-3"><button class="btn btn-secondary btn-sm" onclick="navigate('equipment')">Edit equipment →</button></div>
      </div>
    </div>`;
  }
  const rows = picks.map(ex => {
    const plan = setPlan(ex);
    const chips = plan.perSet.map((st, i) => `
      <span class="bm-set"><i>${i + 1}</i><b>·</b>${st.w == null ? 'BW' : formatWeight(st.w)} × ${st.r}</span>`).join('');
    return `
    <div class="bm-ex">
      <div class="bm-ex-top" role="button" tabindex="0"
           onclick="openExDetail('${ex.id}')"
           onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openExDetail('${ex.id}')}"
           title="How to do it — demo, form cues and video">
        <div class="bm-ex-main">
          <div class="bm-ex-name">${ex.name}</div>
          <div class="bm-ex-meta">${ex.type === 'compound' ? 'Compound' : 'Isolation'} · ${plan.sets} sets</div>
        </div>
        <div class="bm-ex-target">${loadText(plan)}${plan.isColdStart && !plan.isBodyweight ? '<i class="bm-start">start</i>' : ''}</div>
      </div>
      <div class="bm-sets">${chips}</div>
    </div>`;
  }).join('');
  const more = all.length > 8 ? `
    <button class="btn btn-ghost btn-sm bm-more" onclick="bodyMapToggleAll()">
      ${_open.showAll ? 'Show top 8 ▲' : `Show more ${g.label} exercises (${Math.min(all.length, EXPANDED_MAX)} of ${all.length}) ▼`}
    </button>
    ${_open.showAll && all.length > EXPANDED_MAX ? `<div class="dim fs11 tc" style="margin-bottom:12px">All ${all.length} in <a href="#" onclick="event.preventDefault();navigate('library')" style="color:var(--fire)">Exercise Library →</a></div>` : ''}` : '';
  return `
  <div class="bm-panel card">${head}
    <div class="bm-ex-list">${rows}</div>
    ${more}
    <div class="bm-panel-actions">
      <button class="btn btn-fire" style="flex:1" onclick="bodyMapStartGroup('${groupId}')">⚡ Start ${g.label}</button>
      <button class="btn btn-secondary" style="flex:1" onclick="bodyMapAddGroup('${groupId}')">＋ Add to session</button>
    </div>
  </div>`;
}

// ── SESSION TRAY (add-to-session mode) ───────────────────────────────────────
function trayHTML() {
  const t = tray();
  if (!t.length) return '';
  const groups = [...new Set(t.map(e => e.muscle))].join(' · ');
  return `
  <div class="bm-tray card">
    <div class="bm-tray-head">
      <span class="label">Session · ${t.length} exercise${t.length === 1 ? '' : 's'}</span>
      <button class="btn btn-ghost btn-sm" onclick="bodyMapClearTray()">Clear</button>
    </div>
    <div class="dim fs12" style="margin-bottom:10px">${groups}</div>
    <button class="btn btn-fire" style="width:100%" onclick="bodyMapStartTray()">⚡ Start session (${t.length})</button>
  </div>`;
}

// ── PAGE ─────────────────────────────────────────────────────────────────────
export function renderBodyMap() {
  const data = muscleLoadData('balance');
  return `
  <div class="page-header">
    <div class="label" style="margin-bottom:6px">Train by target</div>
    <h1 class="display page-title">BODY MAP</h1>
    <div class="page-sub">Tap a muscle to train it — every set comes with a stated weight.</div>
  </div>
  <div class="card">
    <div class="bm-figure">${renderBodyFigures(data, { interactive: true })}</div>
    <div class="dim fs11 tc" style="margin-top:8px">Shaded by how much you've trained each muscle lately. Tap any muscle to build a workout for it.</div>
  </div>
  <div id="bm-panel-slot">${_open.group ? panelHTML(_open.group) : ''}</div>
  <div id="bm-tray-slot">${trayHTML()}</div>`;
}

function rerenderSlots() {
  const p = document.getElementById('bm-panel-slot');
  if (p) p.innerHTML = _open.group ? panelHTML(_open.group) : '';
  const tr = document.getElementById('bm-tray-slot');
  if (tr) tr.innerHTML = trayHTML();
}

// ── HANDLERS ─────────────────────────────────────────────────────────────────
window.bodyMapTap = (groupId) => {
  _open.group = _open.group === groupId ? null : groupId;
  _open.showAll = false;
  rerenderSlots();
  const p = document.getElementById('bm-panel-slot');
  if (_open.group && p) p.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

window.bodyMapClosePanel = () => { _open.group = null; _open.showAll = false; rerenderSlots(); };

window.bodyMapToggleAll = () => { _open.showAll = !_open.showAll; rerenderSlots(); };

window.bodyMapStartGroup = (groupId) => {
  const picks = pickForGroup(groupId, 4);
  if (!picks.length) return;
  const g = GROUP(groupId);
  const exercises = picks.map(toSessionExercise);
  window.startActiveWorkout(`bodymap-${groupId}`, `${(g?.label || 'Focus').toUpperCase()} FOCUS`, exercises, 'strength');
};

window.bodyMapAddGroup = (groupId) => {
  const picks = pickForGroup(groupId, 4);
  if (!picks.length) return;
  const t = tray();
  const have = new Set(t.map(e => e.id));
  let added = 0;
  for (const ex of picks) {
    if (have.has(ex.id)) continue;
    t.push(toSessionExercise(ex));
    added++;
  }
  save();
  _open.group = null;
  rerenderSlots();
  const g = GROUP(groupId);
  toast(added ? `Added ${added} ${g?.label || ''} exercise${added === 1 ? '' : 's'} to your session` : `${g?.label || 'Those'} exercises already in session`);
};

window.bodyMapStartTray = () => {
  const t = tray();
  if (!t.length) return;
  const exercises = t.slice();
  state.bodyMapTray = [];
  save();
  window.startActiveWorkout('bodymap-session', 'BODY MAP SESSION', exercises, 'strength');
};

window.bodyMapClearTray = () => {
  state.bodyMapTray = [];
  save();
  rerenderSlots();
};
