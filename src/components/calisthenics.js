// ════════════════════════════════════════════════
//   Calisthenics — Standalone Bodyweight Training
//   Fully separate from the weighted program.
//   Own exercise library, circuits, session log.
// ════════════════════════════════════════════════

import { EXERCISES, getCalisthenicsExercises } from '../data/exercises.js';
import { state, save, logWorkout, updateStreak } from '../store.js';
import { showExerciseModal } from './modal.js';

// ── Movement categories (covers both bodyweight + caliOnly pools) ──────────
const CALI_CATEGORIES = [
  {
    id: 'upper_push',
    label: 'Upper Push',
    icon: '💪',
    desc: 'Chest, shoulders, triceps',
    ids: ['pushup', 'diamond_pu', 'pike_pu', 'hspu', 'dips', 'ring_dip'],
  },
  {
    id: 'upper_pull',
    label: 'Upper Pull',
    icon: '🔙',
    desc: 'Lats, biceps, rhomboids',
    ids: ['pullup', 'chinup', 'inverted_row', 'muscle_up'],
  },
  {
    id: 'lower',
    label: 'Lower Body',
    icon: '🦵',
    desc: 'Quads, glutes, hamstrings',
    ids: ['squat_bw', 'lunge_bw', 'bss', 'stepup', 'hipthrust_bw', 'jump_sq', 'pistol_sq', 'nordic_curl', 'calfr_bw'],
  },
  {
    id: 'core',
    label: 'Core',
    icon: '⚙️',
    desc: 'Abs, obliques, stability',
    ids: ['plank', 'deadbug', 'crunch', 'russian', 'legraise', 'hollow', 'ab_wheel', 'l_sit', 'dragon_flag'],
  },
  {
    id: 'conditioning',
    label: 'Conditioning',
    icon: '🔥',
    desc: 'Full-body power & cardio',
    ids: ['burpee', 'mtn_climber', 'jump_sq', 'boxjump'],
  },
];

// Rep / duration targets per exercise
const CALI_REPS = {
  pushup:'10–20 reps',      diamond_pu:'8–15 reps',   pike_pu:'8–12 reps',
  hspu:'3–8 reps',          dips:'8–15 reps',          ring_dip:'5–10 reps',
  pullup:'5–12 reps',       chinup:'5–12 reps',        inverted_row:'10–15 reps',
  muscle_up:'3–6 reps',
  squat_bw:'15–25 reps',    lunge_bw:'12–16 reps',     bss:'8–12/side',
  stepup:'10–15/side',      hipthrust_bw:'15–25 reps', jump_sq:'10–15 reps',
  pistol_sq:'3–8/side',     nordic_curl:'3–8 reps',    calfr_bw:'15–25/side',
  boxjump:'5–10 reps',
  plank:'30–60s',           deadbug:'8–12/side',       crunch:'15–25 reps',
  russian:'20–30 reps',     legraise:'8–15 reps',      hollow:'20–40s',
  ab_wheel:'6–12 reps',     l_sit:'10–20s hold',       dragon_flag:'4–8 reps',
  burpee:'10–15 reps',      mtn_climber:'20–30 reps',
};

// Pre-built circuits ───────────────────────────────────────────────────────
const CIRCUITS = {
  beginner: {
    label: 'Foundation Circuit',
    desc: '3 rounds · 45s rest between exercises · 2 min between rounds',
    rounds: 3,
    exercises: ['pushup', 'squat_bw', 'inverted_row', 'lunge_bw', 'plank', 'crunch'],
    diff: 'beg',
  },
  intermediate: {
    label: 'Strength Circuit',
    desc: '4 rounds · 30s rest between exercises · 90s between rounds',
    rounds: 4,
    exercises: ['pullup', 'dips', 'bss', 'diamond_pu', 'inverted_row', 'hollow', 'mtn_climber'],
    diff: 'int',
  },
  advanced: {
    label: 'Skill & Power Circuit',
    desc: '5 rounds · Minimal rest · Maximum output',
    rounds: 5,
    exercises: ['muscle_up', 'ring_dip', 'hspu', 'pistol_sq', 'l_sit', 'dragon_flag', 'nordic_curl'],
    diff: 'adv',
  },
};

// ── Skill progressions ─────────────────────────────────────────────────────
const PROGRESSIONS = [
  { skill:'Handstand Push-Up',  steps:['Wall Plank Hold → Pike Push-Up → Elevated Pike Push-Up → Wall HSPU → Full HSPU'] },
  { skill:'Muscle-Up',          steps:['Dead Hang → Pull-Up (10+) → High Pull-Up → Transition Drill → Full Muscle-Up'] },
  { skill:'Pistol Squat',       steps:['Bodyweight Squat → Box Pistol (sit to box) → Partial Pistol → Assisted Pistol → Full Pistol'] },
  { skill:'L-Sit',              steps:['Knee Tuck Hold → Single Leg Extension → L-Sit on Parallel Bars → Full L-Sit'] },
  { skill:'Dragon Flag',        steps:['Hollow Body Hold → Tuck Flag → Single Leg Extension → Full Dragon Flag'] },
  { skill:'Ring Dips',          steps:['Bar Dips (15+ reps) → Stable Ring Support → Ring Dip Negative → Full Ring Dips'] },
];

let selectedLevel = null;

export function renderCalisthenics() {
  // Auto-set level from profile on first load
  if (!selectedLevel) {
    selectedLevel = state.profile?.level || 'beginner';
  }

  const diffMap = { beginner:['beg'], intermediate:['beg','int'], advanced:['beg','int','adv'] };
  const allowed  = diffMap[selectedLevel] || ['beg'];

  // Recent calisthenics sessions (workoutType = 'calisthenics')
  const recentSessions = (state.sessions || [])
    .filter(s => s.workoutType === 'calisthenics')
    .slice(0, 5);

  return `
<!-- ── HEADER ────────────────────────────────────── -->
<div class="page-header">
  <div class="label" style="margin-bottom:6px">Bodyweight Training</div>
  <h1 class="display page-title">CALISTHENICS</h1>
  <div class="page-sub">Master your bodyweight — anywhere, no equipment needed</div>
</div>

<!-- ── LEVEL SELECTOR ───────────────────────────── -->
<div class="sec-head" style="margin-bottom:14px">Training Level</div>
<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:32px">
  ${['beginner','intermediate','advanced'].map(lvl => `
    <button class="btn ${selectedLevel === lvl ? 'btn-fire' : 'btn-ghost'}"
            onclick="setCaliLevel('${lvl}')">
      ${lvl === 'beginner' ? '🌱' : lvl === 'intermediate' ? '📈' : '🏆'}
      ${lvl.charAt(0).toUpperCase() + lvl.slice(1)}
    </button>
  `).join('')}
</div>

<!-- ── PRE-BUILT CIRCUITS ────────────────────────── -->
<div class="sec-head" style="margin-bottom:14px">Circuits</div>
<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:32px">
  ${Object.entries(CIRCUITS).map(([lvl, c]) => {
    const accessible = allowed.includes(c.diff);
    return `
  <div class="card ${accessible ? 'cali-circuit-card' : ''}"
       style="padding:14px 16px;opacity:${accessible ? '1' : '0.4'};${accessible ? 'cursor:pointer' : 'cursor:default'}"
       ${accessible ? `onclick="startCaliCircuit('${lvl}')"` : ''}>
    <div style="display:flex;align-items:flex-start;gap:12px">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:5px">
          <span style="font-family:var(--ff-mono);font-size:0.85rem;font-weight:600;color:var(--text)">${c.label}</span>
          <span class="tag ${c.diff==='beg'?'t-dim':c.diff==='int'?'t-steel':'t-fire'}" style="font-size:8px">${lvl}</span>
          <span style="font-family:var(--ff-mono);font-size:0.7rem;color:var(--text-3)">${c.rounds} rounds</span>
        </div>
        <div style="font-family:var(--ff-mono);font-size:0.72rem;color:var(--text-2);margin-bottom:8px">${c.desc}</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">
          ${c.exercises.map(id => {
            const ex = EXERCISES[id];
            return ex ? `<span class="tag t-dim" style="font-size:8px">${ex.name}</span>` : '';
          }).join('')}
        </div>
      </div>
      <div style="font-size:20px;flex-shrink:0;margin-top:2px">${accessible ? '⚡' : '🔒'}</div>
    </div>
  </div>
    `;
  }).join('')}
</div>

<!-- ── EXERCISE LIBRARY ──────────────────────────── -->
<div class="sec-head" style="margin-bottom:20px">Exercise Library</div>
${CALI_CATEGORIES.map(cat => {
  const available = cat.ids
    .map(id => ({ id, ...(EXERCISES[id] || {}) }))
    .filter(ex => ex.name && allowed.includes(ex.diff));
  if (!available.length) return '';

  return `
<div style="margin-bottom:28px">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
    <span style="font-size:15px">${cat.icon}</span>
    <span style="font-family:var(--ff-mono);font-size:0.7rem;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-2)">${cat.label}</span>
    <span style="font-family:var(--ff-mono);font-size:0.65rem;color:var(--text-3)">${cat.desc}</span>
    <span style="font-family:var(--ff-mono);font-size:0.65rem;color:var(--text-3);padding:2px 6px;border:1px solid var(--border);border-radius:var(--r-sm);margin-left:auto">${available.length} exercises</span>
  </div>
  <div style="display:flex;flex-direction:column;gap:6px">
    ${available.map(ex => `
      <div class="cali-ex-card" onclick="openCaliExDetail('${ex.id}')">
        <div style="flex:1;min-width:0">
          <div style="font-family:var(--ff-mono);font-size:0.85rem;font-weight:600;color:var(--text);margin-bottom:4px">${ex.name}</div>
          <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap">
            <span class="tag ${ex.diff==='adv'?'t-fire':ex.diff==='int'?'t-steel':'t-dim'}" style="font-size:8px">
              ${ex.diff==='beg'?'Beginner':ex.diff==='int'?'Intermediate':'Advanced'}
            </span>
            ${ex.type ? `<span class="tag t-dim" style="font-size:8px">${ex.type}</span>` : ''}
            ${ex.caliOnly ? `<span class="tag t-cali" style="font-size:8px">skill</span>` : ''}
            <span style="font-family:var(--ff-mono);font-size:0.7rem;color:var(--text-2)">${ex.muscle || ''}</span>
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;justify-content:center;gap:4px">
          <div style="font-family:var(--ff-mono);font-size:0.8rem;color:var(--fire);font-weight:600">${CALI_REPS[ex.id] || '8–12 reps'}</div>
          <div style="font-family:var(--ff-mono);font-size:0.65rem;color:var(--text-3)">Tap for form ↗</div>
        </div>
      </div>
    `).join('')}
  </div>
</div>
  `;
}).join('')}

<!-- ── SKILL PROGRESSIONS ─────────────────────────── -->
<div class="sec-head" style="margin-bottom:14px">Skill Progressions</div>
<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:32px">
  ${PROGRESSIONS.map((p, i) => `
  <div class="card" style="padding:14px 16px">
    <div style="display:flex;align-items:flex-start;gap:12px">
      <div style="width:24px;height:24px;border-radius:50%;background:var(--fire-dim);border:1px solid var(--fire);display:flex;align-items:center;justify-content:center;font-family:var(--ff-mono);font-size:10px;color:var(--fire);font-weight:700;flex-shrink:0;margin-top:1px">${i+1}</div>
      <div>
        <div style="font-family:var(--ff-mono);font-size:0.82rem;font-weight:600;color:var(--text);margin-bottom:5px">${p.skill}</div>
        <div style="font-family:var(--ff-mono);font-size:0.72rem;color:var(--text-2);line-height:1.6">${p.steps[0]}</div>
      </div>
    </div>
  </div>
  `).join('')}
</div>

<!-- ── RECENT SESSIONS ───────────────────────────── -->
${recentSessions.length ? `
<div class="sec-head" style="margin-bottom:14px">Recent Sessions</div>
<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:32px">
  ${recentSessions.map(s => {
    const d = new Date(s.date);
    const dateStr = d.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
    const exCount = s.exercises?.length || 0;
    const dur = s.durationMinutes ? `${s.durationMinutes} min` : '';
    return `
  <div class="card" style="padding:12px 14px;display:flex;align-items:center;gap:12px">
    <div style="flex:1;min-width:0">
      <div style="font-family:var(--ff-mono);font-size:0.82rem;font-weight:600;color:var(--text);margin-bottom:2px">${s.workoutLabel || 'Calisthenics'}</div>
      <div style="font-family:var(--ff-mono);font-size:0.7rem;color:var(--text-2)">${dateStr}${exCount ? ` · ${exCount} exercises` : ''}${dur ? ` · ${dur}` : ''}</div>
    </div>
    <span class="tag t-cali" style="font-size:8px;flex-shrink:0">DONE</span>
  </div>
    `;
  }).join('')}
</div>
` : ''}
`;
}

// ── GLOBAL HANDLERS ─────────────────────────────────────────────────────────

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
    window.startActiveWorkout(`cali_${lvl}`, circuit.label, exercises, 'calisthenics');
  }
};
