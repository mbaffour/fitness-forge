// ═══════════════════════════════════════════
//   FITNESS FORGE — Gamification engine
//   XP, levels, streaks, quests and badges.
// ═══════════════════════════════════════════
//
// Everything here is DERIVED from the logs the app already keeps. Nothing is
// incremented and stored, for three reasons:
//   1. It cannot drift. Delete a typo set and its XP goes with it; restore a
//      backup and your rank comes back exactly; import a year of Strong
//      history and you land at the level that work deserves.
//   2. It cannot be farmed. Every source has a per-day cap, so logging the same
//      glass of water forty times earns what logging it once does.
//   3. It is the honest record. A badge says what you did, not what a counter
//      happened to reach.
//
// The design follows what the evidence supports rather than every mechanic
// available (see CLAUDE.md v3.38 for sources):
//   - Gamification helps physical activity modestly (meta-analyses: g ≈ 0.3–0.4)
//     and returns diminish as features pile up — so a few coherent mechanics.
//   - A DAILY workout streak fights recovery. The training streak here is
//     WEEKLY (hit your weekly goal, Apple Fitness-style); the daily streak
//     counts recovery work (stretching, a walk) as much as lifting, and
//     streak freezes (Duolingo) cover genuine rest days.
//   - Competition raised stress in a preregistered SDT trial; there are no
//     leagues and no invented rivals — the only opponent is last week's you.
//   - Autonomy: the weekly goal is yours to set, and the whole layer can be
//     switched off in Settings.

import { state, localDateStr } from '../store.js';
import { EXERCISES, targetsOf, isStretch } from '../data/exercises.js';
import { estimateOneRepMax } from './overload.js';
import { objectivesMet, objectiveDates, missionWeeks } from './project500.js';

const DAY = 864e5;

// ── LEVELS & RANKS ───────────────────────────────────────────────────────────
// Total XP to reach level L is 75·(L−1)². Measured on a seeded history, a
// committed 4-session week with sleep, food and weigh-ins logged earns
// ~1,000–1,200 XP: level 5 in a week or two, level 10 in about two months,
// level 30 after a year — early levels come fast (goal-gradient), later ones
// mean something.
export const MAX_LEVEL = 99;
export const xpForLevel = (L) => 75 * (L - 1) ** 2;
export function levelFor(xp) {
  const L = Math.min(MAX_LEVEL, Math.floor(1 + Math.sqrt(Math.max(0, xp) / 75)));
  const floor = xpForLevel(L), next = L >= MAX_LEVEL ? floor : xpForLevel(L + 1);
  return { level: L, floor, next, into: xp - floor, span: next - floor,
           pct: L >= MAX_LEVEL ? 1 : (xp - floor) / (next - floor) };
}

export const RANKS = [
  { min: 1,  name: 'Apprentice',    icon: '🔨', blurb: 'Learning the heat.' },
  { min: 5,  name: 'Striker',       icon: '⚒️', blurb: 'Swinging with purpose.' },
  { min: 10, name: 'Journeyman',    icon: '🛠️', blurb: 'Steady hands, steady work.' },
  { min: 15, name: 'Smith',         icon: '⚙️', blurb: 'Shaping your own steel.' },
  { min: 20, name: 'Master Smith',  icon: '🗡️', blurb: 'The forge answers to you.' },
  { min: 30, name: 'Forgemaster',   icon: '🔥', blurb: 'Others warm their hands at your fire.' },
  { min: 45, name: 'Steelheart',    icon: '🛡️', blurb: 'Tempered by years of heat.' },
  { min: 60, name: 'Anvil Legend',  icon: '👑', blurb: 'They will tell stories about this one.' },
];
export function rankFor(level) {
  let r = RANKS[0];
  for (const x of RANKS) if (level >= x.min) r = x;
  const i = RANKS.indexOf(r);
  return { ...r, index: i, next: RANKS[i + 1] || null };
}

// ── XP RULES ─────────────────────────────────────────────────────────────────
// [xp each, max per day]. Caps are what make this un-farmable.
export const XP = {
  workout:   [50, 2],    // a logged strength workout
  set:       [2, 40],    // each completed working set (warm-ups excluded)
  pr:        [15, 3],    // a personal record — progressive overload makes these common, so modest
  mobility:  [25, 2],    // a stretch / mobility session
  cardio:    [30, 2],
  hiit:      [40, 2],
  activity:  [20, 3],
  moveMin:   [0.5, 60],  // half an XP per active minute, up to 30 XP a day
  checkin:   [10, 1],
  sleep:     [10, 1],
  food:      [10, 1],    // a day with food logged
  protein:   [10, 1],    // protein target hit
  metric:    [5, 3],
  fast:      [20, 1],    // a completed fast
  assess:    [40, 2],    // a Project 500 event check (one or more AFT events tested)
  aft:       [150, 1],   // a full simulated Army Fitness Test
  mission:   [75, 1],    // a Project 500 weekly mission (all scheduled sessions but one)
  objective: [50, 5],    // a Project 500 phase objective met, on the day of the result that met it
};
const WEEK_GOAL_XP = 100;
// Daily-streak milestones and their one-off bonus.
export const STREAK_MILESTONES = [[3, 20], [7, 50], [14, 75], [30, 150], [50, 200], [100, 400], [150, 500], [200, 600], [365, 1000]];
export const WEEK_MILESTONES = [4, 8, 12, 26, 52];

// ── DATES ────────────────────────────────────────────────────────────────────
const isKey = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
function dayOf(v) {
  if (isKey(v)) return v;
  const t = Date.parse(v);
  return Number.isFinite(t) ? localDateStr(new Date(t)) : null;
}
const hourOf = (v) => { if (isKey(v)) return null; const t = Date.parse(v); return Number.isFinite(t) ? new Date(t).getHours() : null; };
function keyToDate(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12); }
function addDays(k, n) { const d = keyToDate(k); d.setDate(d.getDate() + n); return localDateStr(d); }
// Training weeks start on Monday.
export function weekOf(k) { const d = keyToDate(k); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return localDateStr(d); }

// Small, stable string hash → quests are the same for a given day on every
// device and every recomputation.
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// ── QUESTS ───────────────────────────────────────────────────────────────────
// Three a day — one to move, one to log, one stretch goal — chosen by the date
// alone, so a past day's quests never change after the fact. Every slot has
// rest-day-friendly options: a walk or a stretch completes the move quest.
const QUESTS = {
  train:   { slot: 'move',  icon: '⚡', label: 'Log a workout',            hint: 'Lifting, cardio, HIIT or a logged activity', xp: 20, test: (d) => d.strength + d.cardio + d.hiit + d.activity > 0 },
  move20:  { slot: 'move',  icon: '🚶', label: 'Move for 20 minutes',      hint: 'Any workout, cardio or activity counts',     xp: 20, test: (d) => d.moveMin >= 20, prog: (d) => [Math.min(20, Math.round(d.moveMin)), 20] },
  stretch: { slot: 'move',  icon: '🧘', label: 'Do a stretch routine',     hint: 'Body Map → Stretch, or after a workout',     xp: 15, test: (d) => d.mobility > 0 },
  sets12:  { slot: 'move',  icon: '🏋️', label: 'Complete 12 working sets', hint: 'Warm-ups don’t count',                        xp: 30, test: (d) => d.sets >= 12, prog: (d) => [Math.min(12, d.sets), 12] },
  checkin: { slot: 'log',   icon: '⚖️', label: 'Log a weigh-in',           hint: 'Body & Metrics',                              xp: 10, test: (d) => d.checkin },
  sleep:   { slot: 'log',   icon: '🌙', label: 'Log last night’s sleep',   hint: 'Sleep page',                                  xp: 10, test: (d) => d.sleep },
  food2:   { slot: 'log',   icon: '🥗', label: 'Log two meals or snacks',  hint: 'Nutrition page',                              xp: 15, test: (d) => d.food >= 2, prog: (d) => [Math.min(2, d.food), 2] },
  water:   { slot: 'log',   icon: '💧', label: 'Drink 6 glasses of water', hint: 'Tap the glasses on Nutrition',               xp: 10, test: (d) => d.water >= 6, prog: (d) => [Math.min(6, d.water), 6] },
  metric:  { slot: 'log',   icon: '📈', label: 'Log any metric',           hint: 'Weight, measurements or a custom metric',    xp: 10, test: (d) => d.checkin || d.metrics > 0 },
  pr:      { slot: 'bonus', icon: '🏆', label: 'Set a personal record',    hint: 'Beat your best on any lift',                  xp: 40, test: (d) => d.prs > 0 },
  move45:  { slot: 'bonus', icon: '🔥', label: 'Move for 45 minutes',      hint: 'Add it up across the day',                    xp: 30, test: (d) => d.moveMin >= 45, prog: (d) => [Math.min(45, Math.round(d.moveMin)), 45] },
  protein: { slot: 'bonus', icon: '🍗', label: 'Hit your protein target',  hint: 'Nutrition page',                              xp: 25, test: (d) => d.protein },
  trifecta:{ slot: 'bonus', icon: '🎯', label: 'Train, eat and sleep log', hint: 'A workout, food and sleep all logged',       xp: 35, test: (d) => (d.strength + d.cardio + d.hiit + d.activity + d.mobility > 0) && d.food > 0 && d.sleep, prog: (d) => [((d.strength + d.cardio + d.hiit + d.activity + d.mobility > 0) ? 1 : 0) + (d.food > 0 ? 1 : 0) + (d.sleep ? 1 : 0), 3] },
};
const SLOT_IDS = (slot) => Object.keys(QUESTS).filter((k) => QUESTS[k].slot === slot);
export function questsFor(dayKey) {
  return ['move', 'log', 'bonus'].map((slot) => {
    const ids = SLOT_IDS(slot);
    return ids[hash(`${dayKey}:${slot}`) % ids.length];
  });
}

// ── BADGES ───────────────────────────────────────────────────────────────────
// Tiered tracks: bronze → silver → gold → platinum. Each tier is a real
// milestone, not a participation sticker.
export const TIERS = ['Bronze', 'Silver', 'Gold', 'Platinum'];
const TONNAGE = [[4000, 'a car'], [13000, 'an elephant'], [50000, 'a loaded semi-truck'], [300000, 'a blue whale'],
                 [1000000, 'a jumbo jet, twice'], [5000000, 'a space shuttle stack']];
const BADGES = [
  { id: 'sessions', icon: '🏋️', name: 'Iron Habit',     unit: 'workouts',       th: [10, 50, 150, 500],       desc: 'Workouts logged — lifting, cardio, HIIT and stretch sessions' },
  { id: 'tonnage',  icon: '🏗️', name: 'Tonnage',        unit: 'lbs lifted',     th: [50000, 250000, 1000000, 5000000], desc: 'Lifetime working-set volume', weight: true },
  { id: 'prs',      icon: '🏆', name: 'Record Breaker', unit: 'PRs',            th: [5, 25, 75, 200],         desc: 'Personal records set' },
  { id: 'daily',    icon: '🔥', name: 'Eternal Flame',  unit: 'day streak',     th: [7, 30, 100, 365],        desc: 'Longest daily streak' },
  { id: 'weekly',   icon: '🗓️', name: 'Clockwork',      unit: 'weeks in a row', th: [4, 12, 26, 52],          desc: 'Longest run of weeks hitting your weekly goal' },
  { id: 'stretch',  icon: '🧘', name: 'Supple Steel',   unit: 'stretch sessions', th: [5, 25, 75, 200],       desc: 'Stretch and mobility sessions' },
  { id: 'engine',   icon: '🫀', name: 'Engine Room',    unit: 'active minutes', th: [300, 1500, 5000, 15000], desc: 'Minutes of cardio, HIIT and activity' },
  { id: 'coverage', icon: '🗺️', name: 'Full Spectrum',  unit: 'regions in a week', th: [8, 12, 14, 16],       desc: 'Most muscle regions trained in a single week (of 16)' },
  { id: 'quests',   icon: '📜', name: 'Questsmith',     unit: 'quests',         th: [10, 50, 200, 750],       desc: 'Daily quests completed' },
  { id: 'measured', icon: '📏', name: 'Measured',       unit: 'check-in days',  th: [5, 30, 100, 365],        desc: 'Days with a weigh-in or metric logged' },
  { id: 'fueled',   icon: '🥗', name: 'Well Fueled',    unit: 'days',           th: [7, 30, 100, 365],        desc: 'Days with nutrition logged' },
  { id: 'rested',   icon: '🌙', name: 'Well Rested',    unit: 'nights',         th: [7, 30, 100, 365],        desc: 'Nights of sleep logged' },
  { id: 'early',    icon: '🌅', name: 'Early Bird',     unit: 'dawn workouts',  th: [1, 10, 30, 100],         desc: 'Workouts started before 7am' },
  { id: 'owl',      icon: '🦉', name: 'Night Shift',    unit: 'late workouts',  th: [1, 10, 30, 100],         desc: 'Workouts started after 9pm' },
  { id: 'p500',     icon: '🎖️', name: 'Project 500',    unit: 'objectives',     th: [5, 10, 15, 20],          desc: 'Project 500 phase objectives met — five per phase, by real results' },
  { id: 'missions', icon: '🎯', name: 'Mission Ready',  unit: 'weekly missions', th: [4, 12, 26, 48],         desc: 'Project 500 weeks with every scheduled session but one done' },
];
export const BADGE_DEFS = BADGES;
export function tonnageEquivalent(lbs) {
  let best = null;
  for (const [w, what] of TONNAGE) if (lbs >= w) best = { w, what, times: Math.floor(lbs / w) };
  return best;
}

// ── TITLES ───────────────────────────────────────────────────────────────────
// Cosmetic, earned, and chosen: every rank reached, and silver / gold /
// platinum in any badge track, unlocks a title the person can show under their
// name. Derived like everything else — restore a backup and they come back.
const BADGE_TITLES = {
  sessions: ['Regular', 'Gym Rat', 'Iron Devotee'],
  tonnage:  ['Heavy Lifter', 'Ton Mover', 'Mountain Mover'],
  prs:      ['Record Setter', 'Record Breaker', 'Limit Breaker'],
  daily:    ['Torchbearer', 'Firekeeper', 'Eternal Flame'],
  weekly:   ['Clockwork', 'Metronome', 'Unbroken'],
  stretch:  ['Supple', 'Elastic', 'Rubber Steel'],
  engine:   ['Engine', 'Diesel', 'Perpetual Motion'],
  coverage: ['Well-Rounded', 'Full Spectrum', 'Complete Athlete'],
  quests:   ['Questing', 'Questsmith', 'Quest Master'],
  measured: ['Measured', 'Data-Driven', 'Self-Scientist'],
  fueled:   ['Well Fed', 'Fuel Master', 'Kitchen Smith'],
  rested:   ['Well Rested', 'Sleep Smith', 'Dream Forged'],
  early:    ['Early Bird', 'Dawn Patrol', 'Sunrise Smith'],
  owl:      ['Night Owl', 'Night Shift', 'Midnight Smith'],
  p500:     ['Squared Away', 'Hard Charger', 'Five Hundred'],
  missions: ['On Task', 'Mission First', 'Never Out of Step'],
};
export const TITLE_ID_RE = /^(rank:[0-7]|badge:[a-z]+:[234])$/;
export function titleFor(id) {
  if (typeof id !== 'string' || !TITLE_ID_RE.test(id)) return null;
  const [kind, a, t] = id.split(':');
  if (kind === 'rank') return RANKS[Number(a)]?.name || null;
  return BADGE_TITLES[a]?.[Number(t) - 2] || null;
}
function titlesList(rankIndex, badges) {
  const out = RANKS.map((r, i) => ({ id: `rank:${i}`, name: r.name, unlocked: i <= rankIndex, req: `Reach level ${r.min}`, icon: r.icon }));
  for (const b of badges) {
    (BADGE_TITLES[b.id] || []).forEach((name, k) => {
      const tier = k + 2;
      out.push({ id: `badge:${b.id}:${tier}`, name, unlocked: b.tier >= tier, req: `${TIERS[tier - 1]} ${b.name} · ${n0(b.th[tier - 1])} ${b.unit}`, icon: b.icon });
    });
  }
  return out;
}
const n0 = (v) => Math.round(v).toLocaleString();

// ── FLAME ────────────────────────────────────────────────────────────────────
// The daily fire changes as it grows — something to look forward to between
// milestones, and something to protect once you have it.
export const FLAME_TIERS = [
  { min: 0,   id: 'kindled', name: 'Kindled' },
  { min: 7,   id: 'roaring', name: 'Roaring' },
  { min: 30,  id: 'blue',    name: 'Blue flame' },
  { min: 100, id: 'eternal', name: 'Eternal' },
];
export function flameTier(days) {
  let t = FLAME_TIERS[0];
  for (const x of FLAME_TIERS) if (days >= x.min) t = x;
  const i = FLAME_TIERS.indexOf(t);
  return { ...t, index: i, next: FLAME_TIERS[i + 1] || null };
}

// ── DAY FACTS ────────────────────────────────────────────────────────────────
function blankDay() {
  return { strength: 0, mobility: 0, cardio: 0, hiit: 0, activity: 0, sets: 0, prs: 0, moveMin: 0, cardioMin: 0, volume: 0,
           checkin: false, sleep: false, food: 0, foodDay: false, protein: false, water: 0, metrics: 0, fast: false,
           early: 0, late: 0, regions: new Set(), assess: 0, aft: 0, mission: 0, objective: 0 };
}

function collectDays() {
  const days = new Map();
  const at = (k) => { if (!days.has(k)) days.set(k, blankDay()); return days.get(k); };
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  // Workouts. Every logged session also writes a workoutLog entry, and a
  // workout marked complete without the live logger writes only that — so
  // workoutLog is the list of workouts, and sessions add the set detail.
  for (const w of state.workoutLog || []) {
    const k = dayOf(w?.date); if (!k) continue;
    const d = at(k);
    if (w.type === 'mobility') d.mobility++;
    else if (w.type === 'cardio') d.cardio++;
    else d.strength++;
    d.moveMin += Math.min(240, Math.max(0, num(w.duration)));
    const h = hourOf(w.date);
    if (w.type !== 'mobility' && h != null) { if (h < 7) d.early++; else if (h >= 21) d.late++; }
  }

  // Sets, volume, PRs and regions from per-set sessions, replayed oldest first
  // so a PR is judged against the best that existed AT THE TIME. Sessions
  // logged since v3.37 carry the logger's own verdict (prExIds); older ones
  // are replayed by the same rule the logger uses.
  const best = {};
  const sessions = [...(state.sessions || [])].filter((s) => dayOf(s?.date))
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  for (const s of sessions) {
    const k = dayOf(s.date); const d = at(k);
    const mobility = s.workoutType === 'mobility';
    let prs = 0;
    const replay = !Array.isArray(s.prExIds);
    for (const ex of s.exercises || []) {
      const def = EXERCISES[ex?.exId];
      let worked = false;
      for (const st of ex?.sets || []) {
        if (!st?.completed || st.warmup) continue;
        worked = true;
        if (mobility) continue;
        d.sets++;
        const w = num(st.weight), r = num(st.reps);
        if (w > 0 && r > 0 && !st.timed) {
          d.volume += w * r;
          const e = estimateOneRepMax(w, r);
          if (e && r <= 30) {
            if (replay && (best[ex.exId] == null || e > best[ex.exId])) prs++;
            if (best[ex.exId] == null || e > best[ex.exId]) best[ex.exId] = e;
          }
        }
      }
      if (worked && !mobility && def && !isStretch(ex.exId)) for (const r of targetsOf(def)) d.regions.add(r);
    }
    // One PR per lift per session, as the logger counts them.
    if (!replay) prs = new Set(s.prExIds).size;
    else prs = Math.min(prs, (s.exercises || []).length);
    d.prs += prs;
  }

  for (const c of state.cardioLog || []) {
    const k = dayOf(c?.date); if (!k) continue;
    const d = at(k); const m = Math.min(600, Math.max(0, num(c.durationMinutes))); d.cardio++; d.moveMin += m; d.cardioMin += m;
  }
  for (const a of state.activityLog || []) {
    const k = dayOf(a?.date); if (!k) continue;
    const d = at(k); const m = Math.min(600, Math.max(0, num(a.durationMin))); d.activity++; d.moveMin += m; d.cardioMin += m;
  }
  for (const h of state.hiitState?.logs || []) {
    const k = dayOf(h?.date); if (!k) continue;
    const d = at(k); const m = Math.min(240, Math.max(0, num(h.mins))); d.hiit++; d.moveMin += m; d.cardioMin += m;
  }
  // Project 500 tests. A full simulated AFT and an event check are training.
  for (const t of state.p500?.tests || []) {
    const k = dayOf(t?.date); if (!k) continue;
    if (t.kind === 'aft') at(k).aft++; else at(k).assess++;
  }
  if (state.p500 && state.p500.status !== 'setup') {
    for (const o of objectiveDates(state.p500)) { const k = dayOf(o.date); if (k) at(k).objective++; }
    for (const m of missionWeeks(state.p500, localDateStr())) if (m.met && m.metOn) at(m.metOn).mission++;
  }
  for (const b of state.bodyLog || []) { const k = dayOf(b?.date); if (k) at(k).checkin = true; }
  for (const s of state.sleepLog || []) { const k = dayOf(s?.date); if (k && num(s.durationHours) > 0) at(k).sleep = true; }
  for (const n of state.nutritionLog || []) {
    const k = dayOf(n?.date); if (!k) continue;
    const entries = Array.isArray(n.entries) ? n.entries.length : 0;
    const d = at(k);
    d.food += entries;
    if (entries > 0 || num(n.calories) > 0) d.foodDay = true;
    d.water = Math.max(d.water, num(n.water));
    const tp = num(n.target?.protein);
    if (tp > 0 && num(n.protein) >= tp * 0.95) d.protein = true;
  }
  const metricSeen = new Map();
  for (const m of state.metricLog || []) {
    const k = dayOf(m?.date); if (!k) continue;
    const s = metricSeen.get(k) || new Set(); s.add(m.metric); metricSeen.set(k, s);
  }
  for (const [k, s] of metricSeen) at(k).metrics = s.size;
  for (const f of state.fastingLog || []) { const k = dayOf(f?.date); if (k && f.completed) at(k).fast = true; }
  return days;
}

const isActive = (d) => d && (d.strength + d.mobility + d.cardio + d.hiit + d.activity + d.assess + d.aft > 0);
// What keeps the DAILY fire lit: any workout or recovery, or looking after
// yourself on a rest day — a weigh-in, a sleep or food log, a metric, a fast.
// Lifting every day is not the goal; showing up every day is. A daily streak
// that only training could feed would push people to train through recovery.
const isLit = (d) => d && (isActive(d) || d.checkin || d.sleep || d.foodDay || d.metrics > 0 || d.fast);
// A training day for the weekly goal: a workout, or a real block of activity.
// A stretch alone keeps the daily fire lit but is not a training day.
const isTraining = (d) => d && (d.strength + d.cardio + d.hiit + d.assess + d.aft > 0 || (d.activity > 0 && d.moveMin >= 20));

function dayXP(d) {
  const c = (key, n) => Math.min(n, XP[key][1]) * XP[key][0];
  return Math.round(c('workout', d.strength) + c('set', d.sets) + c('pr', d.prs) + c('mobility', d.mobility)
    + c('cardio', d.cardio) + c('hiit', d.hiit) + c('activity', d.activity) + c('moveMin', d.moveMin)
    + c('checkin', d.checkin ? 1 : 0) + c('sleep', d.sleep ? 1 : 0) + c('food', d.foodDay ? 1 : 0)
    + c('protein', d.protein ? 1 : 0) + c('metric', d.metrics) + c('fast', d.fast ? 1 : 0)
    + c('assess', d.assess) + c('aft', d.aft) + c('mission', d.mission) + c('objective', d.objective));
}

// ── STREAKS ──────────────────────────────────────────────────────────────────
// Daily fire: consecutive days with any training, recovery or self-care log
// (see isLit). Every 7 lit days banks a streak freeze
// (max 2, as Duolingo settled on); a missed day spends one automatically. Today
// never breaks the streak — it is not over yet.
function dailyStreak(days, today) {
  const active = [...days.keys()].filter((k) => isLit(days.get(k))).sort();
  const out = { current: 0, longest: 0, bank: 0, frozen: new Set(), milestones: [], todayDone: !!isLit(days.get(today)), start: null };
  if (!active.length) return out;
  let streak = 0, since = 0, bank = 0, start = null;
  for (let k = active[0]; k <= today; k = addDays(k, 1)) {
    if (isLit(days.get(k))) {
      if (streak === 0) start = k;
      streak++; since++;
      if (since === 7) { bank = Math.min(2, bank + 1); since = 0; }
      for (const [n, xp] of STREAK_MILESTONES) if (streak === n) out.milestones.push({ n, xp, day: k });
      out.longest = Math.max(out.longest, streak);
    } else if (k === today) {
      // pending
    } else if (streak > 0 && bank > 0) {
      bank--; out.frozen.add(k);
    } else { streak = 0; since = 0; start = null; }
  }
  return { ...out, current: streak, bank, start };
}

// Weekly training streak: consecutive Monday-to-Sunday weeks with at least
// `goal` training days. The week in progress only counts once it is met, and
// never breaks the run before it is over.
function weeklyStreak(days, today, goal) {
  const perWeek = new Map();
  for (const [k, d] of days) if (isTraining(d)) perWeek.set(weekOf(k), (perWeek.get(weekOf(k)) || 0) + 1);
  const thisWeek = weekOf(today);
  const out = { goal, current: 0, longest: 0, thisWeek: perWeek.get(thisWeek) || 0, metWeeks: [], weekStart: thisWeek };
  const weeks = [...perWeek.keys()].sort();
  if (!weeks.length) return out;
  let run = 0;
  for (let w = weeks[0]; w <= thisWeek; w = addDays(w, 7)) {
    const met = (perWeek.get(w) || 0) >= goal;
    if (met) { run++; out.metWeeks.push(w); out.longest = Math.max(out.longest, run); }
    else if (w !== thisWeek) run = 0;
  }
  return { ...out, current: run };
}

export function weeklyGoal() {
  const g = Number(state.settings?.weeklyGoal) || Number(state.profile?.daysPerWeek) || 3;
  return Math.max(1, Math.min(7, Math.round(g)));
}

export function enabled() { return state.settings?.gamify !== false; }

// ── SUMMARY ──────────────────────────────────────────────────────────────────
let _cache = null, _cacheKey = '';
if (typeof window !== 'undefined') window.addEventListener('forge:saved', () => { _cache = null; });

export function summary() {
  const today = localDateStr();
  const key = `${today}|${weeklyGoal()}`;
  if (_cache && _cacheKey === key) return _cache;

  const days = collectDays();
  const goal = weeklyGoal();
  const daily = dailyStreak(days, today);
  const weekly = weeklyStreak(days, today, goal);

  // XP ledger, per day.
  const xpByDay = new Map();
  let questsDone = 0;
  const add = (k, n) => xpByDay.set(k, (xpByDay.get(k) || 0) + n);
  for (const [k, d] of days) {
    add(k, dayXP(d));
    for (const id of questsFor(k)) if (QUESTS[id].test(d)) { add(k, QUESTS[id].xp); questsDone++; }
  }
  for (const m of daily.milestones) add(m.day, m.xp);
  for (const w of weekly.metWeeks) {
    // The bonus lands on the day the goal was reached.
    let n = 0;
    for (let k = w; k < addDays(w, 7); k = addDays(k, 1)) if (isTraining(days.get(k)) && ++n === goal) { add(k, WEEK_GOAL_XP); break; }
  }
  const xp = [...xpByDay.values()].reduce((a, b) => a + b, 0);
  const lv = levelFor(xp);

  // Today's quests.
  const td = days.get(today) || blankDay();
  const quests = questsFor(today).map((id) => {
    const q = QUESTS[id];
    return { id, key: `${today}:${id}`, ...q, done: q.test(td), progress: q.prog ? q.prog(td) : null };
  });

  // Weekly XP (this week vs last), and the last 8 weeks for the chart.
  const thisWeek = weekOf(today);
  const weeksXP = [];
  for (let i = 7; i >= 0; i--) {
    const w = addDays(thisWeek, -7 * i);
    let sum = 0;
    for (let k = w; k < addDays(w, 7); k = addDays(k, 1)) sum += xpByDay.get(k) || 0;
    weeksXP.push({ week: w, xp: sum });
  }
  // Same point in last week, so Monday morning is not "behind" all of Sunday.
  const dow = (keyToDate(today).getDay() + 6) % 7;
  let lastWeekSoFar = 0;
  for (let i = 0; i <= dow; i++) lastWeekSoFar += xpByDay.get(addDays(thisWeek, -7 + i)) || 0;

  // Badge values.
  let sessions = 0, tonnage = 0, prs = 0, stretch = 0, engine = 0, measured = 0, fueled = 0, rested = 0, early = 0, late = 0;
  const regionsByWeek = new Map();
  for (const [k, d] of days) {
    sessions += d.strength + d.mobility + d.cardio + d.hiit;
    tonnage += d.volume; prs += d.prs; stretch += d.mobility;
    engine += d.cardioMin;
    if (d.checkin || d.metrics) measured++;
    if (d.foodDay) fueled++;
    if (d.sleep) rested++;
    early += d.early; late += d.late;
    if (d.regions.size) { const w = weekOf(k); const s = regionsByWeek.get(w) || new Set(); d.regions.forEach((r) => s.add(r)); regionsByWeek.set(w, s); }
  }
  const coverage = Math.max(0, ...[...regionsByWeek.values()].map((s) => s.size));
  const values = { sessions, tonnage: Math.round(tonnage), prs, daily: daily.longest, weekly: weekly.longest, stretch,
                   engine: Math.round(engine), coverage, quests: questsDone, measured, fueled, rested, early, owl: late,
                   p500: state.p500 ? objectivesMet(state.p500) : 0,
                   missions: [...days.values()].reduce((a, d) => a + d.mission, 0) };
  const badges = BADGES.map((b) => {
    const v = values[b.id] || 0;
    const tier = b.th.filter((t) => v >= t).length;           // 0 = none yet … 4 = platinum
    const nextT = b.th[tier] ?? null;
    const prevT = tier ? b.th[tier - 1] : 0;
    return { ...b, value: v, tier, next: nextT, pct: nextT == null ? 1 : Math.max(0, Math.min(1, (v - prevT) / (nextT - prevT))) };
  });

  _cache = {
    today, xp, todayXP: xpByDay.get(today) || 0, ...lv, rank: rankFor(lv.level),
    daily: { ...daily, frozen: [...daily.frozen] }, weekly, quests, questsDone,
    weeksXP, thisWeekXP: weeksXP[weeksXP.length - 1].xp, lastWeekSoFar,
    badges, values, xpByDay,
    titles: titlesList(rankFor(lv.level).index, badges),
    flame: flameTier(daily.current),
    rankXPToNext: rankFor(lv.level).next ? Math.max(0, xpForLevel(rankFor(lv.level).next.min) - xp) : 0,
  };
  _cacheKey = key;
  return _cache;
}

// Exposed for tests and for the celebration layer.
export const _internals = { collectDays, dailyStreak, weeklyStreak, dayXP, QUESTS, isActive, isLit, isTraining, addDays };
