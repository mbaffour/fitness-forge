// ═══════════════════════════════════════════
//   FITNESS FORGE — Fasting Tracker
// ═══════════════════════════════════════════

import { state, startFast, endFast } from '../store.js';

const PROTOCOLS = [
  { id: '12:12', label: '12:12', fastHours: 12, eatHours: 12, desc: 'Beginner-friendly. Aligns with natural circadian rhythm.' },
  { id: '16:8',  label: '16:8',  fastHours: 16, eatHours: 8,  desc: 'Most studied. Best for most people.' },
  { id: '18:6',  label: '18:6',  fastHours: 18, eatHours: 6,  desc: 'Intermediate. Stronger metabolic benefits.' },
  { id: '20:4',  label: '20:4',  fastHours: 20, eatHours: 4,  desc: 'Advanced. One large meal + small snack.' },
  { id: '5:2',   label: '5:2',   fastHours: 0,  eatHours: 0,  weekly: true, desc: 'Fast 2 days/week at 500 cal. Easier long-term.' },
  { id: 'OMAD',  label: 'OMAD',  fastHours: 23, eatHours: 1,  desc: 'One meal a day. Maximum autophagy.' },
];

const METABOLIC_PHASES = [
  { startH: 0,  endH: 4,  label: 'Fed State',          desc: 'Digesting, glucose burning',       color: 'var(--ember)' },
  { startH: 4,  endH: 8,  label: 'Post-Absorptive',     desc: 'Liver glycogen mobilized',         color: 'var(--steel)' },
  { startH: 8,  endH: 12, label: 'Glycogen Depleting',  desc: 'Fat oxidation increasing',         color: 'var(--forge-green)' },
  { startH: 12, endH: 16, label: 'Fat Oxidation',       desc: 'Primary fuel: stored fat',         color: 'var(--fire)' },
  { startH: 16, endH: 18, label: 'Autophagy Begins',    desc: 'Cellular cleanup initiated',       color: 'var(--fire)' },
  { startH: 18, endH: 24, label: 'Deep Ketosis',        desc: 'Ketone production elevated',       color: 'var(--fire)' },
];

let _selectedProtocol = '16:8';

function _getProtocol(id) {
  return PROTOCOLS.find(p => p.id === id) || PROTOCOLS[1];
}

function _getElapsedHours() {
  const fast = state.activeFast;
  if (!fast) return 0;
  return (Date.now() - new Date(fast.startTime).getTime()) / 3600000;
}

function _fmtHMS(hours) {
  const totalSec = Math.max(Math.round(hours * 3600), 0);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function _fmtHM(hours) {
  const h = Math.floor(Math.max(hours, 0));
  const m = Math.floor((Math.max(hours, 0) - h) * 60);
  return `${h}h ${m}m`;
}

function _renderRing(elapsedHours, totalHours) {
  const pct = totalHours > 0 ? Math.min(elapsedHours / totalHours, 1) : 0;
  const r = 90;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct);
  const remaining = Math.max(totalHours - elapsedHours, 0);
  const remHMS = _fmtHMS(remaining);

  const fast = state.activeFast;
  const isFasting = !!fast;
  const isEating  = !isFasting && state.fastingLog.length > 0;
  const statusLabel = isFasting
    ? (pct >= 1 ? 'FAST COMPLETE ✓' : 'FASTING 🔥')
    : 'EATING WINDOW';
  const statusColor = isFasting && pct < 1 ? 'var(--fire)' : isFasting ? 'var(--forge-green)' : 'var(--steel)';
  const ringColor   = isFasting && pct < 1 ? 'var(--fire)' : isFasting ? 'var(--forge-green)' : 'var(--border)';

  const endTime = fast
    ? new Date(new Date(fast.startTime).getTime() + totalHours * 3600000).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})
    : '—';

  return `
<div class="fast-ring-wrap">
  <div style="display:flex;flex-direction:column;align-items:center;gap:8px">
    <div class="fast-status" style="color:${statusColor}">${statusLabel}</div>
    <svg class="fast-ring" viewBox="0 0 200 200" width="220" height="220">
      <circle cx="100" cy="100" r="${r}" fill="none" stroke="var(--border)" stroke-width="10"/>
      <circle cx="100" cy="100" r="${r}" fill="none"
        stroke="${ringColor}" stroke-width="10"
        stroke-dasharray="${circumference.toFixed(2)}"
        stroke-dashoffset="${offset.toFixed(2)}"
        stroke-linecap="round"
        transform="rotate(-90 100 100)"
        style="transition:stroke-dashoffset 1s linear"/>
      <text x="100" y="90" text-anchor="middle" font-family="'Fira Code',monospace" font-size="30" font-weight="700" fill="var(--text)">${remHMS.slice(0,5)}</text>
      <text x="100" y="112" text-anchor="middle" font-family="'Fira Code',monospace" font-size="13" fill="var(--text-3)">:${remHMS.slice(6)} remaining</text>
      <text x="100" y="134" text-anchor="middle" font-family="'Fira Code',monospace" font-size="11" fill="var(--text-2)">${Math.round(pct * 100)}% complete</text>
    </svg>
    <div style="display:flex;gap:24px;text-align:center;font-family:'Fira Code',monospace;font-size:11px">
      <div><div style="color:var(--text-3);letter-spacing:0.1em;margin-bottom:4px">ELAPSED</div><div style="color:var(--text)">${_fmtHM(elapsedHours)}</div></div>
      <div><div style="color:var(--text-3);letter-spacing:0.1em;margin-bottom:4px">REMAINING</div><div style="color:var(--text)">${_fmtHM(remaining)}</div></div>
      <div><div style="color:var(--text-3);letter-spacing:0.1em;margin-bottom:4px">ENDS AT</div><div style="color:var(--text)">${endTime}</div></div>
    </div>
  </div>
</div>`;
}

function _renderMetabolicTimeline(elapsedHours) {
  const totalH = 24;
  return `
<div style="margin:20px 0">
  <div class="label" style="margin-bottom:10px">Metabolic Phase</div>
  <div class="metabolic-timeline">
    ${METABOLIC_PHASES.map(ph => {
      const width = ((ph.endH - ph.startH) / totalH * 100).toFixed(1);
      const isCurrent = elapsedHours >= ph.startH && elapsedHours < ph.endH;
      return `
      <div class="met-phase${isCurrent ? ' current' : ''}"
        style="width:${width}%;background:${isCurrent ? ph.color : 'var(--bg-3)'};opacity:${isCurrent ? 1 : 0.5}"
        title="${ph.label}: ${ph.desc}">
        <span style="font-size:8px;color:${isCurrent ? 'var(--bg)' : 'var(--text-3)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 2px">${ph.startH}h</span>
      </div>`;
    }).join('')}
  </div>
  ${(() => {
    const cur = METABOLIC_PHASES.find(ph => elapsedHours >= ph.startH && elapsedHours < ph.endH);
    return cur ? `<div style="margin-top:8px;font-size:12px"><span style="color:var(--fire);margin-right:8px">◆</span><strong>${cur.label}</strong><span class="muted" style="margin-left:8px">${cur.desc}</span></div>` : '';
  })()}
</div>`;
}

function _render52View() {
  const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const fast52Days = state.activeFast?.fasting52Days || [];
  return `
<div class="card" style="margin-bottom:24px">
  <div class="label" style="margin-bottom:12px">5:2 — Weekly Fasting Days</div>
  <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-bottom:16px">
    ${DAYS.map((d, i) => {
      const isOn = fast52Days.includes(i);
      return `
      <button onclick="toggle52Day(${i})" style="padding:10px 4px;border-radius:var(--r-md);border:1px solid ${isOn ? 'var(--fire)' : 'var(--border)'};background:${isOn ? 'var(--fire-dim)' : 'var(--bg-2)'};color:${isOn ? 'var(--fire)' : 'var(--text-2)'};font-family:var(--ff-mono);font-size:10px;letter-spacing:0.08em;cursor:pointer">
        <div style="font-weight:700">${d.toUpperCase()}</div>
        <div style="font-size:9px;margin-top:4px">${isOn ? 'FAST' : 'EAT'}</div>
      </button>`;
    }).join('')}
  </div>
  <div class="dim fs12">Tap days to mark as fasting days (500 cal limit)</div>
</div>`;
}

function _renderHistory() {
  const log = state.fastingLog.slice(0, 20);
  if (!log.length) return '';
  return `
<div class="sec-head" style="margin-bottom:12px">Fast History</div>
<div class="card" style="margin-bottom:24px;overflow-x:auto">
  <table class="tbl w100">
    <thead><tr>
      <th>Date</th><th>Protocol</th><th>Planned</th><th>Actual</th><th>Status</th>
    </tr></thead>
    <tbody>
      ${log.map(f => `
      <tr>
        <td class="mono fs11">${f.date}</td>
        <td><span class="tag t-fire">${f.protocol}</span></td>
        <td class="mono fs11">${f.plannedHours}h</td>
        <td class="mono fs11">${f.actualHours}h</td>
        <td><span class="tag ${f.completed ? 't-green' : 't-dim'}">${f.completed ? '✓ Done' : 'Partial'}</span></td>
      </tr>`).join('')}
    </tbody>
  </table>
</div>`;
}

export function renderFasting() {
  const fast = state.activeFast;
  const proto = _getProtocol(fast?.protocol || _selectedProtocol);
  const elapsedHours = _getElapsedHours();
  const is52 = proto.weekly;

  return `
<div class="page-header">
  <div class="label" style="margin-bottom:6px">Intermittent Fasting</div>
  <h1 class="display page-title">FASTING</h1>
  <div class="page-sub">Track your fasting window and metabolic state</div>
</div>

<!-- PROTOCOL SELECTOR -->
<div class="sec-head" style="margin-bottom:12px">Protocol</div>
<div class="card" style="margin-bottom:24px">
  <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">
    ${PROTOCOLS.map(p => `
    <button onclick="setFastProtocol('${p.id}')" style="padding:8px 14px;border-radius:var(--r-md);border:1px solid ${(fast?.protocol || _selectedProtocol) === p.id ? 'var(--fire)' : 'var(--border)'};background:${(fast?.protocol || _selectedProtocol) === p.id ? 'var(--fire-dim)' : 'var(--bg-2)'};color:${(fast?.protocol || _selectedProtocol) === p.id ? 'var(--fire)' : 'var(--text-2)'};font-family:var(--ff-mono);font-size:12px;font-weight:700;cursor:pointer;letter-spacing:0.05em">
      ${p.label}
    </button>`).join('')}
  </div>
  <div class="dim fs12">${proto.desc}${!is52 ? ` · Fast: ${proto.fastHours}h · Eat: ${proto.eatHours}h` : ''}</div>
</div>

${is52 ? _render52View() : `
<!-- FAST RING HERO -->
<div id="fast-hero">
  <div class="card" style="margin-bottom:24px">
    ${_renderRing(elapsedHours, proto.fastHours)}
    <div style="display:flex;justify-content:center;margin-top:16px">
      <button class="btn ${fast ? 'btn-danger' : 'btn-fire'}" style="min-width:180px;padding:14px 24px;font-size:14px" onclick="toggleFast()">
        ${fast ? '⏹ End Fast' : '▶ Start Fast'}
      </button>
    </div>
    ${_renderMetabolicTimeline(elapsedHours)}
  </div>
</div>
`}

${_renderHistory()}
`;
}

function _updateFastingHero() {
  const heroEl = document.getElementById('fast-hero');
  if (!heroEl) return;
  const fast = state.activeFast;
  if (!fast) return;
  const proto = _getProtocol(fast.protocol);
  const elapsed = _getElapsedHours();
  heroEl.innerHTML = `
<div class="card" style="margin-bottom:24px">
  ${_renderRing(elapsed, proto.fastHours)}
  <div style="display:flex;justify-content:center;margin-top:16px">
    <button class="btn btn-danger" style="min-width:180px;padding:14px 24px;font-size:14px" onclick="toggleFast()">
      ⏹ End Fast
    </button>
  </div>
  ${_renderMetabolicTimeline(elapsed)}
</div>`;
}

export function scheduleFastingTimer() {
  clearInterval(window._fastTimerInterval);
  if (!state.activeFast) return;
  window._fastTimerInterval = setInterval(() => {
    const el = document.getElementById('page-fasting');
    if (!el || !el.classList.contains('active')) {
      clearInterval(window._fastTimerInterval);
      return;
    }
    _updateFastingHero();
  }, 1000);
}

// ── GLOBAL HANDLERS ──

window.toggleFast = () => {
  if (state.activeFast) {
    endFast();
  } else {
    const proto = _getProtocol(_selectedProtocol);
    startFast(proto.id, proto.fastHours);
  }
  window.refreshFastingPage();
};

window.setFastProtocol = (id) => {
  _selectedProtocol = id;
  window.refreshFastingPage();
};

window.toggle52Day = (dayIndex) => {
  if (!state.activeFast) {
    const proto = _getProtocol('5:2');
    startFast(proto.id, 0);
  }
  const days = state.activeFast.fasting52Days || [];
  const idx = days.indexOf(dayIndex);
  if (idx >= 0) days.splice(idx, 1); else days.push(dayIndex);
  state.activeFast.fasting52Days = days;
  const { save } = window.__forge_store || {};
  if (save) save(); else localStorage.setItem('fitness_forge_v1', JSON.stringify(state));
  window.refreshFastingPage();
};

window.refreshFastingPage = () => {
  const el = document.getElementById('page-fasting');
  if (!el) return;
  el.innerHTML = renderFasting();
  scheduleFastingTimer();
};
