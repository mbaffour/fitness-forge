// ═══════════════════════════════════════════
//   FITNESS FORGE — Body Map trainer
//   Tap a muscle on the figure → see its best exercises with progressive-
//   overload targets (starting weights on a cold start), then either start an
//   instant targeted workout or stack several muscles into one session.
// ═══════════════════════════════════════════

import { state, getOwnedItems, formatWeight, save } from '../store.js';
import { EXERCISES, getExercisesForItems, isStrengthExercise, isStretch, stapleRank, equipTags, regionOf, parentOf, subOf, targetsOf } from '../data/exercises.js';
import { EXERCISE_ANIM } from '../data/exercise-anim.js';
import { renderBodyFigures, muscleLoadData } from './analytics.js';
import { suggestNextSet } from '../engine/overload.js';
import { cue } from './feedback.js';
import { toast } from './ui.js';
import { exThumbHTML } from './modal.js';

// Building session ("add to session" mode) — persists across taps within a
// visit; cleared on start or by the user. Kept in state so a mid-build reload
// doesn't lose it.
function tray() { return state.bodyMapTray || (state.bodyMapTray = []); }

// A selection id is a REGION: one of the 12 groups, or a refinement (lower
// back, obliques, adductors, neck) that the figure draws on its own.
const GROUP = (id) => regionOf(id);
const exOf = (id) => (EXERCISES[id] ? { id, ...EXERCISES[id] } : null);
// Multi-muscle selection: tap muscles to add them to the target, then build one
// workout across all of them. Persisted so a reload mid-pick doesn't lose it.
function sel() {
  if (!Array.isArray(state.bodyMapSel)) state.bodyMapSel = [];
  return state.bodyMapSel;
}
const selSet = () => new Set(sel());
let _showAll = false;
// 'train' lists strength work with a load for every set; 'stretch' lists the
// stretches for the same muscles and builds a timed hold routine instead.
let _mode = 'train';

// Default set/rep prescription for an exercise picked off the map.
function prescribe(ex) {
  const iso = ex.type === 'isolation';
  return { sets: iso ? 3 : 4, reps: iso ? '10-15' : '8-12' };
}

// Top N available exercises for a muscle group, compounds first.
function pickForGroup(groupId, n = 8) {
  const level = state.profile?.level || 'intermediate';
  // Query the parent group, then keep what actually trains this region:
  // "Back" no longer lists back extensions now that Lower Back is its own
  // target, and "Lower Back" lists only those.
  const list = getExercisesForItems(parentOf(groupId), getOwnedItems(), level)
    .filter(isStrengthExercise)
    .filter(ex => targetsOf(ex).has(groupId));
  // Exercises you've actually logged surface first — they carry real history,
  // so their targets are progressed rather than cold-start estimates.
  const logged = new Set();
  for (const sess of state.sessions || [])
    for (const e of sess.exercises || [])
      if ((e.sets || []).some(st => st.completed && !st.warmup)) logged.add(e.exId);
  // Recognizable staples first: curated exercises (hand-authored short ids with
  // form cues) rank above the bulk-imported free-exercise-db / workout-guide
  // entries (fx_/wg_ ids). Then primary-group match, compound, then name.
  // Logged lifts first (they carry real history, so their loads are progressed
  // rather than estimated), then the shared staple ranking every generator uses.
  list.sort((a, b) =>
    (logged.has(a.id) ? 0 : 1) - (logged.has(b.id) ? 0 : 1) ||
    stapleRank(a, groupId) - stapleRank(b, groupId) ||
    (a.type === 'compound' ? 0 : 1) - (b.type === 'compound' ? 0 : 1) ||
    (a.name || '').localeCompare(b.name || ''));
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
    // A stretch is not training: without this, stretching your hamstrings
    // marked them "trained 0d ago · recovering" and steered you off them.
    const hit = (s.exercises || []).some(e => !isStretch(exOf(e.exId))
      && targetsOf(exOf(e.exId)).has(groupId)
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
  return { id: ex.id, name: ex.name, sets, reps, muscle: ex.muscle || GROUP(subOf(ex))?.label || '' };
}

// ── STRETCHES ────────────────────────────────────────────────────────────────
// A stretch is held (force: static) or moved through (circles, swings). The
// source's force field decides which, so the logger opens a hold timer for
// one and a rep count for the other.
const isSMR = (ex) => equipTags(ex.id).includes('foam_roller') || /\bsmr\b/i.test(ex.name || '');

function stretchDose(ex) {
  if (isSMR(ex)) return { sets: 1, reps: '45s', label: 'Roll 45s' };
  return ex.timed ? { sets: 2, reps: '30s', label: 'Hold 30s × 2' } : { sets: 1, reps: '10', label: '10 reps' };
}

// Stretches whose PRIMARY target is this muscle, then ones that reach it as a
// secondary if the primary list is thin. Kit you do not own is left out (a
// stability ball); a foam roller is not a tracked item, so foam-roller work is
// kept but labelled and ranked last. Animated ones lead: a moving demo teaches
// a stretch better than a still.
function pickStretches(groupId) {
  const owned = new Set(getOwnedItems());
  const rank = (ex) =>
    (isSMR(ex) ? 4 : 0) + (EXERCISE_ANIM[ex.id] ? 0 : 1) + (ex.timed ? 0 : 1);
  const all = Object.entries(EXERCISES)
    .map(([id, ex]) => ({ id, ...ex }))
    .filter((ex) => isStretch(ex) && (ex.requires || []).every((r) => owned.has(r)));
  const primary = all.filter((ex) => subOf(ex) === groupId);
  const secondary = primary.length >= 4 ? [] : all.filter((ex) => subOf(ex) !== groupId && targetsOf(ex).has(groupId));
  const byRank = (a, b) => rank(a) - rank(b) || (a.name || '').localeCompare(b.name || '');
  return [...primary.sort(byRank), ...secondary.sort(byRank)];
}

function stretchRowHTML(ex) {
  const dose = stretchDose(ex);
  const tags = [isSMR(ex) ? 'Foam roller' : ex.timed ? 'Static' : 'Dynamic',
                EXERCISE_ANIM[ex.id] ? 'Animated' : ''].filter(Boolean).join(' · ');
  return `
  <div class="bm-ex">
    <div class="bm-ex-top">
      ${exThumbHTML(ex)}
      <div class="bm-ex-main">
        <div class="bm-ex-name">${ex.name}</div>
        <div class="bm-ex-meta">${tags}</div>
      </div>
      <div class="bm-ex-target">${dose.label}</div>
      <button class="bm-demo" onclick="event.stopPropagation();openExDetail('${ex.id}')"
              title="How to do it — demo and step-by-step"
              aria-label="How to do ${ex.name}">▶</button>
    </div>
  </div>`;
}

function stretchSectionHTML(groupId) {
  const g = GROUP(groupId);
  const all = pickStretches(groupId);
  const picks = _showAll ? all : all.slice(0, 5);
  return `
  <div class="bm-sec">
    <div class="bm-sec-head">
      <div>
        <div class="bm-panel-title">${g.icon} ${g.label}</div>
        <div class="bm-recov bm-fresh">${all.length} stretch${all.length === 1 ? '' : 'es'}</div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="bodyMapTap('${groupId}')">Remove</button>
    </div>
    ${all.length
      ? `<div class="bm-ex-list">${picks.map(stretchRowHTML).join('')}</div>`
      : '<div class="dim fs13 tc p-4">No stretches for this muscle with your current kit.</div>'}
  </div>`;
}

// Two or three per muscle — a routine, not an inventory. Holds first: they are
// what most of a cool-down is.
function selectedStretches() {
  const chosen = sel();
  const per = chosen.length <= 2 ? 3 : 2;
  const out = [], seen = new Set();
  for (const id of chosen) {
    let taken = 0;
    for (const ex of pickStretches(id)) {
      if (taken >= per) break;
      if (seen.has(ex.id) || isSMR(ex)) continue;
      seen.add(ex.id);
      const d = stretchDose(ex);
      out.push({ id: ex.id, name: ex.name, sets: d.sets, reps: d.reps, muscle: GROUP(id)?.label || '' });
      taken++;
    }
  }
  return out;
}

// ── TARGET PANEL (one section per selected muscle) ───────────────────────────
function exRowHTML(ex) {
  const plan = setPlan(ex);
  const chips = plan.perSet.map((st, i) => `
    <span class="bm-set"><i>${i + 1}</i><b>·</b>${st.w == null ? 'BW' : formatWeight(st.w)} × ${st.r}</span>`).join('');
  return `
  <div class="bm-ex">
    <div class="bm-ex-top">
      ${exThumbHTML(ex)}
      <div class="bm-ex-main">
        <div class="bm-ex-name">${ex.name}</div>
        <div class="bm-ex-meta">${ex.type === 'compound' ? 'Compound' : 'Isolation'} · ${plan.sets} sets</div>
      </div>
      <div class="bm-ex-target">${loadText(plan)}${plan.isColdStart && !plan.isBodyweight ? '<i class="bm-start">start</i>' : ''}</div>
      <button class="bm-demo" onclick="event.stopPropagation();openExDetail('${ex.id}')"
              title="How to do it — demo, form cues and video tutorial"
              aria-label="How to do ${ex.name}">▶</button>
    </div>
    <div class="bm-sets">${chips}</div>
  </div>`;
}

function groupSectionHTML(groupId) {
  const g = GROUP(groupId);
  const all = pickForGroup(groupId, Infinity);
  const picks = _showAll ? all.slice(0, 30) : all.slice(0, 5);
  const rec = recoveryText(groupId);
  if (!all.length) {
    return `
    <div class="bm-sec">
      <div class="bm-sec-head"><span class="bm-panel-title">${g.icon} ${g.label}</span></div>
      <div class="dim fs13 tc p-4">No exercises with your current equipment.
        <div class="mt-3"><button class="btn btn-secondary btn-sm" onclick="navigate('equipment')">Edit equipment →</button></div>
      </div>
    </div>`;
  }
  return `
  <div class="bm-sec">
    <div class="bm-sec-head">
      <div>
        <div class="bm-panel-title">${g.icon} ${g.label}</div>
        <div class="bm-recov bm-${rec.tone}">${rec.label}</div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="bodyMapTap('${groupId}')">Remove</button>
    </div>
    <div class="bm-ex-list">${picks.map(exRowHTML).join('')}</div>
  </div>`;
}

function panelHTML() {
  const chosen = sel();
  if (!chosen.length) {
    return _mode === 'stretch' ? `
    <div class="card tc p-6 bm-empty">
      <div style="font-size:34px;margin-bottom:10px">🧘</div>
      <div class="fs13" style="margin-bottom:4px">Tap any muscle to stretch it</div>
      <div class="dim fs12">Pick what feels tight — or what you just trained — and get a timed hold routine.</div>
    </div>` : `
    <div class="card tc p-6 bm-empty">
      <div style="font-size:34px;margin-bottom:10px">🎯</div>
      <div class="fs13" style="margin-bottom:4px">Tap any muscle to target it</div>
      <div class="dim fs12">Pick as many as you like — chest + triceps + shoulders builds one push session.</div>
    </div>`;
  }
  if (_mode === 'stretch') {
    const labels = chosen.map(id => GROUP(id)?.label).filter(Boolean).join(' + ');
    const anyMore = chosen.some(id => pickStretches(id).length > 5);
    const routine = selectedStretches();
    return `
  <div class="bm-panel card">
    <div class="bm-panel-head">
      <div>
        <div class="label" style="margin-bottom:4px">Stretching ${chosen.length} muscle${chosen.length === 1 ? '' : 's'}</div>
        <div class="bm-panel-title">${labels}</div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="bodyMapClearSel()">Clear</button>
    </div>
    ${chosen.map(stretchSectionHTML).join('')}
    ${anyMore ? `<button class="btn btn-ghost btn-sm bm-more" onclick="bodyMapToggleAll()">${_showAll ? 'Show top 5 each ▲' : 'Show all ▼'}</button>` : ''}
    <div class="bm-panel-actions">
      <button class="btn btn-fire" style="flex:1" onclick="bodyMapStartStretch()" ${routine.length ? '' : 'disabled'}>
        🧘 Start stretch routine (${routine.length})</button>
    </div>
    <div class="dim fs11 tc" style="margin-top:8px">Holds open a timer · ▶ on any stretch for its demo and steps</div>
  </div>`;
  }
  const total = chosen.reduce((n, id) => n + Math.min(pickForGroup(id, Infinity).length, 5), 0);
  const anyMore = chosen.some(id => pickForGroup(id, Infinity).length > 5);
  const labels = chosen.map(id => GROUP(id)?.label).filter(Boolean).join(' + ');
  return `
  <div class="bm-panel card">
    <div class="bm-panel-head">
      <div>
        <div class="label" style="margin-bottom:4px">Targeting ${chosen.length} muscle${chosen.length === 1 ? '' : 's'}</div>
        <div class="bm-panel-title">${labels}</div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="bodyMapClearSel()">Clear</button>
    </div>
    ${chosen.map(groupSectionHTML).join('')}
    ${anyMore ? `<button class="btn btn-ghost btn-sm bm-more" onclick="bodyMapToggleAll()">${_showAll ? 'Show top 5 each ▲' : 'Show more per muscle ▼'}</button>` : ''}
    <div class="bm-panel-actions">
      <button class="btn btn-fire" style="flex:1" onclick="bodyMapStartSel()">⚡ Start workout (${chosen.length} muscle${chosen.length === 1 ? '' : 's'})</button>
      <button class="btn btn-secondary" style="flex:1" onclick="bodyMapAddSel()">＋ Add to session</button>
    </div>
    <div class="dim fs11 tc" style="margin-top:8px">${total} exercises shown · ▶ on any exercise for its demo, cues and video</div>
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
  const chosen = sel();
  const chips = chosen.length ? `
    <div class="bm-chips">
      ${chosen.map(id => {
        const g = GROUP(id);
        return `<button class="bm-chip" onclick="bodyMapTap('${id}')" title="Remove ${g?.label}">${g?.icon} ${g?.label} ✕</button>`;
      }).join('')}
    </div>` : '';

  return `
  <div class="page-header">
    <div class="label" style="margin-bottom:6px">${_mode === 'stretch' ? 'Stretch by target' : 'Train by target'}</div>
    <h1 class="display page-title">BODY MAP</h1>
    <div class="page-sub">${_mode === 'stretch'
      ? 'Tap muscles to stretch them — every stretch has a photo or animation, holds get a timer.'
      : 'Tap muscles to target them — stack as many as you like, with a weight for every set.'}</div>
  </div>
  <div class="seg bm-mode" role="tablist" aria-label="Body map mode">
    <button class="seg-btn ${_mode === 'train' ? 'active' : ''}" role="tab" aria-selected="${_mode === 'train'}" onclick="bodyMapMode('train')">⚡ Train</button>
    <button class="seg-btn ${_mode === 'stretch' ? 'active' : ''}" role="tab" aria-selected="${_mode === 'stretch'}" onclick="bodyMapMode('stretch')">🧘 Stretch</button>
  </div>
  <div class="card">
    <div class="bm-figure">${renderBodyFigures(data, { interactive: true, selected: selSet() })}</div>
    ${chips}
    <div class="dim fs11 tc" style="margin-top:8px">${_mode === 'stretch'
      ? 'Shaded by recent training — the brightest muscles are the ones worth stretching after a session.'
      : 'Shaded by recent training. Tap several muscles to build one session across all of them.'}</div>
  </div>
  <div id="bm-panel-slot">${panelHTML()}</div>
  <div id="bm-tray-slot">${_mode === 'train' ? trayHTML() : ''}</div>`;
}

function rerender() {
  const el = document.getElementById('page-bodymap');
  if (el) el.innerHTML = renderBodyMap();
}

// ── HANDLERS ─────────────────────────────────────────────────────────────────
// Tap toggles a muscle in/out of the target set (multi-select).
window.bodyMapTap = (groupId) => {
  cue('select');
  // Pulse the tapped region before the panel below re-renders, so the tap is
  // acknowledged immediately even on a slow list build.
  document.querySelectorAll(`.mm-tap[data-group="${groupId}"]`).forEach((el) => {
    el.classList.add('just-sel');
    setTimeout(() => el.classList.remove('just-sel'), 430);
  });
  const list = sel();
  const i = list.indexOf(groupId);
  if (i >= 0) list.splice(i, 1); else list.push(groupId);
  save();
  rerender();
};

window.bodyMapClearSel = () => { state.bodyMapSel = []; save(); rerender(); };
window.bodyMapToggleAll = () => { _showAll = !_showAll; rerender(); };

// Balanced pick across every selected muscle, capped so one session stays sane.
function selectedExercises() {
  const chosen = sel();
  if (!chosen.length) return [];
  const per = chosen.length === 1 ? 4 : chosen.length === 2 ? 3 : 2;
  const out = [];
  const seen = new Set();
  for (const id of chosen) {
    let taken = 0;                       // count per muscle, not across the whole list
    for (const ex of pickForGroup(id, Infinity)) {
      if (taken >= per) break;
      if (seen.has(ex.id)) continue;     // an exercise hitting two selected muscles counts once
      seen.add(ex.id);
      out.push(toSessionExercise(ex));
      taken++;
    }
  }
  return out;
}

window.bodyMapStartSel = () => {
  const chosen = sel();
  const exercises = selectedExercises();
  if (!exercises.length) return;
  const label = chosen.length === 1
    ? `${GROUP(chosen[0])?.label.toUpperCase()} FOCUS`
    : chosen.map(id => GROUP(id)?.label.toUpperCase()).join(' + ');
  state.bodyMapSel = [];
  save();
  window.startActiveWorkout(`bodymap-${chosen.join('-')}`, label, exercises, 'strength');
};

window.bodyMapAddSel = () => {
  const exercises = selectedExercises();
  if (!exercises.length) return;
  const t = tray();
  const have = new Set(t.map(e => e.id));
  let added = 0;
  for (const e of exercises) if (!have.has(e.id)) { t.push(e); added++; }
  state.bodyMapSel = [];
  save();
  rerender();
  toast(added ? `Added ${added} exercise${added === 1 ? '' : 's'} to your session` : 'Already in your session');
};

window.bodyMapStartTray = () => {
  const t = tray();
  if (!t.length) return;
  const exercises = t.slice();
  state.bodyMapTray = [];
  save();
  window.startActiveWorkout('bodymap-session', 'BODY MAP SESSION', exercises, 'strength');
};

window.bodyMapClearTray = () => { state.bodyMapTray = []; save(); rerender(); };

window.bodyMapMode = (mode) => {
  if (mode !== 'train' && mode !== 'stretch') return;
  _mode = mode;
  _showAll = false;
  cue('select');
  rerender();
};

window.bodyMapStartStretch = () => {
  const chosen = sel();
  const routine = selectedStretches();
  if (!routine.length) { toast('No stretches available for those muscles.'); return; }
  const label = chosen.length === 1
    ? `${GROUP(chosen[0])?.label.toUpperCase()} STRETCH`
    : `STRETCH · ${chosen.map(id => GROUP(id)?.label.toUpperCase()).join(' + ')}`;
  state.bodyMapSel = [];
  save();
  window.startActiveWorkout(`stretch-${chosen.join('-')}`, label, routine, 'mobility');
};

// Entry point from anywhere that knows which muscles were just worked — the
// post-workout summary uses it for "stretch what you trained".
window.bodyMapStretchFor = (groups) => {
  const valid = (groups || []).filter((g) => GROUP(g));
  state.bodyMapSel = [...new Set(valid)];
  save();
  _mode = 'stretch';
  _showAll = false;
  window.navigate('bodymap');
};

// Entry point for "train what is lagging" — the push/pull card in Analytics.
window.bodyMapTarget = (groups) => {
  const valid = (groups || []).filter((g) => GROUP(g));
  state.bodyMapSel = [...new Set(valid)];
  save();
  _mode = 'train';
  _showAll = false;
  window.navigate('bodymap');
};
