// ═══════════════════════════════════════════
//   FITNESS FORGE — Cardio Log
// ═══════════════════════════════════════════

import { state, addCardioEntry, removeCardioEntry, distUnitLabel, toDisplayDist, toStoredDist } from '../store.js';
import { initCardioChart } from './charts.js';
import { toast } from './ui.js';

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
      <label class="label">Distance (${distUnitLabel() === 'km' ? 'km' : 'miles'})</label>
      <input type="number" id="cardio-dist" class="form-input" placeholder="${distUnitLabel() === 'km' ? '5.0' : '3.1'}" min="0" step="0.1" style="width:100%;margin-top:4px;box-sizing:border-box">
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
        ? formatPace(e.durationMinutes / toDisplayDist(e.distanceMiles)) : null;
      return `
      <div class="cardio-entry-row">
        <div class="cardio-icon">${type?.icon || '⚡'}</div>
        <div style="flex:1">
          <div style="font-weight:500;font-size:13px">${type?.label || e.type}</div>
          <div class="muted fs11 mt4" style="margin-top:3px">
            ${e.distanceMiles ? toDisplayDist(e.distanceMiles) + ' ' + distUnitLabel() : ''}
            ${e.distanceMiles && dur !== '—' ? ' · ' : ''}
            ${dur !== '—' ? dur : ''}
            ${pace ? ' · ' + pace + '/' + distUnitLabel() : ''}
            ${e.avgHR ? ' · ' + e.avgHR + ' bpm' : ''}
          </div>
          ${e.notes ? `<div class="dim fs11" style="margin-top:2px">${e.notes}</div>` : ''}
        </div>
        <div class="muted fs11">${new Date(e.date).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</div>
        <button class="btn-remove" onclick="deleteCardioEntry(${Number(e.id) || 0})" title="Remove">✕</button>
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
  // A typed negative is a typo; it was stored as-is (-2 mi, -1 bpm).
  const bad = [['cardio-dist', dist < 0], ['cardio-hr', hr != null && hr < 0]].find(([, b]) => b);
  if (bad) {
    const el = document.getElementById(bad[0]);
    el?.classList.add('input-error');
    setTimeout(() => el?.classList.remove('input-error'), 400);
    toast('Values cannot be negative.', { type: 'danger' });
    return;
  }

  addCardioEntry({
    date:           new Date().toISOString(),
    type,
    distanceMiles:  dist ? Math.round(toStoredDist(dist) * 1000) / 1000 : null,
    durationMinutes: dur,
    durationSeconds: Math.round(dur * 60),
    avgHR:          hr,
    notes,
  });

  refreshCardioSection();
};

window.deleteCardioEntry = (id) => {
  if (!confirm('Delete this cardio session?')) return;
  removeCardioEntry(id);
  refreshCardioSection();
};

function refreshCardioSection() {
  // The Log page is mounted as #page-cardio. This looked for #page-log, which
  // does not exist, so a logged session never appeared until you navigated away.
  const logPage = document.getElementById('page-cardio');
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
      initCardioChart('cardio-chart', state.cardioLog, { toUnit: toDisplayDist, unit: distUnitLabel() });
    }
  }, 0);
}
