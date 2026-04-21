// ═══════════════════════════════════════════
//   FITNESS FORGE — Program Generation Engine
//   Builds a personalized plan from user profile
// ═══════════════════════════════════════════

import { EXERCISES, CARDIO_STRUCTURES } from '../data/exercises.js';

// Helper: pick exercises by equipment availability + difficulty
function pick(pool, equip, level, count) {
  const diffMap = { beginner: ['beg'], intermediate: ['beg','int'], advanced: ['beg','int','adv'] };
  const allowed = diffMap[level] || ['beg','int'];
  const filtered = pool.filter(id =>
    EXERCISES[id] &&
    EXERCISES[id].equip.includes(equip) &&
    allowed.includes(EXERCISES[id].diff)
  );
  // Shuffle and take count
  return filtered.sort(() => Math.random() - 0.5).slice(0, count);
}

function exRow(id, sets, reps, rest, note='') {
  const ex = EXERCISES[id];
  if (!ex) return null;
  return { id, name: ex.name, muscle: ex.muscle, sets, reps, rest, note };
}

// ── WORKOUT BUILDERS ──

function buildLower(equip, level, goal, phase) {
  const isStrength = goal === 'get_stronger';
  const isFat      = goal === 'lose_fat';

  // Phase determines set/rep scheme
  const schemes = [
    { sets: '3–4', reps: '10–12', rest: '90s' },  // foundation
    { sets: '4',   reps: '8–10',  rest: '2 min' }, // hypertrophy
    { sets: '5',   reps: '4–6',   rest: '3 min' }, // strength
    { sets: '5',   reps: '3–5',   rest: '3–4 min'},// peak
  ];
  const s = schemes[phase - 1] || schemes[0];

  const squatPool = ['squat_bb','squat_front','squat_db','squat_bw','bss'];
  const hingPool  = ['rdl_bb','rdl_db','deadlift','trap_dl'];
  const accPool   = ['legpress','lunge_db','lunge_bw','lunge_bb','stepup'];
  const isoPool   = ['legcurl','hipthrust_bb','hipthrust_bw','calfr_bb','calfr_bw'];
  const corePool  = ['plank','deadbug','pallof','hollow','legraise'];
  const powerPool = ['boxjump','bss'];

  const exercises = [];

  if (phase === 4 && level === 'advanced' && equip === 'full_gym') {
    exercises.push(exRow('boxjump', '3', '5', '90s', 'Explosive, step down carefully'));
  }

  const sq = pick(squatPool, equip, level, 1)[0];
  if (sq) exercises.push(exRow(sq, s.sets, s.reps, s.rest, phase >= 3 ? 'Build toward 1× bodyweight' : 'Focus on depth and control'));

  const hn = pick(hingPool, equip, level, 1)[0];
  if (hn) exercises.push(exRow(hn, s.sets, s.reps, s.rest, 'Feel the hamstring stretch'));

  const acc = pick(accPool, equip, level, isFat ? 2 : 1);
  acc.forEach(id => exercises.push(exRow(id, '3', '10–12', '60s', 'Control throughout')));

  const iso = pick(isoPool, equip, level, 2);
  iso.forEach(id => exercises.push(exRow(id, '3', '12–15', '60s', '')));

  const core = pick(corePool, equip, level, 1)[0];
  if (core) exercises.push(exRow(core, '3', core === 'plank' ? '30–45s' : '10–12', '45s', 'Neutral spine'));

  return exercises.filter(Boolean);
}

function buildUpperPush(equip, level, goal, phase) {
  const schemes = [
    { sets: '3–4', reps: '10–12', rest: '90s' },
    { sets: '4',   reps: '8–10',  rest: '90s' },
    { sets: '5',   reps: '5–6',   rest: '2.5 min' },
    { sets: '5',   reps: '3–5',   rest: '3 min' },
  ];
  const s = schemes[phase - 1] || schemes[0];

  const chestPool = ['bench_bb','bench_db','incline_bb','incline_db','pushup','pushup_inc'];
  const pressPool = ['ohp_bb','ohp_db','pushpress'];
  const fliesPool = ['cable_fly','db_fly'];
  const delt      = ['lat_raise','front_raise'];
  const triPool   = ['tri_push','tri_oh','skull','cgbench','dips'];

  const exercises = [];

  // Main chest
  const ch = pick(chestPool, equip, level, 1)[0];
  if (ch) exercises.push(exRow(ch, s.sets, s.reps, s.rest, phase >= 3 ? 'Build toward 0.85× bodyweight' : 'Control the descent'));

  // Incline if full gym
  if (equip === 'full_gym' && level !== 'beginner') {
    const inc = pick(['incline_bb','incline_db'], equip, level, 1)[0];
    if (inc) exercises.push(exRow(inc, '3', '8–10', '90s', '30-degree angle'));
  }

  // Shoulder press
  const pr = pick(pressPool, equip, level, 1)[0];
  if (pr) exercises.push(exRow(pr, '3', s.reps, '90s', 'Strict form'));

  // Fly / isolation
  if (level !== 'beginner') {
    const fl = pick(fliesPool, equip, level, 1)[0];
    if (fl) exercises.push(exRow(fl, '3', '12–15', '60s', 'Squeeze contraction'));
  }

  // Delts
  exercises.push(exRow('lat_raise', '3', '12–15', '60s', 'Light, strict form'));

  // Tricep
  const tri = pick(triPool, equip, level, goal === 'build_muscle' ? 2 : 1);
  tri.forEach(id => exercises.push(exRow(id, '3', '10–12', '60s', '')));

  return exercises.filter(Boolean);
}

function buildUpperPull(equip, level, goal, phase) {
  const schemes = [
    { sets: '3–4', reps: '8–10', rest: '2 min' },
    { sets: '4',   reps: '6–8',  rest: '2 min' },
    { sets: '5',   reps: '5',    rest: '3 min'  },
    { sets: '5',   reps: '3–5',  rest: '3 min'  },
  ];
  const s = schemes[phase - 1] || schemes[0];

  const pullPool  = ['pullup','chinup','lat_pull'];
  const rowPool   = ['row_bb','row_db','row_cable','row_chest','row_tbar'];
  const rearPool  = ['face_pull'];
  const curlPool  = ['curl_bb','curl_db','curl_hammer','curl_incline'];
  const shruPool  = ['shrug_bb','shrug_db'];

  const exercises = [];

  const pull = pick(pullPool, equip, level, 1)[0];
  if (pull) exercises.push(exRow(pull, s.sets, s.reps, s.rest, level === 'beginner' ? 'Use lat pulldown if needed' : 'Full ROM'));

  const row1 = pick(rowPool, equip, level, 1)[0];
  if (row1) exercises.push(exRow(row1, s.sets, s.reps, '90s', 'Squeeze shoulder blades'));

  if (level !== 'beginner') {
    const row2 = pick(rowPool.filter(r => r !== row1), equip, level, 1)[0];
    if (row2) exercises.push(exRow(row2, '3', '10–12', '90s', 'Vary grip'));
  }

  if (equip === 'full_gym') {
    exercises.push(exRow('face_pull', '3', '15–20', '60s', 'External rotation at top — shoulder health'));
  }

  if (goal === 'build_muscle' || phase >= 2) {
    const sh = pick(shruPool, equip, level, 1)[0];
    if (sh) exercises.push(exRow(sh, '3', '12–15', '60s', 'Hold at top'));
  }

  const curl = pick(curlPool, equip, level, goal === 'build_muscle' ? 2 : 1);
  curl.forEach(id => exercises.push(exRow(id, '3', '10–12', '60s', 'No swinging')));

  return exercises.filter(Boolean);
}

function buildFullBody(equip, level, goal, phase) {
  const lower = buildLower(equip, level, goal, phase).slice(0, 3);
  const push  = buildUpperPush(equip, level, goal, phase).slice(0, 2);
  const pull  = buildUpperPull(equip, level, goal, phase).slice(0, 2);
  const core  = [exRow('plank', '3', '30–45s', '45s', '')].filter(Boolean);
  return [...lower, ...push, ...pull, ...core];
}

function buildCardioSession(type, level) {
  const c = CARDIO_STRUCTURES[type];
  if (!c) return null;
  const dur = { beginner: c.begDuration, intermediate: c.intDuration, advanced: c.advDuration }[level] || c.intDuration;
  return { type: c.name, desc: c.desc, duration: dur, zone: c.zone, hrRange: c.hrRange };
}

// ── SPLIT BUILDERS ──

function build3DaySplit(equip, level, goal, totalWeeks) {
  const days = [];
  const daysOfWeek = [
    { day: 'Monday',    type: 'strength', label: 'Full Body A' },
    { day: 'Wednesday', type: 'strength', label: 'Full Body B' },
    { day: 'Friday',    type: 'strength', label: 'Full Body C' },
  ];
  const rest = [
    { day: 'Tuesday',  type: 'cardio',   label: 'Cardio or Rest' },
    { day: 'Thursday', type: 'cardio',   label: 'Cardio or Rest' },
    { day: 'Saturday', type: 'rest',     label: 'Active Recovery' },
    { day: 'Sunday',   type: 'rest',     label: 'Rest' },
  ];
  return [...daysOfWeek, ...rest].sort((a,b) =>
    ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].indexOf(a.day) -
    ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].indexOf(b.day)
  );
}

function build4DaySplit() {
  return [
    { day: 'Monday',    type: 'strength', label: 'Upper Body A' },
    { day: 'Tuesday',   type: 'strength', label: 'Lower Body A' },
    { day: 'Wednesday', type: 'cardio',   label: 'Zone 2 + Core' },
    { day: 'Thursday',  type: 'strength', label: 'Upper Body B' },
    { day: 'Friday',    type: 'strength', label: 'Lower Body B' },
    { day: 'Saturday',  type: 'cardio',   label: 'Long Run / Sport' },
    { day: 'Sunday',    type: 'rest',     label: 'Active Recovery' },
  ];
}

function build5DaySplit() {
  return [
    { day: 'Monday',    type: 'strength', label: 'Lower Body' },
    { day: 'Tuesday',   type: 'cardio',   label: 'Zone 2 + Core' },
    { day: 'Wednesday', type: 'strength', label: 'Upper Push' },
    { day: 'Thursday',  type: 'cardio',   label: 'Intervals / Tempo' },
    { day: 'Friday',    type: 'strength', label: 'Upper Pull' },
    { day: 'Saturday',  type: 'cardio',   label: 'Long Run / Sport' },
    { day: 'Sunday',    type: 'rest',     label: 'Active Recovery' },
  ];
}

function build6DaySplit() {
  return [
    { day: 'Monday',    type: 'strength', label: 'Push A' },
    { day: 'Tuesday',   type: 'strength', label: 'Pull A' },
    { day: 'Wednesday', type: 'strength', label: 'Legs A' },
    { day: 'Thursday',  type: 'strength', label: 'Push B' },
    { day: 'Friday',    type: 'strength', label: 'Pull B' },
    { day: 'Saturday',  type: 'strength', label: 'Legs B' },
    { day: 'Sunday',    type: 'rest',     label: 'Full Rest' },
  ];
}

// ── PHASE WORKOUT TABLES ──

function buildPhaseWorkouts(equip, level, goal, splitDays) {
  const phases = {};
  for (let p = 1; p <= 4; p++) {
    const sessions = {};

    // Determine which sessions to build based on split structure
    const strengthDays = splitDays.filter(d => d.type === 'strength');

    strengthDays.forEach((d, i) => {
      const label = d.label.toLowerCase();
      let exercises;
      if (label.includes('full body')) {
        exercises = buildFullBody(equip, level, goal, p);
      } else if (label.includes('lower')) {
        exercises = buildLower(equip, level, goal, p);
      } else if (label.includes('upper push') || label.includes('push')) {
        exercises = buildUpperPush(equip, level, goal, p);
      } else if (label.includes('upper pull') || label.includes('pull')) {
        exercises = buildUpperPull(equip, level, goal, p);
      } else if (label.includes('upper')) {
        // Generic upper: mix push + pull
        exercises = [...buildUpperPush(equip, level, goal, p).slice(0,4),
                     ...buildUpperPull(equip, level, goal, p).slice(0,4)];
      } else {
        exercises = buildFullBody(equip, level, goal, p);
      }
      sessions[d.day] = { label: d.label, exercises };
    });

    phases[`phase${p}`] = sessions;
  }
  return phases;
}

// ── MAIN GENERATOR ──

export function generateProgram(profile) {
  const { name, goal, level, equipment, daysPerWeek, cardioLevel, weeks = 16 } = profile;

  // Pick split structure
  const splitBuilders = { 3: build3DaySplit, 4: build4DaySplit, 5: build5DaySplit, 6: build6DaySplit };
  const splitDays = (splitBuilders[daysPerWeek] || build4DaySplit)();

  // Build workouts for each phase
  const phaseWorkouts = buildPhaseWorkouts(equipment, level, goal, splitDays);

  // Cardio prescriptions
  const cardioPrescriptions = buildCardioPrescriptions(level, goal, cardioLevel);

  // Strength benchmarks (generic, bodyweight-relative)
  const benchmarks = buildBenchmarks(level, goal, equipment);

  // Targets
  const targets = buildTargets(goal, level);

  return {
    profile: { name, goal, level, equipment, daysPerWeek, cardioLevel, weeks },
    splitDays,
    phaseWorkouts,
    cardioPrescriptions,
    benchmarks,
    targets,
    totalWeeks: weeks,
    createdAt: Date.now(),
  };
}

function buildCardioPrescriptions(level, goal, cardioLevel) {
  if (cardioLevel === 'none') return [];

  const prescriptions = [];

  if (cardioLevel === 'light' || cardioLevel === 'moderate' || cardioLevel === 'heavy') {
    prescriptions.push({
      label: 'Easy Aerobic Session',
      frequency: cardioLevel === 'light' ? '1–2×/week' : '2–3×/week',
      ...buildCardioSession('zone2', level),
    });
  }

  if (cardioLevel === 'moderate' || cardioLevel === 'heavy') {
    prescriptions.push({
      label: 'Tempo / Intervals',
      frequency: '1–2×/week',
      ...buildCardioSession(level === 'beginner' ? 'tempo' : 'intervals', level),
    });
  }

  if (cardioLevel === 'heavy') {
    prescriptions.push({
      label: 'Long Steady-State',
      frequency: '1×/week',
      ...buildCardioSession('steadystate', level),
    });
  }

  return prescriptions;
}

function buildBenchmarks(level, goal, equipment) {
  if (equipment === 'bodyweight') {
    return [
      { lift: 'Push-Ups',      w1: '3×10', w4: '4×15', w8: '4×20', w12: '3×30', goal: 'Max reps clean form' },
      { lift: 'Pull-Ups',      w1: '3×3',  w4: '3×6',  w8: '3×10', w12: '3×15', goal: 'Unassisted × 15' },
      { lift: 'Bodyweight Squat', w1: '3×15', w4: '3×20', w8: '3×30', w12: '2×50', goal: 'Single-leg squat' },
      { lift: 'Plank',         w1: '30s',  w4: '60s',  w8: '90s',  w12: '2 min', goal: '2 min solid' },
    ];
  }

  const isStrength = goal === 'get_stronger';
  return [
    { lift: 'Back Squat',   w1: 'BW×0.5', w4: 'BW×0.6', w8: 'BW×0.8', w12: 'BW×0.9',  goal: '1× bodyweight' },
    { lift: 'Deadlift',     w1: 'BW×0.6', w4: 'BW×0.8', w8: 'BW×1.0', w12: 'BW×1.1',  goal: '1.25× bodyweight' },
    { lift: 'Bench Press',  w1: 'BW×0.4', w4: 'BW×0.5', w8: 'BW×0.6', w12: 'BW×0.7',  goal: '0.85× bodyweight' },
    { lift: 'Pull-Ups',     w1: 'BW×5',   w4: 'BW×8',   w8: '+10 lbs×5', w12: '+25 lbs×5', goal: '+35 lbs × 5' },
    { lift: 'OHP',          w1: 'BW×0.3', w4: 'BW×0.35',w8: 'BW×0.4', w12: 'BW×0.5',  goal: '0.55× bodyweight' },
  ];
}

function buildTargets(goal, level) {
  const map = {
    build_muscle: [
      'Increase muscle mass via progressive overload',
      'Hit 0.7–1g protein per lb bodyweight daily',
      'Add weight or reps each week to compounds',
      'Sleep 7–9 hrs/night for optimal recovery',
    ],
    lose_fat: [
      'Preserve muscle while in a calorie deficit',
      'Stay in 300–500 kcal daily deficit',
      'Maintain protein at 0.8–1g per lb bodyweight',
      'Prioritize strength sessions over cardio',
    ],
    get_stronger: [
      'Build to 1× BW squat, 1.25× BW deadlift',
      'Train the main compounds 2–3× per week',
      'Keep reps low (3–6) with heavy loads on key lifts',
      'Sleep 8–9 hrs — strength gains happen at rest',
    ],
    general_fitness: [
      'Build a consistent 5-day training habit',
      'Increase weekly step count to 8,000+ / day',
      'Mix strength, cardio, and mobility each week',
      'Reduce resting heart rate over 12 weeks',
    ],
    athletic: [
      'Improve power and rate of force development',
      'Add plyometrics and explosive lifts in Phase 3–4',
      'Prioritize unilateral leg work for sport balance',
      'Zone 2 cardio 2–3×/week for aerobic base',
    ],
  };
  return map[goal] || map['general_fitness'];
}
