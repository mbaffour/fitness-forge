// ═══════════════════════════════════════════
//   FITNESS FORGE — App State
//   All user data comes from onboarding quiz
//   or manual builder. Zero hardcoded values.
// ═══════════════════════════════════════════

const KEY = 'fitness_forge_v1';

const defaultState = {
  onboarded:    false,
  profile:      null,   // set after quiz
  program:      null,   // generated or manual
  currentPhase: 1,
  currentWeek:  1,
  workoutLog:   [],     // [{ id, date, day, label, phase, week, completed, notes, sessionId?, totalVolume?, duration? }]
  sessions:     [],     // per-set workout logs
  cardioLog:    [],     // cardio entries
  nutritionLog: [],     // one object per day
  bodyLog:      [],     // weight + measurement check-ins
  achievements: [],     // unlocked achievements
  prs:          {},     // { exId: { weight, reps, date, e1rm } }
  streak:       { current: 0, longest: 0, lastSessionDate: null },
  settings:     { weightUnit: 'lbs', distanceUnit: 'miles', restSeconds: 90, theme: 'forge' },
  // ── v2.7 additions ──
  fastingLog:  [],      // [{ id, date, protocol, plannedHours, startTime, endTime, actualHours, completed }]
  activeFast:  null,    // { startTime: ISO, protocol: '16:8', plannedHours: 16 } | null
  sleepLog:    [],      // [{ id, date, bedtime, wakeTime, durationHours, quality, feeling, notes, score }]
  activityLog: [],      // [{ id, date, type, durationMin, intensity, met, calories, distance, hr, notes }]
  // ── v2.8 additions ──
  hiitState: {
    currentWeek:        0,
    completedWorkouts:  {},
    completedExercises: {},
    totalMins:          0,
    streak:             0,
    lastWorkoutDate:    null,
    logs:               [],
    migrated:           false,
  },
};

export const state = (() => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Merge with defaultState so new keys are always present
      return {
        ...defaultState,
        ...parsed,
        streak:    { ...defaultState.streak,    ...(parsed.streak    || {}) },
        settings:  { ...defaultState.settings,  ...(parsed.settings  || {}) },
        prs:       parsed.prs || {},
        hiitState: { ...defaultState.hiitState, ...(parsed.hiitState || {}) },
      };
    }
    return { ...defaultState };
  } catch {
    return { ...defaultState };
  }
})();

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
}

// ── EXISTING FUNCTIONS ──

export function setProfile(profile) {
  state.profile = profile;
  save();
}

export function setProgram(program) {
  state.program = program;
  state.onboarded = true;
  state.currentPhase = 1;
  state.currentWeek = 1;
  save();
}

export function setPhase(n) {
  state.currentPhase = n;
  save();
}

export function setWeek(n) {
  state.currentWeek = n;
  save();
}

export function logWorkout(entry) {
  state.workoutLog.unshift({ id: Date.now(), ...entry });
  if (state.workoutLog.length > 500) state.workoutLog.length = 500;
  save();
}

export function clearLog() {
  state.workoutLog = [];
  save();
}

export function resetAll() {
  Object.assign(state, { ...defaultState });
  localStorage.removeItem(KEY);
}

// ── NEW: PROFILE ──

export function updateProfile(patches) {
  if (!state.profile) state.profile = {};
  Object.assign(state.profile, patches);
  save();
}

// ── NEW: SESSIONS (per-set workout logs) ──

export function logSession(session) {
  state.sessions.unshift({ id: Date.now(), ...session });
  if (state.sessions.length > 200) state.sessions.length = 200;
  // Also create a workoutLog entry
  logWorkout({
    date: session.date,
    label: session.workoutLabel,
    type: session.workoutType || 'strength',
    phase: state.currentPhase,
    week: state.currentWeek,
    sessionId: session.id,
    totalVolume: session.totalVolume,
    duration: session.durationMinutes,
    notes: session.notes || '',
  });
  save();
}

export function getSessionsForExercise(exId, limit = 10) {
  return state.sessions
    .filter(s => s.exercises?.some(e => e.exId === exId))
    .slice(0, limit);
}

// ── NEW: CARDIO LOG ──

export function addCardioEntry(entry) {
  state.cardioLog.unshift({ id: Date.now(), ...entry });
  if (state.cardioLog.length > 200) state.cardioLog.length = 200;
  updateStreak();
  save();
}

// ── NEW: NUTRITION ──

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function getTodayNutrition() {
  const today = todayStr();
  let day = state.nutritionLog.find(d => d.date === today);
  if (!day) {
    day = {
      date: today,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      entries: [],
      water: 0,
      target: _calcNutritionTarget(),
    };
    state.nutritionLog.unshift(day);
    if (state.nutritionLog.length > 90) state.nutritionLog.length = 90;
    save();
  }
  return day;
}

function _calcNutritionTarget() {
  const tdee = state.profile?.tdee;
  const goal = state.profile?.goal;
  if (!tdee) return { calories: 2000, protein: 150, carbs: 200, fat: 67 };
  const cal = goal === 'lose_fat' ? Math.round(tdee - 400) : goal === 'build_muscle' ? Math.round(tdee + 250) : Math.round(tdee);
  const protein = Math.round((state.profile?.weight || 160) * 0.85);
  const fat = Math.round(cal * 0.27 / 9);
  const carbs = Math.round((cal - protein * 4 - fat * 9) / 4);
  return { calories: cal, protein, carbs: Math.max(carbs, 50), fat };
}

export function addFoodEntry(entry) {
  const day = getTodayNutrition();
  const item = { id: Date.now(), time: new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}), ...entry };
  day.entries.unshift(item);
  day.calories += entry.calories || 0;
  day.protein  += entry.protein  || 0;
  day.carbs    += entry.carbs    || 0;
  day.fat      += entry.fat      || 0;
  save();
  return day;
}

export function removeFoodEntry(entryId) {
  const day = getTodayNutrition();
  const idx = day.entries.findIndex(e => e.id === entryId);
  if (idx < 0) return;
  const item = day.entries[idx];
  day.calories -= item.calories || 0;
  day.protein  -= item.protein  || 0;
  day.carbs    -= item.carbs    || 0;
  day.fat      -= item.fat      || 0;
  day.entries.splice(idx, 1);
  save();
}

export function logWater(glasses) {
  const day = getTodayNutrition();
  day.water = glasses;
  save();
}

// ── NEW: BODY LOG ──

export function addBodyCheckIn(entry) {
  state.bodyLog.unshift({ id: Date.now(), ...entry });
  if (state.bodyLog.length > 365) state.bodyLog.length = 365;
  save();
}

// ── NEW: PERSONAL RECORDS ──

export function recordPR(exId, weight, reps) {
  const e1rm = Math.round(weight * (1 + reps / 30));
  const prev = state.prs[exId];
  if (!prev || e1rm > prev.e1rm) {
    state.prs[exId] = { weight, reps, date: new Date().toISOString(), e1rm };
    awardAchievement(`pr_${exId}`, `New PR: ${exId.replace(/_/g,' ')}`, `${weight} lbs × ${reps} reps`);
    save();
    return true;
  }
  return false;
}

// ── NEW: ACHIEVEMENTS ──

export function awardAchievement(id, label, desc) {
  if (state.achievements.find(a => a.id === id)) return false;
  state.achievements.push({ id, label, desc, unlockedAt: new Date().toISOString() });
  save();
  return true;
}

// ── NEW: STREAKS ──

export function updateStreak() {
  const today = todayStr();
  const last  = state.streak.lastSessionDate;
  if (last === today) return; // already counted today

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (last === yesterday) {
    state.streak.current += 1;
  } else if (last !== today) {
    state.streak.current = 1;
  }
  if (state.streak.current > state.streak.longest) {
    state.streak.longest = state.streak.current;
  }
  state.streak.lastSessionDate = today;

  // Award streak achievements
  if (state.streak.current === 3)  awardAchievement('streak_3',  '3-Day Streak',  'Train 3 days in a row');
  if (state.streak.current === 7)  awardAchievement('streak_7',  'Week Warrior',  '7-day streak');
  if (state.streak.current === 30) awardAchievement('streak_30', 'Iron Will',     '30-day streak');

  save();
}

export function checkFirstSession() {
  if (state.sessions.length === 1) awardAchievement('first_session', 'First Rep', 'Log your first workout session');
  if (state.sessions.length === 10) awardAchievement('ten_sessions', 'Ten Down', 'Log 10 workout sessions');
  if (state.sessions.length === 50) awardAchievement('fifty_sessions', 'Half Century', 'Log 50 workout sessions');
}

// ── FASTING ──

export function startFast(protocol, plannedHours) {
  state.activeFast = { startTime: new Date().toISOString(), protocol, plannedHours };
  save();
}

export function endFast() {
  if (!state.activeFast) return null;
  const start  = new Date(state.activeFast.startTime);
  const end    = new Date();
  const actual = parseFloat(((end - start) / 3600000).toFixed(2));
  const entry  = {
    id: Date.now(),
    date: start.toISOString().slice(0, 10),
    protocol: state.activeFast.protocol,
    plannedHours: state.activeFast.plannedHours,
    startTime: state.activeFast.startTime,
    endTime: end.toISOString(),
    actualHours: actual,
    completed: actual >= state.activeFast.plannedHours * 0.9,
  };
  state.fastingLog.unshift(entry);
  if (state.fastingLog.length > 200) state.fastingLog.length = 200;
  state.activeFast = null;
  save();
  return entry;
}

export function getActiveFast() {
  return state.activeFast;
}

// ── SLEEP ──

export function addSleepEntry(entry) {
  const dur   = _calcSleepDuration(entry.bedtime, entry.wakeTime);
  const score = _calcSleepScore(dur, entry.quality);
  const full  = { id: Date.now(), ...entry, durationHours: dur, score };
  state.sleepLog.unshift(full);
  if (state.sleepLog.length > 365) state.sleepLog.length = 365;
  save();
  return full;
}

export function removeSleepEntry(id) {
  state.sleepLog = state.sleepLog.filter(e => e.id !== id);
  save();
}

function _calcSleepDuration(bedtime, wakeTime) {
  const [bh, bm] = bedtime.split(':').map(Number);
  const [wh, wm] = wakeTime.split(':').map(Number);
  let mins = (wh * 60 + wm) - (bh * 60 + bm);
  if (mins < 0) mins += 1440; // midnight crossing
  return parseFloat((mins / 60).toFixed(2));
}

function _calcSleepScore(durationHours, quality) {
  const durPts  = Math.min(Math.round((durationHours / 7) * 40), 40);
  const qualPts = Math.round(((quality || 3) / 5) * 40);
  const consPts = state.sleepLog.length >= 3 ? 10 : 10; // simplified; give 10 pts by default
  return Math.min(durPts + qualPts + consPts, 100);
}

// ── ACTIVITY ──

const _MET_VALUES = {
  Walking: 3.5, Running: 9.8, Cycling: 6.8, Soccer: 7.0, Basketball: 6.5,
  Swimming: 7.0, Weightlifting: 3.5, HIIT: 8.0, Yoga: 2.5, Hiking: 5.3,
};
const _INTENSITY_MUL = { Low: 0.8, Moderate: 1.0, High: 1.2, Max: 1.4 };

export function addActivityEntry(entry) {
  const calories = entry.calories != null && entry.calories !== '' ? Number(entry.calories) : _calcActivityCalories(entry);
  const full = { id: Date.now(), ...entry, calories };
  state.activityLog.unshift(full);
  if (state.activityLog.length > 500) state.activityLog.length = 500;
  updateStreak();
  save();
  return full;
}

export function removeActivityEntry(id) {
  state.activityLog = state.activityLog.filter(e => e.id !== id);
  save();
}

function _calcActivityCalories(entry) {
  const met    = _MET_VALUES[entry.type] || 5.0;
  const intMul = _INTENSITY_MUL[entry.intensity] || 1.0;
  const weightLbs = state.profile?.weight || 154;
  const weightKg  = weightLbs * 0.453592;
  return Math.round(met * intMul * weightKg * ((entry.durationMin || 30) / 60));
}
