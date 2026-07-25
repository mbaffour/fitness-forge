// ═══════════════════════════════════════════
//   FITNESS FORGE — Equipment-Specific Workouts
//   Pick exactly the gear you have → get a
//   full-body session filtered to it, with
//   auto-progressed targets. Save gym profiles.
// ═══════════════════════════════════════════

import { state, getOwnedItems, saveGymProfile, setActiveGym, deleteGymProfile, formatWeight } from '../store.js';
import { EQUIP_ITEMS, LOCATION_PRESETS, MUSCLE_GROUPS, EXERCISES, getExercisesForItems } from '../data/exercises.js';
import { buildFullBodyOverload, OVERLOAD_VARIANTS } from '../engine/generator.js';
import { suggestNextSet } from '../engine/overload.js';
import { exPreviewHTML } from './modal.js';
import { muscleChip, sectionHead } from './ui.js';

// Session-local selection (seeded from the active gym profile / onboarding preset).
let _owned = new Set(getOwnedItems());
let _variant = 0;
let _plan = null;

function rebuild() {
  const p = state.profile || {};
  const level = p.level || 'intermediate';
  const goal  = p.goal  || 'build_muscle';
  const phase = state.currentPhase || 1;
  _plan = buildFullBodyOverload(_owned, level, goal, phase, _variant);
}

function targetLine(ex) {
  const sug = suggestNextSet(ex.id, ex.reps, state.sessions || [], state.profile || {});
  const reps = sug.reps != null ? sug.reps : ex.reps;
  const load = sug.isBodyweight ? `${reps} reps`
    : (sug.weight != null ? `${formatWeight(sug.weight)} × ${reps}` : `~${reps} reps`);
  const tag = sug.isColdStart ? 'start' : (sug.isBodyweight ? 'bodyweight' : 'target');
  return { load, tag, why: sug.rationale || '' };
}

export function renderEquipment() {
  if (!_plan) rebuild();
  const p = state.profile || {};
  const level = p.level || 'intermediate';

  // coverage across the 12 groups given the owned items
  const cov = {};
  MUSCLE_GROUPS.forEach(g => { cov[g.id] = getExercisesForItems(g.id, _owned, level).length; });
  const hit = Object.values(cov).filter(c => c > 0).length;

  const presetChips = LOCATION_PRESETS.map(loc => {
    const on = sameSet(loc.items, _owned);
    return `<button class="eq-chip${on ? ' on' : ''}" onclick="equipPreset('${loc.id}')">${loc.icon ? `<span class="eq-ic">${loc.icon}</span>` : ''}${loc.label}</button>`;
  }).join('');

  const itemChips = EQUIP_ITEMS.map(it => {
    const on = _owned.has(it.id);
    return `<button class="eq-chip${on ? ' on' : ''}" onclick="equipToggle('${it.id}')"><span class="eq-ic">${it.icon}</span>${it.label}</button>`;
  }).join('');

  const rows = _plan.length ? _plan.map(ex => {
    const meta = EXERCISES[ex.id] || {};
    const t = targetLine(ex);
    return `
    <div class="ov-ex">
      <div class="ov-ex-media" onclick="openExDetail('${ex.id}')">
        ${exPreviewHTML(meta, { variant: 'thumb' }) || `<div class="ov-ex-noimg">${meta.type === 'compound' ? '🏋️' : '💪'}</div>`}
      </div>
      <div class="ov-ex-body">
        <div class="ov-ex-name" onclick="openExDetail('${ex.id}')">${ex.name} <span style="font-size:9px;color:var(--fire);opacity:0.7">↗</span></div>
        <div class="ov-ex-chips">${(meta.groups || []).map(muscleChip).join('')}</div>
        <div class="ov-ex-scheme"><span class="mono fire">${ex.sets}</span> sets · <span class="mono">${ex.reps}</span> reps · <span class="mono muted">${ex.rest}</span> rest</div>
        <div class="ov-target"><span class="ov-target-tag ov-tag-${t.tag}">${t.tag}</span><span class="mono ov-target-load">${t.load}</span><span class="ov-target-why">${t.why}</span></div>
      </div>
    </div>`;
  }).join('') : `<div class="dim tc" style="padding:24px">Select some equipment above to build a session.</div>`;

  const coverageGrid = MUSCLE_GROUPS.map(g => {
    const c = cov[g.id] || 0;
    const op = c >= 3 ? 0.85 : c === 2 ? 0.5 : c === 1 ? 0.3 : 0.08;
    return `<div class="cov-cell ${c === 0 ? 'cov-empty' : ''}" style="--cov:${g.color};--op:${op}"><span class="cov-ic">${g.icon}</span><span class="cov-lbl">${g.label}</span><span class="cov-cnt">${c}</span></div>`;
  }).join('');

  const exercisesJson = JSON.stringify(_plan.map(ex => ({ id: ex.id, name: ex.name, sets: ex.sets, reps: ex.reps, muscle: ex.muscle }))).replace(/'/g, '&#39;');

  const profilesRow = state.gymProfiles.length ? `
    <div class="flex f-wrap gap-2 mt-3">
      ${state.gymProfiles.map(gp => `
        <button class="eq-chip${gp.id === state.activeGymId ? ' on' : ''}" onclick="equipLoadProfile(${gp.id})" title="${gp.items.length} items">${gp.name}</button>
      `).join('')}
    </div>` : '';

  return `
<div class="page-header">
  <div class="label mb-2">Equipment Workout</div>
  <h1 class="display page-title">TRAIN WITH WHAT YOU HAVE</h1>
  <div class="page-sub">Pick your gear — every exercise shown is one you can actually do.</div>
</div>

${sectionHead('Quick Setups')}
<div class="eq-grid mb-4">${presetChips}</div>

${sectionHead('Your Equipment')}
<div class="eq-grid">${itemChips}</div>
<div class="flex f-wrap gap-2 mt-4">
  <button class="btn btn-ghost btn-sm" onclick="equipSaveProfile()">💾 Save as Gym Profile</button>
  ${profilesRow ? '<span class="dim fs11" style="align-self:center">Saved:</span>' : ''}
</div>
${profilesRow}

${sectionHead('Session')}
<div class="flex f-wrap gap-2 mb-4" style="align-items:center">
  <span class="label" style="margin-right:4px">Variant:</span>
  ${OVERLOAD_VARIANTS.map((v, i) => `<button class="seg-btn${i === _variant ? ' active' : ''}" onclick="equipVariant(${i})">${v.key}</button>`).join('')}
  <button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="equipShuffle()">🔀 Shuffle</button>
</div>

<div class="card">
  <div class="flex j-btwn i-ctr f-wrap gap-2 mb-4">
    <div style="font-family:var(--ff-display);font-size:22px;font-weight:800">FULL BODY ${OVERLOAD_VARIANTS[_variant].key}</div>
    ${_plan.length ? `<button class="btn btn-fire btn-sm" onclick='window.equipStart(${exercisesJson})'>⚡ Start Workout</button>` : ''}
  </div>
  <div class="ov-ex-list">${rows}</div>
</div>

${sectionHead('Coverage With This Equipment')}
<div class="page-sub mb-3" style="margin-top:-8px">${hit}/${MUSCLE_GROUPS.length} muscle groups trainable · number = exercises available</div>
<div class="cov-grid">${coverageGrid}</div>
`;
}

// ── helpers ──
function sameSet(arr, set) {
  return arr.length === set.size && arr.every(i => set.has(i));
}
function rerender() {
  const el = document.getElementById('page-equipment');
  if (el) el.innerHTML = renderEquipment();
}

// ── window handlers ──
window.equipToggle = (id) => { _owned.has(id) ? _owned.delete(id) : _owned.add(id); rebuild(); rerender(); };
window.equipPreset = (locId) => {
  const loc = LOCATION_PRESETS.find(l => l.id === locId);
  if (loc) { _owned = new Set(loc.items); rebuild(); rerender(); }
};
window.equipVariant = (i) => { _variant = i; rebuild(); rerender(); };
window.equipShuffle = () => { rebuild(); rerender(); };
window.equipSaveProfile = () => {
  const name = prompt('Name this gym setup (e.g. Home, Commercial Gym, Travel):');
  if (name == null) return;
  saveGymProfile(name.trim() || 'My Gym', [..._owned]);
  rerender();
};
window.equipLoadProfile = (id) => {
  const gp = state.gymProfiles.find(p => p.id === id);
  if (gp) { setActiveGym(id); _owned = new Set(gp.items); rebuild(); rerender(); }
};
window.equipDeleteProfile = (id) => { deleteGymProfile(id); rerender(); };
window.equipStart = (exercises) => {
  window.startActiveWorkout(`equipment-${_variant}`, `Full Body ${OVERLOAD_VARIANTS[_variant].key}`, exercises, 'strength');
};
