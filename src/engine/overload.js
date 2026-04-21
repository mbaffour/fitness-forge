// ═══════════════════════════════════════════
//   FITNESS FORGE — Progressive Overload Engine
//   Pure functions — no side effects
// ═══════════════════════════════════════════

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
]);

function classifyExercise(exId) {
  if (BW_EXERCISES.has(exId)) return 'bodyweight';
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
       'russian','crunch','ab_wheel'].includes(exId)) {
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

// Cold-start: use freestyle weight suggestion fallback
function coldStartWeight(exId, profile) {
  if (!profile?.weight) return null;
  const bw = profile.weight;
  const level = profile.level || 'intermediate';
  const pct = { beginner: 0.4, intermediate: 0.55, advanced: 0.7 }[level] || 0.55;
  const multipliers = {
    squat_bb: 0.9, squat_front: 0.65, squat_db: 0.25, deadlift: 1.1, trap_dl: 1.0,
    rdl_bb: 0.7, rdl_db: 0.3, bss: 0.3, legpress: 1.2,
    bench_bb: 0.6, bench_db: 0.25, incline_bb: 0.5, incline_db: 0.22,
    ohp_bb: 0.4, ohp_db: 0.16, pushpress: 0.45,
    row_bb: 0.55, row_db: 0.22, row_cable: 0.4, row_chest: 0.2, row_tbar: 0.5,
    lat_pull: 0.5, curl_bb: 0.25, curl_db: 0.1,
    lat_raise: 0.06, tri_push: 0.15,
  };
  const mult = multipliers[exId] ?? 0.25;
  const raw = Math.round((bw * pct * mult) / 5) * 5;
  return raw >= 10 ? raw : null;
}

/**
 * suggestNextSet(exId, targetReps, sessions, profile)
 * Returns { weight, reps, rationale, isBodyweight }
 */
export function suggestNextSet(exId, targetRepsStr, sessions, profile) {
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
    const weight = isBodyweight ? null : coldStartWeight(exId, profile);
    return {
      weight,
      reps: targetMin,
      rationale: 'Starting estimate — adjust to your strength.',
      isBodyweight,
      isColdStart: true,
    };
  }

  const lastSession = relevant[0];
  const lastExData  = lastSession.exercises.find(e => e.exId === exId);
  if (!lastExData?.sets?.length) {
    const weight = isBodyweight ? null : coldStartWeight(exId, profile);
    return { weight, reps: targetMin, rationale: 'No sets logged yet.', isBodyweight, isColdStart: true };
  }

  const completedSets = lastExData.sets.filter(s => s.completed);
  if (!completedSets.length) {
    const weight = isBodyweight ? null : coldStartWeight(exId, profile);
    return { weight, reps: targetMin, rationale: 'No completed sets found.', isBodyweight, isColdStart: true };
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
      if (set.completed && set.weight && set.reps) {
        total += set.weight * set.reps;
      }
    }
  }
  return total;
}
