// ═══════════════════════════════════════════
//   FITNESS FORGE — Analytics Dashboard
// ═══════════════════════════════════════════

import { state, toDisplayWeight, weightUnitLabel, formatWeight } from '../store.js';
import { MUSCLE_GROUPS, EXERCISES } from '../data/exercises.js';
import { initAnalyticsTrendChart, initWeightTrendChart, toggleChartSeries, initVolumeBarChart, initE1rmChart } from './charts.js';

// ── STRENGTH ANALYTICS (v3.4) ──
const _WEEK_MS = 604800000;
let _mmMode = 'balance';   // muscle-map view: balance | fatigue | strength

function _sessionVolumeLbs(s) {
  let t = 0;
  for (const ex of s.exercises || []) for (const st of ex.sets || [])
    if (st.completed && !st.warmup && st.weight && st.reps) t += st.weight * st.reps * (st.perSide ? 2 : 1);
  return t;
}

function _weeklyVolume(weeks = 8) {
  const now = Date.now();
  const buckets = Array.from({ length: weeks }, () => 0);
  for (const s of state.sessions || []) {
    const idx = weeks - 1 - Math.floor((now - new Date(s.date).getTime()) / _WEEK_MS);
    if (idx >= 0 && idx < weeks) buckets[idx] += _sessionVolumeLbs(s);
  }
  return {
    labels: Array.from({ length: weeks }, (_, i) => i === weeks - 1 ? 'This wk' : `-${weeks - 1 - i}w`),
    data: buckets.map(v => Math.round(toDisplayWeight(v) || 0)),
    hasData: buckets.some(v => v > 0),
  };
}

function _topLift() {
  const freq = {};
  for (const s of state.sessions || []) for (const ex of s.exercises || [])
    if ((ex.sets || []).some(st => st.completed && !st.warmup && st.weight > 0))
      freq[ex.exId] = (freq[ex.exId] || 0) + 1;
  const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : null;
}

function _e1rmSeries(exId) {
  const pts = [];
  const sorted = [...(state.sessions || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
  for (const s of sorted) {
    const ex = s.exercises?.find(e => e.exId === exId);
    if (!ex) continue;
    let best = 0;
    for (const st of ex.sets || []) if (st.completed && !st.warmup && st.weight > 0 && st.reps > 0)
      best = Math.max(best, st.weight * (1 + st.reps / 30));
    if (best > 0) pts.push({ date: s.date, e1rm: Math.round(toDisplayWeight(best) || 0) });
  }
  return pts;
}

function _prTimeline() {
  return Object.entries(state.prs || {})
    .map(([id, pr]) => ({ id, ...pr }))
    .filter(p => p.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 12);
}

function _muscleMap(mode) {
  const vals = {}; MUSCLE_GROUPS.forEach(g => vals[g.id] = 0);
  const now = Date.now();
  for (const s of state.sessions || []) {
    if (mode === 'fatigue' && (now - new Date(s.date).getTime()) > 4 * 86400000) continue;
    for (const ex of s.exercises || []) {
      const groups = EXERCISES[ex.exId]?.groups || [];
      if (!groups.length) continue;
      let m = 0;
      for (const st of ex.sets || []) if (st.completed && !st.warmup && st.weight > 0) {
        if (mode === 'strength') m = Math.max(m, st.weight * (1 + (st.reps || 0) / 30));
        else m += st.weight * (st.reps || 0) * (st.perSide ? 2 : 1);
      }
      groups.forEach(g => { if (vals[g] != null) vals[g] = mode === 'strength' ? Math.max(vals[g], m) : vals[g] + m; });
    }
  }
  const max = Math.max(1, ...Object.values(vals));
  return MUSCLE_GROUPS.map(g => ({ ...g, val: vals[g.id], pct: vals[g.id] / max }));
}

// ── ANATOMICAL MUSCLE MAP (SVG front/back silhouettes) ──
// Each muscle region is tinted by its normalized training value (same data as
// the chip grid). Stylized figure drawn in-house — flat, on-token, no images.
function _bodySVGs(groups) {
  const g = {};
  groups.forEach(x => { g[x.id] = x; });
  // Region fill for a muscle group id: fire intensity over bg-2.
  const F = (id) => {
    const pct = g[id]?.pct || 0;
    return `fill="color-mix(in srgb, var(--fire) ${Math.round(8 + pct * 84)}%, var(--bg-2))" stroke="var(--border-hi)" stroke-width="1" stroke-linejoin="round"`;
  };
  const N = `fill="var(--bg-2)" stroke="var(--border)" stroke-width="1" stroke-linejoin="round"`;   // neutral (head, hands…)
  const T = (id) => `<title>${g[id]?.label || id} — ${Math.round((g[id]?.pct || 0) * 100)}%</title>`;

  // Body-silhouette underlay: torso + limbs drawn first so the muscle regions
  // sit on one connected figure instead of floating parts.
  const UNDERLAY = `
  <path d="M42,52 L108,52 L96,162 L54,162 Z" ${N}/>
  <path d="M28,60 L42,62 L38,144 L28,144 Z" ${N}/>
  <path d="M122,60 L108,62 L112,144 L122,144 Z" ${N}/>
  <path d="M55,158 L74,158 L70,284 L58,284 Z" ${N}/>
  <path d="M95,158 L76,158 L80,284 L92,284 Z" ${N}/>`;

  const front = `
<svg viewBox="0 0 150 300" class="mm-body" role="img" aria-label="Front muscle map">
  ${UNDERLAY}
  <ellipse cx="75" cy="24" rx="13" ry="15" ${N}/>
  <rect x="68" y="37" width="14" height="12" rx="3" ${N}/>
  <path d="M68,48 L46,56 L68,58 Z" ${F('traps')}>${T('traps')}</path>
  <path d="M82,48 L104,56 L82,58 Z" ${F('traps')}>${T('traps')}</path>
  <ellipse cx="40" cy="62" rx="11" ry="10" ${F('shoulders')}>${T('shoulders')}</ellipse>
  <ellipse cx="110" cy="62" rx="11" ry="10" ${F('shoulders')}>${T('shoulders')}</ellipse>
  <path d="M51,58 L73,58 L73,86 Q61,92 51,80 Z" ${F('chest')}>${T('chest')}</path>
  <path d="M99,58 L77,58 L77,86 Q89,92 99,80 Z" ${F('chest')}>${T('chest')}</path>
  <rect x="27" y="72" width="15" height="32" rx="7" ${F('biceps')}>${T('biceps')}</rect>
  <rect x="108" y="72" width="15" height="32" rx="7" ${F('biceps')}>${T('biceps')}</rect>
  <path d="M27,106 L41,106 L38,140 L29,140 Z" ${F('forearms')}>${T('forearms')}</path>
  <path d="M123,106 L109,106 L112,140 L121,140 Z" ${F('forearms')}>${T('forearms')}</path>
  <circle cx="33" cy="147" r="5" ${N}/>
  <circle cx="117" cy="147" r="5" ${N}/>
  <rect x="55" y="89" width="40" height="48" rx="8" ${F('core')}>${T('core')}</rect>
  <path d="M56,139 L94,139 L88,158 L62,158 Z" ${N}/>
  <path d="M57,158 L73,158 L72,224 Q65,231 59,224 Z" ${F('quads')}>${T('quads')}</path>
  <path d="M93,158 L77,158 L78,224 Q85,231 91,224 Z" ${F('quads')}>${T('quads')}</path>
  <path d="M59,234 L71,234 L68,280 L61,280 Z" ${F('calves')}>${T('calves')}</path>
  <path d="M91,234 L79,234 L82,280 L89,280 Z" ${F('calves')}>${T('calves')}</path>
  <rect x="58" y="282" width="13" height="7" rx="3" ${N}/>
  <rect x="79" y="282" width="13" height="7" rx="3" ${N}/>
</svg>`;

  const back = `
<svg viewBox="0 0 150 300" class="mm-body" role="img" aria-label="Back muscle map">
  ${UNDERLAY}
  <ellipse cx="75" cy="24" rx="13" ry="15" ${N}/>
  <rect x="68" y="37" width="14" height="12" rx="3" ${N}/>
  <path d="M46,64 L73,72 L73,132 L55,126 Z" ${F('back')}>${T('back')}</path>
  <path d="M104,64 L77,72 L77,132 L95,126 Z" ${F('back')}>${T('back')}</path>
  <path d="M75,46 L52,58 L75,90 L98,58 Z" ${F('traps')}>${T('traps')}</path>
  <ellipse cx="40" cy="62" rx="11" ry="10" ${F('shoulders')}>${T('shoulders')}</ellipse>
  <ellipse cx="110" cy="62" rx="11" ry="10" ${F('shoulders')}>${T('shoulders')}</ellipse>
  <rect x="27" y="72" width="15" height="32" rx="7" ${F('triceps')}>${T('triceps')}</rect>
  <rect x="108" y="72" width="15" height="32" rx="7" ${F('triceps')}>${T('triceps')}</rect>
  <path d="M27,106 L41,106 L38,140 L29,140 Z" ${F('forearms')}>${T('forearms')}</path>
  <path d="M123,106 L109,106 L112,140 L121,140 Z" ${F('forearms')}>${T('forearms')}</path>
  <circle cx="33" cy="147" r="5" ${N}/>
  <circle cx="117" cy="147" r="5" ${N}/>
  <rect x="60" y="118" width="30" height="20" rx="5" ${N}/>
  <ellipse cx="64" cy="152" rx="12" ry="13" ${F('glutes')}>${T('glutes')}</ellipse>
  <ellipse cx="86" cy="152" rx="12" ry="13" ${F('glutes')}>${T('glutes')}</ellipse>
  <path d="M56,168 L72,168 L71,226 Q64,233 58,226 Z" ${F('hamstrings')}>${T('hamstrings')}</path>
  <path d="M94,168 L78,168 L79,226 Q86,233 92,226 Z" ${F('hamstrings')}>${T('hamstrings')}</path>
  <ellipse cx="64" cy="254" rx="8" ry="22" ${F('calves')}>${T('calves')}</ellipse>
  <ellipse cx="86" cy="254" rx="8" ry="22" ${F('calves')}>${T('calves')}</ellipse>
  <rect x="58" y="282" width="13" height="7" rx="3" ${N}/>
  <rect x="79" y="282" width="13" height="7" rx="3" ${N}/>
</svg>`;

  return `
<div class="mm-body-wrap">
  <div class="mm-body-col">${front}<div class="label tc mt-2">Front</div></div>
  <div class="mm-body-col">${back}<div class="label tc mt-2">Back</div></div>
</div>`;
}

function _muscleMapHTML() {
  const data = _muscleMap(_mmMode);
  const cells = data.map(g => `
    <div class="mm-cell" title="${g.label}" style="--chip:${g.color};--fill:${g.pct.toFixed(3)}">
      <span class="mm-ic">${g.icon}</span>
      <span class="mm-name">${g.label}</span>
      <span class="mm-bar"><i style="width:${Math.round(g.pct * 100)}%"></i></span>
    </div>`).join('');
  const modes = [['balance', 'Balance'], ['fatigue', 'Fatigue'], ['strength', 'Strength']];
  return `
  <div class="seg" style="margin-bottom:12px">
    ${modes.map(([id, lbl]) => `<button class="seg-btn ${_mmMode === id ? 'active' : ''}" onclick="setMuscleMapMode('${id}')">${lbl}</button>`).join('')}
  </div>
  ${_bodySVGs(data)}
  <div class="mm-grid" style="margin-top:16px">${cells}</div>
  <div class="dim fs11" style="margin-top:10px">${_mmMode === 'balance' ? 'Total training volume per muscle group.' : _mmMode === 'fatigue' ? 'Volume in the last 4 days — high = recently hammered.' : 'Best estimated 1RM reached per group.'}</div>`;
}

function _strengthSectionHTML() {
  const hasSessions = (state.sessions || []).length > 0;
  if (!hasSessions) {
    return `
<div class="sec-head" style="margin-bottom:12px">Strength</div>
<div class="card tc p-6"><div style="font-size:40px;margin-bottom:12px">🏋</div>
  <div class="dim fs13">Log a workout to unlock volume trends, 1RM progression, PR history and your muscle map.</div>
  <div class="mt-4"><button class="btn btn-fire" onclick="navigate('workout')">Start a Workout →</button></div></div>`;
  }
  const unit = weightUnitLabel();
  const vol = _weeklyVolume();
  const topLift = _topLift();
  const topName = topLift ? (EXERCISES[topLift]?.name || topLift) : '';
  const prs = _prTimeline();
  return `
<div class="sec-head" style="margin-bottom:12px">Weekly Training Volume (${unit})</div>
<div class="card mb24" style="margin-bottom:24px">
  <div class="chart-wrap" style="height:180px"><canvas id="strength-volume-chart"></canvas></div>
</div>

${topLift ? `
<div class="sec-head" style="margin-bottom:12px">Estimated 1RM — ${topName}</div>
<div class="card mb24" style="margin-bottom:24px">
  <div class="chart-wrap" style="height:180px"><canvas id="strength-e1rm-chart"></canvas></div>
</div>` : ''}

<div class="sec-head" style="margin-bottom:12px">Muscle Map</div>
<div class="card mb24" style="margin-bottom:24px" id="muscle-map-card">${_muscleMapHTML()}</div>

<div class="sec-head" style="margin-bottom:12px">Personal Record Timeline</div>
${prs.length ? `<div class="card mb24" style="margin-bottom:24px"><div class="pr-timeline">
  ${prs.map(p => `
    <div class="pr-tl-row">
      <span class="pr-tl-dot"></span>
      <div class="pr-tl-body">
        <div class="pr-tl-name">${(EXERCISES[p.id]?.name || p.id.replace(/_/g,' '))}</div>
        <div class="pr-tl-meta">${formatWeight(p.weight)} × ${p.reps} · est. 1RM ${formatWeight(p.e1rm)}</div>
      </div>
      <div class="pr-tl-date">${new Date(p.date).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</div>
    </div>`).join('')}
</div></div>` : `<div class="card"><div class="dim fs12">No PRs yet — they'll appear here as you hit them.</div></div>`}
`;
}

function _startOfWeek() {
  const now = new Date();
  const d = new Date(now);
  d.setDate(now.getDate() - now.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function _computeWeekReport() {
  const startOfWeek = _startOfWeek();
  const startStr = startOfWeek.toISOString().slice(0, 10);

  // Workouts
  const workoutsCompleted = state.workoutLog.filter(l => l.date >= startStr).length;
  const workoutsPlanned = state.program?.splitDays?.filter(d => d.type !== 'rest').length || 4;

  // Sleep
  const thisWeekSleep = state.sleepLog.filter(e => e.date >= startStr);
  const avgSleepScore = thisWeekSleep.length
    ? Math.round(thisWeekSleep.reduce((a, e) => a + e.score, 0) / thisWeekSleep.length)
    : null;
  const goodNights = thisWeekSleep.filter(e => e.durationHours >= 7).length;

  // Nutrition
  const thisWeekNutrition = state.nutritionLog.filter(d => d.date >= startStr);
  const daysOnTarget = thisWeekNutrition.filter(d => {
    if (!d.target?.calories || !d.calories) return false;
    const r = d.calories / d.target.calories;
    return r >= 0.85 && r <= 1.15;
  }).length;
  const calorieAdherence = thisWeekNutrition.length ? Math.round(daysOnTarget / 7 * 100) : null;

  // Fasting
  const thisWeekFasting = state.fastingLog.filter(e => e.date >= startStr);
  const fastingAdherence = thisWeekFasting.length
    ? Math.round(thisWeekFasting.filter(e => e.completed).length / thisWeekFasting.length * 100)
    : null;

  // Activity
  const activeMinutes = state.activityLog
    .filter(e => e.date >= startStr)
    .reduce((a, e) => a + (e.durationMin || 0), 0);

  // Week Score
  const workoutScore = Math.round(Math.min(workoutsCompleted / workoutsPlanned, 1) * 100);
  const weekScore = Math.round(
    (workoutScore * 0.30) +
    ((avgSleepScore ?? 50) * 0.25) +
    ((calorieAdherence ?? 50) * 0.20) +
    ((fastingAdherence ?? 50) * 0.15) +
    (Math.min(activeMinutes / 150, 1) * 100 * 0.10)
  );

  return {
    workoutsCompleted, workoutsPlanned,
    avgSleepScore, goodNights,
    calorieAdherence, daysOnTarget,
    fastingAdherence, activeMinutes,
    weekScore,
  };
}

function _scoreColor(score) {
  if (score >= 80) return 'var(--forge-green)';
  if (score >= 60) return 'var(--ember)';
  return 'var(--fire)';
}

function _renderGoalRing(label, current, total, color) {
  const pct = total > 0 ? Math.min(current / total, 1) : 0;
  const r = 36;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  return `
<div class="goal-ring-wrap">
  <svg width="90" height="90" viewBox="0 0 90 90">
    <circle cx="45" cy="45" r="${r}" fill="none" stroke="var(--border)" stroke-width="8"/>
    <circle cx="45" cy="45" r="${r}" fill="none"
      stroke="${color}" stroke-width="8"
      stroke-dasharray="${circ.toFixed(2)}"
      stroke-dashoffset="${offset.toFixed(2)}"
      stroke-linecap="round"
      transform="rotate(-90 45 45)"/>
    <text x="45" y="50" text-anchor="middle" font-family="'Fira Code',monospace" font-size="12" font-weight="700" fill="var(--text)">${current}/${total}</text>
  </svg>
  <div class="goal-ring-label">${label}</div>
</div>`;
}

function _computeCorrelations() {
  const insights = [];

  // Sleep vs RPE
  if (state.sleepLog.length >= 5 && state.sessions.length >= 5) {
    const sleepByDate = {};
    state.sleepLog.forEach(e => { sleepByDate[e.date] = e.score; });
    const goodSleepSessions = state.sessions.filter(s => sleepByDate[s.date?.slice(0,10)] >= 80);
    const poorSleepSessions = state.sessions.filter(s => sleepByDate[s.date?.slice(0,10)] < 60 && sleepByDate[s.date?.slice(0,10)] != null);
    if (goodSleepSessions.length && poorSleepSessions.length) {
      const goodRPE = goodSleepSessions.reduce((a,s) => a + (s.rpe || 7), 0) / goodSleepSessions.length;
      const poorRPE = poorSleepSessions.reduce((a,s) => a + (s.rpe || 7), 0) / poorSleepSessions.length;
      if (goodRPE > poorRPE + 0.3) {
        insights.push({ icon: '💤', title: 'Sleep boosts performance', desc: `On nights with 8h+ sleep your workout RPE averages ${goodRPE.toFixed(1)} vs ${poorRPE.toFixed(1)} on poor sleep nights.` });
      }
    }
  }

  // Most active day of week
  if (state.activityLog.length >= 7) {
    const DOW_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const byDOW = Array(7).fill(0);
    state.activityLog.forEach(e => {
      const d = new Date(e.date + 'T12:00').getDay();
      byDOW[d] += e.durationMin || 0;
    });
    const maxDOW = byDOW.indexOf(Math.max(...byDOW));
    insights.push({ icon: '📅', title: 'Most active day', desc: `You're most active on ${DOW_NAMES[maxDOW]}s with an average of ${Math.round(byDOW[maxDOW] / Math.max(state.activityLog.length / 7, 1))} min.` });
  }

  // Fasting & nutrition correlation
  if (state.fastingLog.length >= 3 && state.nutritionLog.length >= 3) {
    const completedFastDates = new Set(state.fastingLog.filter(f => f.completed).map(f => f.date));
    const daysAfterFast = state.nutritionLog.filter(d => {
      const prev = new Date(d.date + 'T12:00');
      prev.setDate(prev.getDate() - 1);
      return completedFastDates.has(prev.toISOString().slice(0, 10));
    });
    if (daysAfterFast.length >= 2) {
      const avgAdherence = daysAfterFast.filter(d => {
        const r = d.calories / (d.target?.calories || d.calories);
        return r >= 0.85 && r <= 1.15;
      }).length / daysAfterFast.length * 100;
      if (avgAdherence >= 60) {
        insights.push({ icon: '⏱', title: 'Fasting improves nutrition', desc: `${Math.round(avgAdherence)}% of days following a completed fast hit your calorie target.` });
      }
    }
  }

  if (!insights.length) {
    insights.push({ icon: '📊', title: 'Keep logging to see insights', desc: 'Log at least 5–7 days of sleep, activity, and workouts to unlock personalized correlations.' });
  }

  return insights;
}

function _buildTrendData() {
  const labels = [];
  const sleepScores = [];
  const rpeValues = [];
  const nutritionPcts = [];
  const fastingPcts = [];

  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const dateStr = d.toISOString().slice(0, 10);
    const dt = new Date(d);
    labels.push(`${dt.getMonth()+1}/${dt.getDate()}`);

    const sleepEntry = state.sleepLog.find(e => e.date === dateStr);
    sleepScores.push(sleepEntry ? sleepEntry.score : null);

    const session = state.sessions.find(s => s.date?.slice(0,10) === dateStr);
    rpeValues.push(session?.rpe ? session.rpe * 10 : null);

    const nutDay = state.nutritionLog.find(d2 => d2.date === dateStr);
    if (nutDay && nutDay.target?.calories && nutDay.calories) {
      nutritionPcts.push(Math.min(Math.round(nutDay.calories / nutDay.target.calories * 100), 150));
    } else {
      nutritionPcts.push(null);
    }

    const fastEntry = state.fastingLog.find(f => f.date === dateStr);
    fastingPcts.push(fastEntry ? (fastEntry.completed ? 100 : Math.round(fastEntry.actualHours / fastEntry.plannedHours * 100)) : null);
  }

  return { labels, sleepScores, rpeValues, nutritionPcts, fastingPcts };
}

export function renderAnalytics() {
  const report = _computeWeekReport();
  const correlations = _computeCorrelations();
  const startStr = _startOfWeek().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endStr   = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return `
<div class="page-header">
  <div class="label" style="margin-bottom:6px">Command Center</div>
  <h1 class="display page-title">ANALYTICS</h1>
  <div class="page-sub">Week of ${startStr} – ${endStr}</div>
</div>

<!-- WEEKLY REPORT CARD -->
<div class="sec-head" style="margin-bottom:12px">Weekly Report Card</div>
<div class="card card-fire" style="margin-bottom:24px">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">
    <div>
      <div class="label">OVERALL WEEK SCORE</div>
      <div style="font-family:'Fira Code',monospace;font-size:64px;font-weight:700;line-height:1;color:${_scoreColor(report.weekScore)}">${report.weekScore}</div>
      <div class="muted fs11">${report.weekScore >= 80 ? '🔥 Excellent week!' : report.weekScore >= 60 ? '💪 Solid progress' : '⚡ Room to improve'}</div>
    </div>
    <div class="goal-rings-row" style="flex:1;justify-content:flex-end">
      ${_renderGoalRing('Workouts', report.workoutsCompleted, report.workoutsPlanned, 'var(--fire)')}
      ${_renderGoalRing('Sleep 7h+', report.goodNights, 7, 'var(--steel)')}
      ${_renderGoalRing('On Target', report.daysOnTarget, 7, 'var(--forge-green)')}
      ${_renderGoalRing('Activity', Math.min(report.activeMinutes, 150), 150, 'var(--ember)')}
    </div>
  </div>
  <div class="g3" style="gap:12px">
    <div style="text-align:center;padding:12px;background:var(--bg-3);border-radius:var(--r-md)">
      <div class="label" style="margin-bottom:4px">Workouts</div>
      <div class="mono" style="font-size:20px;color:var(--fire)">${report.workoutsCompleted}<span class="muted fs12">/${report.workoutsPlanned}</span></div>
    </div>
    <div style="text-align:center;padding:12px;background:var(--bg-3);border-radius:var(--r-md)">
      <div class="label" style="margin-bottom:4px">Avg Sleep</div>
      <div class="mono" style="font-size:20px;color:${report.avgSleepScore ? _scoreColor(report.avgSleepScore) : 'var(--text-3)'}">${report.avgSleepScore ?? '—'}<span class="muted fs12">/100</span></div>
    </div>
    <div style="text-align:center;padding:12px;background:var(--bg-3);border-radius:var(--r-md)">
      <div class="label" style="margin-bottom:4px">Nutrition</div>
      <div class="mono" style="font-size:20px;color:${report.calorieAdherence != null ? _scoreColor(report.calorieAdherence) : 'var(--text-3)'}">${report.calorieAdherence != null ? report.calorieAdherence + '%' : '—'}</div>
    </div>
    <div style="text-align:center;padding:12px;background:var(--bg-3);border-radius:var(--r-md)">
      <div class="label" style="margin-bottom:4px">Fasting</div>
      <div class="mono" style="font-size:20px;color:${report.fastingAdherence != null ? _scoreColor(report.fastingAdherence) : 'var(--text-3)'}">${report.fastingAdherence != null ? report.fastingAdherence + '%' : '—'}</div>
    </div>
    <div style="text-align:center;padding:12px;background:var(--bg-3);border-radius:var(--r-md)">
      <div class="label" style="margin-bottom:4px">Active Min</div>
      <div class="mono" style="font-size:20px;color:${report.activeMinutes >= 150 ? 'var(--forge-green)' : 'var(--ember)'}">${report.activeMinutes}<span class="muted fs12">/150</span></div>
    </div>
  </div>
</div>

<!-- 4-IN-1 TREND CHART -->
<div class="sec-head" style="margin-bottom:12px">30-Day Trends</div>
<div class="card mb24" style="margin-bottom:24px">
  <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">
    <button class="btn btn-ghost btn-sm" onclick="toggleAnalyticsSeries(0)" style="font-size:10px">💤 Sleep</button>
    <button class="btn btn-ghost btn-sm" onclick="toggleAnalyticsSeries(1)" style="font-size:10px">⚡ RPE×10</button>
    <button class="btn btn-ghost btn-sm" onclick="toggleAnalyticsSeries(2)" style="font-size:10px">🥗 Nutrition %</button>
    <button class="btn btn-ghost btn-sm" onclick="toggleAnalyticsSeries(3)" style="font-size:10px">⏱ Fasting %</button>
  </div>
  <div class="chart-wrap" style="height:220px"><canvas id="analytics-trend-chart"></canvas></div>
</div>

${state.bodyLog.length >= 2 ? `
<!-- BODY WEIGHT TREND -->
<div class="sec-head" style="margin-bottom:12px">Body Weight Trend</div>
<div class="card mb24" style="margin-bottom:24px">
  <div class="chart-wrap" style="height:180px"><canvas id="analytics-weight-chart"></canvas></div>
</div>
` : ''}

<!-- STRENGTH ANALYTICS -->
${_strengthSectionHTML()}

<!-- CORRELATION INSIGHTS -->
<div class="sec-head" style="margin-bottom:12px">Insights</div>
<div style="display:flex;flex-direction:column;gap:12px;margin-bottom:24px">
  ${correlations.map(c => `
  <div class="card" style="display:flex;align-items:flex-start;gap:14px">
    <span style="font-size:24px;margin-top:2px">${c.icon}</span>
    <div>
      <div style="font-weight:600;font-size:13px;margin-bottom:4px">${c.title}</div>
      <div class="dim fs12" style="line-height:1.6">${c.desc}</div>
    </div>
  </div>`).join('')}
</div>
`;
}

export function scheduleAnalyticsCharts() {
  setTimeout(() => {
    const trendData = _buildTrendData();
    initAnalyticsTrendChart('analytics-trend-chart', trendData);
    if (state.bodyLog.length >= 2) {
      initWeightTrendChart('analytics-weight-chart', state.bodyLog);
    }
    // Strength charts
    if ((state.sessions || []).length) {
      const unit = weightUnitLabel();
      const vol = _weeklyVolume();
      initVolumeBarChart('strength-volume-chart', vol.labels, vol.data, unit);
      const topLift = _topLift();
      if (topLift) initE1rmChart('strength-e1rm-chart', _e1rmSeries(topLift), unit);
    }
  }, 0);
}

// ── GLOBAL HANDLERS ──

window.toggleAnalyticsSeries = (datasetIndex) => {
  toggleChartSeries('analytics-trend-chart', datasetIndex);
};

window.setMuscleMapMode = (mode) => {
  _mmMode = mode;
  const card = document.getElementById('muscle-map-card');
  if (card) card.innerHTML = _muscleMapHTML();
};
