// ═══════════════════════════════════════════
//   FITNESS FORGE — Active Workout Logger
//   Live set-by-set session overlay
// ═══════════════════════════════════════════

import { state, logSession, recordPR, updateStreak, checkFirstSession } from '../store.js';
import { suggestNextSet, detectPR, computeSessionVolume, estimateOneRepMax } from '../engine/overload.js';
import { EXERCISES } from '../data/exercises.js';

let sessionState = null;  // current in-progress session
let timerInterval = null;
let startTime     = null;

// ── SESSION BOOTSTRAP ──

/**
 * Start an active workout session.
 * @param {string} workoutId   - e.g. 'Monday-phase2' or 'freestyle'
 * @param {string} workoutLabel - Human-readable label
 * @param {Array}  exercises   - [{ id, name, sets (str), reps (str), ... }]
 */
export function startActiveWorkout(workoutId, workoutLabel, exercises) {
  if (!exercises?.length) {
    alert('No exercises to log for this session.');
    return;
  }

  startTime = Date.now();

  sessionState = {
    workoutId,
    workoutLabel,
    date: new Date().toISOString(),
    exercises: exercises.map(ex => ({
      exId:   ex.id,
      exName: ex.name || EXERCISES[ex.id]?.name || ex.id,
      targetSets: parseInt(ex.sets) || 3,
      targetReps: ex.reps || '8–10',
      sets: [],
    })),
    notes: '',
  };

  renderOverlay();
  startTimer();
}

function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const el = document.getElementById('session-timer');
    if (el) el.textContent = formatDuration(Date.now() - startTime);
  }, 1000);
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${pad(m % 60)}:${pad(s % 60)}`;
  return `${pad(m)}:${pad(s % 60)}`;
}

function pad(n) { return String(n).padStart(2, '0'); }

// ── RENDER ──

function renderOverlay() {
  const mainArea = document.getElementById('main-area');
  if (!mainArea) return;

  // Hide existing pages
  mainArea.querySelectorAll('.page').forEach(p => p.style.display = 'none');

  const overlay = document.createElement('div');
  overlay.id = 'active-session-overlay';
  overlay.className = 'active-session-overlay';
  overlay.innerHTML = buildOverlayHTML();
  mainArea.appendChild(overlay);
}

function buildOverlayHTML() {
  const s = sessionState;
  return `
<div class="session-header">
  <div>
    <div class="label" style="margin-bottom:4px">Active Session</div>
    <div class="display" style="font-size:28px">${s.workoutLabel.toUpperCase()}</div>
  </div>
  <div style="display:flex;align-items:center;gap:16px">
    <div class="session-timer-wrap">
      <div class="label">Time</div>
      <div class="mono fire" id="session-timer" style="font-size:22px;font-weight:600">00:00</div>
    </div>
    <button class="btn btn-danger btn-sm" onclick="cancelActiveWorkout()">✕ Cancel</button>
  </div>
</div>

<div class="session-volume-bar">
  <span class="label">Total Volume:</span>
  <span class="mono fire" id="session-volume">0 lbs</span>
  <span class="label" style="margin-left:16px">Sets Done:</span>
  <span class="mono" id="session-sets-done">0</span>
</div>

<div id="session-exercises">
  ${s.exercises.map((ex, exIdx) => renderExerciseBlock(ex, exIdx)).join('')}
</div>

<div class="session-notes-wrap">
  <label class="label">Session Notes (optional)</label>
  <textarea id="session-notes" placeholder="How did it feel? Any PRs, pain points, notes..."
    style="width:100%;margin-top:8px;padding:10px;background:var(--bg-2);border:1px solid var(--border);color:var(--text);font-family:var(--ff-body);font-size:13px;border-radius:4px;resize:vertical;min-height:60px;box-sizing:border-box"></textarea>
</div>

<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:24px;padding-bottom:40px">
  <button class="btn btn-fire btn-lg" onclick="finishActiveWorkout()">✓ Finish &amp; Save Session</button>
  <button class="btn btn-ghost btn-lg" onclick="cancelActiveWorkout()">✕ Discard</button>
</div>
`;
}

function renderExerciseBlock(ex, exIdx) {
  const suggestion = suggestNextSet(ex.exId, ex.targetReps, state.sessions, state.profile);
  const pr = state.prs[ex.exId];
  const isBodyweight = suggestion.isBodyweight;

  // Build existing sets
  const existingSets = ex.sets.map((set, setIdx) => renderSetRow(exIdx, setIdx, set, isBodyweight)).join('');

  // Next set input row
  const nextSetNum = ex.sets.length;
  const setsLeft = ex.targetSets - ex.sets.filter(s => s.completed).length;

  return `
<div class="session-ex-block" id="ex-block-${exIdx}">
  <div class="session-ex-header">
    <div style="flex:1">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <div class="session-ex-name">${ex.exName}</div>
        <span class="tag t-dim" style="font-size:9px">${ex.targetSets}×${ex.targetReps}</span>
        ${pr ? `<span class="tag t-green" style="font-size:9px" title="1RM ~${pr.e1rm} lbs">PR: ${pr.weight}×${pr.reps}</span>` : ''}
      </div>
      ${suggestion && !suggestion.isColdStart ? `
        <div class="overload-suggest">
          💡 ${isBodyweight
            ? `Target: ${suggestion.reps} reps — ${suggestion.rationale}`
            : `${suggestion.weight} lbs × ${suggestion.reps} — ${suggestion.rationale}`
          }
        </div>
      ` : suggestion.isColdStart && suggestion.weight ? `
        <div class="overload-suggest">💡 Start ~${isBodyweight ? 'Bodyweight' : suggestion.weight + ' lbs'}</div>
      ` : ''}
    </div>
    <button class="btn btn-ghost btn-sm" onclick="addSetRow(${exIdx})" ${setsLeft <= 0 ? '' : ''}>+ Set</button>
  </div>

  <div class="set-rows-header">
    <span class="label" style="width:32px">#</span>
    ${isBodyweight ? '' : '<span class="label" style="flex:1">Weight (lbs)</span>'}
    <span class="label" style="flex:1">Reps</span>
    <span class="label" style="width:90px">RIR</span>
    <span style="width:36px"></span>
  </div>

  <div id="set-rows-${exIdx}">
    ${existingSets}
  </div>

  ${nextSetNum < ex.targetSets + 3 ? `
  <div class="set-input-row" id="next-set-${exIdx}">
    <span class="set-num">${nextSetNum + 1}</span>
    ${isBodyweight ? '' : `<input type="number" class="set-input" id="wi-${exIdx}" placeholder="${suggestion.weight || ''}" min="0" step="2.5" value="${suggestion.weight || ''}">`}
    <input type="number" class="set-input" id="ri-${exIdx}" placeholder="${suggestion.reps || ex.targetReps.split('–')[0] || 8}" min="1" step="1" value="${suggestion.reps || ''}">
    <div class="rir-selector" id="rir-${exIdx}">
      ${[0,1,2,3,4,5].map(r => `<button class="rir-btn" data-rir="${r}" onclick="setRIR(${exIdx}, ${r})">${r}</button>`).join('')}
    </div>
    <button class="btn-log-set" onclick="logSet(${exIdx})">✓</button>
  </div>
  ` : `<div class="muted fs12" style="padding:8px 0">All target sets logged — use + Set for more.</div>`}
</div>
`;
}

function renderSetRow(exIdx, setIdx, set, isBodyweight) {
  const cls = set.completed ? 'set-row set-row-done' : 'set-row';
  const rirLabel = set.rir != null ? set.rir : '–';
  return `
<div class="${cls}" id="set-row-${exIdx}-${setIdx}">
  <span class="set-num">${setIdx + 1}</span>
  ${isBodyweight ? '' : `<span class="set-val">${set.weight ? set.weight + ' lbs' : '–'}</span>`}
  <span class="set-val">${set.reps || '–'}</span>
  <span class="set-rir">${rirLabel !== '–' ? 'RIR ' + rirLabel : '–'}</span>
  ${set.completed ? '<span class="set-done-badge">✓</span>' : '<span></span>'}
</div>
`;
}

// ── GLOBAL HANDLERS ──

window.addSetRow = (exIdx) => {
  if (!sessionState) return;
  const ex = sessionState.exercises[exIdx];
  ex.targetSets = Math.min(ex.targetSets + 1, ex.targetSets + 1);
  refreshExerciseBlock(exIdx);
};

window.setRIR = (exIdx, rir) => {
  document.querySelectorAll(`#rir-${exIdx} .rir-btn`).forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.rir) === rir);
  });
  // Store pending RIR
  const block = document.getElementById(`ex-block-${exIdx}`);
  if (block) block.dataset.pendingRir = rir;
};

window.logSet = (exIdx) => {
  if (!sessionState) return;
  const ex = sessionState.exercises[exIdx];
  const isBodyweight = !document.getElementById(`wi-${exIdx}`);

  const weightEl = document.getElementById(`wi-${exIdx}`);
  const repsEl   = document.getElementById(`ri-${exIdx}`);
  const block    = document.getElementById(`ex-block-${exIdx}`);

  const weight = isBodyweight ? 0 : parseFloat(weightEl?.value || 0);
  const reps   = parseInt(repsEl?.value || 0);

  if (!reps || reps < 1) {
    repsEl?.classList.add('input-error');
    setTimeout(() => repsEl?.classList.remove('input-error'), 800);
    return;
  }

  const pendingRir = block?.dataset.pendingRir != null ? parseInt(block.dataset.pendingRir) : null;

  const setData = {
    setNum:    ex.sets.length + 1,
    weight:    isBodyweight ? 0 : weight,
    reps,
    rir:       pendingRir,
    completed: true,
    timestamp: Date.now(),
  };

  ex.sets.push(setData);

  // Check PR
  if (!isBodyweight && weight > 0) {
    const { isPR, previous, improvement } = detectPR(ex.exId, weight, reps, state.prs);
    if (isPR) {
      recordPR(ex.exId, weight, reps);
      showPRToast(ex.exName, weight, reps, estimateOneRepMax(weight, reps));
    }
  }

  updateVolumeDisplay();
  refreshExerciseBlock(exIdx);
};

window.cancelActiveWorkout = () => {
  if (confirm('Discard this session? All logged sets will be lost.')) {
    closeOverlay();
  }
};

window.finishActiveWorkout = () => {
  if (!sessionState) return;
  const totalSets = sessionState.exercises.reduce((s, ex) => s + ex.sets.filter(s => s.completed).length, 0);
  if (totalSets === 0 && !confirm('No sets logged. Save anyway?')) return;

  clearInterval(timerInterval);
  const durationMs = Date.now() - startTime;
  const durationMinutes = Math.round(durationMs / 60000);

  sessionState.notes = document.getElementById('session-notes')?.value || '';
  sessionState.totalVolume = computeSessionVolume(sessionState);
  sessionState.durationMinutes = durationMinutes;

  const sessionId = Date.now();
  sessionState.id = sessionId;

  logSession({ ...sessionState });
  updateStreak();
  checkFirstSession();

  showSessionSummary(sessionState);
  closeOverlay();
};

// ── HELPERS ──

function refreshExerciseBlock(exIdx) {
  const ex = sessionState.exercises[exIdx];
  const block = document.getElementById(`ex-block-${exIdx}`);
  if (!block) return;
  const suggestion = suggestNextSet(ex.exId, ex.targetReps, state.sessions, state.profile);
  const isBodyweight = suggestion.isBodyweight;
  block.outerHTML = renderExerciseBlock(ex, exIdx);
  updateVolumeDisplay();
}

function updateVolumeDisplay() {
  if (!sessionState) return;
  const vol  = computeSessionVolume(sessionState);
  const sets = sessionState.exercises.reduce((s, ex) => s + ex.sets.filter(s => s.completed).length, 0);
  const volEl  = document.getElementById('session-volume');
  const setsEl = document.getElementById('session-sets-done');
  if (volEl)  volEl.textContent  = vol > 0 ? `${vol.toLocaleString()} lbs` : '0 lbs';
  if (setsEl) setsEl.textContent = sets;
}

function closeOverlay() {
  clearInterval(timerInterval);
  sessionState = null;
  startTime    = null;

  const overlay = document.getElementById('active-session-overlay');
  if (overlay) overlay.remove();

  // Restore pages
  const mainArea = document.getElementById('main-area');
  if (mainArea) {
    mainArea.querySelectorAll('.page').forEach(p => p.style.display = '');
  }
}

function showPRToast(exName, weight, reps, e1rm) {
  const toast = document.createElement('div');
  toast.className = 'pr-toast';
  toast.innerHTML = `🏆 NEW PR — ${exName}: ${weight} lbs × ${reps} (est. 1RM: ${e1rm} lbs)`;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 50);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 3500);
}

function showSessionSummary(session) {
  const vol   = session.totalVolume || 0;
  const sets  = session.exercises.reduce((s, ex) => s + ex.sets.filter(s => s.completed).length, 0);
  const dur   = session.durationMinutes;
  const prs   = session.exercises.filter(ex => {
    const topSet = ex.sets.filter(s => s.completed && s.weight > 0).sort((a,b) => b.weight-a.weight)[0];
    return topSet && state.prs[ex.exId]?.weight === topSet.weight;
  });

  const toast = document.createElement('div');
  toast.className = 'session-summary-toast';
  toast.innerHTML = `
<div style="font-family:var(--ff-display);font-size:20px;margin-bottom:12px">SESSION COMPLETE 🔥</div>
<div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:8px">
  <div><div class="label">Sets</div><div class="mono fire">${sets}</div></div>
  <div><div class="label">Volume</div><div class="mono fire">${vol > 0 ? vol.toLocaleString() + ' lbs' : '—'}</div></div>
  <div><div class="label">Duration</div><div class="mono fire">${dur}m</div></div>
</div>
${prs.length ? `<div class="fs12" style="color:var(--forge-green)">🏆 ${prs.length} PR${prs.length > 1 ? 's' : ''} this session!</div>` : ''}
<button class="btn btn-fire btn-sm" style="margin-top:12px" onclick="this.closest('.session-summary-toast').remove()">Close</button>
`;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 50);
}
