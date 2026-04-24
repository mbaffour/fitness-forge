// ════════════════════════════════════════════
//   Calisthenics — Browse & Session Builder
//   Filters by level, grouped by category
//   Tap any card → modal with GIF + cues
// ════════════════════════════════════════════

import { EXERCISES, getCalisthenicsExercises } from '../data/exercises.js';
import { state } from '../store.js';
import { showExerciseModal } from './modal.js';

// ── Category groupings (calisthenics exercises by movement pattern) ──
const CALI_CATEGORIES = [
  {
    id: 'upper_push',
    label: 'Upper Push',
    icon: '⬆️',
    ids: ['pushup', 'diamond_pu', 'pike_pu', 'hspu', 'dips', 'ring_dip'],
  },
  {
    id: 'upper_pull',
    label: 'Upper Pull',
    icon: '⬇️',
    ids: ['pullup', 'chinup', 'inverted_row', 'muscle_up'],
  },
  {
    id: 'lower',
    label: 'Lower Body',
    icon: '🦵',
    ids: ['squat_bw', 'lunge_bw', 'pistol_sq', 'jump_sq', 'nordic_curl', 'hipthrust_bw', 'calfr_bw', 'stepup'],
  },
  {
    id: 'core',
    label: 'Core',
    icon: '⚙️',
    ids: ['plank', 'hollow', 'l_sit', 'dragon_flag', 'deadbug', 'crunch', 'legraise', 'russian', 'ab_wheel'],
  },
  {
    id: 'conditioning',
    label: 'Conditioning',
    icon: '🔥',
    ids: ['burpee', 'mtn_climber', 'jump_sq', 'boxjump'],
  },
];

// Pre-built circuits: level → array of exercise IDs
const CIRCUITS = {
  beginner: {
    label: 'Beginner Foundation Circuit',
    desc: '3 rounds · 30s rest between exercises · 90s rest between rounds',
    rounds: 3,
    exercises: ['pushup', 'squat_bw', 'inverted_row', 'plank', 'lunge_bw', 'crunch'],
  },
  intermediate: {
    label: 'Intermediate Bodyweight Strength',
    desc: '4 rounds · 20s rest between exercises · 2 min rest between rounds',
    rounds: 4,
    exercises: ['pullup', 'dips', 'pistol_sq', 'diamond_pu', 'inverted_row', 'hollow', 'mtn_climber'],
  },
  advanced: {
    label: 'Advanced Skill Circuit',
    desc: '5 rounds · Minimal rest · Full body athletic output',
    rounds: 5,
    exercises: ['muscle_up', 'ring_dip', 'hspu', 'pistol_sq', 'l_sit', 'dragon_flag', 'nordic_curl'],
  },
};

// Rep/time schemes by exercise type
const CALI_REPS = {
  // Holds (time-based)
  plank: '30–60s', hollow: '20–40s', l_sit: '10–20s', dragon_flag: '5–8 reps',
  // Upper push
  pushup: '10–20 reps', diamond_pu: '8–15 reps', pike_pu: '8–12 reps',
  hspu: '3–8 reps', dips: '8–15 reps', ring_dip: '5–10 reps',
  // Upper pull
  pullup: '5–10 reps', chinup: '5–10 reps', inverted_row: '10–15 reps', muscle_up: '3–6 reps',
  // Lower
  squat_bw: '15–25 reps', lunge_bw: '10–15/side', pistol_sq: '3–8/side',
  jump_sq: '10–15 reps', nordic_curl: '3–8 reps', hipthrust_bw: '15–25 reps',
  calfr_bw: '15–25/side', stepup: '10–15/side', boxjump: '5–10 reps',
  // Core
  deadbug: '8–12/side', crunch: '15–25 reps', legraise: '8–15 reps',
  russian: '20–30 reps', ab_wheel: '6–12 reps',
  // Conditioning
  burpee: '10–15 reps', mtn_climber: '20–30 reps',
};

let selectedLevel = 'beginner';
let selectedCircuit = null;

export function renderCalisthenics() {
  const userLevel = state.profile?.level || 'beginner';
  // Init selected level from user profile if first load
  if (!window.__cali_level_set) {
    selectedLevel = userLevel;
    window.__cali_level_set = true;
  }

  const diffMap = { beginner: ['beg'], intermediate: ['beg', 'int'], advanced: ['beg', 'int', 'adv'] };
  const allowed = diffMap[selectedLevel] || ['beg'];

  return `
<div class="page-header">
  <div class="label" style="margin-bottom:6px">Bodyweight Training</div>
  <h1 class="display page-title">CALISTHENICS</h1>
  <div class="page-sub">Master your bodyweight — no equipment required</div>
</div>

<!-- LEVEL FILTER -->
<div class="sec-head" style="margin-bottom:14px">Your Level</div>
<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:28px">
  ${['beginner','intermediate','advanced'].map(lvl => `
    <button class="btn ${selectedLevel === lvl ? 'btn-fire' : 'btn-ghost'}"
            onclick="setCaliLevel('${lvl}')">
      ${lvl === 'beginner' ? '🌱' : lvl === 'intermediate' ? '📈' : '🏆'}
      ${lvl.charAt(0).toUpperCase() + lvl.slice(1)}
    </button>
  `).join('')}
</div>

<!-- QUICK CIRCUITS -->
<div class="sec-head" style="margin-bottom:14px">Quick Circuits</div>
<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:32px">
  ${Object.entries(CIRCUITS).map(([lvl, c]) => {
    const isAccessible = allowed.includes({ beginner:'beg', intermediate:'int', advanced:'adv' }[lvl]);
    return `
    <div class="card ${!isAccessible ? 'card-locked' : ''}"
         style="cursor:${isAccessible ? 'pointer' : 'default'};opacity:${isAccessible ? '1' : '0.45'};display:flex;align-items:flex-start;gap:14px;padding:14px 16px"
         onclick="${isAccessible ? `startCaliCircuit('${lvl}')` : ''}">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">
          <span style="font-family:var(--ff-mono);font-size:0.8rem;font-weight:600;color:var(--text)">${c.label}</span>
          <span class="tag ${lvl==='beginner'?'t-dim':lvl==='intermediate'?'t-steel':'t-fire'}" style="font-size:8px">
            ${lvl}
          </span>
        </div>
        <div style="font-family:var(--ff-mono);font-size:0.75rem;color:var(--text-2)">${c.desc}</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px">
          ${c.exercises.map(id => `<span class="tag t-dim" style="font-size:8px">${EXERCISES[id]?.name || id}</span>`).join('')}
        </div>
      </div>
      ${isAccessible ? `<div style="color:var(--fire);font-size:18px;margin-top:2px;flex-shrink:0">⚡</div>` : `<div style="font-size:18px;flex-shrink:0">🔒</div>`}
    </div>
  `}).join('')}
</div>

<!-- EXERCISES BY CATEGORY -->
<div class="sec-head" style="margin-bottom:20px">Exercise Library</div>
${CALI_CATEGORIES.map(cat => {
  // Filter to exercises that exist and are accessible at this level
  const available = cat.ids
    .map(id => ({ id, ...(EXERCISES[id] || {}) }))
    .filter(ex => ex.name && allowed.includes(ex.diff));
  if (!available.length) return '';

  return `
  <div style="margin-bottom:28px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
      <span style="font-size:16px">${cat.icon}</span>
      <span style="font-family:var(--ff-mono);font-size:0.7rem;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-2)">${cat.label}</span>
      <span style="font-family:var(--ff-mono);font-size:0.65rem;color:var(--text-3);padding:2px 6px;border:1px solid var(--border);border-radius:var(--r-sm)">${available.length}</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px">
      ${available.map(ex => `
        <div class="cali-ex-card" onclick="openCaliExDetail('${ex.id}')">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px">
              <span style="font-family:var(--ff-mono);font-size:0.82rem;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${ex.name}</span>
            </div>
            <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap">
              <span class="tag ${ex.diff==='adv'?'t-fire':ex.diff==='int'?'t-steel':'t-dim'}" style="font-size:8px">
                ${ex.diff==='beg'?'Beginner':ex.diff==='int'?'Intermediate':'Advanced'}
              </span>
              ${ex.type ? `<span class="tag t-dim" style="font-size:8px">${ex.type}</span>` : ''}
            </div>
            <div style="font-family:var(--ff-mono);font-size:0.72rem;color:var(--text-2);margin-top:5px">${ex.muscle || ''}</div>
          </div>
          <div style="text-align:right;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:4px">
            <div style="font-family:var(--ff-mono);font-size:0.75rem;color:var(--fire);font-weight:600">${CALI_REPS[ex.id] || '8–12 reps'}</div>
            <div style="font-family:var(--ff-mono);font-size:0.65rem;color:var(--text-3)">Tap for form</div>
          </div>
        </div>
      `).join('')}
    </div>
  </div>
  `;
}).join('')}

<!-- PROGRESSION GUIDE -->
<div class="sec-head" style="margin-bottom:14px">Progression Path</div>
<div class="card" style="padding:16px;margin-bottom:32px">
  <div style="display:flex;flex-direction:column;gap:12px">
    ${[
      { step:'1', label:'Push foundations', detail:'Push-Up → Diamond Push-Up → Pike Push-Up → Handstand Push-Up' },
      { step:'2', label:'Pull foundations', detail:'Inverted Row → Chin-Up → Pull-Up → Muscle-Up' },
      { step:'3', label:'Leg foundations', detail:'Bodyweight Squat → Reverse Lunge → Jump Squat → Pistol Squat' },
      { step:'4', label:'Core foundations', detail:'Crunch → Plank → Hollow Body Hold → L-Sit → Dragon Flag' },
      { step:'5', label:'Hamstring strength', detail:'Glute Bridge → Nordic Hamstring Curl' },
    ].map(p => `
      <div style="display:flex;gap:12px;align-items:flex-start">
        <div style="width:22px;height:22px;border-radius:50%;background:rgba(255,107,26,0.15);border:1px solid var(--fire);display:flex;align-items:center;justify-content:center;font-family:var(--ff-mono);font-size:10px;color:var(--fire);font-weight:700;flex-shrink:0;margin-top:1px">${p.step}</div>
        <div>
          <div style="font-family:var(--ff-mono);font-size:0.8rem;font-weight:600;color:var(--text);margin-bottom:2px">${p.label}</div>
          <div style="font-family:var(--ff-mono);font-size:0.72rem;color:var(--text-2)">${p.detail}</div>
        </div>
      </div>
    `).join('')}
  </div>
</div>
`;
}

// ── GLOBAL HANDLERS ──────────────────────────────────────────

window.setCaliLevel = (lvl) => {
  selectedLevel = lvl;
  const el = document.getElementById('page-calisthenics');
  if (el) el.innerHTML = renderCalisthenics();
};

window.openCaliExDetail = (exId) => {
  const ex = EXERCISES[exId];
  if (ex) showExerciseModal({ id: exId, ...ex });
};

window.startCaliCircuit = (lvl) => {
  const circuit = CIRCUITS[lvl];
  if (!circuit) return;

  const exercises = circuit.exercises
    .map(id => {
      const ex = EXERCISES[id];
      if (!ex) return null;
      return {
        id,
        name: ex.name,
        sets: String(circuit.rounds),
        reps: CALI_REPS[id] || '10 reps',
        muscle: ex.muscle,
        notes: 'Bodyweight',
      };
    })
    .filter(Boolean);

  if (exercises.length) {
    window.startActiveWorkout(`cali_${lvl}`, circuit.label, exercises);
  }
};
