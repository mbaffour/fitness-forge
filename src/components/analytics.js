// ═══════════════════════════════════════════
//   FITNESS FORGE — Analytics Dashboard
// ═══════════════════════════════════════════

import { state } from '../store.js';
import { initAnalyticsTrendChart, initWeightTrendChart, toggleChartSeries } from './charts.js';

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
  }, 0);
}

// ── GLOBAL HANDLERS ──

window.toggleAnalyticsSeries = (datasetIndex) => {
  toggleChartSeries('analytics-trend-chart', datasetIndex);
};
