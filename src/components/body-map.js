// ═══════════════════════════════════════════
//   FITNESS FORGE — Body Map trainer
//   Tap a muscle on the figure → see its best exercises with progressive-
//   overload targets (starting weights on a cold start), then either start an
//   instant targeted workout or stack several muscles into one session.
// ═══════════════════════════════════════════

import { state, getOwnedItems, formatWeight, save } from '../store.js';
import { MUSCLE_GROUPS, getExercisesForItems } from '../data/exercises.js';
import { renderBodyFigures, muscleLoadData } from './analytics.js';
import { suggestNextSet } from '../engine/overload.js';
import { toast } from './ui.js';

// Building session ("add to session" mode) — persists across taps within a
// visit; cleared on start or by the user. Kept in state so a mid-build reload
// doesn't lose it.
function tray() { return state.bodyMapTray || (state.bodyMapTray = []); }

const GROUP = (id) => MUSCLE_GROUPS.find(g => g.id === id);
const _open = { group: null };   // currently expanded muscle panel

// Default set/rep prescription for an exercise picked off the map.
function prescribe(ex) {
  const iso = ex.type === 'isolation';
  return { sets: iso ? 3 : 4, reps: iso ? '10-15' : '8-12' };
}

// Top N available exercises for a muscle group, compounds first.
function pickForGroup(groupId, n = 4) {
  const level = state.profile?.level || 'intermediate';
  const list = getExercisesForItems(groupId, getOwnedItems(), level);
  // Recognizable staples first: curated exercises (hand-authored short ids with
  // form cues) rank above the bulk-imported free-exercise-db / workout-guide
  // entries (fx_/wg_ ids). Then primary-group match, compound, then name.
  list.sort((a, b) => {
    const ap = a.groups?.[0] === groupId ? 0 : 1;
    const bp = b.groups?.[0] === groupId ? 0 : 1;
    if (ap !== bp) return ap - bp;
    const ac = /^(fx_|wg_)/.test(a.id) ? 1 : 0;
    const bc = /^(fx_|wg_)/.test(b.id) ? 1 : 0;
    if (ac !== bc) return ac - bc;
    const at = a.type === 'compound' ? 0 : 1;
    const bt = b.type === 'compound' ? 0 : 1;
    if (at !== bt) return at - bt;
    return (a.name || '').localeCompare(b.name || '');
  });
  return list.slice(0, n);
}

// Human-readable target for one exercise (uses the active progression scheme;
// falls back to a cold-start starting weight when there's no history).
function targetText(ex, reps) {
  const scheme = state.settings?.progression || 'double';
  const sug = suggestNextSet(ex.id, reps, state.sessions || [], state.profile || {}, scheme);
  const r = sug.reps != null ? sug.reps : reps;
  if (sug.isBodyweight) return `${r} reps`;
  if (sug.weight != null) return `${formatWeight(sug.weight)} × ${r}${sug.isColdStart ? ' · start' : ''}`;
  return `~${r} reps`;
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
  const picks = pickForGroup(groupId);
  if (!picks.length) {
    return `
    <div class="bm-panel card">
      <div class="bm-panel-head">
        <span class="bm-panel-title">${g.icon} ${g.label}</span>
        <button class="modal-close" onclick="bodyMapClosePanel()" aria-label="Close">✕</button>
      </div>
      <div class="dim fs13 p-4 tc">No exercises for ${g.label} with your current equipment.
        <div class="mt-3"><button class="btn btn-secondary btn-sm" onclick="navigate('equipment')">Edit equipment →</button></div>
      </div>
    </div>`;
  }
  const rows = picks.map(ex => {
    const { reps } = prescribe(ex);
    return `
    <div class="bm-ex">
      <div class="bm-ex-main">
        <div class="bm-ex-name">${ex.name}</div>
        <div class="bm-ex-meta">${ex.type === 'compound' ? 'Compound' : 'Isolation'} · ${prescribe(ex).sets}×${reps}</div>
      </div>
      <div class="bm-ex-target">${targetText(ex, reps)}</div>
    </div>`;
  }).join('');
  return `
  <div class="bm-panel card">
    <div class="bm-panel-head">
      <span class="bm-panel-title">${g.icon} ${g.label}</span>
      <button class="modal-close" onclick="bodyMapClosePanel()" aria-label="Close">✕</button>
    </div>
    <div class="bm-ex-list">${rows}</div>
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
    <div class="page-sub">Tap a muscle to train it — targets and starting weights included.</div>
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
  rerenderSlots();
  const p = document.getElementById('bm-panel-slot');
  if (_open.group && p) p.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

window.bodyMapClosePanel = () => { _open.group = null; rerenderSlots(); };

window.bodyMapStartGroup = (groupId) => {
  const picks = pickForGroup(groupId);
  if (!picks.length) return;
  const g = GROUP(groupId);
  const exercises = picks.map(toSessionExercise);
  window.startActiveWorkout(`bodymap-${groupId}`, `${(g?.label || 'Focus').toUpperCase()} FOCUS`, exercises, 'strength');
};

window.bodyMapAddGroup = (groupId) => {
  const picks = pickForGroup(groupId);
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
