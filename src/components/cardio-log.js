// ═══════════════════════════════════════════
//   FITNESS FORGE — Cardio Log
// ═══════════════════════════════════════════

import { state, addCardioEntry } from '../store.js';
import { initCardioChart } from './charts.js';

const CARDIO_TYPES = [
  { id: 'run',      label: 'Run',        icon: '🏃' },
  { id: 'bike',     label: 'Bike',       icon: '🚴' },
  { id: 'swim',     label: 'Swim',       icon: '🏊' },
  { id: 'row',      label: 'Row',        icon: '🚣' },
  { id: 'elliptical', label: 'Elliptical', icon: '🔄' },
  { id: 'jumprope', label: 'Jump Rope',  icon: '🪢' },
  { id: 'hike',     label: 'Hike',       icon: '🥾' },
  { id: 'other',    label: 'Other',      icon: '⚡' },
];

export function renderCardioLog() {
  const { cardioLog } = state;

  return `
<!-- ADD CARDIO FORM -->
<div class="sec-head" style="margin-bottom:12px">Log Cardio Session</div>
<div class="card mb24" style="margin-bottom:24px">
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px">
    <div>
      <label class="label">Activity Type</label>
      <select id="cardio-type" class="form-input" style="width:100%;margin-top:4px">
        ${CARDIO_TYPES.map(t => `<option value="${t.id}">${t.icon} ${t.label}</option>`).join('')}
      </select>
    </div>
    <div>
      <label class="label">Distance (miles)</label>
      <input type="number" id="cardio-dist" class="form-input" placeholder="3.1" min="0" step="0.1" style="width:100%;margin-top:4px;box-sizing:border-box">
    </div>
    <div>
      <label class="label">Duration (min)</label>
      <input type="number" id="cardio-dur" class="form-input" placeholder="30" min="1" step="1" style="width:100%;margin-top:4px;box-sizing:border-box">
    </div>
    <div>
      <label class="label">Avg HR (optional)</label>
      <input type="number" id="cardio-hr" class="form-input" placeholder="145" min="50" max="220" style="width:100%;margin-top:4px;box-sizing:border-box">
    </div>
    <div style="grid-column:1/-1">
      <label class="label">Notes (optional)</label>
      <input type="text" id="cardio-notes" class="form-input" placeholder="Felt strong, trails were muddy..." style="width:100%;margin-top:4px;box-sizing:border-box">
    </div>
  </div>
  <div style="margin-top:14px">
    <button class="btn btn-fire" onclick="logCardioSession()">+ Log Session</button>
  </div>
</div>

<!-- CARDIO HISTORY -->
${cardioLog.length > 0 ? `
  ${cardioLog.length >= 3 ? `
    <div class="sec-head" style="margin-bottom:12px">Distance History</div>
    <div class="card mb24" style="margin-bottom:24px">
      <div class="chart-wrap" style="height:160px">
        <canvas id="cardio-chart"></canvas>
      </div>
    </div>
  ` : ''}

  <div class="sec-head" style="margin-bottom:12px">${cardioLog.length} Sessions Logged</div>
  <div class="card">
    ${cardioLog.slice(0, 30).map(e => {
      const type = CARDIO_TYPES.find(t => t.id === e.type);
      const dur  = e.durationSeconds ? formatDur(e.durationSeconds) : (e.durationMinutes ? e.durationMinutes + ' min' : '—');
      const pace = e.durationMinutes && e.distanceMiles > 0
        ? formatPace(e.durationMinutes / e.distanceMiles) : null;
      return `
      <div class="cardio-entry-row">
        <div class="cardio-icon">${type?.icon || '⚡'}</div>
        <div style="flex:1">
          <div style="font-weight:500;font-size:13px">${type?.label || e.type}</div>
          <div class="muted fs11 mt4" style="margin-top:3px">
            ${e.distanceMiles ? e.distanceMiles + ' mi' : ''}
            ${e.distanceMiles && dur !== '—' ? ' · ' : ''}
            ${dur !== '—' ? dur : ''}
            ${pace ? ' · ' + pace + '/mi' : ''}
            ${e.avgHR ? ' · ' + e.avgHR + ' bpm' : ''}
          </div>
          ${e.notes ? `<div class="dim fs11" style="margin-top:2px">${e.notes}</div>` : ''}
        </div>
        <div class="muted fs11">${new Date(e.date).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</div>
      </div>
      `;
    }).join('')}
  </div>
` : `
  <div class="card tc" style="padding:48px">
    <div style="font-size:40px;margin-bottom:12px">🏃</div>
    <div class="display" style="font-size:24px;margin-bottom:8px">NO CARDIO YET</div>
    <div class="dim fs13">Log your first cardio session above.</div>
  </div>
`}
`;
}

function formatDur(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatPace(minsPerMile) {
  const m = Math.floor(minsPerMile);
  const s = Math.round((minsPerMile - m) * 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── GLOBAL HANDLERS ──

window.logCardioSession = () => {
  const type   = document.getElementById('cardio-type')?.value;
  const dist   = parseFloat(document.getElementById('cardio-dist')?.value) || 0;
  const dur    = parseFloat(document.getElementById('cardio-dur')?.value)  || 0;
  const hr     = parseFloat(document.getElementById('cardio-hr')?.value)   || null;
  const notes  = document.getElementById('cardio-notes')?.value?.trim()   || '';

  if (!dur || dur < 1) {
    document.getElementById('cardio-dur')?.focus();
    return;
  }

  addCardioEntry({
    date:           new Date().toISOString(),
    type,
    distanceMiles:  dist || null,
    durationMinutes: dur,
    durationSeconds: Math.round(dur * 60),
    avgHR:          hr,
    notes,
  });

  refreshCardioSection();
};

function refreshCardioSection() {
  const logPage = document.getElementById('page-log');
  if (!logPage) return;
  // Re-render the active tab (cardio)
  const cardioSection = document.getElementById('cardio-section');
  if (cardioSection) {
    cardioSection.innerHTML = renderCardioLog();
    scheduleCardioCharts();
  }
}

export function scheduleCardioCharts() {
  setTimeout(() => {
    if (state.cardioLog.length >= 3) {
      initCardioChart('cardio-chart', state.cardioLog);
    }
  }, 0);
}
