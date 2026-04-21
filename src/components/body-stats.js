// ═══════════════════════════════════════════
//   FITNESS FORGE — Body Stats Tracker
// ═══════════════════════════════════════════

import { state, addBodyCheckIn } from '../store.js';
import { initWeightTrendChart } from './charts.js';

export function renderBodyStats() {
  const { bodyLog, profile } = state;
  const latest = bodyLog[0];
  const previous = bodyLog[1];

  let trendIcon = '';
  let trendColor = 'var(--text-2)';
  if (latest && previous) {
    const diff = latest.weight - previous.weight;
    if (diff < 0) { trendIcon = `↓ ${Math.abs(diff).toFixed(1)}`; trendColor = 'var(--forge-green)'; }
    else if (diff > 0) { trendIcon = `↑ ${diff.toFixed(1)}`; trendColor = 'var(--danger)'; }
    else { trendIcon = '→ 0.0'; }
  }

  return `
<div class="page-header">
  <div class="label" style="margin-bottom:6px">Body Metrics</div>
  <h1 class="display page-title">BODY STATS</h1>
  <div class="page-sub">Weight, measurements &amp; progress tracking</div>
</div>

<!-- CURRENT WEIGHT CARD -->
<div class="g2 mb24" style="margin-bottom:24px">
  <div class="card card-fire">
    <div class="label mb16" style="margin-bottom:8px">Current Weight</div>
    ${latest ? `
      <div class="display" style="font-size:56px;line-height:1">${latest.weight}</div>
      <div class="muted fs13" style="margin-top:4px">lbs · ${new Date(latest.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>
      ${trendIcon ? `<div class="mono" style="color:${trendColor};margin-top:8px;font-size:14px">${trendIcon} lbs vs last check-in</div>` : ''}
    ` : `
      <div class="display" style="font-size:40px;color:var(--text-3)">${profile?.weight || '—'}</div>
      <div class="muted fs12 mt8">From profile · Add a check-in to track changes</div>
    `}
  </div>

  <div class="card">
    <div class="label mb16" style="margin-bottom:8px">Add Check-In</div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <div>
        <label class="label">Weight (lbs)</label>
        <input type="number" id="checkin-weight" class="form-input" placeholder="${latest?.weight || profile?.weight || '175'}" min="50" max="500" step="0.1" style="width:100%;box-sizing:border-box;margin-top:4px">
      </div>
      <div>
        <label class="label">Body Fat % (optional)</label>
        <input type="number" id="checkin-bf" class="form-input" placeholder="e.g. 18" min="3" max="60" step="0.1" style="width:100%;box-sizing:border-box;margin-top:4px">
      </div>
      <div>
        <label class="label">Notes (optional)</label>
        <input type="text" id="checkin-notes" class="form-input" placeholder="e.g. Morning, fasted" style="width:100%;box-sizing:border-box;margin-top:4px">
      </div>
      <details style="margin-top:4px">
        <summary class="label" style="cursor:pointer;user-select:none">+ Measurements (optional)</summary>
        <div class="measurement-grid" style="margin-top:10px">
          ${[
            ['chest', 'Chest (in)'],
            ['waist', 'Waist (in)'],
            ['hips', 'Hips (in)'],
            ['leftArm', 'Left Arm (in)'],
            ['rightArm', 'Right Arm (in)'],
            ['leftThigh', 'Left Thigh (in)'],
            ['neck', 'Neck (in)'],
          ].map(([id, label]) => `
            <div>
              <label class="label">${label}</label>
              <input type="number" id="m-${id}" class="form-input" placeholder="—" min="0" step="0.25" style="width:100%;box-sizing:border-box;margin-top:2px">
            </div>
          `).join('')}
        </div>
      </details>
      <button class="btn btn-fire w100" onclick="saveBodyCheckIn()">Save Check-In</button>
    </div>
  </div>
</div>

<!-- WEIGHT TREND CHART -->
${bodyLog.length >= 2 ? `
<div class="sec-head" style="margin-bottom:12px">Weight Trend</div>
<div class="card mb24" style="margin-bottom:24px">
  <div class="chart-wrap" style="height:200px">
    <canvas id="weight-trend-chart"></canvas>
  </div>
</div>
` : bodyLog.length === 1 ? `
<div class="alert alert-neutral mb24" style="margin-bottom:24px">
  <span>ℹ️</span>
  <span class="fs13">Add one more check-in to see your weight trend chart.</span>
</div>
` : ''}

<!-- HISTORY TABLE -->
${bodyLog.length > 0 ? `
<div class="sec-head" style="margin-bottom:12px">Check-In History</div>
<div class="card" style="overflow-x:auto">
  <table class="tbl w100">
    <thead>
      <tr>
        <th>Date</th>
        <th>Weight</th>
        <th>BF%</th>
        <th>Chest</th>
        <th>Waist</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>
      ${bodyLog.slice(0, 20).map(e => `
        <tr>
          <td class="mono muted fs11">${new Date(e.date).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</td>
          <td class="mono fire">${e.weight} lbs</td>
          <td class="mono muted fs11">${e.bodyFatPct ? e.bodyFatPct + '%' : '—'}</td>
          <td class="mono muted fs11">${e.measurements?.chest ? e.measurements.chest + '"' : '—'}</td>
          <td class="mono muted fs11">${e.measurements?.waist ? e.measurements.waist + '"' : '—'}</td>
          <td class="muted fs11">${e.notes || ''}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</div>
` : `
<div class="card tc" style="padding:48px">
  <div style="font-size:40px;margin-bottom:12px">📏</div>
  <div class="display" style="font-size:24px;margin-bottom:8px">NO DATA YET</div>
  <div class="dim fs13">Add your first check-in to start tracking body composition.</div>
</div>
`}
`;
}

// ── GLOBAL HANDLERS ──

window.saveBodyCheckIn = () => {
  const weight = parseFloat(document.getElementById('checkin-weight')?.value);
  if (!weight || weight < 50) {
    document.getElementById('checkin-weight')?.focus();
    return;
  }

  const bf    = parseFloat(document.getElementById('checkin-bf')?.value)    || null;
  const notes = document.getElementById('checkin-notes')?.value?.trim()     || '';

  const measureIds = ['chest','waist','hips','leftArm','rightArm','leftThigh','neck'];
  const measurements = {};
  measureIds.forEach(id => {
    const val = parseFloat(document.getElementById(`m-${id}`)?.value);
    if (val) measurements[id] = val;
  });

  addBodyCheckIn({
    date: new Date().toISOString(),
    weight,
    bodyFatPct: bf,
    measurements,
    notes,
  });

  refreshBodyPage();
};

function refreshBodyPage() {
  const el = document.getElementById('page-body');
  if (!el) return;
  el.innerHTML = renderBodyStats();
  scheduleBodyCharts();
}

export function scheduleBodyCharts() {
  setTimeout(() => {
    if (state.bodyLog.length >= 2) {
      initWeightTrendChart('weight-trend-chart', state.bodyLog);
    }
  }, 0);
}
