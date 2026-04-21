import { state, setPhase, setWeek, logWorkout, clearLog, resetAll, updateProfile } from '../store.js';
import { GOAL_OPTIONS, LEVEL_OPTIONS, PHASE_NAMES, PHASE_DESCS } from '../data/exercises.js';
import { calcBMR, calcTDEE, calcMacros, ACTIVITY_MULTIPLIERS } from '../engine/bmr.js';
import { renderCardioLog, scheduleCardioCharts } from './cardio-log.js';
import { initStrengthChart, initVolumeChart } from './charts.js';

// ── HELPERS ──
const goalLabel  = id => GOAL_OPTIONS.find(g => g.id === id)?.label || id;
const levelLabel = id => LEVEL_OPTIONS.find(l => l.id === id)?.label || id;
function phaseKey(n) { return `phase${n}`; }

// ── DASHBOARD ──
export function renderDashboard() {
  const { profile, program, currentPhase, currentWeek, workoutLog, sessions, streak } = state;
  if (!profile || !program) return '<div style="padding:40px"><p class="dim">No program found. Start onboarding.</p></div>';

  const today       = new Date();
  const dayName     = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][today.getDay()];
  const todaySchedule = program.splitDays.find(d => d.day === dayName);
  const recentLogs  = workoutLog.slice(0, 5);
  const totalSessions = workoutLog.length;
  const pct = Math.round((currentWeek / program.totalWeeks) * 100);

  return `
<div class="page-header">
  <div class="label" style="margin-bottom:6px">Dashboard</div>
  <h1 class="display page-title">${profile.name.toUpperCase()}</h1>
  <div class="page-sub">${goalLabel(profile.goal)} · ${levelLabel(profile.level)} · Week ${currentWeek} of ${program.totalWeeks}</div>
</div>

<!-- TODAY CARD -->
<div class="g2 mb24" style="margin-bottom:24px">
  <div class="card card-fire">
    <div class="label mb16" style="margin-bottom:12px">Today · ${dayName}</div>
    ${todaySchedule ? `
      <div style="display:flex;align-items:center;gap:14px">
        <div style="font-size:40px">${todaySchedule.type === 'strength' ? '⚡' : todaySchedule.type === 'cardio' ? '🏃' : '🧘'}</div>
        <div>
          <div class="display" style="font-size:30px">${todaySchedule.label.toUpperCase()}</div>
          <div class="dim fs13 mt8">${todaySchedule.type === 'strength' ? 'Strength session' : todaySchedule.type === 'cardio' ? 'Cardio session' : 'Rest & recover'}</div>
        </div>
      </div>
    ` : '<div class="dim">Rest day — recover well.</div>'}
    <div style="margin-top:20px;display:flex;gap:10px">
      <button class="btn btn-fire w100" onclick="navigate('workout')">Open Workout →</button>
    </div>
  </div>

  <div class="card">
    <div class="label mb16" style="margin-bottom:12px">Program Progress</div>
    <div style="font-family:var(--ff-display);font-size:56px;line-height:1;color:var(--fire)">${pct}%</div>
    <div class="dim fs13 mt8">Week ${currentWeek} of ${program.totalWeeks}</div>
    <div class="pbar-wrap" style="margin-top:12px">
      <div class="pbar pbar-fire" style="width:${pct}%"></div>
    </div>
    <div style="margin-top:16px;display:flex;justify-content:space-between">
      <div>
        <div class="label">Phase</div>
        <div class="mono fs12 mt8" style="margin-top:4px;color:var(--fire)">${PHASE_NAMES[currentPhase-1]}</div>
      </div>
      <div style="text-align:right">
        <div class="label">Streak</div>
        <div class="mono fs12 mt8" style="margin-top:4px;color:var(--forge-green)">${streak.current} 🔥</div>
      </div>
      <div style="text-align:right">
        <div class="label">Sessions</div>
        <div class="mono fs12 mt8" style="margin-top:4px">${totalSessions}</div>
      </div>
    </div>
  </div>
</div>

<!-- QUICK STATS ROW -->
<div class="g4 mb24" style="margin-bottom:24px">
  <div class="stat s-fire" style="cursor:pointer" onclick="navigate('log')">
    <div class="label">Sessions</div>
    <div class="display" style="font-size:28px;margin-top:6px">${totalSessions}</div>
  </div>
  <div class="stat s-green" style="cursor:pointer" onclick="navigate('achievements')">
    <div class="label">Streak</div>
    <div class="display" style="font-size:28px;margin-top:6px">${streak.current}d</div>
  </div>
  <div class="stat s-steel" style="cursor:pointer" onclick="navigate('body')">
    <div class="label">PRs</div>
    <div class="display" style="font-size:28px;margin-top:6px">${Object.keys(state.prs).length}</div>
  </div>
  <div class="stat s-ember" style="cursor:pointer" onclick="navigate('nutrition')">
    <div class="label">Today kcal</div>
    <div class="display" style="font-size:28px;margin-top:6px">${state.nutritionLog.find(d => d.date === new Date().toISOString().slice(0,10))?.calories || 0}</div>
  </div>
</div>

<!-- PHASE CARDS -->
<div class="sec-head">Program Phases</div>
<div class="g4 mb24" style="margin-bottom:24px">
  ${PHASE_NAMES.map((name, i) => {
    const n = i + 1;
    const isActive = n === currentPhase;
    const isDone   = n < currentPhase;
    return `
    <div class="stat" style="border-color:${isActive ? 'var(--fire-glow)' : 'var(--border)'};cursor:pointer" onclick="changePhase(${n})">
      <div class="label" style="color:${isActive ? 'var(--fire)' : isDone ? 'var(--forge-green)' : 'var(--text-3)'}">
        ${isDone ? '✓ ' : isActive ? '→ ' : ''}Phase ${n}
      </div>
      <div class="display" style="font-size:22px;margin:6px 0;color:${isActive ? 'var(--text)' : 'var(--text-2)'}">
        ${name.toUpperCase()}
      </div>
      <div class="muted" style="font-size:11px">Weeks ${(n-1)*4+1}–${n*4}</div>
    </div>
    `;
  }).join('')}
</div>

<!-- RECENT LOG -->
<div class="sec-head">Recent Sessions</div>
${recentLogs.length > 0 ? `
  <div class="card">
    ${recentLogs.map(l => {
      const d = new Date(l.date);
      return `
      <div class="log-row">
        <div class="log-dt">${d.toLocaleDateString('en-US',{month:'short',day:'numeric'})}<br>${d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</div>
        <div style="flex:1">
          <div style="font-weight:500;font-size:14px">${l.label}</div>
          <div class="mono muted fs11" style="margin-top:3px">
            Phase ${l.phase} · Week ${l.week}
            ${l.totalVolume ? ` · ${l.totalVolume.toLocaleString()} lbs vol` : ''}
            ${l.duration ? ` · ${l.duration}m` : ''}
          </div>
        </div>
        <span class="tag t-fire">Done</span>
      </div>
      `;
    }).join('')}
  </div>
` : `
  <div class="card tc" style="padding:40px">
    <div style="font-size:36px;margin-bottom:12px">📋</div>
    <div class="dim">No sessions logged yet. Complete your first workout!</div>
  </div>
`}
`;
}

// ── WORKOUT ──
export function renderWorkout() {
  const { profile, program, currentPhase, currentWeek } = state;
  if (!profile || !program) return '<p class="dim">No program found.</p>';

  const today    = new Date();
  const dayName  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][today.getDay()];
  const todaySchedule = program.splitDays.find(d => d.day === dayName);
  const phData   = program.phaseWorkouts?.[phaseKey(currentPhase)];
  const todayWorkout  = phData?.[dayName];
  const phaseDesc = PHASE_DESCS[currentPhase - 1] || '';

  return `
<div class="page-header">
  <div class="label" style="margin-bottom:6px">Today · ${dayName}</div>
  <h1 class="display page-title">${todaySchedule?.label?.toUpperCase() || 'WORKOUT'}</h1>
  <div class="page-sub">Phase ${currentPhase}: ${PHASE_NAMES[currentPhase-1]} · Week ${currentWeek} of ${program.totalWeeks}</div>
</div>

<!-- PHASE + WEEK SELECTORS -->
<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:16px">
  <span class="label" style="align-self:center;margin-right:8px">Phase:</span>
  ${PHASE_NAMES.map((n, i) => `
    <button class="wtab ${i+1 === currentPhase ? 'active' : ''}" onclick="changePhase(${i+1})">${i+1}. ${n}</button>
  `).join('')}
</div>
<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:28px">
  <span class="label" style="align-self:center;margin-right:8px">Week:</span>
  ${Array.from({length:program.totalWeeks},(_,i)=>i+1).map(w => `
    <button class="wtab ${w===currentWeek?'active':''}" onclick="changeWeek(${w})">W${w}</button>
  `).join('')}
</div>

<div class="alert alert-neutral mb24" style="margin-bottom:24px">
  <span>📋</span>
  <span class="fs13">${phaseDesc}</span>
</div>

${todayWorkout ? renderExerciseCard(todayWorkout, todaySchedule, currentPhase, dayName) : renderNonStrengthDay(todaySchedule, program)}

<!-- CARDIO (if applicable) -->
${todaySchedule?.type === 'cardio' && program.cardioPrescriptions?.length ? renderCardioCard(program.cardioPrescriptions, profile.level) : ''}

<!-- LOG BUTTON -->
<div style="margin-top:32px;display:flex;gap:12px;flex-wrap:wrap">
  <button class="btn btn-fire btn-lg" id="log-btn" onclick="logToday('${todaySchedule?.label || dayName}','${todaySchedule?.type || 'rest'}')">
    ✓ Mark Complete
  </button>
  <button class="btn btn-ghost btn-lg" onclick="navigate('log')">View Log</button>
</div>
`;
}

function renderExerciseCard(workout, sched, currentPhase, dayName) {
  if (!workout?.exercises?.length) return '<div class="card tc" style="padding:40px"><div class="dim">No exercises defined for this session.</div></div>';

  // Build JSON for the active workout launcher
  const exercisesJson = JSON.stringify(workout.exercises.map(ex => ({
    id: ex.id, name: ex.name, sets: ex.sets, reps: ex.reps, muscle: ex.muscle,
  }))).replace(/'/g, '&#39;');

  const workoutId    = `${dayName}-phase${currentPhase}`;
  const workoutLabel = workout.label;

  return `
<div class="card">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
    <div style="font-family:var(--ff-display);font-size:26px;font-weight:800">${workout.label.toUpperCase()}</div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <span class="tag t-fire">${workout.exercises.length} exercises</span>
      <span class="tag t-dim">${workout.exercises.reduce((a,e)=>a+parseInt(e.sets||0),0)} sets</span>
      <button class="btn btn-fire btn-sm" onclick='window.startActiveWorkout("${workoutId}", "${workoutLabel}", ${exercisesJson})'>
        ⚡ Start Workout
      </button>
    </div>
  </div>
  <div style="overflow-x:auto">
    <table class="tbl w100">
      <thead>
        <tr>
          <th style="width:36%">Exercise</th>
          <th>Sets</th>
          <th>Reps</th>
          <th>Rest</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        ${workout.exercises.map(ex => `
          <tr>
            <td>
              <div class="ex-name" style="cursor:pointer" onclick="openExDetail('${ex.id}')">
                ${ex.name} <span style="font-size:9px;color:var(--fire);font-family:var(--ff-mono);opacity:0.7">↗</span>
              </div>
              <div class="ex-note">${ex.muscle}</div>
            </td>
            <td><span class="mono fire">${ex.sets}</span></td>
            <td><span class="mono fs12">${ex.reps}</span></td>
            <td><span class="mono muted fs11">${ex.rest}</span></td>
            <td><span class="muted fs11">${ex.note}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
</div>
`;
}

function renderNonStrengthDay(sched, program) {
  if (!sched) return '<div class="card tc" style="padding:48px"><div class="dim fs13">Rest day — prioritize sleep and hydration.</div></div>';
  if (sched.type === 'rest') {
    return `
<div class="card">
  <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
    <div style="font-size:44px">🧘</div>
    <div>
      <div class="display" style="font-size:28px">ACTIVE RECOVERY</div>
      <div class="dim fs13 mt8">Light movement accelerates recovery.</div>
    </div>
  </div>
  <div style="display:flex;flex-direction:column;gap:0">
    ${[
      ['🚶','Light Walk','15–20 min','Blood flow and mental reset'],
      ['🌀','Foam Rolling','10–15 min','Quads, hamstrings, IT band, back'],
      ['🤸','Static Stretching','10–15 min','Hip flexors, hamstrings, chest'],
      ['🚿','Contrast Shower','5 min','30s cold / 1 min hot × 3'],
      ['💧','Hydration','All day','Bodyweight (lbs) ÷ 2 = oz of water'],
    ].map(([ic,act,dur,purp]) => `
      <div style="display:flex;align-items:center;gap:14px;padding:13px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:20px;width:26px;text-align:center">${ic}</span>
        <div style="flex:1"><div style="font-weight:500;font-size:13px">${act}</div><div class="muted fs11 mt8">${purp}</div></div>
        <span class="mono muted fs11">${dur}</span>
      </div>
    `).join('')}
  </div>
</div>`;
  }
  return `
<div class="card tc" style="padding:48px">
  <div style="font-size:44px;margin-bottom:16px">${sched.type === 'cardio' ? '🏃' : '⚽'}</div>
  <div class="display" style="font-size:30px;margin-bottom:8px">${sched.label.toUpperCase()}</div>
  <div class="dim fs13">See your cardio prescription below ↓</div>
  <button class="btn btn-green btn-sm" style="margin-top:16px" onclick="navigate('log');setTimeout(()=>switchLogTab('cardio'),100)">+ Log Cardio →</button>
</div>`;
}

function renderCardioCard(prescriptions, level) {
  return `
<div class="mt24" style="margin-top:24px">
  <div class="sec-head">Cardio Prescription</div>
  <div style="display:flex;flex-direction:column;gap:12px">
    ${prescriptions.map(p => `
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div class="display" style="font-size:20px">${p.type?.toUpperCase() || p.label?.toUpperCase()}</div>
          <span class="tag t-green">${p.frequency || ''}</span>
        </div>
        <div class="dim fs13 mb16" style="margin-bottom:12px">${p.desc}</div>
        <div style="display:flex;gap:20px;flex-wrap:wrap">
          <div><div class="label">Duration</div><div class="mono fs12 mt8" style="margin-top:4px;color:var(--forge-green)">${p.duration}</div></div>
          <div><div class="label">Zone</div><div class="mono fs12 mt8" style="margin-top:4px">${p.zone}</div></div>
          <div><div class="label">HR Range</div><div class="mono fs12 mt8" style="margin-top:4px">${p.hrRange}</div></div>
        </div>
      </div>
    `).join('')}
  </div>
</div>`;
}

// ── SCHEDULE ──
export function renderSchedule() {
  const { profile, program, currentPhase } = state;
  if (!profile || !program) return '<p class="dim">No program found.</p>';

  const today    = new Date();
  const todayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][today.getDay()];
  const phData   = program.phaseWorkouts?.[phaseKey(currentPhase)];

  return `
<div class="page-header">
  <div class="label" style="margin-bottom:6px">Weekly Overview</div>
  <h1 class="display page-title">SCHEDULE</h1>
  <div class="page-sub">Phase ${currentPhase}: ${PHASE_NAMES[currentPhase-1]}</div>
</div>

<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:28px">
  <span class="label" style="align-self:center;margin-right:8px">Phase:</span>
  ${PHASE_NAMES.map((n,i) => `
    <button class="wtab ${i+1===currentPhase?'active':''}" onclick="changePhase(${i+1})">${i+1}. ${n}</button>
  `).join('')}
</div>

<div class="g-auto">
  ${program.splitDays.map(s => {
    const isToday = s.day === todayName;
    const workout = phData?.[s.day];
    const typeTag = {strength:'t-fire', cardio:'t-green', rest:'t-dim'}[s.type] || 't-dim';
    const typeIcon = {strength:'⚡', cardio:'🏃', rest:'🧘'}[s.type] || '📅';
    return `
    <div class="day-card ${isToday ? 'today-card' : ''}">
      <div class="day-head">
        <div>
          <div class="day-name" style="color:${isToday ? 'var(--fire)' : 'var(--text)'}">${s.day.slice(0,3).toUpperCase()}</div>
          ${isToday ? '<div style="font-size:9px;font-family:var(--ff-mono);color:var(--fire);letter-spacing:0.15em">TODAY</div>' : ''}
        </div>
        <span class="tag ${typeTag}">${typeIcon} ${s.type}</span>
      </div>
      <div class="day-body">
        <div style="font-weight:500;font-size:14px;margin-bottom:6px">${s.label}</div>
        ${workout?.exercises?.length ? `
          <div class="label" style="margin-bottom:6px">Exercises</div>
          ${workout.exercises.slice(0,4).map(ex => `
            <div style="display:flex;justify-content:space-between;font-size:12px;padding:5px 0;border-bottom:1px solid var(--border);color:var(--text-2)">
              <span>${ex.name}</span>
              <span class="mono muted" style="font-size:10px">${ex.sets}×${ex.reps}</span>
            </div>
          `).join('')}
          ${workout.exercises.length > 4 ? `<div class="muted mt8" style="font-size:11px;font-family:var(--ff-mono);margin-top:6px">+${workout.exercises.length-4} more</div>` : ''}
        ` : `<div class="muted fs12">${s.type === 'rest' ? 'Rest & mobility' : 'See cardio prescription'}</div>`}
      </div>
    </div>`;
  }).join('')}
</div>
`;
}

// ── PROGRESS ──
export function renderProgress() {
  const { profile, program, sessions, prs } = state;
  if (!profile || !program) return '<p class="dim">No program found.</p>';

  const prKeys = Object.keys(prs);

  setTimeout(() => {
    if (sessions.length >= 2) initVolumeChart('volume-chart', sessions);
    if (prKeys.length > 0) {
      initStrengthChart('strength-chart-1', sessions, prKeys[0]);
    }
  }, 0);

  return `
<div class="page-header">
  <div class="label" style="margin-bottom:6px">Benchmarks</div>
  <h1 class="display page-title">PROGRESS</h1>
  <div class="page-sub">Strength targets relative to bodyweight · ${levelLabel(profile.level)}</div>
</div>

<div class="g4 mb24" style="margin-bottom:24px">
  <div class="stat s-fire"><div class="label">Goal</div><div class="display" style="font-size:22px;margin-top:6px">${goalLabel(profile.goal)}</div></div>
  <div class="stat s-green"><div class="label">Level</div><div class="display" style="font-size:22px;margin-top:6px">${levelLabel(profile.level)}</div></div>
  <div class="stat s-steel"><div class="label">Equipment</div><div class="display" style="font-size:22px;margin-top:6px">${profile.equipment.replace(/_/g,' ')}</div></div>
  <div class="stat s-ember"><div class="label">PRs</div><div class="display" style="font-size:22px;margin-top:6px">${prKeys.length}</div></div>
</div>

${sessions.length >= 2 ? `
<div class="sec-head" style="margin-bottom:12px">Session Volume</div>
<div class="card mb24" style="margin-bottom:24px">
  <div class="chart-wrap" style="height:180px"><canvas id="volume-chart"></canvas></div>
</div>
` : ''}

${prKeys.length > 0 ? `
<div class="sec-head" style="margin-bottom:12px">Strength Trend — ${(state.prs[prKeys[0]] ? (state.prs[prKeys[0]].weight + 'lb ' + prKeys[0].replace(/_/g,' ')) : '')}</div>
<div class="card mb24" style="margin-bottom:24px">
  <div class="chart-wrap" style="height:180px" id="strength-chart-1-wrap"><canvas id="strength-chart-1"></canvas></div>
</div>
` : ''}

<div class="sec-head">Strength Benchmarks</div>
<div class="card mb24" style="margin-bottom:24px;overflow-x:auto">
  <div style="min-width:500px">
    <div style="display:grid;grid-template-columns:1fr 90px 90px 90px 90px 110px;gap:12px;padding:0 0 10px;border-bottom:1px solid var(--border);margin-bottom:4px">
      <div class="label">Lift</div>
      <div class="label tc">Wk 1</div>
      <div class="label tc">Wk 4</div>
      <div class="label tc">Wk 8</div>
      <div class="label tc">Wk 12</div>
      <div class="label tc" style="color:var(--fire)">Goal</div>
    </div>
    ${program.benchmarks.map(b => `
      <div style="display:grid;grid-template-columns:1fr 90px 90px 90px 90px 110px;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);font-size:13px;align-items:center">
        <div style="font-weight:500">${b.lift}</div>
        <div class="mono muted tc fs11">${b.w1}</div>
        <div class="mono muted tc fs11">${b.w4}</div>
        <div class="mono muted tc fs11">${b.w8}</div>
        <div class="mono muted tc fs11">${b.w12}</div>
        <div class="mono fire tc fs12" style="font-weight:600">${b.goal}</div>
      </div>
    `).join('')}
  </div>
</div>

${program.cardioPrescriptions?.length ? `
  <div class="sec-head">Cardio Prescription</div>
  <div class="g-auto mb24" style="margin-bottom:24px">
    ${program.cardioPrescriptions.map(p => `
      <div class="card">
        <div class="label" style="margin-bottom:8px">${p.label || p.type}</div>
        <div class="display" style="font-size:22px;margin-bottom:8px">${(p.type||'').toUpperCase()}</div>
        <div class="dim fs12" style="margin-bottom:12px">${p.desc}</div>
        <div style="display:flex;gap:16px">
          <div><div class="label">Duration</div><div class="mono fs12 mt8" style="margin-top:4px;color:var(--forge-green)">${p.duration}</div></div>
          <div><div class="label">Zone</div><div class="mono fs12 mt8" style="margin-top:4px">${p.zone}</div></div>
        </div>
      </div>
    `).join('')}
  </div>
` : ''}

<div class="sec-head">Program Targets</div>
<div class="card">
  <div style="display:flex;flex-direction:column;gap:12px">
    ${program.targets.map(t => `
      <div style="display:flex;gap:12px;align-items:flex-start">
        <span style="color:var(--fire);margin-top:3px;font-size:12px">◆</span>
        <span class="fs13">${t}</span>
      </div>
    `).join('')}
  </div>
</div>
`;
}

// ── LOG (tabbed: Sessions | Cardio) ──
let activeLogTab = 'sessions';

export function renderLog() {
  const { workoutLog, cardioLog } = state;
  return `
<div class="page-header">
  <div class="label" style="margin-bottom:6px">Activity</div>
  <h1 class="display page-title">LOG</h1>
  <div class="page-sub">${workoutLog.length} strength · ${cardioLog.length} cardio sessions</div>
</div>

<div class="tab-bar mb24" style="margin-bottom:24px">
  <button class="tab-btn ${activeLogTab === 'sessions' ? 'active' : ''}" onclick="switchLogTab('sessions')">Strength Sessions</button>
  <button class="tab-btn ${activeLogTab === 'cardio' ? 'active' : ''}" onclick="switchLogTab('cardio')">Cardio</button>
</div>

<div id="sessions-section" style="display:${activeLogTab === 'sessions' ? 'block' : 'none'}">
  ${renderSessionsTab(workoutLog)}
</div>
<div id="cardio-section" style="display:${activeLogTab === 'cardio' ? 'block' : 'none'}">
  ${renderCardioLog()}
</div>
`;
}

function renderSessionsTab(workoutLog) {
  if (!workoutLog.length) return `
<div class="card tc" style="padding:64px 24px">
  <div style="font-size:48px;margin-bottom:16px">📋</div>
  <div class="display" style="font-size:28px;margin-bottom:8px">NO SESSIONS YET</div>
  <div class="dim" style="margin-bottom:24px">Complete your first workout to start tracking</div>
  <button class="btn btn-fire" onclick="navigate('workout')">Go to Workout →</button>
</div>`;

  return `
<div style="display:flex;justify-content:flex-end;margin-bottom:16px">
  <button class="btn btn-danger btn-sm" onclick="if(confirm('Clear all log entries?')) { clearWorkoutLog(); }">Clear Log</button>
</div>
<div class="card">
  ${workoutLog.map(l => {
    const d = new Date(l.date);
    return `
    <div class="log-row">
      <div class="log-dt">${d.toLocaleDateString('en-US',{month:'short',day:'numeric'})}<br>${d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</div>
      <div style="flex:1">
        <div style="font-weight:500;font-size:14px">${l.label}</div>
        <div class="mono muted fs11" style="margin-top:3px">
          Phase ${l.phase} · Week ${l.week}
          ${l.totalVolume ? ` · ${l.totalVolume.toLocaleString()} lbs` : ''}
          ${l.duration ? ` · ${l.duration}m` : ''}
        </div>
        ${l.notes ? `<div class="dim fs12" style="margin-top:4px">${l.notes}</div>` : ''}
      </div>
      <span class="tag t-fire">Done</span>
    </div>`;
  }).join('')}
</div>`;
}

// ── SETTINGS ──
export function renderSettings() {
  const { profile } = state;

  return `
<div class="page-header">
  <div class="label" style="margin-bottom:6px">Account</div>
  <h1 class="display page-title">SETTINGS</h1>
  <div class="page-sub">Manage your program, profile &amp; data</div>
</div>

<div class="g2 mb24" style="margin-bottom:24px">
  <div class="card">
    <div class="sec-head" style="margin-bottom:16px">Your Profile</div>
    ${profile ? `
      <div style="display:flex;flex-direction:column;gap:10px">
        ${[
          ['Name',       profile.name],
          ['Goal',       goalLabel(profile.goal)],
          ['Level',      levelLabel(profile.level)],
          ['Equipment',  profile.equipment?.replace(/_/g,' ') || '—'],
          ['Days/week',  profile.daysPerWeek],
          ['Bodyweight', profile.weight ? `${profile.weight} lbs` : 'Not set'],
          ['BMR',        profile.bmr  ? `${profile.bmr} kcal/day` : 'Not set'],
          ['TDEE',       profile.tdee ? `${profile.tdee} kcal/day` : 'Not set'],
        ].map(([k,v]) => `
          <div style="display:flex;justify-content:space-between;font-size:13px;padding:8px 0;border-bottom:1px solid var(--border)">
            <span class="muted">${k}</span>
            <span style="font-weight:500">${v}</span>
          </div>
        `).join('')}
      </div>
    ` : '<div class="dim fs13">No profile set</div>'}
  </div>

  <div class="card">
    <div class="sec-head" style="margin-bottom:16px">Actions</div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <button class="btn btn-ghost w100" onclick="navigate('onboard')">↺ Redo Quiz (New Program)</button>
      <button class="btn btn-ghost w100" onclick="navigate('builder')">✏ Manual Builder</button>
      <button class="btn btn-ghost w100" onclick="exportData()">↓ Export Data (JSON)</button>
      <button class="btn btn-ghost w100" onclick="document.getElementById('import-file').click()">↑ Import Data (JSON)</button>
      <input type="file" id="import-file" accept=".json" style="display:none" onchange="importData(event)">
      <button class="btn btn-danger w100" onclick="if(confirm('Reset everything? This cannot be undone.')) { resetProgram(); }">✕ Reset All Data</button>
    </div>
  </div>
</div>

<!-- BMR / NUTRITION TARGETS -->
<div class="card mb24" style="margin-bottom:24px">
  <div class="sec-head" style="margin-bottom:16px">Nutrition Profile (for calorie targets)</div>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:16px">
    <div>
      <label class="label">Height (ft)</label>
      <input type="number" id="pf-ft" class="form-input" placeholder="5" min="3" max="8" value="${profile?.heightFt || ''}" style="width:100%;margin-top:4px;box-sizing:border-box">
    </div>
    <div>
      <label class="label">Height (in)</label>
      <input type="number" id="pf-in" class="form-input" placeholder="10" min="0" max="11" value="${profile?.heightIn || ''}" style="width:100%;margin-top:4px;box-sizing:border-box">
    </div>
    <div>
      <label class="label">Age</label>
      <input type="number" id="pf-age" class="form-input" placeholder="28" min="13" max="100" value="${profile?.age || ''}" style="width:100%;margin-top:4px;box-sizing:border-box">
    </div>
    <div>
      <label class="label">Sex</label>
      <select id="pf-sex" class="form-input" style="width:100%;margin-top:4px">
        <option value="">Select...</option>
        <option value="male"   ${profile?.sex === 'male'   ? 'selected' : ''}>Male</option>
        <option value="female" ${profile?.sex === 'female' ? 'selected' : ''}>Female</option>
      </select>
    </div>
    <div style="grid-column:1/-1">
      <label class="label">Activity Level</label>
      <select id="pf-activity" class="form-input" style="width:100%;margin-top:4px">
        <option value="">Select...</option>
        ${Object.entries(ACTIVITY_MULTIPLIERS).map(([id, a]) => `
          <option value="${id}" ${profile?.activityLevel === id ? 'selected' : ''}>${a.label} — ${a.desc}</option>
        `).join('')}
      </select>
    </div>
  </div>
  <button class="btn btn-fire" onclick="saveBMR()">Calculate &amp; Save BMR/TDEE</button>
  ${profile?.tdee ? `<div class="muted fs12" style="margin-top:8px">Current: BMR ${profile.bmr} kcal · TDEE ${profile.tdee} kcal</div>` : ''}
</div>

<div class="alert alert-neutral">
  <span>ℹ️</span>
  <span class="fs13">All data is stored locally in your browser. Nothing is sent to any server.</span>
</div>
`;
}

// ── GLOBAL HANDLERS ──

window.switchLogTab = (tab) => {
  activeLogTab = tab;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.toLowerCase().includes(tab));
  });
  const sessEl   = document.getElementById('sessions-section');
  const cardioEl = document.getElementById('cardio-section');
  if (sessEl)   sessEl.style.display   = tab === 'sessions' ? 'block' : 'none';
  if (cardioEl) cardioEl.style.display = tab === 'cardio'   ? 'block' : 'none';
  if (tab === 'cardio') scheduleCardioCharts();
};

window.saveBMR = () => {
  const ft       = parseInt(document.getElementById('pf-ft')?.value)       || 0;
  const inches   = parseInt(document.getElementById('pf-in')?.value)       || 0;
  const age      = parseInt(document.getElementById('pf-age')?.value)      || 0;
  const sex      = document.getElementById('pf-sex')?.value;
  const activity = document.getElementById('pf-activity')?.value;

  if (!ft || !age || !sex || !activity) {
    alert('Please fill in height, age, sex, and activity level.');
    return;
  }

  const heightCm = Math.round((ft * 12 + inches) * 2.54);
  const patches  = { heightFt: ft, heightIn: inches, height: heightCm, age, sex, activityLevel: activity };
  const tmpProfile = { ...state.profile, ...patches };
  const bmr  = calcBMR(tmpProfile);
  const tdee = calcTDEE(bmr, activity);
  const macros = state.profile ? calcMacros(tdee, state.profile.goal, state.profile.weight) : null;

  updateProfile({ ...patches, bmr, tdee, ...(macros || {}) });

  const btn = document.querySelector('[onclick="saveBMR()"]');
  if (btn) {
    btn.textContent = `✓ Saved! BMR: ${bmr} · TDEE: ${tdee}`;
    btn.style.background = 'var(--forge-green)';
    btn.style.color = '#0d0d0b';
    setTimeout(() => {
      btn.textContent = 'Calculate & Save BMR/TDEE';
      btn.style.background = '';
      btn.style.color = '';
      const el = document.getElementById('page-settings');
      if (el) el.innerHTML = renderSettings();
    }, 2000);
  }
};

window.exportData = () => {
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `fitness-forge-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

window.importData = (evt) => {
  const file = evt.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!parsed.onboarded) { alert('Invalid backup file.'); return; }
      if (!confirm('This will replace ALL current data. Continue?')) return;
      localStorage.setItem('fitness_forge_v1', JSON.stringify(parsed));
      window.location.reload();
    } catch {
      alert('Could not read file. Make sure it\'s a valid Fitness Forge backup.');
    }
  };
  reader.readAsText(file);
};
