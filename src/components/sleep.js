// ═══════════════════════════════════════════
//   FITNESS FORGE — Sleep Tracker
// ═══════════════════════════════════════════

import { state, addSleepEntry, removeSleepEntry } from '../store.js';
import { initSleepBarChart } from './charts.js';

let _sleepQuality = 3;
let _sleepFeeling = 3;

const FEELINGS = ['😴','😐','🙂','😄','⚡'];
const FEELING_LABELS = ['Exhausted','Groggy','OK','Rested','Energized'];

function _todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function _scoreColor(score) {
  if (score >= 80) return 'var(--forge-green)';
  if (score >= 60) return 'var(--ember)';
  return 'var(--danger)';
}

function _scoreTag(score) {
  if (score >= 80) return 't-green';
  if (score >= 60) return 't-ember';
  return 't-fire';
}

function _fmtDuration(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

function _calcSleepDebt(sleepLog) {
  const target = 8;
  const recent = sleepLog.slice(0, 14);
  if (!recent.length) return 0;
  const totalDebt = recent.reduce((acc, e) => acc + Math.max(target - e.durationHours, 0), 0);
  return parseFloat(totalDebt.toFixed(1));
}

function _buildInsights(sleepLog) {
  if (!sleepLog.length) return null;

  const today = _todayStr();
  const sevenDaysAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const last7 = sleepLog.filter(e => e.date >= sevenDaysAgo);
  const avgScore = last7.length ? Math.round(last7.reduce((a, e) => a + e.score, 0) / last7.length) : null;

  // Best day of week
  const byDOW = {};
  sleepLog.forEach(e => {
    const dow = new Date(e.date + 'T12:00').getDay();
    if (!byDOW[dow]) byDOW[dow] = [];
    byDOW[dow].push(e.score);
  });
  const DOW_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  let bestDOW = null, bestAvg = 0;
  Object.entries(byDOW).forEach(([d, scores]) => {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (avg > bestAvg) { bestAvg = avg; bestDOW = parseInt(d); }
  });

  // Most consistent bedtime
  const bedtimes = sleepLog.slice(0, 14).map(e => {
    const [h, m] = e.bedtime.split(':').map(Number);
    return h * 60 + m;
  });
  const avgBedMins = bedtimes.length ? Math.round(bedtimes.reduce((a,b) => a+b, 0) / bedtimes.length) : null;
  const avgBedHour = avgBedMins != null ? `${String(Math.floor(avgBedMins / 60) % 24).padStart(2,'0')}:${String(avgBedMins % 60).padStart(2,'0')}` : null;

  const debt = _calcSleepDebt(sleepLog);

  return { avgScore, bestDOW: bestDOW != null ? DOW_NAMES[bestDOW] : null, avgBedtime: avgBedHour, debt };
}

function _renderHeatmap(sleepLog) {
  const cells = [];
  for (let i = 34; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    const entry = sleepLog.find(e => e.date === key);
    const score = entry?.score;
    const bg = !score ? 'var(--bg-3)'
      : score >= 80 ? 'rgba(77,255,170,0.5)'
      : score >= 60 ? 'rgba(255,179,71,0.5)'
      : 'rgba(255,68,68,0.5)';
    const dow = ['S','M','T','W','T','F','S'][d.getDay()];
    cells.push(`<div class="sleep-cell" style="background:${bg}" title="${key}${score ? ' · Score: ' + score : ' · No data'}"></div>`);
  }
  const DOW_LABELS = ['S','M','T','W','T','F','S'];
  return `
<div>
  <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:4px">
    ${DOW_LABELS.map(d => `<div style="font-size:9px;text-align:center;color:var(--text-3);font-family:var(--ff-mono);letter-spacing:0.1em">${d}</div>`).join('')}
  </div>
  <div class="sleep-heatmap">${cells.join('')}</div>
  <div style="display:flex;gap:12px;margin-top:8px;font-size:10px;font-family:var(--ff-mono)">
    <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:2px;background:rgba(77,255,170,0.5);display:inline-block"></span>≥80</span>
    <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:2px;background:rgba(255,179,71,0.5);display:inline-block"></span>60–79</span>
    <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:2px;background:rgba(255,68,68,0.5);display:inline-block"></span>&lt;60</span>
    <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:2px;background:var(--bg-3);display:inline-block"></span>No data</span>
  </div>
</div>`;
}

export function renderSleep() {
  const { sleepLog } = state;
  const today = _todayStr();
  const lastEntry = sleepLog[0];
  const todayEntry = sleepLog.find(e => e.date === today);
  const insights = _buildInsights(sleepLog);
  const debt = _calcSleepDebt(sleepLog);

  return `
<div class="page-header">
  <div class="label" style="margin-bottom:6px">Recovery Tracking</div>
  <h1 class="display page-title">SLEEP</h1>
  <div class="page-sub">Log sleep, track quality &amp; manage recovery debt</div>
</div>

<!-- LOG FORM -->
<div class="sec-head" style="margin-bottom:12px">Log Sleep</div>
<div class="card" style="margin-bottom:24px">
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:16px">
    <div>
      <label class="label">Bedtime</label>
      <input type="time" id="sleep-bed" class="form-input" value="23:00" style="width:100%;margin-top:4px;box-sizing:border-box">
    </div>
    <div>
      <label class="label">Wake Time</label>
      <input type="time" id="sleep-wake" class="form-input" value="07:00" style="width:100%;margin-top:4px;box-sizing:border-box">
    </div>
    <div>
      <label class="label">Date</label>
      <input type="date" id="sleep-date" class="form-input" value="${today}" style="width:100%;margin-top:4px;box-sizing:border-box">
    </div>
  </div>

  <div style="margin-bottom:16px">
    <label class="label" style="margin-bottom:8px;display:block">Sleep Quality</label>
    <div id="sleep-quality-stars" style="display:flex;gap:8px">
      ${[1,2,3,4,5].map(n => `
      <button onclick="setSleepQuality(${n})" style="font-size:22px;background:none;border:none;cursor:pointer;padding:4px;opacity:${n <= _sleepQuality ? 1 : 0.3};transition:opacity 0.2s" title="${n} star${n>1?'s':''}">★</button>
      `).join('')}
    </div>
  </div>

  <div style="margin-bottom:16px">
    <label class="label" style="margin-bottom:8px;display:block">How did you feel on waking?</label>
    <div id="sleep-feeling-btns" style="display:flex;gap:8px;flex-wrap:wrap">
      ${FEELINGS.map((emoji, i) => `
      <button onclick="setSleepFeeling(${i+1})" style="padding:8px 12px;border-radius:var(--r-md);border:1px solid ${_sleepFeeling === i+1 ? 'var(--fire)' : 'var(--border)'};background:${_sleepFeeling === i+1 ? 'var(--fire-dim)' : 'var(--bg-2)'};cursor:pointer;font-size:18px" title="${FEELING_LABELS[i]}">${emoji}</button>
      `).join('')}
    </div>
  </div>

  <div style="margin-bottom:16px">
    <label class="label">Notes (optional)</label>
    <textarea id="sleep-notes" class="form-input" placeholder="Dreams, wakeups, stress…" rows="2" style="width:100%;margin-top:4px;box-sizing:border-box;resize:vertical"></textarea>
  </div>

  <button class="btn btn-fire" onclick="logSleep()">+ Log Sleep</button>
</div>

${todayEntry ? `
<!-- TODAY STATS -->
<div class="g4 mb24" style="margin-bottom:24px">
  <div class="stat s-fire">
    <div class="label">Duration</div>
    <div class="display" style="font-size:22px;margin-top:6px">${_fmtDuration(todayEntry.durationHours)}</div>
  </div>
  <div class="stat" style="border-top:3px solid ${_scoreColor(todayEntry.score)}">
    <div class="label">Score</div>
    <div class="display" style="font-size:28px;margin-top:6px;color:${_scoreColor(todayEntry.score)}">${todayEntry.score}</div>
  </div>
  <div class="stat s-steel">
    <div class="label">Cycles</div>
    <div class="display" style="font-size:22px;margin-top:6px">~${Math.floor(todayEntry.durationHours / 1.5)}</div>
  </div>
  <div class="stat ${debt > 4 ? 's-fire' : 's-ember'}">
    <div class="label">Sleep Debt</div>
    <div class="display" style="font-size:22px;margin-top:6px">${debt}h</div>
  </div>
</div>
` : debt > 2 ? `
<div class="alert alert-fire" style="margin-bottom:24px">
  <span>⚠️</span>
  <div><div style="font-weight:500">${debt}h sleep debt accumulated</div><div class="fs12">Aim for 8h/night to recover</div></div>
</div>
` : ''}

${insights ? `
<!-- INSIGHT CARDS -->
<div class="g4 mb24" style="margin-bottom:24px">
  <div class="stat">
    <div class="label">Avg Score (7d)</div>
    <div class="display" style="font-size:28px;margin-top:6px;color:${insights.avgScore ? _scoreColor(insights.avgScore) : 'var(--text-3)'}">${insights.avgScore ?? '—'}</div>
  </div>
  <div class="stat">
    <div class="label">Best Day</div>
    <div class="display" style="font-size:16px;margin-top:6px">${insights.bestDOW ?? '—'}</div>
  </div>
  <div class="stat">
    <div class="label">Avg Bedtime</div>
    <div class="display" style="font-size:20px;margin-top:6px">${insights.avgBedtime ?? '—'}</div>
  </div>
  <div class="stat">
    <div class="label">14d Debt</div>
    <div class="display" style="font-size:22px;margin-top:6px;color:${insights.debt > 4 ? 'var(--danger)' : 'var(--ember)'}">${insights.debt}h</div>
  </div>
</div>
` : ''}

${sleepLog.length >= 3 ? `
<!-- CHARTS -->
<div class="sec-head" style="margin-bottom:12px">30-Night History</div>
<div class="card mb24" style="margin-bottom:24px">
  <div class="chart-wrap" style="height:200px"><canvas id="sleep-bar-chart"></canvas></div>
</div>
` : ''}

<!-- HEATMAP -->
<div class="sec-head" style="margin-bottom:12px">35-Night Heatmap</div>
<div class="card mb24" style="margin-bottom:24px">
  ${_renderHeatmap(sleepLog)}
</div>

${sleepLog.length > 0 ? `
<!-- HISTORY LIST -->
<div class="sec-head" style="margin-bottom:12px">Recent Entries</div>
<div class="card" style="margin-bottom:24px">
  ${sleepLog.slice(0, 14).map(e => `
  <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--border)">
    <div>
      <div style="font-size:13px;font-weight:500">${e.date} <span style="font-size:11px;color:var(--text-3);margin-left:4px">${e.bedtime} → ${e.wakeTime}</span></div>
      <div class="muted fs11" style="margin-top:3px">${_fmtDuration(e.durationHours)} · ${FEELINGS[e.feeling-1] || ''} ${FEELING_LABELS[(e.feeling||3)-1]}${e.notes ? ' · ' + e.notes.slice(0,40) : ''}</div>
    </div>
    <div style="display:flex;align-items:center;gap:8px">
      <span class="tag ${_scoreTag(e.score)}">${e.score}</span>
      <button class="btn-remove" onclick="deleteSleepEntry(${e.id})" title="Remove">✕</button>
    </div>
  </div>`).join('')}
</div>
` : `
<div class="card tc" style="padding:40px;margin-bottom:24px">
  <div style="font-size:36px;margin-bottom:12px">🌙</div>
  <div class="dim fs13">No sleep logged yet. Add your first entry above.</div>
</div>
`}
`;
}

export function scheduleSleepCharts() {
  setTimeout(() => {
    if (state.sleepLog.length >= 3) {
      initSleepBarChart('sleep-bar-chart', state.sleepLog);
    }
  }, 0);
}

// ── GLOBAL HANDLERS ──

window.setSleepQuality = (n) => {
  _sleepQuality = n;
  const stars = document.querySelectorAll('#sleep-quality-stars button');
  stars.forEach((btn, i) => { btn.style.opacity = i < n ? '1' : '0.3'; });
};

window.setSleepFeeling = (n) => {
  _sleepFeeling = n;
  const btns = document.querySelectorAll('#sleep-feeling-btns button');
  btns.forEach((btn, i) => {
    btn.style.borderColor = i + 1 === n ? 'var(--fire)' : 'var(--border)';
    btn.style.background  = i + 1 === n ? 'var(--fire-dim)' : 'var(--bg-2)';
  });
};

window.logSleep = () => {
  const bedtime = document.getElementById('sleep-bed')?.value;
  const wakeTime = document.getElementById('sleep-wake')?.value;
  const date = document.getElementById('sleep-date')?.value || new Date().toISOString().slice(0, 10);
  const notes = document.getElementById('sleep-notes')?.value?.trim() || '';

  if (!bedtime || !wakeTime) {
    alert('Please enter bedtime and wake time.');
    return;
  }

  addSleepEntry({ date, bedtime, wakeTime, quality: _sleepQuality, feeling: _sleepFeeling, notes });
  _sleepQuality = 3;
  _sleepFeeling = 3;
  _refreshSleepPage();
};

window.deleteSleepEntry = (id) => {
  removeSleepEntry(id);
  _refreshSleepPage();
};

function _refreshSleepPage() {
  const el = document.getElementById('page-sleep');
  if (!el) return;
  el.innerHTML = renderSleep();
  scheduleSleepCharts();
}
