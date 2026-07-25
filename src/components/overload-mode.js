// ═══════════════════════════════════════════
//   FITNESS FORGE — Progressive Overload Mode
//   A rotating 3-day full-body plan that hits
//   every muscle group across the week, with
//   auto-progressed weight/rep targets.
// ═══════════════════════════════════════════

import { state, getOverloadVariant, advanceOverloadVariant, formatWeight } from '../store.js';
import { EXERCISES, MUSCLE_GROUPS, getExercisesForGroup } from '../data/exercises.js';
import { OVERLOAD_VARIANTS, buildFullBodyOverload } from '../engine/generator.js';
import { suggestNextSet } from '../engine/overload.js';
import { exPreviewHTML } from './modal.js';

// Cache the built plan so re-renders (opening the modal, logging) don't reshuffle
// the workout. Keyed by profile + phase + variant; cleared by an explicit shuffle.
let _plan = null;

function planKey(equip, level, goal, phase, variant) {
  return `${equip}|${level}|${goal}|${phase}|${variant}`;
}

function buildPlan(force = false) {
  const p     = state.profile || {};
  const equip = p.equipment || 'full_gym';
  const level = p.level      || 'intermediate';
  const goal  = p.goal       || 'build_muscle';
  const phase = state.currentPhase || 1;
  const variant = getOverloadVariant();
  const key = planKey(equip, level, goal, phase, variant);
  if (!force && _plan && _plan.key === key) return _plan;
  _plan = {
    key, variant,
    label:     OVERLOAD_VARIANTS[variant].label,
    exercises: buildFullBodyOverload(equip, level, goal, phase, variant),
  };
  return _plan;
}

// ── SMALL VIEW HELPERS ──

export function muscleChip(groupId) {
  const g = MUSCLE_GROUPS.find(m => m.id === groupId);
  if (!g) return '';
  return `<span class="muscle-chip" style="--chip:${g.color}">${g.icon} ${g.label}</span>`;
}

// Weekly coverage: how many of the 3 sessions train each muscle group.
// A group only counts for a session if the user's equipment/level actually has
// an exercise for it — so bodyweight users see honest gaps, not false coverage.
function coverageCounts() {
  const p     = state.profile || {};
  const equip = p.equipment || 'full_gym';
  const level = p.level      || 'intermediate';
  const avail = {};
  MUSCLE_GROUPS.forEach(g => { avail[g.id] = getExercisesForGroup(g.id, equip, level).length > 0; });

  const counts = {};
  MUSCLE_GROUPS.forEach(g => { counts[g.id] = 0; });
  OVERLOAD_VARIANTS.forEach(v => {
    [...new Set(v.groups)].forEach(g => { if (counts[g] != null && avail[g]) counts[g]++; });
  });
  return counts;
}

function ring(pct, label, value, color) {
  const deg = Math.round(Math.max(0, Math.min(100, pct)) * 3.6);
  return `
  <div class="ov-ring-wrap">
    <div class="ring" style="--deg:${deg}deg;--ring:${color || 'var(--fire)'}">
      <div class="ring-inner"><span class="ring-val">${value}</span></div>
    </div>
    <div class="ov-ring-label">${label}</div>
  </div>`;
}

function sessionsThisWeek() {
  const now = new Date();
  const start = new Date(now); start.setDate(now.getDate() - now.getDay()); start.setHours(0,0,0,0);
  return (state.sessions || []).filter(s => new Date(s.date) >= start).length;
}

// ── TARGET LINE (progressive overload suggestion) ──

function targetLine(ex) {
  const sug = suggestNextSet(ex.id, ex.reps, state.sessions || [], state.profile || {});
  const reps = sug.reps != null ? sug.reps : ex.reps;
  const load = sug.isBodyweight
    ? `${reps} reps`
    : (sug.weight != null ? `${formatWeight(sug.weight)} × ${reps}` : `~${reps} reps`);
  const tag = sug.isColdStart ? 'start' : (sug.isBodyweight ? 'bodyweight' : 'target');
  return { load, tag, rationale: sug.rationale || '' };
}

// ── MAIN RENDER ──

export function renderOverloadMode() {
  const plan   = buildPlan();
  const cov    = coverageCounts();
  const hit    = Object.values(cov).filter(c => c > 0).length;
  const total  = MUSCLE_GROUPS.length;
  const swk    = sessionsThisWeek();

  const exercisesJson = JSON.stringify(plan.exercises.map(ex => ({
    id: ex.id, name: ex.name, sets: ex.sets, reps: ex.reps, muscle: ex.muscle,
  }))).replace(/'/g, '&#39;');

  const rows = plan.exercises.map(ex => {
    const meta = EXERCISES[ex.id] || {};
    const t = targetLine(ex);
    return `
    <div class="ov-ex">
      <div class="ov-ex-media" onclick="openExDetail('${ex.id}')">
        ${exPreviewHTML(meta, { variant: 'thumb' }) || `<div class="ov-ex-noimg">${(meta.type === 'compound' ? '🏋️' : '💪')}</div>`}
      </div>
      <div class="ov-ex-body">
        <div class="ov-ex-name" onclick="openExDetail('${ex.id}')">${ex.name}
          <span style="font-size:9px;color:var(--fire);opacity:0.7">↗</span>
        </div>
        <div class="ov-ex-chips">${(meta.groups || []).map(muscleChip).join('')}</div>
        <div class="ov-ex-scheme">
          <span class="mono fire">${ex.sets}</span> sets ·
          <span class="mono">${ex.reps}</span> reps ·
          <span class="mono muted">${ex.rest}</span> rest
        </div>
        <div class="ov-target">
          <span class="ov-target-tag ov-tag-${t.tag}">${t.tag}</span>
          <span class="mono ov-target-load">${t.load}</span>
          <span class="ov-target-why">${t.rationale}</span>
        </div>
      </div>
    </div>`;
  }).join('');

  const coverageGrid = MUSCLE_GROUPS.map(g => {
    const c = cov[g.id] || 0;
    const op = c >= 2 ? 0.85 : c === 1 ? 0.45 : 0.08;
    return `
    <div class="cov-cell ${c === 0 ? 'cov-empty' : ''}" style="--cov:${g.color};--op:${op}">
      <span class="cov-ic">${g.icon}</span>
      <span class="cov-lbl">${g.label}</span>
      <span class="cov-cnt">${c}×</span>
    </div>`;
  }).join('');

  return `
<div class="page-header">
  <div class="label" style="margin-bottom:6px">Progressive Overload</div>
  <h1 class="display page-title">OVERLOAD · ${plan.label.toUpperCase().replace('FULL BODY ','SESSION ')}</h1>
  <div class="page-sub">Every muscle group, 3× a week — auto-progressed from your last sessions.</div>
</div>

<div class="alert alert-neutral mb24" style="margin-bottom:20px">
  <span>📈</span>
  <span class="fs13">Three rotating full-body sessions (A · B · C). Across the week they train
  <strong>all ${total} muscle groups</strong>. Each lift shows your next target — beat it to progress.</span>
</div>

<!-- RINGS -->
<div class="ov-rings">
  ${ring((hit / total) * 100, 'Muscle coverage', `${hit}/${total}`, 'var(--fire)')}
  ${ring(Math.min(swk / 3, 1) * 100, 'Sessions this wk', `${swk}/3`, 'var(--forge-green)')}
  ${ring(((plan.variant + 1) / 3) * 100, 'Rotation', plan.label.replace('Full Body ',''), 'var(--steel)')}
</div>

<!-- SESSION SELECTOR -->
<div style="display:flex;flex-wrap:wrap;gap:6px;margin:18px 0 10px">
  <span class="label" style="align-self:center;margin-right:6px">Session:</span>
  ${OVERLOAD_VARIANTS.map((v, i) => `
    <button class="wtab ${i === plan.variant ? 'active' : ''}" onclick="overloadPick(${i})">${v.key}</button>
  `).join('')}
  <button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="overloadShuffle()">🔀 Shuffle</button>
</div>

<!-- WORKOUT CARD -->
<div class="card">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
    <div style="font-family:var(--ff-display);font-size:24px;font-weight:800">${plan.label.toUpperCase()}</div>
    <button class="btn btn-fire btn-sm" onclick='window.overloadStart("${plan.label}", ${exercisesJson})'>⚡ Start Workout</button>
  </div>
  <div class="ov-ex-list">${rows || '<div class="dim tc" style="padding:24px">No exercises for your equipment — try Full Gym in Settings.</div>'}</div>
</div>

<!-- COVERAGE HEATMAP -->
<div class="sec-head" style="margin-top:28px">Weekly Muscle Coverage</div>
<div class="cov-grid">${coverageGrid}</div>
`;
}

// ── HANDLERS ──

function rerender() {
  const el = document.getElementById('page-overload');
  if (el) el.innerHTML = renderOverloadMode();
}

window.overloadShuffle = () => { buildPlan(true); rerender(); };

window.overloadPick = (i) => {
  // Jump the rotation pointer to the picked session and rebuild.
  if (!state.overloadState) state.overloadState = { nextVariant: 0 };
  state.overloadState.nextVariant = ((i % 3) + 3) % 3;
  buildPlan(true);
  rerender();
};

window.overloadStart = (label, exercises) => {
  const id = `overload-${getOverloadVariant()}`;
  window.startActiveWorkout(id, label, exercises, 'strength');
  // Advance the rotation so the next visit shows the next session.
  advanceOverloadVariant();
  _plan = null;
};
