// ════════════════════════════════════════
//   Freestyle Workout Generator
//   User picks muscle groups + intensity
//   → personalised session with weight suggestions
// ════════════════════════════════════════

import { MUSCLE_GROUPS, getExercisesForGroup, rankedForGroup, EXERCISES } from '../data/exercises.js';
import { state, formatWeight, weightUnitLabel } from '../store.js';
import { suggestNextSet } from '../engine/overload.js';
import { showExerciseModal, exThumbHTML } from './modal.js';

// Rep schemes by intensity
const SCHEMES = {
  light:    { sets: 3, repRange: '12–15', rest: '60s',    rpe: '~RPE 6', desc: 'Light session — focus on form, pump' },
  moderate: { sets: 3, repRange: '8–12',  rest: '90s',    rpe: '~RPE 7–8', desc: 'Balanced volume and intensity' },
  heavy:    { sets: 4, repRange: '4–6',   rest: '2–3 min', rpe: '~RPE 9',   desc: 'Heavy strength focus — big weights, low reps' },
};

// Freestyle used to carry its OWN copy of the cold-start weight model — the
// same one that shipped in the engine, with the same two faults: a level
// fraction multiplied on top of a per-exercise bodyweight fraction (halving
// every number) and a flat 0.25x fallback for anything outside its 20-entry
// table. Two models also meant Freestyle ignored your training history and
// always quoted a first-timer's load, even for a lift you had logged for
// months. It now asks the shared engine, which reads both.
function weightSuggestion(exId, reps) {
  const sug = suggestNextSet(exId, reps, state.sessions || [], state.profile || {},
                             state.settings?.progression || 'double');
  if (sug.isBodyweight) {
    return { text: 'Bodyweight', note: sug.rationale || 'Add weight when form is solid' };
  }
  if (sug.weight == null) {
    return sug.rationale ? { text: `${sug.reps ?? reps} reps`, note: sug.rationale } : null;
  }
  const ex = EXERCISES[exId];
  const perHand = (ex?.requires || []).some(r => r === 'dumbbells' || r === 'kettlebell')
    && !/goblet|single[- ]?arm|one[- ]?arm|suitcase|swing/i.test(ex?.name || '');
  const unit = weightUnitLabel();
  return {
    text: `${formatWeight(sug.weight, false)} ${unit}${perHand ? ' per hand' : ''}`,
    note: sug.rationale || '',
  };
}

let selectedGroups = [];
let selectedIntensity = 'moderate';
let generatedSession = null;

export function renderFreestyle() {
  const { profile } = state;
  const hasProfile = !!profile;

  return `
<div class="page-header">
  <div class="label" style="margin-bottom:6px">Build a Session</div>
  <h1 class="display page-title">FREESTYLE</h1>
  <div class="page-sub">Pick your targets → get a custom session on the spot</div>
</div>

${!hasProfile ? `
  <div class="alert alert-fire mb24" style="margin-bottom:24px">
    <span>⚡</span>
    <div>
      <div style="font-weight:500;margin-bottom:2px">No profile set — freestyle still works!</div>
      <div class="fs12">Weight suggestions require a bodyweight. <span style="cursor:pointer;text-decoration:underline" onclick="navigate('onboard')">Complete the quiz →</span></div>
    </div>
  </div>
` : ''}

<!-- STEP 1: MUSCLE GROUPS -->
<div class="sec-head" style="margin-bottom:16px">Step 1 — Pick muscle groups to train</div>
<div class="muscle-grid" id="muscle-grid">
  ${MUSCLE_GROUPS.map(g => `
    <div class="muscle-tile ${selectedGroups.includes(g.id) ? 'selected' : ''}"
         onclick="toggleMuscle('${g.id}')"
         style="${selectedGroups.includes(g.id) ? `border-color:${g.color};background:rgba(${hexToRgb(g.color)},0.1)` : ''}">
      <div class="tile-icon">${g.icon}</div>
      <div class="tile-label">${g.label}</div>
    </div>
  `).join('')}
</div>

<!-- STEP 2: INTENSITY -->
<div class="sec-head" style="margin-bottom:14px">Step 2 — Intensity</div>
<div class="intensity-btns mb24" style="margin-bottom:24px">
  ${Object.entries(SCHEMES).map(([key, s]) => `
    <button class="int-btn ${selectedIntensity === key ? 'active' : ''}" onclick="setIntensity('${key}')">
      ${key} <span style="opacity:0.6;font-size:9px">(${s.repRange} reps)</span>
    </button>
  `).join('')}
</div>

<!-- GENERATE BUTTON -->
<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:32px">
  <button class="btn btn-fire btn-lg" onclick="generateFreestyle()">
    🔥 Generate Session
  </button>
  ${selectedGroups.length > 0 ? `
    <button class="btn btn-ghost" onclick="clearFreestyle()">Clear</button>
  ` : ''}
</div>

<!-- GENERATED SESSION -->
<div id="freestyle-result"></div>
`;
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}

function buildFreestyleSession(groups, intensity, profile) {
  const equip = profile?.equipment || 'full_gym';
  const level = profile?.level    || 'intermediate';
  const scheme = SCHEMES[intensity];

  // Collect exercises per group, deduplicate
  const seen = new Set();
  const exercises = [];

  for (const gid of groups) {
    // Shared ranking: exercises that train this group as their PRIMARY target
    // first, curated staples above the bulk libraries, cardio/SMR excluded.
    // Sorting on compound-vs-isolation alone offered Pull-Ups and Lat Pulldown
    // for a biceps session, and Farmer Carries + Air Bike for core.
    const pool = rankedForGroup(getExercisesForGroup(gid, equip, level), gid);

    // Take 1–2 per group depending on total groups
    const perGroup = groups.length <= 3 ? 2 : 1;
    let added = 0;
    for (const ex of pool) {
      if (!seen.has(ex.id) && added < perGroup) {
        seen.add(ex.id);
        exercises.push(ex);
        added++;
      }
    }
  }

  // Cap at 8 exercises
  const final = exercises.slice(0, 8);

  return final.map(ex => {
    const suggestion = weightSuggestion(ex.id, scheme.repRange);
    return {
      ...ex,
      sets: scheme.sets,
      reps: scheme.repRange,
      rest: scheme.rest,
      suggestion,
    };
  });
}

function renderResult(exercises, intensity) {
  const scheme = SCHEMES[intensity];
  if (!exercises.length) {
    return `<div class="alert alert-neutral"><span>ℹ️</span><span>No exercises found for the selected muscles + equipment. Try adding more muscle groups or changing equipment in settings.</span></div>`;
  }

  return `
<div class="sec-head" style="margin-bottom:16px">Your Session — ${exercises.length} exercises</div>

<div class="alert alert-neutral mb24" style="margin-bottom:16px">
  <span>📋</span>
  <div class="fs13"><strong>${intensity.charAt(0).toUpperCase()+intensity.slice(1)} intensity:</strong> ${scheme.desc} · ${scheme.sets} sets × ${scheme.repRange} reps · ${scheme.rest} rest · ${scheme.rpe}</div>
</div>

<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:32px">
  ${exercises.map((ex, i) => `
    <div class="freestyle-ex-card" onclick="openExDetail('${ex.id}')">
      <div class="ex-card-num">${String(i+1).padStart(2,'0')}</div>
      ${exThumbHTML(ex)}
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <div style="font-weight:500;font-size:14px">${ex.name}</div>
          <span class="tag ${ex.type==='compound'?'t-fire':'t-steel'}" style="font-size:8px">${ex.type}</span>
        </div>
        <div class="muted fs12 mt4" style="margin-top:4px">${ex.muscle}</div>
        ${ex.suggestion ? `
          <div style="font-family:var(--ff-mono);font-size:10px;color:var(--forge-green);margin-top:4px">
            💡 ${ex.suggestion.text}
          </div>
        ` : ''}
      </div>
      <div style="text-align:right;min-width:90px">
        <div class="mono fire" style="font-size:13px;font-weight:600">${ex.sets} × ${ex.reps}</div>
        <div class="mono muted" style="font-size:10px;margin-top:2px">${ex.rest} rest</div>
        <div class="muted" style="font-size:10px;margin-top:4px">Tap for form →</div>
      </div>
    </div>
  `).join('')}
</div>

<div style="display:flex;gap:12px;flex-wrap:wrap">
  <button class="btn btn-fire btn-lg" onclick="startFreestyleActive()">⚡ Start Active Session</button>
  <button class="btn btn-ghost btn-lg" onclick="logFreestyleSession()">✓ Quick Log</button>
  <button class="btn btn-ghost" onclick="generateFreestyle()">🔄 Regenerate</button>
</div>
`;
}

// ── GLOBAL HANDLERS ──

window.toggleMuscle = (id) => {
  const idx = selectedGroups.indexOf(id);
  if (idx >= 0) selectedGroups.splice(idx, 1);
  else selectedGroups.push(id);
  refreshFreestylePage();
};

window.setIntensity = (val) => {
  selectedIntensity = val;
  refreshFreestylePage();
};

window.clearFreestyle = () => {
  selectedGroups = [];
  generatedSession = null;
  refreshFreestylePage();
};

window.generateFreestyle = () => {
  if (!selectedGroups.length) {
    alert('Pick at least one muscle group first!');
    return;
  }
  const { profile } = state;
  generatedSession = buildFreestyleSession(selectedGroups, selectedIntensity, profile);

  const result = document.getElementById('freestyle-result');
  if (result) result.innerHTML = renderResult(generatedSession, selectedIntensity);
};

window.startFreestyleActive = () => {
  if (!generatedSession?.length) return;
  const groups = selectedGroups.map(g => MUSCLE_GROUPS.find(m => m.id === g)?.label || g).join(', ');
  const label = `Freestyle: ${groups}`;
  const exercises = generatedSession.map(ex => ({
    id: ex.id, name: ex.name, sets: String(ex.sets), reps: ex.reps, muscle: ex.muscle,
  }));
  window.startActiveWorkout('freestyle', label, exercises);
};

window.logFreestyleSession = () => {
  if (!generatedSession) return;
  const { logWorkout } = window.__forge_store;
  const groups = selectedGroups.map(g => MUSCLE_GROUPS.find(m => m.id === g)?.label || g).join(', ');
  logWorkout({
    date: new Date().toISOString(),
    label: `Freestyle: ${groups}`,
    type: 'Freestyle',
    phase: state.currentPhase,
    week: state.currentWeek,
  });
  const btn = document.querySelector('#freestyle-result .btn-fire');
  if (btn) {
    btn.textContent = '✓ Logged!';
    btn.style.background = 'var(--forge-green)';
    btn.style.color = 'var(--bg)';
    setTimeout(() => { btn.textContent = '✓ Log This Session'; btn.style.background=''; btn.style.color=''; }, 2000);
  }
};

// window.openExDetail is defined once in main.js — this file used to redefine
// it identically, which meant whichever module loaded last silently won.

function refreshFreestylePage() {
  const el = document.getElementById('page-freestyle');
  if (el) el.innerHTML = renderFreestyle();
  // Re-render result if session exists
  if (generatedSession) {
    const result = document.getElementById('freestyle-result');
    if (result) result.innerHTML = renderResult(generatedSession, selectedIntensity);
  }
}
