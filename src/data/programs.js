// ═══════════════════════════════════════════
//   FITNESS FORGE — Goal Programs
//   Curated, finite training plans for a specific target: a skill, a lift, a
//   look, an event you're prepping for, or getting back on your feet.
//   Distinct from `state.program` (the generated 16-week onboarding plan).
//   Every exercise id here must exist in EXERCISES — validated by the test in
//   the Programs page and at import time in dev.
// ═══════════════════════════════════════════

export const PROGRAM_CATEGORIES = [
  { id: 'skill',    label: 'Skills',        icon: '🤸', blurb: 'Unlock a movement you can\'t do yet' },
  { id: 'strength', label: 'Strength',      icon: '🏋', blurb: 'Add weight to the big lifts' },
  { id: 'physique', label: 'Physique',      icon: '💪', blurb: 'Target how you look' },
  { id: 'event',    label: 'Event Prep',    icon: '📅', blurb: 'Be ready for a date on the calendar' },
  { id: 'health',   label: 'Health',        icon: '🧘', blurb: 'Feel better, move better, stay injury-free' },
];

const P = (id, sets, reps) => ({ id, sets, reps });

export const PROGRAMS = [
  // ── SKILLS ────────────────────────────────────────────────────────────────
  {
    id: 'first_pullup', name: 'First Pull-Up', cat: 'skill', icon: '🎯',
    weeks: 6, days: 3, requires: ['pull_up_bar'],
    blurb: 'Zero to one strict pull-up — build the pull from the ground up.',
    goal: 'One strict bodyweight pull-up',
    sessions: [
      { label: 'Pull Strength', exercises: [P('inverted_row',4,'8-10'), P('lat_pull',4,'8-12'), P('curl_db',3,'10-12'), P('plank',3,'40s')] },
      { label: 'Push + Core',   exercises: [P('pushup',4,'8-12'), P('ohp_db',3,'8-10'), P('hollow',3,'30s'), P('deadbug',3,'10')] },
      { label: 'Pull Skill',    exercises: [P('pullup',5,'1-3'), P('inverted_row',3,'10-12'), P('str_pull',3,'12-15'), P('farmer',3,'40s')] },
    ],
    progression: 'Negatives first: jump to the top and lower for 5 seconds. Add one rep per set each week. Drop band assistance every two weeks.',
    milestones: ['Week 2 — 5 controlled negatives', 'Week 4 — 1 band-assisted pull-up', 'Week 6 — 1 strict pull-up'],
  },
  {
    id: 'first_pushup', name: 'First Push-Up', cat: 'skill', icon: '🌱',
    weeks: 4, days: 3, requires: [],
    blurb: 'Build pressing strength from incline to a full floor push-up.',
    goal: 'One full-range floor push-up',
    sessions: [
      { label: 'Press A', exercises: [P('pushup',4,'5-10'), P('plank',3,'30s'), P('deadbug',3,'10')] },
      { label: 'Full Body', exercises: [P('squat_bw',3,'12-15'), P('inverted_row',3,'8-10'), P('hipthrust_bw',3,'12-15')] },
      { label: 'Press B', exercises: [P('pushup',5,'4-8'), P('side_plank',3,'20s'), P('hollow',3,'20s')] },
    ],
    progression: 'Start hands-elevated on a counter, then a bench, then a low step, then the floor. Lower the surface only when you can do 3×10 clean.',
    milestones: ['Week 1 — 3×10 counter push-ups', 'Week 3 — 3×8 on a low step', 'Week 4 — 1 floor push-up'],
  },
  {
    id: 'handstand', name: 'Handstand & Core Control', cat: 'skill', icon: '🤸',
    weeks: 8, days: 3, requires: [],
    blurb: 'Overhead strength, straight-line control and the core to hold it.',
    goal: 'A 15-second wall handstand',
    sessions: [
      { label: 'Overhead', exercises: [P('pike_pu',4,'6-10'), P('ohp_db',3,'8-10'), P('hollow',3,'30s')] },
      { label: 'Core Line', exercises: [P('l_sit',4,'15s'), P('plank',3,'45s'), P('side_plank',3,'30s'), P('deadbug',3,'12')] },
      { label: 'Skill', exercises: [P('hspu',4,'3-6'), P('pike_pu',3,'8-12'), P('hollow',4,'30s')] },
    ],
    progression: 'Kick up to the wall daily for practice, not to failure. Add 5 seconds to your hold each week.',
    milestones: ['Week 2 — 30s hollow hold', 'Week 5 — 10s wall handstand', 'Week 8 — 15s + 3 wall HSPU'],
  },

  // ── STRENGTH ──────────────────────────────────────────────────────────────
  {
    id: 'bench_builder', name: 'Bigger Bench', cat: 'strength', icon: '🏋',
    weeks: 8, days: 3, requires: ['barbell','bench'],
    blurb: 'Add real weight to your bench with heavy work plus targeted volume.',
    goal: '+10–20 lbs on your bench 1RM',
    sessions: [
      { label: 'Heavy Bench', exercises: [P('bench_bb',5,'5'), P('row_bb',4,'8-10'), P('tri_push',3,'10-12'), P('face_pull',3,'15')] },
      { label: 'Volume Push', exercises: [P('incline_db',4,'8-12'), P('dips',3,'8-10'), P('cable_fly',3,'12-15'), P('skull',3,'10-12')] },
      { label: 'Speed + Back', exercises: [P('bench_bb',6,'3'), P('lat_pull',4,'10'), P('cgbench',3,'8-10'), P('rear_delt_fly',3,'15')] },
    ],
    progression: 'Add 5 lbs to the heavy day each week. If you miss twice, drop 10% and climb again. Speed day stays at 60% — move it fast.',
    milestones: ['Week 3 — heavy 5s feel easy', 'Week 6 — new working weight', 'Week 8 — test a new 1RM'],
  },
  {
    id: 'squat_5x5', name: 'Squat Strength 5×5', cat: 'strength', icon: '🦵',
    weeks: 8, days: 3, requires: ['barbell'],
    blurb: 'Classic linear 5×5 built around the back squat.',
    goal: 'A clear jump in squat working weight',
    sessions: [
      { label: 'Squat Heavy', exercises: [P('squat_bb',5,'5'), P('rdl_bb',3,'8'), P('plank',3,'45s')] },
      { label: 'Squat + Press', exercises: [P('squat_bb',5,'5'), P('ohp_bb',3,'5'), P('row_bb',3,'8')] },
      { label: 'Squat + Pull', exercises: [P('squat_bb',5,'5'), P('deadlift',1,'5'), P('legcurl',3,'10-12')] },
    ],
    progression: 'Add 5 lbs every session while all 5×5 are clean. Two failed sessions in a row: deload 10%.',
    milestones: ['Week 2 — form dialled at working weight', 'Week 5 — bodyweight squat ×5', 'Week 8 — new 5RM'],
  },
  {
    id: 'deadlift_power', name: 'Deadlift Power', cat: 'strength', icon: '⚡',
    weeks: 8, days: 3, requires: ['barbell'],
    blurb: 'Pull heavier with focused posterior-chain and grip work.',
    goal: '+20 lbs on your deadlift',
    sessions: [
      { label: 'Pull Heavy', exercises: [P('deadlift',5,'3'), P('row_bb',4,'8'), P('farmer',3,'40s')] },
      { label: 'Posterior', exercises: [P('rdl_bb',4,'8-10'), P('good_morning',3,'10-12'), P('legcurl',3,'12'), P('hipthrust_bb',3,'10')] },
      { label: 'Back + Grip', exercises: [P('pendlay_row',4,'6-8'), P('lat_pull',3,'10'), P('shrug_bb',3,'12-15'), P('wrist_curl',3,'15')] },
    ],
    progression: 'Add 10 lbs to the heavy triples each week while bar speed holds. Reset 10% if speed dies.',
    milestones: ['Week 3 — triples move fast', 'Week 6 — new working triple', 'Week 8 — test a new 1RM'],
  },

  // ── PHYSIQUE ──────────────────────────────────────────────────────────────
  {
    id: 'bigger_arms', name: 'Bigger Arms', cat: 'physique', icon: '💪',
    weeks: 6, days: 3, requires: ['dumbbells'],
    blurb: 'High-frequency biceps and triceps work that actually adds size.',
    goal: 'Visible arm growth in 6 weeks',
    sessions: [
      { label: 'Arms A', exercises: [P('curl_bb',4,'8-12'), P('skull',4,'10-12'), P('curl_hammer',3,'12'), P('tri_push',3,'12-15')] },
      { label: 'Push + Tris', exercises: [P('cgbench',4,'8-10'), P('dips',3,'8-12'), P('tri_oh',3,'12'), P('diamond_pu',3,'10-15')] },
      { label: 'Pull + Bis', exercises: [P('chinup',4,'6-10'), P('preacher_curl',3,'10-12'), P('curl_incline',3,'12'), P('concentration_curl',3,'12-15')] },
    ],
    progression: 'Arms recover fast — add a rep every session and weight once you top the range. Take the last set close to failure.',
    milestones: ['Week 2 — pump and form locked', 'Week 4 — +1 sleeve-fill notch', 'Week 6 — measure cold and compare'],
  },
  {
    id: 'glute_build', name: 'Glute Build', cat: 'physique', icon: '🍑',
    weeks: 8, days: 3, requires: ['dumbbells'],
    blurb: 'Hip-thrust-led programming that trains glutes through full range.',
    goal: 'Stronger, fuller glutes',
    sessions: [
      { label: 'Heavy Hips', exercises: [P('hipthrust_bb',4,'8-10'), P('rdl_db',4,'10-12'), P('bss',3,'10'), P('hip_abduction',3,'15-20')] },
      { label: 'Legs + Glutes', exercises: [P('squat_db',4,'10-12'), P('lunge_db',3,'12'), P('glute_kickback',3,'15'), P('calfr_bw',3,'20')] },
      { label: 'Pump', exercises: [P('hipthrust_bw',4,'20'), P('stepup',3,'12'), P('hip_abduction',4,'20'), P('side_plank',3,'30s')] },
    ],
    progression: 'Drive through the heels and pause one second at lockout. Add weight on the heavy day weekly; chase reps on the pump day.',
    milestones: ['Week 3 — bodyweight hip thrust ×10', 'Week 6 — noticeable strength jump', 'Week 8 — retest and photo'],
  },
  {
    id: 'v_taper', name: 'V-Taper — Shoulders & Back', cat: 'physique', icon: '🔺',
    weeks: 8, days: 4, requires: [],
    blurb: 'Widen the shoulders and lats for a broader upper body.',
    goal: 'Wider shoulders, thicker back',
    sessions: [
      { label: 'Width', exercises: [P('lat_pull',4,'10-12'), P('pullup',3,'6-10'), P('str_pull',3,'12-15'), P('lat_raise',4,'15')] },
      { label: 'Delts', exercises: [P('ohp_bb',4,'6-8'), P('lat_raise',4,'12-15'), P('rear_delt_fly',3,'15'), P('face_pull',3,'15')] },
      { label: 'Thickness', exercises: [P('row_bb',4,'8-10'), P('row_chest',3,'10-12'), P('shrug_db',3,'12-15'), P('band_pull_apart',3,'20')] },
      { label: 'Upper Mix', exercises: [P('arnold_press',3,'10-12'), P('row_cable',3,'12'), P('lat_raise',3,'15-20'), P('pullover',3,'12')] },
    ],
    progression: 'Side raises are the width driver — go light, strict and high-rep. Add weight only on the pressing and rowing lifts.',
    milestones: ['Week 3 — strict raise form', 'Week 6 — shirt fits differently', 'Week 8 — measure shoulder width'],
  },
  {
    id: 'lean_out', name: 'Lean Out', cat: 'physique', icon: '🔥',
    weeks: 8, days: 4, requires: [],
    blurb: 'Keep your strength while dropping fat — full-body work with density.',
    goal: 'Lose fat, hold muscle',
    sessions: [
      { label: 'Full Body A', exercises: [P('squat_db',4,'12'), P('bench_db',4,'12'), P('row_db',4,'12'), P('plank',3,'45s')] },
      { label: 'Conditioning', exercises: [P('kb_swing',5,'20'), P('burpee',4,'10'), P('mtn_climber',4,'30s'), P('jump_sq',3,'15')] },
      { label: 'Full Body B', exercises: [P('rdl_db',4,'12'), P('ohp_db',4,'12'), P('lat_pull',4,'12'), P('russian',3,'20')] },
      { label: 'Circuit', exercises: [P('lunge_bw',3,'20'), P('pushup',3,'15'), P('inverted_row',3,'12'), P('hollow',3,'30s')] },
    ],
    progression: 'Keep the weights honest and shorten rest instead — 60s on lifting days, 30s on conditioning. Fat loss is won in the kitchen; log your food.',
    milestones: ['Week 2 — routine locked in', 'Week 5 — waist down, lifts held', 'Week 8 — reassess and photo'],
  },

  // ── EVENT PREP ────────────────────────────────────────────────────────────
  {
    id: 'ski_prep', name: 'Ski & Snowboard Prep', cat: 'event', icon: '🎿',
    weeks: 6, days: 3, requires: [],
    blurb: 'Quads that survive day three — eccentric strength and single-leg control.',
    goal: 'Ride all week without blown legs',
    sessions: [
      { label: 'Leg Strength', exercises: [P('squat_bb',4,'8-10'), P('bss',3,'10'), P('legcurl',3,'12'), P('calfr_bw',3,'20')] },
      { label: 'Power + Balance', exercises: [P('jump_sq',4,'10'), P('boxjump',4,'6'), P('lunge_bw',3,'16'), P('side_plank',3,'30s')] },
      { label: 'Endurance', exercises: [P('squat_bw',4,'25'), P('stepup',3,'15'), P('pallof',3,'12'), P('plank',3,'60s')] },
    ],
    progression: 'Lower slowly on every squat — the burn on a run is eccentric. Build the wall-sit hold to 90 seconds by week 6.',
    milestones: ['Week 2 — 60s wall sit', 'Week 4 — 20 clean jump squats', 'Week 6 — 90s wall sit, legs ready'],
  },
  {
    id: 'hike_prep', name: 'Hiking & Trek Prep', cat: 'event', icon: '🥾',
    weeks: 6, days: 3, requires: [],
    blurb: 'Carry a pack uphill for hours without your legs or back quitting.',
    goal: 'A full day on the trail under load',
    sessions: [
      { label: 'Loaded Legs', exercises: [P('stepup',4,'12'), P('lunge_db',3,'12'), P('rdl_db',3,'10-12'), P('calfr_bb',4,'15')] },
      { label: 'Carry + Core', exercises: [P('farmer',5,'45s'), P('plank',3,'60s'), P('side_plank',3,'40s'), P('pallof',3,'12')] },
      { label: 'Descent', exercises: [P('squat_bw',4,'20'), P('bss',3,'10'), P('boxjump',3,'8'), P('calfr_bw',3,'25')] },
    ],
    progression: 'Add weight to the step-ups and carries weekly. Do one long weekend walk with your actual pack, adding 10 minutes each week.',
    milestones: ['Week 2 — 45s heavy carry', 'Week 4 — 2h pack walk', 'Week 6 — full-day ready'],
  },
  {
    id: 'beach_ready', name: 'Beach / Vacation Ready', cat: 'event', icon: '🏖',
    weeks: 8, days: 4, requires: ['dumbbells'],
    blurb: 'Upper body, core and conditioning for a date on the calendar.',
    goal: 'Look and feel sharp on the trip',
    sessions: [
      { label: 'Push', exercises: [P('bench_db',4,'10-12'), P('ohp_db',3,'12'), P('lat_raise',3,'15'), P('tri_push',3,'15')] },
      { label: 'Pull', exercises: [P('lat_pull',4,'12'), P('row_db',4,'12'), P('curl_db',3,'12'), P('face_pull',3,'15')] },
      { label: 'Core + Cardio', exercises: [P('crunch',4,'20'), P('russian',3,'20'), P('mtn_climber',4,'30s'), P('burpee',3,'12')] },
      { label: 'Legs', exercises: [P('squat_db',4,'12'), P('lunge_db',3,'12'), P('hipthrust_bw',3,'20'), P('calfr_bw',3,'20')] },
    ],
    progression: 'Train hard and eat in a small deficit — you cannot out-train the kitchen. Keep protein high so you hold muscle.',
    milestones: ['Week 3 — habits locked', 'Week 6 — visible change', 'Week 8 — trip ready'],
  },
  {
    id: 'wedding_prep', name: 'Wedding Prep', cat: 'event', icon: '💍',
    weeks: 12, days: 4, requires: ['dumbbells'],
    blurb: 'A twelve-week runway: build shape early, sharpen at the end.',
    goal: 'Your best in the photos',
    sessions: [
      { label: 'Upper Push', exercises: [P('bench_db',4,'10'), P('ohp_db',4,'10'), P('lat_raise',3,'15'), P('dips',3,'10')] },
      { label: 'Lower', exercises: [P('squat_db',4,'12'), P('rdl_db',4,'12'), P('bss',3,'10'), P('calfr_bw',4,'20')] },
      { label: 'Upper Pull', exercises: [P('lat_pull',4,'12'), P('row_db',4,'12'), P('curl_db',3,'12'), P('rear_delt_fly',3,'15')] },
      { label: 'Core + Conditioning', exercises: [P('plank',3,'60s'), P('russian',3,'20'), P('kb_swing',4,'20'), P('burpee',3,'12')] },
    ],
    progression: 'Weeks 1–8 build: add weight, eat at maintenance. Weeks 9–12 sharpen: hold the weights, add conditioning, small deficit.',
    milestones: ['Week 4 — strength up', 'Week 8 — shape built', 'Week 12 — sharp for the day'],
  },
  {
    id: 'military_prep', name: 'Fitness Test Prep', cat: 'event', icon: '🎖',
    weeks: 8, days: 4, requires: [],
    blurb: 'Push-ups, sit-ups, pull-ups and a timed run — train the test itself.',
    goal: 'Pass or max a standard fitness test',
    sessions: [
      { label: 'Push Volume', exercises: [P('pushup',6,'15-25'), P('diamond_pu',3,'12'), P('dips',3,'10'), P('plank',3,'60s')] },
      { label: 'Pull Volume', exercises: [P('pullup',6,'5-10'), P('inverted_row',4,'12'), P('curl_db',3,'12'), P('farmer',3,'40s')] },
      { label: 'Core + Run', exercises: [P('crunch',5,'25'), P('russian',3,'20'), P('legraise',3,'15'), P('mtn_climber',4,'30s')] },
      { label: 'Test Sim', exercises: [P('pushup',3,'25'), P('pullup',3,'8'), P('crunch',3,'30'), P('burpee',3,'15')] },
    ],
    progression: 'Every third session, run the real test cold and record your numbers. Train just above your target on volume days.',
    milestones: ['Week 2 — baseline recorded', 'Week 5 — +25% on every event', 'Week 8 — test day'],
  },
  {
    id: 'first_5k', name: 'First 5K', cat: 'event', icon: '🏃',
    weeks: 6, days: 3, requires: [],
    blurb: 'Run-walk to a continuous 5K, with the strength work that prevents injury.',
    goal: 'Run 5K without stopping',
    sessions: [
      { label: 'Run + Legs', exercises: [P('squat_bw',3,'20'), P('lunge_bw',3,'16'), P('calfr_bw',4,'20')] },
      { label: 'Strength Support', exercises: [P('rdl_db',3,'12'), P('stepup',3,'12'), P('plank',3,'45s'), P('side_plank',3,'30s')] },
      { label: 'Long Effort', exercises: [P('hipthrust_bw',3,'20'), P('deadbug',3,'12'), P('calfr_bw',3,'25')] },
    ],
    progression: 'Run-walk intervals: week 1 is 1 min run / 2 min walk × 8. Add 30s of running and remove 30s of walking each week until you run 30 minutes straight.',
    milestones: ['Week 2 — 2 min running blocks', 'Week 4 — 10 min continuous', 'Week 6 — 5K continuous'],
  },

  // ── HEALTH ────────────────────────────────────────────────────────────────
  {
    id: 'desk_reset', name: 'Desk-Job Posture Reset', cat: 'health', icon: '🪑',
    weeks: 4, days: 3, requires: [],
    blurb: 'Undo the desk slouch — open the chest, wake the glutes, pull more.',
    goal: 'Stand taller, ache less',
    sessions: [
      { label: 'Pull & Open', exercises: [P('face_pull',4,'15-20'), P('band_pull_apart',4,'20'), P('rear_delt_fly',3,'15'), P('inverted_row',3,'10')] },
      { label: 'Hips & Core', exercises: [P('hipthrust_bw',4,'15'), P('deadbug',3,'12'), P('side_plank',3,'30s'), P('pallof',3,'12')] },
      { label: 'Full Reset', exercises: [P('row_cable',3,'12'), P('plank',3,'45s'), P('glute_kickback',3,'15'), P('band_pull_apart',3,'20')] },
    ],
    progression: 'Do the band pull-aparts daily — they are the highest-value minute in this plan. Quality over load throughout.',
    milestones: ['Week 1 — daily band habit', 'Week 3 — less neck/shoulder ache', 'Week 4 — posture holds without thinking'],
  },
  {
    id: 'strong_back', name: 'Bulletproof Lower Back', cat: 'health', icon: '🛡',
    weeks: 6, days: 3, requires: [],
    blurb: 'Build a back that tolerates load — bracing, hinging and endurance.',
    goal: 'A back that stops flaring up',
    sessions: [
      { label: 'Brace', exercises: [P('deadbug',4,'12'), P('plank',3,'45s'), P('side_plank',4,'30s'), P('pallof',3,'12')] },
      { label: 'Hinge', exercises: [P('hipthrust_bw',4,'15'), P('good_morning',3,'12'), P('rdl_db',3,'12'), P('wg_bird_dog',3,'10')] },
      { label: 'Endurance', exercises: [P('farmer',4,'40s'), P('plank',3,'60s'), P('glute_kickback',3,'15'), P('deadbug',3,'15')] },
    ],
    progression: 'Never train through sharp pain. Build hold times before adding load — endurance protects the spine more than max strength.',
    milestones: ['Week 2 — 45s side plank each side', 'Week 4 — pain-free hinging', 'Week 6 — loaded carries comfortable'],
  },
  {
    id: 'comeback', name: 'Return to Training', cat: 'health', icon: '↩',
    weeks: 4, days: 3, requires: [],
    blurb: 'Back after a layoff — rebuild the habit without wrecking yourself.',
    goal: 'Training consistently again',
    sessions: [
      { label: 'Full Body A', exercises: [P('squat_bw',3,'12-15'), P('pushup',3,'8-12'), P('inverted_row',3,'8-10'), P('plank',3,'30s')] },
      { label: 'Full Body B', exercises: [P('lunge_bw',3,'12'), P('ohp_db',3,'10-12'), P('lat_pull',3,'12'), P('deadbug',3,'10')] },
      { label: 'Full Body C', exercises: [P('hipthrust_bw',3,'15'), P('bench_db',3,'10-12'), P('row_db',3,'12'), P('side_plank',3,'25s')] },
    ],
    progression: 'Stop every set two reps short of failure for the first two weeks. Soreness is fine; joint pain is not. Consistency beats intensity right now.',
    milestones: ['Week 1 — three sessions done', 'Week 2 — movement feels normal', 'Week 4 — ready for a real program'],
  },

  // ── SKILLS (more) ─────────────────────────────────────────────────────────
  {
    id: 'first_dip', name: 'First Dip', cat: 'skill', icon: '⬇',
    weeks: 4, days: 3, requires: [],
    blurb: 'Build to a full bodyweight dip from bench dips and negatives.',
    goal: 'One strict parallel-bar dip',
    sessions: [
      { label: 'Press Base', exercises: [P('pushup',4,'12-15'), P('cgbench',3,'8-10'), P('tri_push',3,'12'), P('plank',3,'40s')] },
      { label: 'Dip Skill', exercises: [P('dips',5,'2-5'), P('diamond_pu',3,'10'), P('skull',3,'10-12')] },
      { label: 'Shoulders + Core', exercises: [P('ohp_db',4,'10'), P('lat_raise',3,'15'), P('hollow',3,'30s')] },
    ],
    progression: 'Start with bench dips, then slow negatives from the top of the bar. Five clean 5-second negatives earns you a real attempt.',
    milestones: ['Week 1 — 3×12 bench dips', 'Week 3 — 5 slow negatives', 'Week 4 — 1 strict dip'],
  },
  {
    id: 'pistol_squat', name: 'Pistol Squat', cat: 'skill', icon: '🦩',
    weeks: 8, days: 3, requires: [],
    blurb: 'Single-leg strength, ankle mobility and balance for a full pistol.',
    goal: 'One clean pistol squat per leg',
    sessions: [
      { label: 'Single Leg', exercises: [P('bss',4,'10'), P('stepup',3,'12'), P('calfr_bw',4,'20'), P('side_plank',3,'30s')] },
      { label: 'Pistol Skill', exercises: [P('pistol_sq',5,'3-5'), P('squat_bw',3,'20'), P('leg_ext',3,'15')] },
      { label: 'Strength', exercises: [P('squat_bb',4,'8'), P('legcurl',3,'12'), P('hipthrust_bw',3,'15')] },
    ],
    progression: 'Squat to a box and lower the box every two weeks. Hold a light plate out front as a counterweight until you no longer need it.',
    milestones: ['Week 2 — box pistol to a chair', 'Week 5 — box pistol to a low step', 'Week 8 — full pistol'],
  },
  {
    id: 'muscle_up_prog', name: 'Muscle-Up', cat: 'skill', icon: '🚀',
    weeks: 10, days: 3, requires: ['pull_up_bar'],
    blurb: 'The big one — explosive pull, fast transition, strong lockout.',
    goal: 'One bar muscle-up',
    sessions: [
      { label: 'Explosive Pull', exercises: [P('pullup',5,'5-8'), P('inverted_row',3,'12'), P('str_pull',3,'12'), P('hollow',3,'30s')] },
      { label: 'Transition', exercises: [P('muscle_up',5,'1-3'), P('dips',4,'8-10'), P('chinup',3,'6-8')] },
      { label: 'Lockout', exercises: [P('ring_dip',4,'6-8'), P('ohp_db',3,'10'), P('tri_oh',3,'12'), P('l_sit',3,'15s')] },
    ],
    progression: 'You need 8 strict pull-ups and 8 strict dips before the transition will happen. Train explosive pull-ups to sternum height.',
    milestones: ['Week 3 — chest-to-bar pull-up', 'Week 6 — 10 strict dips', 'Week 10 — 1 muscle-up'],
  },

  // ── STRENGTH (more) ───────────────────────────────────────────────────────
  {
    id: 'ohp_builder', name: 'Overhead Press Builder', cat: 'strength', icon: '🙌',
    weeks: 8, days: 3, requires: ['barbell'],
    blurb: 'A stronger, more stable press overhead.',
    goal: '+10 lbs on your strict press',
    sessions: [
      { label: 'Press Heavy', exercises: [P('ohp_bb',5,'5'), P('lat_pull',4,'10'), P('lat_raise',3,'15'), P('face_pull',3,'15')] },
      { label: 'Push Volume', exercises: [P('ohp_db',4,'8-10'), P('arnold_press',3,'12'), P('pike_pu',3,'8-12'), P('tri_push',3,'12')] },
      { label: 'Power', exercises: [P('pushpress',5,'3'), P('row_bb',4,'8'), P('rear_delt_fly',3,'15'), P('plank',3,'45s')] },
    ],
    progression: 'The press moves slowly — add 2.5 lbs a week, not 5. Brace hard and squeeze the glutes; most missed presses are a soft midsection.',
    milestones: ['Week 3 — bar path locked', 'Week 6 — new working 5', 'Week 8 — test a new 1RM'],
  },
  {
    id: 'meet_prep', name: 'Powerlifting Meet Prep', cat: 'strength', icon: '🥇',
    weeks: 12, days: 4, requires: ['barbell','bench'],
    blurb: 'Twelve weeks to a squat, bench and deadlift platform total.',
    goal: 'Peak for a three-lift total',
    sessions: [
      { label: 'Squat', exercises: [P('squat_bb',5,'3-5'), P('legpress',3,'10'), P('good_morning',3,'10'), P('plank',3,'45s')] },
      { label: 'Bench', exercises: [P('bench_bb',5,'3-5'), P('cgbench',3,'8'), P('row_bb',4,'8'), P('tri_push',3,'12')] },
      { label: 'Deadlift', exercises: [P('deadlift',5,'3'), P('rdl_bb',3,'8'), P('pendlay_row',3,'8'), P('farmer',3,'40s')] },
      { label: 'Accessory', exercises: [P('incline_db',3,'10'), P('lat_pull',4,'10'), P('legcurl',3,'12'), P('curl_db',3,'12')] },
    ],
    progression: 'Weeks 1–8 build volume, weeks 9–11 drop volume and raise intensity, week 12 is a deload with openers only. Never miss a rep in the last two weeks.',
    milestones: ['Week 4 — volume peak', 'Week 8 — heavy singles', 'Week 12 — meet day'],
  },
  {
    id: 'iron_grip', name: 'Iron Grip', cat: 'strength', icon: '🤝',
    weeks: 6, days: 3, requires: [],
    blurb: 'Forearms and grip that stop being the weak link on every pull.',
    goal: 'A grip that outlasts your back',
    sessions: [
      { label: 'Carry', exercises: [P('farmer',5,'45s'), P('shrug_db',4,'12'), P('wrist_curl',3,'15-20'), P('rev_wrist_curl',3,'15')] },
      { label: 'Pull + Hold', exercises: [P('deadlift',4,'5'), P('row_db',4,'10'), P('reverse_curl',3,'12'), P('curl_hammer',3,'12')] },
      { label: 'Hang', exercises: [P('pullup',4,'6-10'), P('inverted_row',3,'12'), P('farmer',4,'60s'), P('wrist_curl',3,'20')] },
    ],
    progression: 'Never use straps in this block. Add 10 seconds to the carries or hangs every week — time under tension is the whole game.',
    milestones: ['Week 2 — 45s dead hang', 'Week 4 — 60s heavy carry', 'Week 6 — 90s dead hang'],
  },

  // ── PHYSIQUE (more) ───────────────────────────────────────────────────────
  {
    id: 'thick_back', name: 'Thicker Back', cat: 'physique', icon: '🗿',
    weeks: 8, days: 3, requires: [],
    blurb: 'Rows first — build the density a lat pulldown alone never will.',
    goal: 'A visibly thicker, denser back',
    sessions: [
      { label: 'Heavy Row', exercises: [P('row_bb',5,'6-8'), P('lat_pull',4,'10'), P('shrug_bb',3,'12'), P('curl_bb',3,'10')] },
      { label: 'Width', exercises: [P('pullup',4,'6-10'), P('row_cable',4,'12'), P('str_pull',3,'15'), P('rear_delt_fly',3,'15')] },
      { label: 'Detail', exercises: [P('row_chest',4,'12'), P('row_tbar',3,'10'), P('pullover',3,'12'), P('face_pull',4,'15-20')] },
    ],
    progression: 'Pull with the elbows, not the hands, and pause a beat at the top of every row. Add weight only when the pause holds.',
    milestones: ['Week 3 — mind-muscle connection', 'Week 6 — heavier rows', 'Week 8 — measure and compare'],
  },
  {
    id: 'chest_spec', name: 'Chest Specialization', cat: 'physique', icon: '🛡',
    weeks: 6, days: 3, requires: ['dumbbells'],
    blurb: 'Three angles, high frequency — build the whole chest.',
    goal: 'Fuller chest, upper and lower',
    sessions: [
      { label: 'Flat', exercises: [P('bench_db',4,'8-12'), P('cable_fly',3,'12-15'), P('pushup',3,'15'), P('tri_push',3,'12')] },
      { label: 'Incline', exercises: [P('incline_db',4,'10'), P('incline_bb',3,'8'), P('db_fly',3,'12'), P('dips',3,'10')] },
      { label: 'Volume', exercises: [P('machine_press',4,'12'), P('decline_bench',3,'10'), P('cable_fly',4,'15'), P('diamond_pu',3,'12')] },
    ],
    progression: 'Stretch matters more than lockout — control the bottom of every fly and press. Add a rep before you add weight.',
    milestones: ['Week 2 — full-range control', 'Week 4 — upper chest fills', 'Week 6 — compare photos'],
  },
  {
    id: 'stubborn_calves', name: 'Stubborn Calves', cat: 'physique', icon: '🐮',
    weeks: 6, days: 3, requires: [],
    blurb: 'High frequency, full range, brutal reps — the only thing that works.',
    goal: 'Calves that finally grow',
    sessions: [
      { label: 'Standing', exercises: [P('calfr_bb',5,'12-15'), P('calfr_bw',3,'25'), P('farmer',3,'40s')] },
      { label: 'Seated', exercises: [P('seated_calf',5,'15-20'), P('calfr_bw',4,'30'), P('boxjump',3,'8')] },
      { label: 'Mixed', exercises: [P('calfr_bb',4,'10'), P('seated_calf',4,'20'), P('jump_sq',3,'12'), P('calfr_bw',3,'30')] },
    ],
    progression: 'Two seconds down, full stretch at the bottom, one second squeeze at the top. Calves respond to frequency — never skip a day here.',
    milestones: ['Week 2 — full range every rep', 'Week 4 — heavier standing raises', 'Week 6 — measure cold'],
  },
  {
    id: 'visible_abs', name: 'Visible Abs', cat: 'physique', icon: '🧊',
    weeks: 8, days: 4, requires: [],
    blurb: 'Train the core hard, keep the rest of your training honest.',
    goal: 'A core that shows',
    sessions: [
      { label: 'Core Strength', exercises: [P('ab_wheel',4,'10-12'), P('hollow',4,'30s'), P('legraise',4,'12-15'), P('pallof',3,'12')] },
      { label: 'Full Body', exercises: [P('squat_db',4,'12'), P('row_db',4,'12'), P('ohp_db',3,'12'), P('plank',3,'60s')] },
      { label: 'Obliques', exercises: [P('russian',4,'20'), P('side_plank',4,'40s'), P('wood_chop',3,'15'), P('v_up',3,'15')] },
      { label: 'Conditioning', exercises: [P('mtn_climber',4,'40s'), P('burpee',4,'12'), P('crunch',4,'25'), P('hollow',3,'40s')] },
    ],
    progression: 'Abs are built in the gym and revealed in the kitchen — log your food. Train the core with resistance and low reps, not endless crunches.',
    milestones: ['Week 3 — 45s hollow hold', 'Week 6 — ab wheel from standing', 'Week 8 — reassess'],
  },

  // ── EVENT PREP (more) ─────────────────────────────────────────────────────
  {
    id: 'murph_prep', name: 'Murph Prep', cat: 'event', icon: '🇺🇸',
    weeks: 8, days: 4, requires: ['pull_up_bar'],
    blurb: '100 pull-ups, 200 push-ups, 300 squats, two miles. Build the engine.',
    goal: 'Complete Murph unbroken-ish',
    sessions: [
      { label: 'Pull Volume', exercises: [P('pullup',10,'5'), P('inverted_row',4,'12'), P('curl_db',3,'12')] },
      { label: 'Push Volume', exercises: [P('pushup',10,'15'), P('dips',4,'10'), P('tri_push',3,'15')] },
      { label: 'Squat Volume', exercises: [P('squat_bw',10,'25'), P('lunge_bw',4,'20'), P('calfr_bw',3,'25')] },
      { label: 'Partitioned Sim', exercises: [P('pullup',5,'5'), P('pushup',5,'10'), P('squat_bw',5,'15'), P('burpee',3,'10')] },
    ],
    progression: 'Partition everything: 20 rounds of 5 pull-ups, 10 push-ups, 15 squats. Never train to failure — stop each set with two in the tank.',
    milestones: ['Week 3 — half Murph', 'Week 6 — full volume partitioned', 'Week 8 — Murph'],
  },
  {
    id: 'obstacle_race', name: 'Obstacle Race Prep', cat: 'event', icon: '🧗',
    weeks: 8, days: 4, requires: [],
    blurb: 'Grip, carries, burpees and hills — the four things that break people.',
    goal: 'Finish an obstacle race strong',
    sessions: [
      { label: 'Grip + Pull', exercises: [P('pullup',4,'6-10'), P('farmer',5,'45s'), P('inverted_row',3,'12'), P('wrist_curl',3,'15')] },
      { label: 'Carry + Legs', exercises: [P('stepup',4,'15'), P('lunge_db',3,'16'), P('kb_swing',4,'20'), P('calfr_bw',3,'25')] },
      { label: 'Conditioning', exercises: [P('burpee',6,'12'), P('mtn_climber',4,'40s'), P('jump_sq',4,'12'), P('plank',3,'60s')] },
      { label: 'Full Body', exercises: [P('squat_bw',4,'25'), P('pushup',4,'20'), P('row_db',3,'12'), P('hollow',3,'30s')] },
    ],
    progression: 'Burpees are the tax on every failed obstacle — get comfortable doing 30 in a row. Train grip after running, when it is already tired.',
    milestones: ['Week 2 — 30 unbroken burpees', 'Week 5 — 60s heavy carry after cardio', 'Week 8 — race ready'],
  },
  {
    id: 'ruck_prep', name: 'Ruck March Prep', cat: 'event', icon: '🎒',
    weeks: 6, days: 3, requires: [],
    blurb: 'Carry weight a long way without destroying your feet, back or knees.',
    goal: 'A loaded 12-mile march',
    sessions: [
      { label: 'Load Bearing', exercises: [P('farmer',5,'60s'), P('stepup',4,'15'), P('shrug_db',3,'15'), P('plank',3,'60s')] },
      { label: 'Legs', exercises: [P('squat_bb',4,'10'), P('lunge_db',4,'16'), P('calfr_bb',4,'20'), P('legcurl',3,'12')] },
      { label: 'Back + Core', exercises: [P('deadlift',4,'6'), P('row_bb',3,'10'), P('side_plank',3,'45s'), P('deadbug',3,'12')] },
    ],
    progression: 'Add one mile or 5 lbs per week, never both. Break in your boots early and keep cadence high with short steps.',
    milestones: ['Week 2 — 4 miles loaded', 'Week 4 — 8 miles loaded', 'Week 6 — 12 miles'],
  },
  {
    id: 'vertical_jump', name: 'Vertical Jump', cat: 'event', icon: '🏀',
    weeks: 8, days: 3, requires: [],
    blurb: 'Get off the floor faster — strength, then rate of force.',
    goal: '+3–5 inches on your vertical',
    sessions: [
      { label: 'Strength', exercises: [P('squat_bb',5,'5'), P('rdl_bb',3,'8'), P('calfr_bb',4,'12'), P('plank',3,'45s')] },
      { label: 'Plyometric', exercises: [P('boxjump',6,'5'), P('jump_sq',5,'8'), P('lunge_bw',3,'16'), P('hollow',3,'30s')] },
      { label: 'Single Leg', exercises: [P('bss',4,'10'), P('stepup',4,'12'), P('legcurl',3,'12'), P('calfr_bw',4,'25')] },
    ],
    progression: 'Jump when you are fresh, never fatigued — quality reps only, and stop the moment height drops. Land soft and quiet.',
    milestones: ['Week 2 — baseline measured', 'Week 5 — +2 inches', 'Week 8 — retest'],
  },
  {
    id: 'sprint_speed', name: 'Sprint Speed', cat: 'event', icon: '💨',
    weeks: 6, days: 3, requires: [],
    blurb: 'Faster over 40–100m: hamstrings, hips and clean mechanics.',
    goal: 'A faster sprint time',
    sessions: [
      { label: 'Posterior', exercises: [P('rdl_bb',4,'8'), P('nordic_curl',3,'6'), P('hipthrust_bb',4,'10'), P('calfr_bb',3,'15')] },
      { label: 'Power', exercises: [P('jump_sq',5,'6'), P('boxjump',5,'5'), P('bss',3,'10'), P('pallof',3,'12')] },
      { label: 'Core + Hips', exercises: [P('deadbug',4,'12'), P('side_plank',3,'40s'), P('glute_kickback',3,'15'), P('hip_abduction',3,'20')] },
    ],
    progression: 'Sprint on fresh legs before lifting, full recovery between runs. Hamstring strength is the number-one protector against pulls.',
    milestones: ['Week 2 — mechanics filmed', 'Week 4 — nordic negatives clean', 'Week 6 — retest 40m'],
  },
  {
    id: 'boxing_cond', name: 'Boxing Conditioning', cat: 'event', icon: '🥊',
    weeks: 6, days: 4, requires: [],
    blurb: 'Rotational power, shoulder endurance and rounds-long gas tank.',
    goal: 'Last hard rounds without fading',
    sessions: [
      { label: 'Power', exercises: [P('wood_chop',4,'15'), P('kb_swing',5,'20'), P('pushpress',4,'8'), P('russian',3,'20')] },
      { label: 'Shoulders', exercises: [P('lat_raise',5,'20'), P('front_raise',3,'15'), P('ohp_db',3,'12'), P('face_pull',3,'20')] },
      { label: 'Conditioning', exercises: [P('burpee',6,'10'), P('mtn_climber',5,'40s'), P('jump_sq',4,'15')] },
      { label: 'Core + Neck', exercises: [P('plank',4,'60s'), P('side_plank',3,'45s'), P('hollow',3,'40s'), P('shrug_db',3,'15')] },
    ],
    progression: 'Work in 3-minute rounds with 1 minute rest to match the sport. Shoulder endurance beats shoulder strength for keeping hands up.',
    milestones: ['Week 2 — 6 clean rounds', 'Week 4 — 9 rounds', 'Week 6 — 12 rounds'],
  },

  // ── HEALTH (more) ─────────────────────────────────────────────────────────
  {
    id: 'over_50', name: 'Strong Over 50', cat: 'health', icon: '🌟',
    weeks: 8, days: 3, requires: ['dumbbells'],
    blurb: 'Strength, balance and bone density — joint-friendly throughout.',
    goal: 'Stronger and steadier every year',
    sessions: [
      { label: 'Full Body A', exercises: [P('squat_db',3,'10-12'), P('bench_db',3,'10'), P('row_db',3,'12'), P('plank',3,'30s')] },
      { label: 'Balance + Hips', exercises: [P('stepup',3,'12'), P('hipthrust_bw',3,'15'), P('calfr_bw',3,'20'), P('side_plank',3,'25s')] },
      { label: 'Full Body B', exercises: [P('rdl_db',3,'10'), P('ohp_db',3,'10'), P('lat_pull',3,'12'), P('deadbug',3,'12')] },
    ],
    progression: 'Leave two reps in reserve on every set. Load progressively but slowly — tendons adapt slower than muscle. Balance work daily.',
    milestones: ['Week 2 — routine established', 'Week 5 — noticeably steadier', 'Week 8 — strength retested'],
  },
  {
    id: 'no_gym', name: 'No Gym, No Excuses', cat: 'health', icon: '🏠',
    weeks: 4, days: 4, requires: [],
    blurb: 'Zero equipment, four weeks, full body — done in your living room.',
    goal: 'Stay strong with nothing but the floor',
    sessions: [
      { label: 'Push', exercises: [P('pushup',4,'12-20'), P('pike_pu',3,'10'), P('diamond_pu',3,'10'), P('plank',3,'45s')] },
      { label: 'Legs', exercises: [P('squat_bw',4,'25'), P('lunge_bw',4,'20'), P('hipthrust_bw',3,'20'), P('calfr_bw',4,'25')] },
      { label: 'Pull + Core', exercises: [P('inverted_row',4,'10'), P('hollow',3,'30s'), P('v_up',3,'15'), P('side_plank',3,'30s')] },
      { label: 'Conditioning', exercises: [P('burpee',5,'12'), P('mtn_climber',4,'40s'), P('jump_sq',4,'15'), P('deadbug',3,'12')] },
    ],
    progression: 'When reps get easy, slow them down — three seconds lowering doubles the difficulty without any equipment.',
    milestones: ['Week 1 — habit started', 'Week 3 — 20 clean push-ups', 'Week 4 — full-body strength held'],
  },
  {
    id: 'hotel_20', name: 'Hotel Room 20', cat: 'health', icon: '🧳',
    weeks: 4, days: 4, requires: [],
    blurb: 'Twenty minutes, no kit, any hotel room — for weeks on the road.',
    goal: 'Never lose a week to travel',
    sessions: [
      { label: 'Quick Push', exercises: [P('pushup',4,'15'), P('pike_pu',3,'10'), P('plank',3,'45s')] },
      { label: 'Quick Legs', exercises: [P('squat_bw',4,'25'), P('lunge_bw',3,'20'), P('calfr_bw',3,'25')] },
      { label: 'Quick Core', exercises: [P('hollow',4,'30s'), P('russian',3,'20'), P('side_plank',3,'30s'), P('deadbug',3,'12')] },
      { label: 'Quick Burn', exercises: [P('burpee',5,'10'), P('mtn_climber',4,'30s'), P('jump_sq',3,'15')] },
    ],
    progression: 'Set a 20-minute timer and move continuously, resting only as needed. Something beats nothing every single time.',
    milestones: ['Week 1 — 4 sessions on the road', 'Week 2 — no missed days', 'Week 4 — travel-proof routine'],
  },
  {
    id: 'knee_friendly', name: 'Knee-Friendly Legs', cat: 'health', icon: '🦵',
    weeks: 6, days: 3, requires: [],
    blurb: 'Build legs without deep loaded knee flexion — for cranky knees.',
    goal: 'Strong legs, quiet knees',
    sessions: [
      { label: 'Hinge', exercises: [P('rdl_db',4,'12'), P('hipthrust_bw',4,'15'), P('legcurl',3,'12-15'), P('calfr_bw',3,'20')] },
      { label: 'Controlled', exercises: [P('legpress',4,'12'), P('leg_ext',3,'15'), P('glute_kickback',3,'15'), P('side_plank',3,'30s')] },
      { label: 'Stability', exercises: [P('stepup',3,'12'), P('hip_abduction',4,'20'), P('deadbug',3,'12'), P('calfr_bw',4,'25')] },
    ],
    progression: 'Stay in pain-free range — partial squats done well beat deep squats done badly. Strengthen the hamstrings and glutes to unload the knee.',
    milestones: ['Week 2 — pain-free sessions', 'Week 4 — added load', 'Week 6 — full pain-free range'],
  },
  {
    id: 'shoulder_health', name: 'Shoulder Health', cat: 'health', icon: '🩹',
    weeks: 6, days: 3, requires: ['resistance_bands'],
    blurb: 'Rotator cuff, scapular control and pain-free overhead reaching.',
    goal: 'Press overhead without pinching',
    sessions: [
      { label: 'Cuff', exercises: [P('face_pull',4,'20'), P('band_pull_apart',4,'20'), P('rear_delt_fly',3,'15'), P('band_lat_raise',3,'15')] },
      { label: 'Scapular', exercises: [P('inverted_row',4,'10'), P('str_pull',3,'15'), P('shrug_db',3,'15'), P('plank',3,'45s')] },
      { label: 'Overhead', exercises: [P('ohp_db',3,'12'), P('lat_raise',3,'15'), P('face_pull',3,'20'), P('band_pull_apart',3,'25')] },
    ],
    progression: 'Light and high-rep — the cuff responds to blood flow, not load. Stop any movement that pinches and lower the range instead.',
    milestones: ['Week 2 — daily band habit', 'Week 4 — pain-free overhead', 'Week 6 — loaded pressing restored'],
  },
];

export const getProgram = (id) => PROGRAMS.find(p => p.id === id) || null;
export const programsByCategory = (cat) => PROGRAMS.filter(p => p.cat === cat);

// ═══════════════════════════════════════════
//   CHALLENGES — short, daily, tick-off-able. The fun end of training.
//   Each has a fixed number of days and a target that escalates.
// ═══════════════════════════════════════════
export const CHALLENGES = [
  {
    id: 'pushup_30', name: '30-Day Push-Up', icon: '💥', days: 30, exId: 'pushup',
    blurb: 'Every day, one set to near-failure. Watch the number climb.',
    unit: 'reps', target: (d) => 10 + Math.floor(d * 1.6),
    reward: 'Iron Chest',
  },
  {
    id: 'plank_ladder', name: 'Plank Ladder', icon: '🪜', days: 21, exId: 'plank',
    blurb: 'Hold a plank a little longer every single day for three weeks.',
    unit: 'seconds', target: (d) => 30 + d * 5,
    reward: 'Unbreakable Core',
  },
  {
    id: 'squat_century', name: 'Squat Century', icon: '🦵', days: 14, exId: 'squat_bw',
    blurb: 'Build to 100 bodyweight squats in a day. Split them however you like.',
    unit: 'reps', target: (d) => 30 + Math.round(d * 5.4),
    reward: 'Legs of Steel',
  },
  {
    id: 'burpee_blitz', name: 'Burpee Blitz', icon: '🔥', days: 10, exId: 'burpee',
    blurb: 'Ten days, ten more burpees each day. Brutal and brief.',
    unit: 'reps', target: (d) => 10 + d * 5,
    reward: 'Furnace Lungs',
  },
  {
    id: 'pullup_grind', name: 'Pull-Up Grind', icon: '🎯', days: 21, exId: 'pullup',
    blurb: 'Greasing the groove — daily submaximal pull-up volume.',
    unit: 'reps', target: (d) => 5 + Math.floor(d * 0.9),
    reward: 'Bar Master',
  },
  {
    id: 'hollow_hold', name: 'Hollow Hold', icon: '🧊', days: 14, exId: 'hollow',
    blurb: 'The hardest 60 seconds in calisthenics, built one day at a time.',
    unit: 'seconds', target: (d) => 20 + Math.round(d * 2.9),
    reward: 'Iron Midsection',
  },
  {
    id: 'walk_streak', name: 'Daily Movement', icon: '🚶', days: 30, exId: null,
    blurb: 'Move every day — a walk, a session, anything. Just do not break it.',
    unit: 'days moved', target: () => 1,
    reward: 'Consistency Forged',
  },
  {
    id: 'carry_week', name: "Farmer's Week", icon: '🤝', days: 7, exId: 'farmer',
    blurb: 'Heavy carries daily. Your grip will hate you, then thank you.',
    unit: 'seconds', target: (d) => 30 + d * 10,
    reward: 'Vice Grip',
  },
  {
    id: 'dip_dive', name: 'Dip Dive', icon: '⬇', days: 14, exId: 'dips',
    blurb: 'Daily dips, climbing steadily. Triceps and chest, no equipment fuss.',
    unit: 'reps', target: (d) => 5 + Math.round(d * 1.9),
    reward: 'Locked Out',
  },
  {
    id: 'lunge_march', name: 'Lunge March', icon: '🚶', days: 21, exId: 'lunge_bw',
    blurb: 'Walking lunges every day — legs and balance, one step at a time.',
    unit: 'reps', target: (d) => 20 + d * 2,
    reward: 'Ironclad Legs',
  },
  {
    id: 'row_streak', name: 'Row Streak', icon: '🚣', days: 14, exId: 'inverted_row',
    blurb: 'Daily rows to balance out all that pressing. Your posture will thank you.',
    unit: 'reps', target: (d) => 12 + Math.round(d * 1.7),
    reward: 'Balanced Frame',
  },
  {
    id: 'calf_climb', name: 'Calf Climb', icon: '🐮', days: 21, exId: 'calfr_bw',
    blurb: 'The muscle everyone skips, trained every single day for three weeks.',
    unit: 'reps', target: (d) => 25 + d * 3,
    reward: 'No Skipped Days',
  },
  {
    id: 'core_28', name: 'Core 28', icon: '⚙', days: 28, exId: 'crunch',
    blurb: 'Four weeks of daily core work. Small doses, big compound effect.',
    unit: 'reps', target: (d) => 20 + Math.round(d * 2.1),
    reward: 'Solid Middle',
  },
  {
    id: 'kb_swing_14', name: 'Swing Fortnight', icon: '🔔', days: 14, exId: 'kb_swing',
    blurb: 'Kettlebell swings daily — the most efficient posterior-chain hit there is.',
    unit: 'reps', target: (d) => 30 + Math.round(d * 5.4),
    reward: 'Hip Engine',
  },
  {
    id: 'mountain_10', name: 'Mountain Ten', icon: '⛰', days: 10, exId: 'mtn_climber',
    blurb: 'Ten days of mountain climbers. Short, sharp, and it will find your lungs.',
    unit: 'seconds', target: (d) => 30 + d * 8,
    reward: 'Engine Built',
  },
  {
    id: 'side_plank_14', name: 'Side Plank Duel', icon: '📐', days: 14, exId: 'side_plank',
    blurb: 'Both sides, every day. The obliques nobody trains until their back hurts.',
    unit: 'seconds per side', target: (d) => 20 + Math.round(d * 2.7),
    reward: 'Armoured Obliques',
  },
  {
    id: 'stretch_21', name: 'Daily Mobility', icon: '🧘', days: 21, exId: null,
    blurb: 'Five minutes of stretching a day. The least glamorous habit that changes most.',
    unit: 'session', target: () => 1,
    reward: 'Freed Up',
  },
  {
    id: 'wall_sit_14', name: 'Wall Sit Wager', icon: '🧱', days: 14, exId: 'wg_wall_sit',
    blurb: 'One wall sit a day, longer each time. Simple, and it burns.',
    unit: 'seconds', target: (d) => 30 + Math.round(d * 4.6),
    reward: 'Quads of Stone',
  },
];

export const getChallenge = (id) => CHALLENGES.find(c => c.id === id) || null;
