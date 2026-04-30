// ═══════════════════════════════════════════
//   FITNESS FORGE — Activity Tracker
// ═══════════════════════════════════════════

import { state, addActivityEntry, removeActivityEntry } from '../store.js';
import { initActivityStackedBar } from './charts.js';

const ACTIVITY_TYPES = [
  { id: 'Walking',       icon: '🚶', met: 3.5 },
  { id: 'Running',       icon: '🏃', met: 9.8 },
  { id: 'Cycling',       icon: '🚴', met: 6.8 },
  { id: 'Soccer',        icon: '⚽', met: 7.0 },
  { id: 'Basketball',    icon: '🏀', met: 6.5 },
  { id: 'Swimming',      icon: '🏊', met: 7.0 },
  { id: 'Weightlifting', icon: '🏋️', met: 3.5 },
  { id: 'HIIT',          icon: '⚡', met: 8.0 },
  { id: 'Yoga',          icon: '🧘', met: 2.5 },
  { id: 'Hiking',        icon: '🥾', met: 5.3 },
  { id: 'Tennis',        icon: '🎾', met: 7.3 },
  { id: 'Rowing',        icon: '🚣', met: 7.0 },
  { id: 'Boxing',        icon: '🥊', met: 8.5 },
  { id: 'Dancing',       icon: '💃', met: 5.0 },
  { id: 'Custom',        icon: '🏅', met: 5.0 },
];

const INTENSITY_LEVELS = ['Low','Moderate','High','Max'];
const INTENSITY_MULS   = { Low: 0.8, Moderate: 1.0, High: 1.2, Max: 1.4 };
const MET_VALUES = Object.fromEntries(ACTIVITY_TYPES.map(a => [a.id, a.met]));

function _todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function _previewCalories(type, durationMin, intensity) {
  const weight = state.profile?.weight || 154;
  const wKg = weight * 0.453592;
  const met = MET_VALUES[type] || 5.0;
  const mul = INTENSITY_MULS[intensity] || 1.0;
  return Math.round(met * mul * wKg * (durationMin / 60));
}

function _computeWeeklyStats(activityLog) {
  const sevenDaysAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const recent = activityLog.filter(e => e.date >= sevenDaysAgo);
  return {
    totalMin: recent.reduce((a, e) => a + (e.durationMin || 0), 0),
    sessions: recent.length,
    totalCal: recent.reduce((a, e) => a + (e.calories || 0), 0),
  };
}

function _computePersonalBests(activityLog) {
  const bests = {};
  activityLog.forEach(e => {
    if (!bests[e.type]) bests[e.type] = { longestMin: 0, mostCalories: 0, bestDistance: 0 };
    const b = bests[e.type];
    if ((e.durationMin || 0) > b.longestMin) b.longestMin = e.durationMin;
    if ((e.calories || 0) > b.mostCalories) b.mostCalories = e.calories;
    if ((e.distance || 0) > b.bestDistance) b.bestDistance = e.distance;
  });
  return bests;
}

function _renderHeatmap(activityLog) {
  const dayMap = {};
  activityLog.forEach(e => {
    dayMap[e.date] = (dayMap[e.date] || 0) + (e.durationMin || 0);
  });

  const cells = [];
  for (let i = 34; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    const mins = dayMap[key] || 0;
    const bg = mins === 0 ? 'var(--bg-3)'
      : mins <= 30 ? 'rgba(122,179,200,0.3)'
      : mins <= 60 ? 'rgba(122,179,200,0.7)'
      : 'rgba(255,107,26,0.7)';
    cells.push(`<div class="sleep-cell" style="background:${bg}" title="${key}: ${mins} min"></div>`);
  }

  const DOW = ['S','M','T','W','T','F','S'];
  return `
<div>
  <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:4px">
    ${DOW.map(d => `<div style="font-size:9px;text-align:center;color:var(--text-3);font-family:var(--ff-mono)">${d}</div>`).join('')}
  </div>
  <div class="sleep-heatmap">${cells.join('')}</div>
  <div style="display:flex;gap:12px;margin-top:8px;font-size:10px;font-family:var(--ff-mono)">
    <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:2px;background:rgba(255,107,26,0.7);display:inline-block"></span>60+ min</span>
    <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:2px;background:rgba(122,179,200,0.7);display:inline-block"></span>31-60 min</span>
    <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:2px;background:rgba(122,179,200,0.3);display:inline-block"></span>1-30 min</span>
  </div>
</div>`;
}

function _groupByDate(activityLog) {
  const groups = {};
  activityLog.slice(0, 20).forEach(e => {
    if (!groups[e.date]) groups[e.date] = [];
    groups[e.date].push(e);
  });
  return groups;
}

function _getIcon(type) {
  return ACTIVITY_TYPES.find(a => a.id === type)?.icon || '🏅';
}

export function renderActivity() {
  const { activityLog } = state;
  const today = _todayStr();
  const weekStats = _computeWeeklyStats(activityLog);
  const bests = _computePersonalBests(activityLog);
  const grouped = _groupByDate(activityLog);
  const bestKeys = Object.keys(bests);

  return `
<div class="page-header">
  <div class="label" style="margin-bottom:6px">Lifestyle Activity</div>
  <h1 class="display page-title">ACTIVITY</h1>
  <div class="page-sub">Log any physical activity outside structured training</div>
</div>

<!-- LOG FORM -->
<div class="sec-head" style="margin-bottom:12px">Log Activity</div>
<div class="card" style="margin-bottom:24px">
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:16px">
    <div>
      <label class="label">Activity Type</label>
      <select id="act-type" class="form-input" style="width:100%;margin-top:4px" onchange="updateCalPreview()">
        ${ACTIVITY_TYPES.map(a => `<option value="${a.id}">${a.icon} ${a.id}</option>`).join('')}
      </select>
    </div>
    <div>
      <label class="label">Duration (min)</label>
      <input type="number" id="act-dur" class="form-input" placeholder="30" min="1" style="width:100%;margin-top:4px;box-sizing:border-box" oninput="updateCalPreview()">
    </div>
    <div>
      <label class="label">Intensity</label>
      <select id="act-intensity" class="form-input" style="width:100%;margin-top:4px" onchange="updateCalPreview()">
        ${INTENSITY_LEVELS.map(l => `<option value="${l}" ${l === 'Moderate' ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
    </div>
    <div>
      <label class="label">Date</label>
      <input type="date" id="act-date" class="form-input" value="${today}" style="width:100%;margin-top:4px;box-sizing:border-box">
    </div>
    <div>
      <label class="label">Distance (optional)</label>
      <input type="number" id="act-dist" class="form-input" placeholder="3.1 mi" min="0" step="0.1" style="width:100%;margin-top:4px;box-sizing:border-box">
    </div>
    <div>
      <label class="label">Avg HR bpm (opt.)</label>
      <input type="number" id="act-hr" class="form-input" placeholder="145" min="40" style="width:100%;margin-top:4px;box-sizing:border-box">
    </div>
    <div>
      <label class="label">Calories (opt. override)</label>
      <input type="number" id="act-cal" class="form-input" placeholder="Auto: ~${_previewCalories('Walking', 30, 'Moderate')}" min="0" id="act-cal" style="width:100%;margin-top:4px;box-sizing:border-box">
    </div>
    <div>
      <label class="label">Notes (optional)</label>
      <input type="text" id="act-notes" class="form-input" placeholder="How it went…" style="width:100%;margin-top:4px;box-sizing:border-box">
    </div>
  </div>
  <div style="display:flex;align-items:center;gap:16px">
    <button class="btn btn-fire" onclick="logActivity()">+ Log Activity</button>
    <div class="muted fs12" id="cal-preview"></div>
  </div>
</div>

<!-- WEEKLY SUMMARY -->
<div class="g4 mb24" style="margin-bottom:24px">
  <div class="stat s-fire">
    <div class="label">Active Min (7d)</div>
    <div class="display" style="font-size:24px;margin-top:6px">${weekStats.totalMin}</div>
  </div>
  <div class="stat s-steel">
    <div class="label">Sessions (7d)</div>
    <div class="display" style="font-size:24px;margin-top:6px">${weekStats.sessions}</div>
  </div>
  <div class="stat s-ember">
    <div class="label">Calories (7d)</div>
    <div class="display" style="font-size:24px;margin-top:6px">${weekStats.totalCal}</div>
  </div>
  <div class="stat ${weekStats.totalMin >= 150 ? 's-green' : 's-fire'}">
    <div class="label">WHO Target</div>
    <div class="display" style="font-size:20px;margin-top:6px">${weekStats.totalMin}/150m</div>
  </div>
</div>

${activityLog.length > 0 ? `
<!-- RECENT ACTIVITY -->
<div class="sec-head" style="margin-bottom:12px">Recent Activity</div>
<div class="card" style="margin-bottom:24px">
  ${Object.entries(grouped).map(([date, entries]) => `
  <div style="padding:10px 0;border-bottom:1px solid var(--border)">
    <div class="label" style="margin-bottom:8px;color:var(--text-3)">${date}</div>
    ${entries.map(e => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:20px">${_getIcon(e.type)}</span>
        <div>
          <div style="font-size:13px;font-weight:500">${e.type}</div>
          <div class="muted fs11">${e.durationMin}min · ${e.intensity} · ${e.calories} cal${e.distance ? ' · ' + e.distance + 'mi' : ''}${e.hr ? ' · ' + e.hr + 'bpm' : ''}</div>
        </div>
      </div>
      <button class="btn-remove" onclick="deleteActivity(${e.id})" title="Remove">✕</button>
    </div>`).join('')}
  </div>`).join('')}
</div>
` : `
<div class="card tc mb24" style="padding:40px;margin-bottom:24px">
  <div style="font-size:36px;margin-bottom:12px">🏃</div>
  <div class="dim fs13">No activity logged yet. Add your first session above.</div>
</div>
`}

${activityLog.length >= 2 ? `
<!-- WEEKLY CHART -->
<div class="sec-head" style="margin-bottom:12px">Weekly Minutes (8 weeks)</div>
<div class="card mb24" style="margin-bottom:24px">
  <div class="chart-wrap" style="height:200px"><canvas id="activity-stacked-chart"></canvas></div>
</div>
` : ''}

<!-- HEATMAP -->
<div class="sec-head" style="margin-bottom:12px">Activity Heatmap (35 days)</div>
<div class="card mb24" style="margin-bottom:24px">
  ${_renderHeatmap(activityLog)}
</div>

${bestKeys.length > 0 ? `
<!-- PERSONAL BESTS -->
<div class="sec-head" style="margin-bottom:12px">Personal Bests</div>
<div class="card" style="margin-bottom:24px;overflow-x:auto">
  <table class="tbl w100">
    <thead><tr><th>Activity</th><th>Longest Session</th><th>Most Calories</th><th>Best Distance</th></tr></thead>
    <tbody>
      ${bestKeys.map(type => {
        const b = bests[type];
        const icon = _getIcon(type);
        return `<tr>
          <td>${icon} ${type}</td>
          <td class="mono fs11">${b.longestMin}min</td>
          <td class="mono fs11">${b.mostCalories} cal</td>
          <td class="mono fs11">${b.bestDistance ? b.bestDistance + 'mi' : '—'}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
</div>
` : ''}
`;
}

export function scheduleActivityCharts() {
  setTimeout(() => {
    if (state.activityLog.length >= 2) {
      initActivityStackedBar('activity-stacked-chart', state.activityLog);
    }
  }, 0);
}

// ── GLOBAL HANDLERS ──

window.updateCalPreview = () => {
  const type      = document.getElementById('act-type')?.value || 'Walking';
  const dur       = parseInt(document.getElementById('act-dur')?.value) || 30;
  const intensity = document.getElementById('act-intensity')?.value || 'Moderate';
  const cal = _previewCalories(type, dur, intensity);
  const el = document.getElementById('cal-preview');
  if (el) el.textContent = `≈ ${cal} calories`;
  const calInput = document.getElementById('act-cal');
  if (calInput && !calInput.value) calInput.placeholder = `Auto: ~${cal}`;
};

window.logActivity = () => {
  const type      = document.getElementById('act-type')?.value;
  const durationMin = parseInt(document.getElementById('act-dur')?.value) || 0;
  const intensity = document.getElementById('act-intensity')?.value || 'Moderate';
  const date      = document.getElementById('act-date')?.value || new Date().toISOString().slice(0, 10);
  const distance  = parseFloat(document.getElementById('act-dist')?.value) || null;
  const hr        = parseInt(document.getElementById('act-hr')?.value) || null;
  const calories  = document.getElementById('act-cal')?.value ? parseInt(document.getElementById('act-cal').value) : null;
  const notes     = document.getElementById('act-notes')?.value?.trim() || '';

  if (!type || !durationMin) {
    alert('Please select an activity and enter duration.');
    return;
  }

  const met = MET_VALUES[type] || 5.0;
  addActivityEntry({ type, durationMin, intensity, date, distance, hr, calories, notes, met });
  _refreshActivityPage();
};

window.deleteActivity = (id) => {
  removeActivityEntry(id);
  _refreshActivityPage();
};

function _refreshActivityPage() {
  const el = document.getElementById('page-activity');
  if (!el) return;
  el.innerHTML = renderActivity();
  scheduleActivityCharts();
}
