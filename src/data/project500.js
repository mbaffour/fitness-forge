// ═══════════════════════════════════════════
//   FITNESS FORGE — Project 500 program template
// ═══════════════════════════════════════════
//
// The 52-week plan as data: phases, objectives, the weekly template and the
// substitutions. Numbers that depend on the person (loads, paces, holds) are
// NOT here — engine/project500.js prescribes those from their own results.
// Every value in canonical units: lb, reps, seconds.

export const P500 = {
  id: 'project500',
  name: 'Project 500',
  weeks: 52,
  defaultTime: '06:30',
  // No one's numbers live here. Each person sets their own final targets (or
  // takes the 100-point values from a loaded scoring table), and the phase
  // milestones are worked out from their own baseline: each phase closes this
  // share of the gap between where they started and where they are going.
  phases: [
    { n: 1, name: 'Foundation',            weeks: [1, 13],  score: 350, share: 0.25,
      focus: 'Lifting technique, base strength, aerobic base, mobility and consistency.' },
    { n: 2, name: 'Strength & Endurance',  weeks: [14, 26], score: 400, share: 0.5,
      focus: 'Progressive resistance, more running, muscular endurance, carries and sled work.' },
    { n: 3, name: 'Performance',           weeks: [27, 39], score: 450, share: 0.75,
      focus: 'Running speed, explosive strength, heavier lifting, conditioning under fatigue.' },
    { n: 4, name: 'Peak',                  weeks: [40, 52], score: 500, share: 1,
      focus: 'Sharpen all five events, full practice tests, transitions, peak for test day.' },
  ],
  // Deload every 4th week; full simulated AFT at the end of each phase block
  // and on the final week. Event checks happen in the other deload weeks.
  deloadEvery: 4,
  fullTestWeeks: [12, 24, 36, 48, 52],
};

// Weekday template, Monday = 0. `stress` tags keep the rescheduler from putting
// two sessions that load the same thing on consecutive days.
export const DAY_TEMPLATES = {
  lower:    { id: 'lower',    name: 'Lower-body strength',            dur: '55–65 min', load: 'hard',     stress: ['hinge', 'legs'], icon: '🏋' },
  speed:    { id: 'speed',    name: 'Running speed + muscular endurance', dur: '45–60 min', load: 'hard', stress: ['run-hard'],      icon: '⚡' },
  recovery: { id: 'recovery', name: 'Active recovery',                dur: '35–45 min', load: 'easy',     stress: [],                icon: '🏊' },
  full:     { id: 'full',     name: 'Full-body strength',             dur: '55–65 min', load: 'hard',     stress: ['hinge', 'legs'], icon: '💪' },
  aerobic:  { id: 'aerobic',  name: 'Aerobic endurance + core',       dur: '40–60 min', load: 'moderate', stress: ['run-easy'],      icon: '🏃' },
  military: { id: 'military', name: 'Military conditioning',          dur: '40–55 min', load: 'moderate', stress: ['run-mod', 'carry'], icon: '🎖' },
  soccer:   { id: 'soccer',   name: 'Soccer session',    dur: 'your session', load: 'moderate', stress: ['run-mod'],   icon: '⚽' },
  rest:     { id: 'rest',     name: 'Rest + weekly review',           dur: 'optional walk', load: 'rest', stress: [],                icon: '☾' },
  // Assessment days replace the normal session in their week.
  checkA:   { id: 'checkA',   name: 'Event check: push-ups + plank',  dur: '30–40 min', load: 'moderate', stress: [],                icon: '🎯', test: ['hrp', 'plk'] },
  checkRun: { id: 'checkRun', name: 'Event check: 2-mile time trial', dur: '30–40 min', load: 'hard',     stress: ['run-hard'],      icon: '🎯', test: ['tmr'] },
  checkSdc: { id: 'checkSdc', name: 'Event check: sprint-drag-carry', dur: '30–40 min', load: 'moderate', stress: ['carry'],         icon: '🎯', test: ['sdc'] },
  aft:      { id: 'aft',      name: 'Simulated AFT — all five events', dur: '90–120 min', load: 'hard',   stress: ['hinge', 'legs', 'run-hard', 'carry'], icon: '🎖', test: ['mdl', 'hrp', 'sdc', 'plk', 'tmr'] },
  // Placed by the person (rescheduling / recovery management).
  recover:  { id: 'recover',  name: 'Recovery day',                   dur: '20–30 min', load: 'easy',     stress: [],                icon: '🛌' },
};
export const WEEK_TEMPLATE = ['lower', 'speed', 'recovery', 'full', 'aerobic', 'military', 'rest'];

// Swaps for missing kit. A substitute is recorded as one and is never given an
// official AFT score.
export const SUBSTITUTES = {
  trap_dl:  ['deadlift', 'fx_Stiff_Legged_Dumbbell_Deadlift'],
  squat_db: ['fx_Dumbbell_Squat', 'kb_goblet'],
  farmer:   ['wg_farmer_carry'],
  fx_Sled_Drag___Harness: ['fx_Sled_Push', 'farmer'],
  lat_pull: ['band_pulldown'],
  hr_pushup: ['pushup'],
};

// Optional Combat Field Test — the Army's April 2026 sequence: seven events
// back to back on one continuous clock, ACU and boots, 30-minute limit.
export const CFT = {
  name: 'Combat Field Test',
  limitSec: 1800,
  source: { label: 'U.S. Army — new Combat Field Test (22 Apr 2026)', url: 'https://www.army.mil/article/291880' },
  events: [
    { id: 'run1',   name: '1-mile run' },
    { id: 'pushup', name: '30 dead-stop push-ups' },
    { id: 'sprint', name: '100 m sprint' },
    { id: 'sandbag', name: '16 sandbag lifts — 40 lb onto a 65 in platform' },
    { id: 'cans',   name: '50 m carry — two 40 lb water cans' },
    { id: 'crawl',  name: '50 m movement drill — 25 m high crawl + 25 m 3–5 s rushes' },
    { id: 'run2',   name: '1-mile run' },
  ],
  // Unlocks for demanding practice only once the base is there.
  unlock: { tmr: 960, hrp: 30, weeks: 13 },
};

// Self-reported running ability → where the aerobic work starts.
export const RUN_LEVELS = [
  { id: 'none',    label: 'Not running yet',               easyMin: 20, runWalk: '1 min run / 1 min walk' },
  { id: 'runwalk', label: 'Can run/walk 20 minutes',       easyMin: 20, runWalk: '3 min run / 1 min walk' },
  { id: 'c20',     label: 'Can run 20 minutes continuously', easyMin: 25, runWalk: null },
  { id: 'c30',     label: 'Can run 30+ minutes',           easyMin: 30, runWalk: null },
];
