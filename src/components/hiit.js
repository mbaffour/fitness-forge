// ═══════════════════════════════════════════
//   FITNESS FORGE — HIIT Tracker
// ═══════════════════════════════════════════

import { state, save } from '../store.js';

// ── EXERCISE DATABASE ──────────────────────
// gif: primary animated GIF url (onerror falls back to cue card)
// ytId: YouTube video ID embedded via youtube-nocookie.com
const _EXDB_CDN = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';
const HIIT_EX = {
  burpees:        { name:'Burpees',          workSecs:40, restSecs:20, icon:'💥',
    ytId:'dZgVxmf6jkA',
    gif:'https://upload.wikimedia.org/wikipedia/commons/9/9a/Burpees.gif',
    cues:'Squat → plank → push-up → jump. Keep core tight throughout.' },

  mountainClimbers:{ name:'Mountain Climbers',workSecs:40, restSecs:20, icon:'🧗',
    ytId:'nmwgirgXLYM',
    gif:`${_EXDB_CDN}/Mountain%20Climber/0.gif`,
    cues:'Plank. Drive knees to chest alternately. Hips stay low and level.' },

  jumpingJacks:   { name:'Jumping Jacks',    workSecs:45, restSecs:15, icon:'⭐',
    ytId:'c4DAnQ6DtF8',
    gif:'https://upload.wikimedia.org/wikipedia/commons/5/52/Jumpingjacks_wbs.gif',
    cues:'Full arm range. Arms over head each rep. Land softly on balls of feet.' },

  highKnees:      { name:'High Knees',       workSecs:40, restSecs:20, icon:'🏃',
    ytId:'oDdkytliOqE',
    gif:`${_EXDB_CDN}/High%20Knees/0.gif`,
    cues:'Drive knees above hip height. Pump arms. Stay light and quick.' },

  squat:          { name:'Squat Jumps',      workSecs:35, restSecs:25, icon:'🦵',
    ytId:'Azl5tkCzDcc',
    gif:`${_EXDB_CDN}/Jump%20Squat/0.gif`,
    cues:'Squat deep, explode up. Land soft with knees tracking toes.' },

  pushUps:        { name:'Push-Ups',         workSecs:40, restSecs:20, icon:'💪',
    ytId:'IODxDxX7oi4',
    gif:`${_EXDB_CDN}/Push-up/0.gif`,
    cues:'Elbows 45°. Full range. Core braced. Control the descent.' },

  plank:          { name:'Plank Hold',       workSecs:45, restSecs:15, icon:'🏋️',
    ytId:'pSHjTRCQxIw',
    gif:`${_EXDB_CDN}/Plank/0.gif`,
    cues:"Neutral spine. Squeeze glutes. Breathe steadily. Don't let hips sag." },

  jumpingLunges:  { name:'Jump Lunges',      workSecs:35, restSecs:25, icon:'⚡',
    ytId:'G86Rp4nEpEQ',
    gif:`${_EXDB_CDN}/Jump%20Lunge/0.gif`,
    cues:'Switch legs mid-air. Land with 90° knee angles. Use arms for balance.' },

  bicycleCrunches:{ name:'Bicycle Crunches', workSecs:40, restSecs:20, icon:'🔄',
    ytId:'9FGilxCbdz8',
    gif:`${_EXDB_CDN}/Bicycle%20Crunch/0.gif`,
    cues:"Slow and controlled. Elbow to opposite knee. Don't pull your neck." },

  legRaises:      { name:'Leg Raises',       workSecs:40, restSecs:20, icon:'🦵',
    ytId:'l4kQd9eWclE',
    gif:`${_EXDB_CDN}/Leg%20Raise/0.gif`,
    cues:'Lower back pressed flat. Control the descent. Legs stay straight.' },

  supermanHold:   { name:'Superman Hold',    workSecs:30, restSecs:10, icon:'🦸',
    ytId:'z6PJMT2y8GQ',
    gif:`${_EXDB_CDN}/Superman/0.gif`,
    cues:'Lift arms and legs simultaneously. Squeeze glutes and back. Breathe.' },

  inchWorms:      { name:'Inchworms',        workSecs:40, restSecs:20, icon:'🐛',
    ytId:'X0kCQdVr7rE',
    gif:`${_EXDB_CDN}/Inchworm/0.gif`,
    cues:'Walk hands out to plank. Walk feet to hands. Repeat. Keep legs straight.' },

  sprintInPlace:  { name:'Sprint in Place',  workSecs:30, restSecs:30, icon:'🚀',
    ytId:'r8UBvJgQKCQ',
    gif:'https://upload.wikimedia.org/wikipedia/commons/b/b4/High_knees.gif',
    cues:'Max effort. Pump arms hard. Stay on balls of feet. Full speed.' },

  lateralJumps:   { name:'Lateral Jumps',    workSecs:40, restSecs:20, icon:'↔️',
    ytId:'2yFBUg0OaLQ',
    gif:`${_EXDB_CDN}/Lateral%20Bound/0.gif`,
    cues:'Jump side to side over imaginary line. Stay light and quick. Land soft.' },

  deadBugs:       { name:'Dead Bugs',        workSecs:40, restSecs:20, icon:'🐞',
    ytId:'4XLEnwUr1d8',
    gif:`${_EXDB_CDN}/Dead%20Bug/0.gif`,
    cues:'Opposite arm and leg extend slowly. Keep lower back flush to floor.' },

  starJumps:      { name:'Star Jumps',       workSecs:40, restSecs:20, icon:'✨',
    ytId:'f7j7bGQPy9Y',
    gif:'https://upload.wikimedia.org/wikipedia/commons/5/52/Jumpingjacks_wbs.gif',
    cues:'Explode from squat. Arms and legs out in star shape. Land softly and repeat.' },
};

// ── 4-WEEK PROGRAM ─────────────────────────
const HIIT_PROGRAM = [
  { week:1, theme:'Foundation Burn', days:[
    { day:'Monday',    type:'burn',   label:'FULL BURN',     duration:22, exercises:['burpees','mountainClimbers','jumpingJacks','highKnees','squat','pushUps'] },
    { day:'Tuesday',   type:'core',   label:'CORE BLAST',    duration:20, exercises:['plank','bicycleCrunches','legRaises','deadBugs','supermanHold','mountainClimbers'] },
    { day:'Wednesday', type:'rest',   label:'REST',          duration:0,  exercises:[] },
    { day:'Thursday',  type:'cardio', label:'CARDIO',        duration:25, exercises:['highKnees','jumpingJacks','sprintInPlace','lateralJumps','inchWorms','jumpingJacks'] },
    { day:'Friday',    type:'power',  label:'POWER',         duration:22, exercises:['squat','jumpingLunges','burpees','pushUps','starJumps','mountainClimbers'] },
    { day:'Saturday',  type:'core',   label:'CORE & FLEX',   duration:18, exercises:['deadBugs','plank','legRaises','bicycleCrunches','supermanHold'] },
    { day:'Sunday',    type:'rest',   label:'REST',          duration:0,  exercises:[] },
  ]},
  { week:2, theme:'Intensity Up', days:[
    { day:'Monday',    type:'burn',   label:'HIIT BLAST',    duration:25, exercises:['burpees','sprintInPlace','jumpingLunges','highKnees','starJumps','pushUps'] },
    { day:'Tuesday',   type:'core',   label:'ABS FIRE',      duration:20, exercises:['bicycleCrunches','legRaises','deadBugs','mountainClimbers','plank','supermanHold'] },
    { day:'Wednesday', type:'cardio', label:'SPEED DAY',     duration:25, exercises:['sprintInPlace','lateralJumps','highKnees','jumpingJacks','inchWorms','starJumps'] },
    { day:'Thursday',  type:'rest',   label:'REST',          duration:0,  exercises:[] },
    { day:'Friday',    type:'power',  label:'LOWER POWER',   duration:22, exercises:['squat','jumpingLunges','lateralJumps','highKnees','starJumps','squat'] },
    { day:'Saturday',  type:'burn',   label:'FULL BURN',     duration:28, exercises:['burpees','mountainClimbers','pushUps','squat','jumpingJacks','highKnees','legRaises'] },
    { day:'Sunday',    type:'rest',   label:'REST',          duration:0,  exercises:[] },
  ]},
  { week:3, theme:'Pyramid Surge', days:[
    { day:'Monday',    type:'burn',   label:'PYRAMID',       duration:26, exercises:['jumpingJacks','burpees','mountainClimbers','squat','jumpingLunges','starJumps','highKnees'] },
    { day:'Tuesday',   type:'core',   label:'DEEP CORE',     duration:20, exercises:['plank','deadBugs','legRaises','bicycleCrunches','supermanHold'] },
    { day:'Wednesday', type:'cardio', label:'INTERVALS',     duration:25, exercises:['sprintInPlace','inchWorms','lateralJumps','highKnees','jumpingJacks','starJumps'] },
    { day:'Thursday',  type:'power',  label:'POWER',         duration:22, exercises:['squat','pushUps','jumpingLunges','burpees','mountainClimbers'] },
    { day:'Friday',    type:'rest',   label:'REST',          duration:0,  exercises:[] },
    { day:'Saturday',  type:'burn',   label:'WEEKEND BURN',  duration:30, exercises:['burpees','highKnees','pushUps','squat','starJumps','jumpingLunges','mountainClimbers','jumpingJacks'] },
    { day:'Sunday',    type:'core',   label:'RECOVERY CORE', duration:15, exercises:['deadBugs','plank','supermanHold','legRaises'] },
  ]},
  { week:4, theme:'Peak Performance', days:[
    { day:'Monday',    type:'burn',   label:'PEAK BURN',     duration:28, exercises:['burpees','sprintInPlace','jumpingLunges','mountainClimbers','highKnees','starJumps','pushUps'] },
    { day:'Tuesday',   type:'core',   label:'ABS PEAK',      duration:22, exercises:['bicycleCrunches','legRaises','plank','deadBugs','mountainClimbers','supermanHold'] },
    { day:'Wednesday', type:'power',  label:'POWER DAY',     duration:25, exercises:['squat','jumpingLunges','burpees','lateralJumps','starJumps','pushUps'] },
    { day:'Thursday',  type:'rest',   label:'REST',          duration:0,  exercises:[] },
    { day:'Friday',    type:'cardio', label:'SPRINT DAY',    duration:25, exercises:['sprintInPlace','highKnees','lateralJumps','jumpingJacks','inchWorms','starJumps','sprintInPlace'] },
    { day:'Saturday',  type:'burn',   label:'FINAL BOSS',    duration:30, exercises:['burpees','mountainClimbers','squat','jumpingLunges','pushUps','highKnees','bicycleCrunches','starJumps'] },
    { day:'Sunday',    type:'rest',   label:'WELL DONE 🎉',  duration:0,  exercises:[] },
  ]},
];

const TYPE_COLOR = { burn:'var(--fire)', core:'var(--ember)', cardio:'var(--steel)', power:'var(--forge-green)', rest:'var(--text-3)' };

// ── MODULE STATE ──────────────────────────
let _view = 'program';
let _timerInterval = null;
let _timerLeft = 0, _timerTotal = 0, _isResting = false;
let _curExList = [], _curExIdx = 0, _curWk = 0, _curDi = 0;
let _ratings = { energy: 0, effort: 0 };

const wKey = (w, d) => `w${w}d${d}`;
const eKey = (w, d, e) => `w${w}d${d}_${e}`;
const H    = () => state.hiitState;
const cssV = v  => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

// ── MIGRATION ────────────────────────────
function _migrate() {
  try {
    const raw = localStorage.getItem('hiit_v3');
    if (raw && !H().migrated) {
      const d = JSON.parse(raw);
      Object.assign(H(), {
        currentWeek: d.currentWeek || 0,
        completedWorkouts: d.completedWorkouts || {},
        completedExercises: d.completedExercises || {},
        totalMins: d.totalMins || 0,
        streak: d.streak || 0,
        lastWorkoutDate: d.lastWorkoutDate || null,
        logs: d.logs || [],
        migrated: true,
      });
      save();
    }
  } catch {}
}

// ── EXERCISE FREQUENCY ────────────────────
function _exFrequency() {
  const freq = {};
  Object.entries(H().completedExercises).forEach(([key, done]) => {
    if (!done) return;
    const m = key.match(/_(.+)$/);
    if (m) freq[m[1]] = (freq[m[1]] || 0) + 1;
  });
  return freq;
}

// ── EXPORTS ──────────────────────────────
export function renderHIIT() {
  _migrate();
  _ensureModal();
  return _view === 'progress' ? _renderProgress() : _renderProgram();
}

export function scheduleHIITCharts() {
  setTimeout(() => { if (_view === 'progress') _drawSparklines(); }, 0);
}

// ── PROGRAM VIEW ──────────────────────────
function _renderProgram() {
  const h = H();
  const wk = HIIT_PROGRAM[h.currentWeek];
  const todayDow = new Date().getDay();
  const dowMap = { Monday:1, Tuesday:2, Wednesday:3, Thursday:4, Friday:5, Saturday:6, Sunday:0 };
  const totalDone = Object.values(h.completedWorkouts).filter(Boolean).length;
  const totalEx = Object.values(h.completedExercises).filter(Boolean).length;

  return `
<div class="page-header">
  <div class="label" style="margin-bottom:6px">No Equipment · Home · Fat Burn</div>
  <h1 class="display page-title">HIIT</h1>
  <div class="page-sub">4-week rotating program · 20–30 min/day</div>
</div>

<div class="hiit-tabs">
  <button class="hiit-tab active" onclick="hiitSwitchView('program')">Program</button>
  <button class="hiit-tab" onclick="hiitSwitchView('progress')">Progress &amp; Insights</button>
</div>

<div class="hiit-stats-row mb16" style="margin-bottom:16px">
  <div class="hiit-stat"><span class="hiit-stat-v">${h.streak}</span><span class="hiit-stat-k">Streak</span></div>
  <div class="hiit-stat"><span class="hiit-stat-v">${totalDone}</span><span class="hiit-stat-k">Workouts</span></div>
  <div class="hiit-stat"><span class="hiit-stat-v">${h.totalMins}</span><span class="hiit-stat-k">Mins</span></div>
  <div class="hiit-stat"><span class="hiit-stat-v">${Math.round(h.totalMins * 8.5)}</span><span class="hiit-stat-k">~Cals</span></div>
  <div class="hiit-stat"><span class="hiit-stat-v">${totalEx}</span><span class="hiit-stat-k">Exercises</span></div>
</div>

<div class="hiit-week-switcher mb16" style="margin-bottom:16px">
  ${HIIT_PROGRAM.map((w, i) => `
    <button class="hiit-wk-btn ${h.currentWeek === i ? 'active' : ''}" onclick="hiitSwitchWeek(${i})">
      WK ${w.week}: ${w.theme}
    </button>`).join('')}
</div>

<div class="hiit-day-grid mb24" style="margin-bottom:24px">
  ${wk.days.map((day, di) => {
    const key    = wKey(h.currentWeek, di);
    const isDone = !!h.completedWorkouts[key];
    const isToday = h.currentWeek === 0 && dowMap[day.day] === todayDow;
    const isRest  = day.type === 'rest';
    const tc      = TYPE_COLOR[day.type] || 'var(--text-2)';

    const exRows = isRest ? '' : `
      <div class="hiit-ex-list">
        ${day.exercises.map(id => {
          const ex = HIIT_EX[id]; if (!ex) return '';
          const ek   = eKey(h.currentWeek, di, id);
          const done = !!h.completedExercises[ek];
          return `<div class="hiit-ex-item">
            <div class="hiit-ex-chk ${done ? 'on' : ''}" onclick="hiitToggleEx('${ek}',this)" title="Mark complete"></div>
            <div class="hiit-ex-info">
              <div class="hiit-ex-name">${ex.icon} ${ex.name}</div>
              <div class="hiit-ex-meta">${ex.workSecs}s work · ${ex.restSecs}s rest</div>
            </div>
            <button class="hiit-demo-btn" onclick="hiitOpenDemo('${id}')">▶ DEMO</button>
          </div>`;
        }).join('')}
      </div>`;

    const restBody = isRest
      ? `<div class="hiit-rest-body">😴 Recovery Day<br><span class="muted fs11">Stretch, hydrate, sleep well.</span></div>`
      : '';

    const footer = isRest ? '' : `
      <div class="hiit-day-foot">
        <span class="muted fs11">⏱ ${day.duration} min · ${day.exercises.length} exercises</span>
        ${isDone
          ? `<button class="hiit-done-btn" onclick="hiitStartWorkout(${h.currentWeek},${di})" title="Redo">✓ DONE</button>`
          : `<button class="btn btn-fire hiit-start-btn" onclick="hiitStartWorkout(${h.currentWeek},${di})">▶ START</button>`
        }
      </div>`;

    return `<div class="hiit-day-card ${isToday ? 'is-today' : ''} ${isDone ? 'is-done' : ''}">
      <div class="hiit-day-hdr">
        <span class="hiit-day-name">${day.day.toUpperCase()}</span>
        <span class="hiit-type-tag" style="color:${tc};background:${tc}22">${day.label}</span>
      </div>
      ${exRows}${restBody}${footer}
    </div>`;
  }).join('')}
</div>

<div class="card mb24" style="margin-bottom:24px">
  <div class="sec-head" style="margin-bottom:12px">Week ${wk.week} — ${wk.theme}</div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
    ${[
      [wk.days.filter(d => d.type !== 'rest').length, 'Workout Days'],
      [wk.days.filter(d => d.type === 'rest').length, 'Rest Days'],
      [wk.days.filter((d,i) => h.completedWorkouts[wKey(h.currentWeek,i)]).length, 'Done'],
      [wk.days.reduce((s,d) => s+(d.duration||0), 0), 'Total Min'],
    ].map(([v,k]) => `<div class="card" style="text-align:center;padding:10px 8px">
      <div style="font-size:22px;font-weight:700;color:var(--fire);font-family:var(--ff-mono)">${v}</div>
      <div class="label" style="font-size:9px;margin-top:2px">${k}</div>
    </div>`).join('')}
  </div>
</div>

${_renderExerciseGrid()}`;
}

function _renderExerciseGrid() {
  const freq = _exFrequency();
  const totalEx = Object.values(freq).reduce((s, v) => s + v, 0);
  if (!totalEx) return '';
  const sorted = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 16);
  const max = sorted[0]?.[1] || 1;
  return `
<div class="sec-head" style="margin-bottom:12px">Exercise Tracker</div>
<div class="card mb24" style="margin-bottom:24px">
  <div class="muted fs11" style="margin-bottom:12px">${totalEx} total reps tracked across all workouts</div>
  <div style="display:flex;flex-direction:column;gap:8px">
    ${sorted.map(([id, count]) => {
      const ex  = HIIT_EX[id]; if (!ex) return '';
      const pct = Math.round((count / max) * 100);
      return `<div>
        <div style="display:flex;justify-content:space-between;margin-bottom:3px;font-size:12px">
          <span>${ex.icon} ${ex.name}</span>
          <span class="mono" style="color:var(--fire)">${count}×</span>
        </div>
        <div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:var(--fire);border-radius:2px;transition:width 0.4s"></div>
        </div>
      </div>`;
    }).join('')}
  </div>
  <button class="btn" style="margin-top:14px;font-size:11px;padding:5px 12px" onclick="hiitSwitchView('exercises')">View All Exercises →</button>
</div>`;
}

// ── EXERCISE LIBRARY VIEW ─────────────────
function _renderExerciseLibrary() {
  const freq = _exFrequency();
  const allIds = Object.keys(HIIT_EX);
  return `
<div class="page-header">
  <div class="label" style="margin-bottom:6px">No Equipment · Home · Fat Burn</div>
  <h1 class="display page-title">HIIT</h1>
  <div class="page-sub">Exercise library &amp; personal stats</div>
</div>

<div class="hiit-tabs">
  <button class="hiit-tab" onclick="hiitSwitchView('program')">Program</button>
  <button class="hiit-tab" onclick="hiitSwitchView('progress')">Progress &amp; Insights</button>
  <button class="hiit-tab active" onclick="hiitSwitchView('exercises')">Exercise Library</button>
</div>

<div class="sec-head" style="margin-bottom:12px">All Exercises (${allIds.length})</div>
<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;margin-bottom:24px">
  ${allIds.map(id => {
    const ex    = HIIT_EX[id];
    const count = freq[id] || 0;
    return `<div class="card hiit-ex-card" style="cursor:pointer;transition:border-color 0.2s" onclick="hiitOpenDemo('${id}')">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <div style="font-size:28px;line-height:1">${ex.icon}</div>
        <div>
          <div style="font-weight:600;font-size:13px">${ex.name}</div>
          <div class="muted fs11">${ex.workSecs}s work · ${ex.restSecs}s rest</div>
        </div>
        ${count ? `<span class="hiit-freq-badge">${count}×</span>` : ''}
      </div>
      <div style="font-size:11px;color:var(--text-2);line-height:1.5">${ex.cues}</div>
      <div style="margin-top:10px;display:flex;gap:6px">
        <button class="btn" style="font-size:10px;padding:4px 10px;flex:1" onclick="event.stopPropagation();hiitOpenDemo('${id}')">▶ VIDEO DEMO</button>
      </div>
    </div>`;
  }).join('')}
</div>`;
}

// ── PROGRESS VIEW ─────────────────────────
function _renderProgress() {
  const h     = H();
  const today = new Date().toISOString().split('T')[0];
  const freq  = _exFrequency();
  const topEx = Object.entries(freq).sort((a,b) => b[1]-a[1]).slice(0,5);
  return `
<div class="page-header">
  <div class="label" style="margin-bottom:6px">No Equipment · Home · Fat Burn</div>
  <h1 class="display page-title">HIIT</h1>
  <div class="page-sub">Session logs &amp; performance insights</div>
</div>

<div class="hiit-tabs">
  <button class="hiit-tab" onclick="hiitSwitchView('program')">Program</button>
  <button class="hiit-tab active" onclick="hiitSwitchView('progress')">Progress &amp; Insights</button>
  <button class="hiit-tab" onclick="hiitSwitchView('exercises')">Exercise Library</button>
</div>

<div id="hiit-insight-box" style="margin-bottom:16px">${_buildAIInsight()}</div>

<div class="g2 mb24" style="margin-bottom:24px">
  <div class="card">
    <div class="label mb16" style="margin-bottom:12px">This Week</div>
    ${_buildWeekBarsHTML()}
  </div>
  <div class="card">
    <div class="label mb16" style="margin-bottom:12px">Overall Stats</div>
    ${_buildOverallStats()}
  </div>
  <div class="card">
    <div class="label mb16" style="margin-bottom:12px">Weight Trend</div>
    <div style="height:90px"><canvas id="hiit-weight-chart" style="width:100%;height:90px"></canvas></div>
    <div id="hiit-weight-delta" style="margin-top:6px;font-size:11px;color:var(--text-2)"></div>
  </div>
  <div class="card">
    <div class="label mb16" style="margin-bottom:12px">Energy &amp; Effort</div>
    <div style="height:90px"><canvas id="hiit-energy-chart" style="width:100%;height:90px"></canvas></div>
    <div id="hiit-energy-insight" style="margin-top:6px;font-size:11px;color:var(--text-2)"></div>
  </div>
</div>

${topEx.length ? `
<div class="sec-head" style="margin-bottom:12px">Top Exercises This Program</div>
<div class="card mb24" style="margin-bottom:24px">
  <div style="display:flex;flex-direction:column;gap:8px">
    ${topEx.map(([id, count]) => {
      const ex = HIIT_EX[id]; if (!ex) return '';
      const max = topEx[0][1];
      return `<div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:16px;width:22px">${ex.icon}</span>
        <div style="flex:1">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
            <span>${ex.name}</span>
            <span class="mono" style="color:var(--fire)">${count}×</span>
          </div>
          <div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden">
            <div style="height:100%;width:${Math.round((count/max)*100)}%;background:var(--fire);border-radius:2px"></div>
          </div>
        </div>
      </div>`;
    }).join('')}
  </div>
  <button class="btn" style="margin-top:12px;font-size:11px;padding:5px 12px" onclick="hiitSwitchView('exercises')">Full Exercise Library →</button>
</div>
` : ''}

<div class="sec-head" style="margin-bottom:12px">30-Day Activity</div>
<div class="card mb24" style="margin-bottom:24px">${_buildHeatmap()}</div>

<div class="sec-head" style="margin-bottom:12px">Log Session</div>
<div class="card mb24" style="margin-bottom:24px">
  <div class="food-form-grid">
    <div>
      <label class="label">Date</label>
      <input type="date" id="hiit-log-date" class="form-input" value="${today}" style="width:100%;box-sizing:border-box">
    </div>
    <div>
      <label class="label">Type</label>
      <select id="hiit-log-type" class="form-input" style="width:100%;box-sizing:border-box">
        <option>Full Burn</option><option>Core Blast</option><option>Cardio</option>
        <option>Power</option><option>Custom</option>
      </select>
    </div>
    <div>
      <label class="label">Duration (min)</label>
      <input type="number" id="hiit-log-mins" class="form-input" placeholder="25" min="1" style="width:100%;box-sizing:border-box">
    </div>
    <div>
      <label class="label">Est. Calories</label>
      <input type="number" id="hiit-log-cals" class="form-input" placeholder="auto" style="width:100%;box-sizing:border-box">
    </div>
    <div>
      <label class="label">Weight (lbs/kg)</label>
      <input type="number" id="hiit-log-weight" class="form-input" placeholder="175" step="0.1" style="width:100%;box-sizing:border-box">
    </div>
    <div>
      <label class="label">Energy 1–5</label>
      <div style="display:flex;gap:6px;margin-top:6px" id="hiit-energy-row">
        ${[1,2,3,4,5].map(n => `<button class="hiit-rating-btn" data-type="energy" data-v="${n}" onclick="hiitSetRating('energy',${n})">${n}</button>`).join('')}
      </div>
    </div>
    <div>
      <label class="label">Effort 1–5</label>
      <div style="display:flex;gap:6px;margin-top:6px" id="hiit-effort-row">
        ${[1,2,3,4,5].map(n => `<button class="hiit-rating-btn" data-type="effort" data-v="${n}" onclick="hiitSetRating('effort',${n})">${n}</button>`).join('')}
      </div>
    </div>
    <div style="grid-column:1/-1">
      <label class="label">Notes</label>
      <textarea id="hiit-log-notes" class="form-input" rows="2" placeholder="How did it feel? Any PRs?" style="width:100%;box-sizing:border-box;resize:vertical"></textarea>
    </div>
  </div>
  <button class="btn btn-fire w100" style="margin-top:12px" onclick="hiitSubmitLog()">💾 Save Session</button>
</div>

<div class="sec-head" style="margin-bottom:12px">Session History</div>
<div class="card mb24" style="margin-bottom:24px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
    <span class="muted fs11">${h.logs.length} sessions logged</span>
    ${h.logs.length ? `<button class="btn" style="font-size:11px;padding:4px 10px;color:var(--danger)" onclick="hiitClearLogs()">Clear All</button>` : ''}
  </div>
  ${_buildLogList()}
</div>`;
}

// ── HELPER RENDERERS ──────────────────────
function _buildWeekBarsHTML() {
  const h    = H();
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const today = new Date();
  const data  = Array.from({ length: 7 }, (_, i) => {
    const d  = new Date(today); d.setDate(today.getDate() - 6 + i);
    const ds = d.toISOString().split('T')[0];
    const log = h.logs.find(l => l.date === ds);
    return { day: days[d.getDay()], mins: log ? log.mins : 0 };
  });
  const maxMins = Math.max(...data.map(d => d.mins), 1);
  return `<div style="display:flex;align-items:flex-end;gap:4px;height:60px">
    ${data.map(d => `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
        <div style="font-size:8px;color:var(--text-2);font-family:var(--ff-mono)">${d.mins || ''}</div>
        <div style="width:100%;background:${d.mins ? 'var(--fire)' : 'var(--border)'};height:${Math.max((d.mins/maxMins)*40,d.mins?3:1)}px;border-radius:2px 2px 0 0;opacity:${d.mins?1:0.3}"></div>
        <div style="font-size:9px;color:var(--text-3)">${d.day}</div>
      </div>`).join('')}
  </div>`;
}

function _buildOverallStats() {
  const h    = H();
  const total = Object.values(h.completedWorkouts).filter(Boolean).length + h.logs.length;
  const mins  = h.totalMins + h.logs.reduce((s,l) => s+l.mins, 0);
  const cals  = h.logs.reduce((s,l) => s+l.cals, 0) + Math.round(h.totalMins*8.5);
  const eff   = h.logs.filter(l => l.effort);
  const avg   = eff.length ? (eff.reduce((s,l) => s+l.effort,0)/eff.length).toFixed(1) : '—';
  const exDone = Object.values(h.completedExercises).filter(Boolean).length;
  return `<div style="display:flex;flex-direction:column;gap:6px">
    ${[['Sessions',total],['Total Mins',mins],['~Cals Burned',cals.toLocaleString()],['Exercises Done',exDone],['Avg Effort',avg+'/5'],['Streak 🔥',h.streak+' days']]
      .map(([k,v]) => `<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid var(--border)">
        <span class="muted">${k}</span><span class="mono">${v}</span>
      </div>`).join('')}
  </div>`;
}

function _buildHeatmap() {
  const h    = H();
  const today = new Date();
  const start = new Date(today); start.setDate(today.getDate()-28-today.getDay());
  const cells = Array.from({length:35},(_,i) => {
    const d  = new Date(start); d.setDate(start.getDate()+i);
    const ds = d.toISOString().split('T')[0];
    const log = h.logs.find(l => l.date===ds);
    const w  = log ? (log.mins>=30?'w4':log.mins>=20?'w3':log.mins>=10?'w2':'w1') : 'w0';
    return `<div class="hiit-hm-cell ${w}" title="${ds}${log?': '+log.mins+'min':''}"></div>`;
  });
  return `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:4px">
    ${['S','M','T','W','T','F','S'].map(l => `<div style="font-size:8px;color:var(--text-3);text-align:center;font-family:var(--ff-mono)">${l}</div>`).join('')}
  </div>
  <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px">${cells.join('')}</div>
  <div style="display:flex;gap:6px;align-items:center;margin-top:8px">
    <span style="font-size:10px;color:var(--text-3)">Less</span>
    ${['w0','w1','w2','w3','w4'].map(c=>`<div class="hiit-hm-cell ${c}" style="width:12px;height:12px;border-radius:2px;flex-shrink:0"></div>`).join('')}
    <span style="font-size:10px;color:var(--text-3)">More</span>
  </div>`;
}

function _buildLogList() {
  const h = H();
  if (!h.logs.length) return `<div style="text-align:center;padding:24px;color:var(--text-2);font-size:13px">No sessions logged yet. Complete a workout! 🔥</div>`;
  return h.logs.slice(0,30).map(l => {
    const d = new Date(l.date+'T12:00:00');
    const stars = '★'.repeat(l.effort||0)+'☆'.repeat(5-(l.effort||0));
    return `<div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);align-items:flex-start">
      <div style="text-align:center;width:38px;flex-shrink:0">
        <div style="font-size:20px;font-weight:700;color:var(--fire);line-height:1">${d.getDate()}</div>
        <div style="font-size:9px;color:var(--text-2);letter-spacing:1px">${d.toLocaleString('default',{month:'short'}).toUpperCase()}</div>
      </div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:500;margin-bottom:3px">${l.type}</div>
        <div style="font-size:11px;color:var(--text-2);display:flex;gap:10px;flex-wrap:wrap">
          <span>⏱ ${l.mins} min</span><span>🔥 ~${l.cals} cal</span>
          ${l.weight?`<span>⚖️ ${l.weight}</span>`:''}
          ${l.energy?`<span>⚡ ${l.energy}/5</span>`:''}
          <span style="color:var(--ember)">${stars}</span>
        </div>
        ${l.notes?`<div style="font-size:11px;color:var(--text-2);margin-top:3px;font-style:italic">"${l.notes}"</div>`:''}
      </div>
    </div>`;
  }).join('');
}

function _buildAIInsight() {
  const h = H();
  let msg = '';
  if (!h.logs.length && !Object.keys(h.completedWorkouts).length) {
    msg = "Complete your first workout and log it here to get personalized insights. 💪";
  } else if (h.streak >= 7) {
    msg = `🔥 <strong>${h.streak}-day streak!</strong> Elite consistency. Your body is in fat-burning adaptation mode.`;
  } else if (h.streak >= 3) {
    msg = `Solid momentum — ${h.streak} days straight. You're ${21-h.streak} workouts from locking in the habit.`;
  } else if (h.logs.length >= 3) {
    const avgMins = (h.logs.reduce((s,l)=>s+l.mins,0)/h.logs.length).toFixed(0);
    const effs = h.logs.filter(l=>l.effort);
    const avgEff = effs.length?(effs.reduce((s,l)=>s+l.effort,0)/effs.length).toFixed(1):'?';
    msg = `Averaging <strong>${avgMins} min/session</strong> at effort <strong>${avgEff}/5</strong>. ${parseFloat(avgEff)<3?'Try pushing harder — HIIT works best at 7–8/10 effort.':'Great intensity! Consistency is your next lever.'}`;
  } else {
    msg = `${h.logs.length} session${h.logs.length!==1?'s':''} logged. Keep it up for at least a week to unlock trend insights.`;
  }
  return `<div class="alert alert-fire"><span>💡</span><div>${msg}</div></div>`;
}

// ── WORKOUT MODAL ─────────────────────────
const _MODAL_HTML = `
<div class="hiit-modal-overlay" id="hiit-modal-overlay">
  <div class="hiit-modal">
    <div style="padding:16px 18px 0">
      <div class="label" id="hiit-modal-prog">Exercise 1 / 6</div>
      <div id="hiit-modal-name" style="font-size:22px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:var(--fire);margin-top:4px;line-height:1.1">BURPEES</div>
      <div id="hiit-modal-cue" style="font-size:12px;color:var(--text-2);margin-top:6px;margin-bottom:10px;line-height:1.5"></div>
    </div>
    <div style="display:flex;gap:4px;padding:0 18px">
      <button class="hiit-vtab active" id="hiit-vtab-video" onclick="hiitSetVTab('video')">▶ VIDEO</button>
      <button class="hiit-vtab" id="hiit-vtab-gif" onclick="hiitSetVTab('gif')">🎞 DEMO GIF</button>
      <a id="hiit-yt-link" href="#" target="_blank" rel="noopener" class="hiit-vtab" style="text-decoration:none;margin-left:auto">↗ YouTube</a>
    </div>
    <div class="hiit-media-box" id="hiit-media-box">
      <div style="text-align:center;padding:30px;color:var(--text-2)">🔥 Loading…</div>
    </div>
    <div style="padding:14px 18px 18px;text-align:center">
      <div class="label" id="hiit-t-label">WORK — GO!</div>
      <div id="hiit-t-display" style="font-size:64px;font-weight:700;line-height:1;margin:4px 0;color:var(--ember);font-family:var(--ff-mono)">40</div>
      <div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden;margin:8px 0 14px">
        <div id="hiit-t-bar" style="height:100%;background:var(--fire);border-radius:2px;width:100%;transition:width 0.1s linear"></div>
      </div>
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
        <button class="btn btn-fire" id="hiit-mbtn-start" onclick="hiitModalStart()">START</button>
        <button class="btn" id="hiit-mbtn-skip" onclick="hiitModalSkip()">SKIP →</button>
        <button class="btn" onclick="hiitModalClose()">✕ CLOSE</button>
      </div>
    </div>
  </div>
</div>`;

function _ensureModal() {
  if (document.getElementById('hiit-modal-overlay')) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = _MODAL_HTML;
  document.body.appendChild(wrap.firstElementChild);
  document.getElementById('hiit-modal-overlay').addEventListener('click', e => {
    if (e.target.id === 'hiit-modal-overlay') window.hiitModalClose();
  });
}

function _openWorkoutModal(w, d) {
  _curWk = w; _curDi = d;
  _curExList = HIIT_PROGRAM[w].days[d].exercises.filter(id => HIIT_EX[id]);
  _curExIdx = 0; _isResting = false;
  document.getElementById('hiit-mbtn-start').style.display = '';
  document.getElementById('hiit-mbtn-skip').style.display  = '';
  _loadExInModal(_curExList[0], true);
  document.getElementById('hiit-modal-overlay').classList.add('open');
}

function _openDemoModal(exId) {
  _curExList = [exId]; _curExIdx = 0;
  _curWk = -1; _curDi = -1; _isResting = false;
  document.getElementById('hiit-mbtn-start').style.display = 'none';
  document.getElementById('hiit-mbtn-skip').style.display  = 'none';
  _loadExInModal(exId, false);
  document.getElementById('hiit-modal-overlay').classList.add('open');
}

function _loadExInModal(exId, withTimer) {
  const ex = HIIT_EX[exId]; if (!ex) return;
  _clearTimer(); // clear first, then set up new state
  document.getElementById('hiit-modal-prog').textContent =
    withTimer ? `Exercise ${_curExIdx + 1} / ${_curExList.length}` : 'Exercise Preview';
  document.getElementById('hiit-modal-name').textContent = ex.name.toUpperCase();
  document.getElementById('hiit-modal-cue').textContent  = ex.cues;
  // Update YouTube link
  const ytLink = document.getElementById('hiit-yt-link');
  if (ytLink) ytLink.href = `https://www.youtube.com/watch?v=${ex.ytId}`;
  // Show video tab
  _setVTab('video');
  if (withTimer) {
    _timerLeft = ex.workSecs; _timerTotal = ex.workSecs;
    const btn = document.getElementById('hiit-mbtn-start');
    if (btn) btn.textContent = 'START';
    _updateTimerUI();
  }
}

function _buildExCard(ex) {
  return `<div style="padding:24px 20px;text-align:center;width:100%">
    <div style="font-size:56px;margin-bottom:10px;animation:workout-pulse 1.6s ease-in-out infinite">${ex.icon}</div>
    <div style="font-size:15px;font-weight:700;letter-spacing:0.06em;color:var(--text);text-transform:uppercase;margin-bottom:12px">${ex.name}</div>
    <div style="display:flex;justify-content:center;gap:12px;margin-bottom:14px">
      <div style="background:rgba(255,107,26,0.12);border:1px solid rgba(255,107,26,0.3);border-radius:var(--r-sm);padding:6px 14px">
        <div style="font-size:20px;font-weight:700;color:var(--fire);font-family:var(--ff-mono)">${ex.workSecs}s</div>
        <div style="font-size:9px;color:var(--text-2);letter-spacing:0.1em">WORK</div>
      </div>
      <div style="background:rgba(122,179,200,0.1);border:1px solid rgba(122,179,200,0.25);border-radius:var(--r-sm);padding:6px 14px">
        <div style="font-size:20px;font-weight:700;color:var(--steel);font-family:var(--ff-mono)">${ex.restSecs}s</div>
        <div style="font-size:9px;color:var(--text-2);letter-spacing:0.1em">REST</div>
      </div>
    </div>
    <p style="font-size:12px;color:var(--text-2);line-height:1.6;max-width:310px;margin:0 auto 14px">${ex.cues}</p>
    <a href="https://www.youtube.com/watch?v=${ex.ytId}" target="_blank" rel="noopener"
      class="btn btn-fire" style="text-decoration:none;display:inline-block">▶ Watch on YouTube</a>
  </div>`;
}

function _setVTab(tab) {
  const vBtn = document.getElementById('hiit-vtab-video');
  const gBtn = document.getElementById('hiit-vtab-gif');
  if (vBtn) vBtn.classList.toggle('active', tab === 'video');
  if (gBtn) gBtn.classList.toggle('active', tab === 'gif');
  const exId = _curExList[_curExIdx] || _curExList[0];
  if (!exId) return;
  const ex  = HIIT_EX[exId];
  const box = document.getElementById('hiit-media-box');
  if (!box) return;

  if (tab === 'video') {
    box.innerHTML = `<iframe
      src="https://www.youtube-nocookie.com/embed/${ex.ytId}?rel=0&playsinline=1&modestbranding=1"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen title="${ex.name} tutorial"
      style="width:100%;height:260px;border:none;display:block"
    ></iframe>`;
  } else {
    if (ex.gif) {
      const img = document.createElement('img');
      img.src   = ex.gif;
      img.alt   = ex.name + ' demo';
      img.style.cssText = 'width:100%;max-height:260px;object-fit:contain;display:block;background:var(--bg-2)';
      img.onerror = () => { box.innerHTML = _buildExCard(ex); };
      box.innerHTML = '';
      box.appendChild(img);
    } else {
      box.innerHTML = _buildExCard(ex);
    }
  }
}

function _clearTimer() {
  if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
  window._hiitTimerInterval = null;
}

function _updateTimerUI() {
  const d = document.getElementById('hiit-t-display');
  const b = document.getElementById('hiit-t-bar');
  const l = document.getElementById('hiit-t-label');
  if (!d) return;
  d.textContent = _timerLeft;
  d.style.color = _isResting ? 'var(--steel)' : 'var(--ember)';
  if (l) l.textContent = _isResting ? 'REST — BREATHE' : 'WORK — GO!';
  const pct = (_timerLeft / _timerTotal) * 100;
  if (b) { b.style.width = pct + '%'; b.style.background = _isResting ? 'var(--steel)' : 'var(--fire)'; }
}

function _finishWorkout() {
  _clearTimer();
  if (_curWk >= 0) {
    const h   = H();
    const key = wKey(_curWk, _curDi);
    if (!h.completedWorkouts[key]) {
      h.completedWorkouts[key] = true;
      h.totalMins += HIIT_PROGRAM[_curWk].days[_curDi].duration || 0;
      _updateStreak();
      _confetti();
      setTimeout(() => {
        _showToast('🔥 Workout done! Log your session in Progress tab.');
        window.hiitSwitchView('progress');
      }, 800);
    }
    save();
  }
  _closeModal();
}

function _closeModal() {
  _clearTimer();
  const box = document.getElementById('hiit-media-box');
  if (box) box.innerHTML = '';
  const mo = document.getElementById('hiit-modal-overlay');
  if (mo) mo.classList.remove('open');
  const el = document.getElementById('page-hiit');
  if (el && el.classList.contains('active') && _view === 'program') el.innerHTML = renderHIIT();
}

function _updateStreak() {
  const h     = H();
  const today = new Date().toDateString();
  if (h.lastWorkoutDate === today) return;
  const yest  = new Date(Date.now() - 86400000).toDateString();
  h.streak = h.lastWorkoutDate === yest ? h.streak + 1 : 1;
  h.lastWorkoutDate = today;
}

// ── SPARKLINES ────────────────────────────
function _drawSparklines() {
  const h     = H();
  const wLogs = h.logs.filter(l => l.weight).slice(-14).reverse();
  const eLogs = h.logs.filter(l => l.energy || l.effort).slice(-14).reverse();
  _drawLine('hiit-weight-chart', wLogs.map(l=>l.weight), cssV('--fire')||'#ff6b1a');
  _drawLine('hiit-energy-chart', eLogs.map(l=>l.energy||0), cssV('--steel')||'#7ab3c8', eLogs.map(l=>l.effort||0), cssV('--ember')||'#ffb347');
  const wDelta = document.getElementById('hiit-weight-delta');
  if (wDelta) {
    if (wLogs.length >= 2) {
      const delta = (wLogs[wLogs.length-1].weight - wLogs[0].weight).toFixed(1);
      const sign  = delta > 0 ? '+' : '';
      wDelta.innerHTML = `<span style="color:${delta<0?'var(--forge-green)':delta>0?'var(--danger)':'var(--text-2)'}">${sign}${delta} over ${wLogs.length} entries</span>`;
    } else wDelta.textContent = 'Log weight to track trend';
  }
  const eIns = document.getElementById('hiit-energy-insight');
  if (eIns) {
    if (eLogs.length >= 3) {
      const recent = eLogs.slice(-3).reduce((s,l)=>s+(l.energy||0),0)/3;
      const older  = eLogs.slice(0,3).reduce((s,l)=>s+(l.energy||0),0)/3;
      eIns.textContent = recent>older+0.4?'📈 Energy improving — keep the momentum!'
        :recent<older-0.4?'⚡ Energy dipped — check sleep & hydration.'
        :'✅ Energy levels are steady.';
    } else eIns.textContent = 'Log more sessions for trend data.';
  }
}

function _drawLine(canvasId, data1, c1, data2, c2) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.clientWidth || 240, H2 = 80;
  canvas.width = W; canvas.height = H2;
  ctx.clearRect(0,0,W,H2);
  if (!data1.length) { ctx.fillStyle=cssV('--text-3')||'#5a5545';ctx.font='11px monospace';ctx.fillText('Log data to see chart',8,H2/2);return; }
  function draw(data, color) {
    if (!data||!data.length) return;
    const mn=Math.min(...data)*0.96,mx=Math.max(...data)*1.04,rng=mx-mn||1;
    const xs=data.map((_,i)=>i*(W-20)/(data.length-1||1)+10);
    const ys=data.map(v=>H2-12-((v-mn)/rng)*(H2-24));
    ctx.beginPath();ctx.moveTo(xs[0],H2-4);xs.forEach((x,i)=>ctx.lineTo(x,ys[i]));ctx.lineTo(xs[xs.length-1],H2-4);ctx.closePath();ctx.fillStyle=color+'22';ctx.fill();
    ctx.beginPath();xs.forEach((x,i)=>i===0?ctx.moveTo(x,ys[i]):ctx.lineTo(x,ys[i]));ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();
    xs.forEach((x,i)=>{ctx.beginPath();ctx.arc(x,ys[i],3,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();});
  }
  draw(data1,c1);
  if (data2&&data2.length) draw(data2,c2);
}

// ── CONFETTI & TOAST ─────────────────────
function _confetti() {
  const colors=[cssV('--fire')||'#ff6b1a',cssV('--ember')||'#ffb347',cssV('--forge-green')||'#4dffaa',cssV('--text')||'#f2ede4'];
  for (let i=0;i<48;i++) {
    const el=document.createElement('div');
    el.style.cssText=`position:fixed;width:8px;height:8px;border-radius:2px;pointer-events:none;z-index:9999;left:${Math.random()*100}vw;top:0;background:${colors[Math.floor(Math.random()*colors.length)]};animation:cfall ${0.9+Math.random()*0.9}s ease-in forwards;animation-delay:${Math.random()*0.8}s;transform:rotate(${Math.random()*360}deg)`;
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),2200);
  }
}

function _showToast(msg) {
  let t=document.getElementById('hiit-toast');
  if (!t){t=document.createElement('div');t.id='hiit-toast';t.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(16px);background:var(--fire);color:#0d0d0b;padding:9px 22px;border-radius:var(--r-md);font-weight:600;font-size:12px;opacity:0;transition:all .3s;z-index:9998;pointer-events:none;font-family:var(--ff-mono);letter-spacing:0.06em';document.body.appendChild(t);}
  t.textContent=msg;t.style.opacity='1';t.style.transform='translateX(-50%) translateY(0)';
  setTimeout(()=>{t.style.opacity='0';t.style.transform='translateX(-50%) translateY(16px)';},3200);
}

// ── WINDOW HANDLERS ───────────────────────

window.hiitSwitchView = v => {
  _view = v;
  const el = document.getElementById('page-hiit');
  if (el) { el.innerHTML = renderHIIT(); scheduleHIITCharts(); }
};

window.hiitSwitchWeek = i => {
  H().currentWeek = i;
  save();
  window.hiitSwitchView('program');
};

// FIX: accept element to immediately toggle visual class
window.hiitToggleEx = (ek, el) => {
  const next = !H().completedExercises[ek];
  H().completedExercises[ek] = next;
  save();
  if (el) el.classList.toggle('on', next); // update checkbox visually without full re-render
};

window.hiitStartWorkout = (w, d) => _openWorkoutModal(w, d);
window.hiitOpenDemo     = exId  => _openDemoModal(exId);
window.hiitSetVTab      = tab   => _setVTab(tab);

window.hiitModalStart = () => {
  const btn = document.getElementById('hiit-mbtn-start');
  if (_timerInterval) { _clearTimer(); if (btn) btn.textContent='RESUME'; return; }
  if (btn) btn.textContent = 'PAUSE';
  _timerInterval = setInterval(() => {
    window._hiitTimerInterval = _timerInterval;
    _timerLeft--;
    if (_timerLeft <= 0) {
      if (!_isResting) {
        if (_curWk >= 0) { H().completedExercises[eKey(_curWk,_curDi,_curExList[_curExIdx])]=true; save(); }
        const ex = HIIT_EX[_curExList[_curExIdx]];
        if (ex && ex.restSecs > 0) { _isResting=true;_timerLeft=ex.restSecs;_timerTotal=ex.restSecs;_updateTimerUI();return; }
      }
      _isResting = false;
      _curExIdx++;
      if (_curExIdx >= _curExList.length) { _finishWorkout(); return; }
      _loadExInModal(_curExList[_curExIdx], true);
      if (btn) btn.textContent = 'START';
      return;
    }
    _updateTimerUI();
  }, 1000);
};

window.hiitModalSkip = () => {
  _clearTimer();
  if (_isResting) {
    _isResting = false; _curExIdx++;
    if (_curExIdx >= _curExList.length) { _finishWorkout(); return; }
    _loadExInModal(_curExList[_curExIdx], true);
  } else {
    const ex = HIIT_EX[_curExList[_curExIdx]];
    if (ex && ex.restSecs > 0) { _isResting=true;_timerLeft=ex.restSecs;_timerTotal=ex.restSecs;_updateTimerUI(); }
    else { _curExIdx++; if (_curExIdx>=_curExList.length){_finishWorkout();return;} _loadExInModal(_curExList[_curExIdx],true); }
  }
  const btn = document.getElementById('hiit-mbtn-start');
  if (btn) btn.textContent = 'START';
};

window.hiitModalClose = () => _closeModal();

window.hiitSetRating = (type, val) => {
  _ratings[type] = val;
  const row = document.getElementById(`hiit-${type}-row`);
  if (row) row.querySelectorAll('.hiit-rating-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.v) <= val));
};

window.hiitSubmitLog = () => {
  const date   = document.getElementById('hiit-log-date')?.value;
  const type   = document.getElementById('hiit-log-type')?.value;
  const mins   = parseInt(document.getElementById('hiit-log-mins')?.value)   || 0;
  const cals   = parseInt(document.getElementById('hiit-log-cals')?.value)   || (mins ? Math.round(mins*8.5) : 0);
  const weight = parseFloat(document.getElementById('hiit-log-weight')?.value) || null;
  const notes  = document.getElementById('hiit-log-notes')?.value?.trim()    || '';
  if (!date || !mins) { _showToast('Fill in date and duration.'); return; }
  H().logs.unshift({ date, type, mins, cals, weight, notes, energy:_ratings.energy, effort:_ratings.effort, ts:Date.now() });
  _ratings = { energy:0, effort:0 };
  save();
  _showToast('✅ Session logged!');
  window.hiitSwitchView('progress');
};

window.hiitClearLogs = () => {
  if (!confirm('Clear all HIIT session logs?')) return;
  H().logs = []; save(); window.hiitSwitchView('progress');
};
