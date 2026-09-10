// ═══════════════════════════════════════════
//   FITNESS FORGE — Progressive Overload Engine
//   Pure functions — no side effects
// ═══════════════════════════════════════════

import { EXERCISES } from '../data/exercises.js';

// Weight increments by exercise category and level
const INCREMENT = {
  compound_bb: { beginner: 5, intermediate: 2.5, advanced: 2.5 },
  compound_db: { beginner: 5, intermediate: 2.5, advanced: 2.5 },
  isolation:   { beginner: 2.5, intermediate: 2.5, advanced: 2.5 },
};

// Bodyweight exercises — tracked by reps only
const BW_EXERCISES = new Set([
  'pullup','chinup','dips','pushup','squat_bw','lunge_bw',
  'plank','deadbug','hollow','russian','crunch','legraise',
  'hipthrust_bw','calfr_bw','stepup','boxjump',
  'side_plank','v_up',
]);

// A movement carries no external load when the curated list says so, or when
// the exercise data itself asks for no equipment. Before this was data-driven,
// only the 18 ids above counted, so Bird Dog, Wall Sit, Bicycle Crunch and the
// rest of the bodyweight library were quoted a phantom barbell load.
const NO_LOAD_ITEMS = new Set(['bench', 'pull_up_bar', 'ab_wheel', 'rings_trx']);

function isUnloaded(exId, ex) {
  if (BW_EXERCISES.has(exId)) return true;
  const e = ex || EXERCISES[exId];
  if (!e) return false;
  if (!Array.isArray(e.requires)) return false;
  if (e.requires.length === 0) return !/\bplate\b|weighted|medicine ball|sandbag/i.test(e.name || '');
  // A bench, pull-up bar, ab wheel or set of rings is a tool, not a load —
  // none of them has a weight to choose. Only barbell / dumbbells /
  // kettlebell / cable / machine / bands carry an adjustable resistance.
  return e.requires.every(r => NO_LOAD_ITEMS.has(r));
}

function classifyExercise(exId) {
  if (isUnloaded(exId)) return 'bodyweight';
  if (exId.endsWith('_db') || exId.includes('curl_db') || exId.includes('shrug_db') ||
      exId === 'lat_raise' || exId === 'front_raise' || exId === 'farmer' ||
      exId === 'ohp_db' || exId === 'bench_db' || exId === 'incline_db' ||
      exId === 'rdl_db' || exId === 'lunge_db' || exId === 'row_db') {
    return 'compound_db';
  }
  // Isolations
  if (['legcurl','legpress','cable_fly','db_fly','tri_push','tri_oh','skull',
       'lat_raise','front_raise','face_pull','shrug_bb','shrug_db',
       'curl_bb','curl_db','curl_hammer','curl_incline','str_pull',
       'russian','crunch','ab_wheel',
       'leg_ext','seated_calf','glute_kickback','hip_abduction','hip_adduction',
       'rear_delt_fly','upright_row','pullover','preacher_curl','cable_curl',
       'concentration_curl','reverse_curl','wrist_curl','rev_wrist_curl',
       'cable_crunch','wood_chop'].includes(exId)) {
    return 'isolation';
  }
  return 'compound_bb';
}

function parseRepRange(repsStr) {
  if (!repsStr) return { min: 8, max: 12 };
  // Handle "10–12" or "10-12" or "10" or "30–45s" (timed)
  const clean = repsStr.replace(/s$/, '').replace('–', '-');
  const parts = clean.split('-').map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return { min: parts[0], max: parts[1] };
  }
  const single = parseInt(clean);
  if (!isNaN(single)) return { min: single, max: single };
  return { min: 8, max: 12 };
}

// ══ COLD START — first-ever load for an exercise ═══════════════════════════
// Nothing has been logged, so the load is estimated from the person: their
// bodyweight, training level, sex and age, against published strength
// standards for the movement pattern. It is deliberately conservative — this
// is the first set of a lift you have never done here, so it should be a
// weight you can own with clean technique, not a test.
//
// The previous model multiplied a per-exercise bodyweight fraction by a second
// level fraction, halving every number, and fell back to a flat 0.25 x for any
// exercise not in its 60-entry table — which is 950 of the 1057 in the library.
// That is why almost everything quoted the same generic load.

// Approximate 1RM as a multiple of bodyweight for an INTERMEDIATE MALE aged
// <= 35, expressed as total external load (both hands / the whole bar).
// These are ballpark strength-standard figures, not a medical prescription.
const PATTERN_1RM = {
  squat: 1.25, front_squat: 1.00, leg_press: 2.30, lunge: 0.55,
  hinge: 1.50, hinge_light: 0.95, hip_thrust: 1.40,
  horiz_push: 1.00, incline_push: 0.80, vert_push: 0.62,
  horiz_pull: 0.90, vert_pull: 0.80, shrug: 1.30, carry: 1.00,
  curl: 0.35, tri_ext: 0.35, lat_raise: 0.22, rear_delt: 0.20,
  chest_fly: 0.55, pullover: 0.35,
  calf: 1.40, leg_ext: 0.55, leg_curl: 0.45, hip_iso: 0.50,
  core_loaded: 0.35, forearm: 0.18,
  other_compound: 0.50, other_iso: 0.25,
};

// Ceiling on a cold-start suggestion, as a multiple of bodyweight. A backstop
// against a nonsense profile producing a dangerous first set — never a target.
const PATTERN_CAP = {
  leg_press: 3.0, hinge: 2.0, squat: 1.75, hip_thrust: 2.0, calf: 2.0, shrug: 1.8,
};
const DEFAULT_CAP = 1.5;

// Movement pattern for the curated staples, where the name alone is ambiguous.
const PATTERN_BY_ID = {
  squat_bb: 'squat', squat_front: 'front_squat', squat_db: 'squat', hack_squat: 'squat',
  legpress: 'leg_press', bss: 'lunge', lunge_db: 'lunge', lunge_bb: 'lunge', stepup: 'lunge',
  deadlift: 'hinge', trap_dl: 'hinge', sumo_dl: 'hinge', pendlay_row: 'horiz_pull',
  rdl_bb: 'hinge_light', rdl_db: 'hinge_light', good_morning: 'hinge_light',
  hipthrust: 'hip_thrust', glute_bridge: 'hip_thrust',
  bench_bb: 'horiz_push', bench_db: 'horiz_push', decline_bench: 'horiz_push',
  machine_press: 'horiz_push', cgbench: 'horiz_push',
  incline_bb: 'incline_push', incline_db: 'incline_push',
  ohp_bb: 'vert_push', ohp_db: 'vert_push', pushpress: 'vert_push', arnold_press: 'vert_push',
  row_bb: 'horiz_pull', row_db: 'horiz_pull', row_cable: 'horiz_pull',
  row_chest: 'horiz_pull', row_tbar: 'horiz_pull',
  lat_pull: 'vert_pull', str_pull: 'vert_pull',
  shrug_bb: 'shrug', shrug_db: 'shrug', farmer: 'carry',
  curl_bb: 'curl', curl_db: 'curl', curl_hammer: 'curl', curl_incline: 'curl',
  preacher_curl: 'curl', cable_curl: 'curl', concentration_curl: 'curl', reverse_curl: 'curl',
  tri_push: 'tri_ext', tri_oh: 'tri_ext', skull: 'tri_ext',
  lat_raise: 'lat_raise', front_raise: 'lat_raise', upright_row: 'lat_raise',
  rear_delt_fly: 'rear_delt', face_pull: 'rear_delt',
  cable_fly: 'chest_fly', db_fly: 'chest_fly', pullover: 'pullover',
  seated_calf: 'calf', calf_raise: 'calf',
  leg_ext: 'leg_ext', legcurl: 'leg_curl',
  hip_abduction: 'hip_iso', hip_adduction: 'hip_iso', glute_kickback: 'hip_iso',
  cable_crunch: 'core_loaded', wood_chop: 'core_loaded',
  wrist_curl: 'forearm', rev_wrist_curl: 'forearm',
};

// Keyword fallback for the ~950 library exercises with no hand-written entry.
const PATTERN_BY_NAME = [
  [/leg press/i,                                  'leg_press'],
  [/hack squat/i,                                 'squat'],
  [/front squat|goblet/i,                          'front_squat'],
  [/squat|belt squat|sissy/i,                      'squat'],
  [/lunge|split squat|step[- ]?up|bulgarian/i,     'lunge'],
  [/romanian|rdl|good ?morning|back extension|hyperextension/i, 'hinge_light'],
  [/deadlift|clean|snatch|swing|pull[- ]?through/i,'hinge'],
  [/hip thrust|glute bridge/i,                     'hip_thrust'],
  [/incline (bench|press|push)/i,                  'incline_push'],
  [/shoulder press|overhead press|military|push press|arnold|landmine press/i, 'vert_push'],
  [/bench press|chest press|floor press|board press|dip machine/i, 'horiz_push'],
  [/fly|flye|pec deck|crossover/i,                 'chest_fly'],
  [/pullover/i,                                     'pullover'],
  [/pulldown|pull[- ]?down|pull[- ]?up|chin[- ]?up/i, 'vert_pull'],
  [/row|face pull/i,                                'horiz_pull'],
  [/shrug/i,                                        'shrug'],
  [/carry|farmer|suitcase|waiter/i,                 'carry'],
  [/lateral raise|side raise|front raise|upright row/i, 'lat_raise'],
  [/rear delt|reverse fly|reverse flye/i,           'rear_delt'],
  [/curl/i,                                         'curl'],
  [/tricep|pushdown|push[- ]?down|skull ?crusher|extension.*tricep|kickback/i, 'tri_ext'],
  [/calf|heel raise/i,                              'calf'],
  [/leg extension|knee extension/i,                 'leg_ext'],
  [/leg curl|hamstring curl/i,                      'leg_curl'],
  [/abduction|adduction|clamshell|glute kick/i,     'hip_iso'],
  [/\bwrist\b|\bforearm\b|gripper|grip (?:strength|trainer|machine)|pinch|hand squeeze/i, 'forearm'],
  [/crunch|sit[- ]?up|twist|woodchop|wood chop|pallof|leg raise|plank/i, 'core_loaded'],
  [/press/i,                                        'horiz_push'],
];

// Last resort: the exercise's own muscle group + compound/isolation flag.
const PATTERN_BY_GROUP = {
  chest: 'horiz_push', shoulders: 'vert_push', back: 'horiz_pull',
  quads: 'squat', hamstrings: 'hinge_light', glutes: 'hip_thrust', calves: 'calf',
  biceps: 'curl', triceps: 'tri_ext', forearms: 'forearm', core: 'core_loaded',
};

const CARDIO_RE = /elliptical|treadmill|stationary bike|rowing machine|stair ?master|jacobs ladder|arc trainer|airdyne|ski ?erg|\bcycling\b|\bjogging\b|\brunning\b|\bwalking\b/i;

// Explosive variants are trained well below the strength version of the lift.
const PLYO_RE = /\bjump|plyo|explosive|\bhop\b|bound|depth drop|clap/i;

function movementPattern(exId, ex) {
  if (PATTERN_BY_ID[exId]) return PATTERN_BY_ID[exId];
  const name = ex?.name || '';
  for (const [re, pat] of PATTERN_BY_NAME) if (re.test(name)) return pat;
  const g = ex?.groups?.[0];
  if (g && PATTERN_BY_GROUP[g]) {
    const pat = PATTERN_BY_GROUP[g];
    // An isolation move on a compound pattern is much lighter than the pattern.
    return ex?.type === 'isolation' ? (pat === 'horiz_push' ? 'chest_fly' : pat) : pat;
  }
  return ex?.type === 'isolation' ? 'other_iso' : 'other_compound';
}

// Each standard above is quoted for the implement the movement is normally
// performed on — a lat pulldown's number is a cable stack, a lateral raise's
// is a pair of dumbbells. Only a SUBSTITUTION is discounted; scaling a
// natively-cable lift by a "cable factor" was double-counting and made
// pulldowns and raises read far too light.
const NATIVE_IMPLEMENT = {
  squat: 'barbell', front_squat: 'barbell', leg_press: 'machine', lunge: 'dumbbell',
  hinge: 'barbell', hinge_light: 'barbell', hip_thrust: 'barbell',
  horiz_push: 'barbell', incline_push: 'barbell', vert_push: 'barbell',
  horiz_pull: 'barbell', vert_pull: 'cable', shrug: 'barbell', carry: 'dumbbell',
  curl: 'barbell', tri_ext: 'cable', lat_raise: 'dumbbell', rear_delt: 'dumbbell',
  chest_fly: 'dumbbell', pullover: 'dumbbell',
  calf: 'machine', leg_ext: 'machine', leg_curl: 'machine', hip_iso: 'machine',
  core_loaded: 'cable', forearm: 'barbell',
  other_compound: 'barbell', other_iso: 'dumbbell',
};
const SUBSTITUTION = { barbell: 1.15, machine: 1.05, cable: 0.85, dumbbell: 0.75, kettlebell: 0.60, other: 0.80 };

function implementOf(exId, ex) {
  const req = ex?.requires || [];
  if (req.includes('resistance_bands')) return 'band';
  if (req.includes('barbell'))          return 'barbell';
  if (req.includes('machine'))          return 'machine';
  if (req.includes('cable'))            return 'cable';
  if (req.includes('kettlebell'))       return 'kettlebell';
  if (req.includes('dumbbells'))        return 'dumbbell';
  if (/\bplate\b/i.test(ex?.name || '')) return 'dumbbell';
  return 'other';
}

// Isolation work is done on EZ, fixed or light bars, so the 45 lb olympic bar
// is not its floor — forcing it handed a 140 lb beginner a 45 lb barbell curl.
const ISOLATION_PATTERNS = new Set(['curl', 'tri_ext', 'lat_raise', 'rear_delt', 'chest_fly',
  'pullover', 'forearm', 'core_loaded', 'leg_ext', 'leg_curl', 'hip_iso']);

// One implement held in both hands (goblet, swings, single-arm work) takes the
// whole load; a matched pair splits it, and the number the user types is the
// weight of ONE dumbbell.
const SINGLE_IMPLEMENT = /goblet|single[- ]?arm|one[- ]?arm|single[- ]?leg|suitcase|swing|halo|windmill|turkish|landmine|around the world/i;

// Strength scales with bodyweight but not linearly — a 250 lb lifter is not
// 1.6x as strong as a 155 lb one at the same level. Allometric-style damping.
function bodyweightScale(bw) {
  const ref = 175;
  return Math.pow(bw / ref, 0.67) * ref;
}

const LEVEL_FACTOR = { beginner: 0.62, intermediate: 1.0, advanced: 1.35 };

// Upper-body strength relative to bodyweight differs more by sex than lower.
// When sex is unknown, take the lower of the two — starting light is the safe
// error, and one working set corrects it.
const UPPER = new Set(['horiz_push', 'incline_push', 'vert_push', 'horiz_pull', 'vert_pull',
  'curl', 'tri_ext', 'lat_raise', 'rear_delt', 'chest_fly', 'pullover', 'shrug', 'forearm']);
function sexFactor(sex, pattern) {
  const upper = UPPER.has(pattern);
  if (sex === 'male')   return 1.0;
  if (sex === 'female') return upper ? 0.60 : 0.72;
  return upper ? 0.68 : 0.78;   // unstated — conservative middle
}

// Peak roughly 20–35; taper after, and hold youth well back.
function ageFactor(age) {
  if (!age) return 1.0;
  if (age < 18) return 0.70;
  if (age <= 35) return 1.0;
  return Math.max(0.62, 1 - (age - 35) * 0.006);
}

// Inverse Epley: the load you can move for `reps` given a 1RM.
const loadForReps = (oneRm, reps) => oneRm / (1 + Math.max(1, reps) / 30);

function roundLoad(w) {
  if (w < 12) return Math.round(w);              // small dumbbells come in 1s
  if (w < 25) return Math.round(w / 2.5) * 2.5;
  return Math.round(w / 5) * 5;
}

const BAR_LB = 45;         // an empty olympic bar — you cannot load less
const LIGHT_BAR_LB = 15;   // lightest EZ / fixed / training bar

/**
 * coldStartWeight(exId, profile, reps)
 * Returns a starting load in canonical lbs, or null when the movement carries
 * no measurable external load (bodyweight, bands) or the profile has no
 * bodyweight to reason from.
 */
function coldStartWeight(exId, profile, reps = 8) {
  const bw = profile?.weight;
  if (!bw) return null;
  const ex = EXERCISES[exId];
  if (isUnloaded(exId, ex)) return null;

  if (CARDIO_RE.test(ex?.name || '')) return null;   // cardio machine, not a lift

  const impl = implementOf(exId, ex);
  if (impl === 'band') return null;               // bands are not measured in lbs

  const pattern = movementPattern(exId, ex);
  const base    = PATTERN_1RM[pattern] ?? PATTERN_1RM.other_compound;
  const level   = profile.level || 'intermediate';

  // 1RM estimate for this person on this pattern, as total external load.
  let oneRm = bodyweightScale(bw) * base
            * (LEVEL_FACTOR[level] ?? 1.0)
            * sexFactor(profile.sex, pattern)
            * ageFactor(profile.age);

  // A vertical pull already moves bodyweight; the stack only makes up the rest.
  if (pattern === 'vert_pull') oneRm *= 0.9;

  // Only discount when the implement differs from the one the standard assumes.
  const native = NATIVE_IMPLEMENT[pattern] || 'barbell';
  if (impl !== native) oneRm *= SUBSTITUTION[impl] ?? 0.8;

  // First session on this lift: leave headroom for technique.
  let load = loadForReps(oneRm, reps) * (level === 'beginner' ? 0.78 : 0.85);

  // A jump squat is not a squat — explosive work is loaded far lighter.
  if (PLYO_RE.test(ex?.name || '')) load *= 0.45;

  // Health backstop — never suggest an absurd first set.
  load = Math.min(load, bw * (PATTERN_CAP[pattern] ?? DEFAULT_CAP));

  // Per-implement, not total, for anything held in the hands.
  if ((impl === 'dumbbell' || impl === 'kettlebell') && !SINGLE_IMPLEMENT.test(ex?.name || '')) {
    load /= 2;
  }

  load = roundLoad(load);

  // Below the bar is not a weight you can load on a big barbell lift, and an
  // empty bar is the standard place to start one. Accessory barbell work is
  // exempt — EZ and fixed bars go lighter.
  if (impl === 'barbell') {
    return ISOLATION_PATTERNS.has(pattern)
      ? Math.max(LIGHT_BAR_LB, load)   // EZ / fixed / training bar
      : Math.max(BAR_LB, load);
  }
  return load >= 2 ? load : null;   // lighter than the smallest dumbbell — reps only
}

// Say what the number is based on, so a first-session load does not read as an
// arbitrary default. Also names the missing input when there isn't one.
function coldStartRationale(profile, weight, isBodyweight) {
  if (isBodyweight) return 'Bodyweight movement — chase clean reps, not load.';
  if (!profile?.weight) {
    return 'Add your bodyweight in Profile and starting weights get estimated for you.';
  }
  if (weight == null) return 'No fixed load here — work to the rep target.';
  const bits = [`${Math.round(profile.weight)} lb bodyweight`];
  if (profile.level) bits.push(profile.level);
  if (profile.age)   bits.push(`age ${profile.age}`);
  return `Start estimate from ${bits.join(' · ')} — deliberately light. Adjust after set 1.`;
}

/**
 * suggestNextSet(exId, targetReps, sessions, profile)
 * Returns { weight, reps, rationale, isBodyweight }
 */
export function suggestNextSet(exId, targetRepsStr, sessions, profile, scheme = 'double') {
  const exType  = classifyExercise(exId);
  const isBodyweight = exType === 'bodyweight';
  const level   = profile?.level || 'intermediate';
  const { min: targetMin, max: targetMax } = parseRepRange(targetRepsStr);

  // Filter sessions containing this exercise, most recent first
  const relevant = sessions
    .filter(s => s.exercises?.some(e => e.exId === exId))
    .slice(0, 5);

  if (!relevant.length) {
    // Cold start
    const weight = isBodyweight ? null : coldStartWeight(exId, profile, targetMin);
    return {
      weight,
      reps: targetMin,
      rationale: coldStartRationale(profile, weight, isBodyweight),
      isBodyweight,
      isColdStart: true,
    };
  }

  const lastSession = relevant[0];
  const lastExData  = lastSession.exercises.find(e => e.exId === exId);
  if (!lastExData?.sets?.length) {
    const weight = isBodyweight ? null : coldStartWeight(exId, profile, targetMin);
    return { weight, reps: targetMin, rationale: coldStartRationale(profile, weight, isBodyweight), isBodyweight, isColdStart: true };
  }

  const completedSets = lastExData.sets.filter(s => s.completed);
  if (!completedSets.length) {
    const weight = isBodyweight ? null : coldStartWeight(exId, profile, targetMin);
    return { weight, reps: targetMin, rationale: coldStartRationale(profile, weight, isBodyweight), isBodyweight, isColdStart: true };
  }

  // Find "working sets" = sets at ≥60% of max weight for this exercise that session
  const maxWeight = Math.max(...completedSets.map(s => s.weight || 0));
  const workingSets = isBodyweight
    ? completedSets
    : completedSets.filter(s => (s.weight || 0) >= maxWeight * 0.6);

  const lastTopWeight = maxWeight;
  const avgReps = workingSets.reduce((sum, s) => sum + (s.reps || 0), 0) / workingSets.length;
  const rirValues = workingSets.filter(s => s.rir != null).map(s => s.rir);
  const avgRIR = rirValues.length ? rirValues.reduce((a, b) => a + b, 0) / rirValues.length : null;

  // Check if this is the 2nd consecutive miss
  const prevSession = relevant[1];
  let prevWasAlsoMiss = false;
  if (prevSession) {
    const prevExData = prevSession.exercises.find(e => e.exId === exId);
    if (prevExData?.sets?.length) {
      const prevCompleted = prevExData.sets.filter(s => s.completed);
      const prevMax = Math.max(...prevCompleted.map(s => s.weight || 0));
      const prevWorking = isBodyweight ? prevCompleted : prevCompleted.filter(s => (s.weight || 0) >= prevMax * 0.6);
      const prevAvgReps = prevWorking.reduce((sum, s) => sum + (s.reps || 0), 0) / (prevWorking.length || 1);
      const prevAvgRIR = prevWorking.filter(s => s.rir != null).length
        ? prevWorking.filter(s => s.rir != null).reduce((a, s) => a + s.rir, 0) / prevWorking.filter(s => s.rir != null).length
        : null;
      const prevSignal = classifySignal(prevAvgReps, prevAvgRIR, targetMin, targetMax);
      prevWasAlsoMiss = prevSignal === 'MISS';
    }
  }

  const signal = classifySignal(avgReps, avgRIR, targetMin, targetMax);
  const incTable = INCREMENT[exType === 'bodyweight' ? 'compound_bb' : exType] || INCREMENT.compound_bb;
  const increment = incTable[level] || 2.5;

  if (isBodyweight) {
    if (signal === 'HIT_UPPER') {
      return { weight: null, reps: targetMin, rationale: 'Great reps — try adding weight (vest/belt) or progress to a harder variant.', isBodyweight: true };
    }
    if (signal === 'MISS' && prevWasAlsoMiss) {
      return { weight: null, reps: Math.max(targetMin - 2, 1), rationale: 'Take it down a notch — rebuild your base.', isBodyweight: true };
    }
    return { weight: null, reps: Math.min(Math.round(avgReps) + 1, targetMax + 2), rationale: 'Push for one more rep.', isBodyweight: true };
  }

  // ── Named progression schemes (weighted lifts) ──
  const topReps = Math.max(0, ...workingSets.map(s => s.reps || 0));
  if (scheme === 'linear') {
    if (signal === 'MISS' && prevWasAlsoMiss) {
      return { weight: roundToNearest(lastTopWeight * 0.9, 2.5), reps: targetMin, rationale: 'Linear — two misses, deload 10% and climb again.' };
    }
    if (signal === 'MISS') {
      return { weight: lastTopWeight, reps: targetMin, rationale: 'Linear — repeat this weight, then add next time.' };
    }
    return { weight: roundToNearest(lastTopWeight + increment, 2.5), reps: targetMin, rationale: `Linear — add ${increment} lbs every session.` };
  }
  if (scheme === 'greyskull') {
    if (topReps >= targetMin * 2) {
      return { weight: roundToNearest(lastTopWeight + increment * 2, 2.5), reps: targetMin, rationale: `Greyskull — big AMRAP (${topReps}), double jump +${increment * 2} lbs.` };
    }
    if (signal === 'MISS') {
      return { weight: roundToNearest(lastTopWeight * 0.9, 2.5), reps: targetMin, rationale: 'Greyskull — missed, deload 10% and rebuild.' };
    }
    return { weight: roundToNearest(lastTopWeight + increment, 2.5), reps: targetMin, rationale: `Greyskull — AMRAP hit, add ${increment} lbs. Last set: go to failure.` };
  }

  // ── Default: double progression ──
  if (signal === 'HIT_UPPER') {
    const nextW = roundToNearest(lastTopWeight + increment, 2.5);
    return { weight: nextW, reps: targetMin, rationale: `Hit the top of your range — add ${increment} lbs.` };
  }
  if (signal === 'HIT_LOWER') {
    return { weight: lastTopWeight, reps: Math.min(Math.round(avgReps) + 1, targetMax), rationale: 'Good effort — push for one more rep.' };
  }
  if (signal === 'MISS' && prevWasAlsoMiss) {
    const deloadW = roundToNearest(lastTopWeight * 0.9, 2.5);
    return { weight: deloadW, reps: targetMax, rationale: 'Deload — reset and rebuild with lighter weight.' };
  }
  // Single miss — hold weight
  return { weight: lastTopWeight, reps: targetMin, rationale: 'Hold this weight and nail the full rep range.' };
}

function classifySignal(avgReps, avgRIR, targetMin, targetMax) {
  if (avgReps >= targetMax && (avgRIR == null || avgRIR <= 2)) return 'HIT_UPPER';
  if (avgReps >= targetMin && (avgRIR == null || avgRIR <= 3)) return 'HIT_LOWER';
  return 'MISS';
}

function roundToNearest(val, nearest) {
  return Math.round(val / nearest) * nearest;
}

/**
 * Epley formula for estimated 1-rep max
 */
export function estimateOneRepMax(weight, reps) {
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

/**
 * Detect if a new weight+reps is a PR for this exercise.
 * Returns { isPR, previous, improvement }
 */
export function detectPR(exId, weight, reps, prs) {
  const e1rm = estimateOneRepMax(weight, reps);
  const prev = prs?.[exId];
  if (!prev) return { isPR: true, previous: null, improvement: null };
  if (e1rm > prev.e1rm) {
    return { isPR: true, previous: prev, improvement: e1rm - prev.e1rm };
  }
  return { isPR: false, previous: prev, improvement: null };
}

/**
 * Compute total volume for a session (sum of weight × reps across all completed sets)
 */
export function computeSessionVolume(session) {
  let total = 0;
  for (const ex of session.exercises || []) {
    for (const set of ex.sets || []) {
      // Warm-up sets are excluded from tonnage; unilateral sets logged per-side
      // count both limbs.
      if (set.completed && !set.warmup && set.weight && set.reps) {
        total += set.weight * set.reps * (set.perSide ? 2 : 1);
      }
    }
  }
  return total;
}
