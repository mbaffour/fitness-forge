import { exThumbHTML } from './modal.js';
import { getProgram } from '../data/programs.js';
import { completedProgramKey } from './program-tools.js';
import { programSuggestion, programProfile } from './program-coach.js';
// ═══════════════════════════════════════════
//   FITNESS FORGE — Active Workout Logger
//   Live set-by-set session overlay
// ═══════════════════════════════════════════

import { state, logSession, saveOk, recordPR, clampReps, clampSeconds, MAX_WEIGHT_LB, MAX_REPS, updateStreak, checkFirstSession, formatWeight, weightUnitLabel, toStoredWeight, toDisplayWeight, weightInputStep } from '../store.js';
import { suggestNextSet, detectPR, computeSessionVolume, estimateOneRepMax } from '../engine/overload.js';
import { EXERCISES, isStretch, subOf, rankedForGroup } from '../data/exercises.js';
import { cue, acquireWakeLock, releaseWakeLock, notify, countUp, sparkBurst } from './feedback.js';
import { toast } from './ui.js';

let sessionState = null;  // current in-progress session
let timerInterval = null;
let startTime     = null;
let editingSet    = null; // {exIdx,setIdx} currently being edited inline

// Detect exercises that are logged by TIME (holds/carries) rather than reps,
// and single-limb (unilateral) movements logged per-side. Honors an explicit
// data flag when present, else falls back to a name/muscle heuristic.
const _TIMED_RE = /plank|hollow|hang|carry|farmer|wall ?sit|l-?sit|dead ?hang|superman hold|isometric/i;
const _UNILAT_RE = /single-?arm|single-?leg|one-?arm|one-?leg|bulgarian|split squat|pistol|unilateral|\bstep-?up|lunge|concentration curl/i;
function isTimed(exId, exData) {
  if (exData?.timed != null) return !!exData.timed;
  return _TIMED_RE.test(exData?.name || exId || '');
}
function isUnilateral(exId, exData) {
  if (exData?.unilateral != null) return !!exData.unilateral;
  return _UNILAT_RE.test(exData?.name || exId || '');
}

// ── REST TIMER ──
let restInterval  = null;
let restTimeLeft  = 0;
let restPaused    = false;
let restNextUp    = '';   // "next up" label shown in the rest bar

function startRestTimer(seconds, nextUp = '') {
  clearInterval(restInterval);
  restTimeLeft = seconds;
  restPaused   = false;
  restNextUp   = nextUp;
  renderRestBar();
  restInterval = setInterval(tickRest, 1000);
}

function tickRest() {
  if (restPaused) return;
  restTimeLeft--;
  if (restTimeLeft <= 0) {
    clearInterval(restInterval);
    restInterval = null;
    cue('finish');
    // Local notification when the app is backgrounded (opt-in). Offline-safe.
    if (document.hidden && state.settings?.restNotify) {
      notify('Rest complete 🔥', restNextUp ? `Next: ${restNextUp}` : 'Time for your next set.');
    }
    _restoreTitle();
    const bar = document.getElementById('rest-timer-bar');
    if (bar) {
      bar.innerHTML = `<span class="rest-done-flash">REST DONE — GO! 🔥</span>`;
      setTimeout(() => bar?.remove(), 1800);
    }
    return;
  }
  if (restTimeLeft <= 3) cue('tick');  // soft countdown ticks for the last 3s
  updateRestBar();
  updateTitleCountdown();
}

// ── Tab-title countdown ──
// When the user switches tabs mid-rest, mirror the countdown in the tab title
// so it stays visible; restore the original title when rest ends.
const _origTitle = document.title;

function updateTitleCountdown() {
  if (!document.hidden) { _restoreTitle(); return; }
  const m = Math.floor(restTimeLeft / 60);
  const s = restTimeLeft % 60;
  document.title = `⏱ ${m > 0 ? `${m}:${pad(s)}` : `${restTimeLeft}s`} rest — Fitness Forge`;
}

function _restoreTitle() {
  if (document.title !== _origTitle) document.title = _origTitle;
}

function renderRestBar() {
  let bar = document.getElementById('rest-timer-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'rest-timer-bar';
    bar.className = 'rest-timer-bar';
    document.body.appendChild(bar);
  }
  updateRestBar();
}

function updateRestBar() {
  const bar = document.getElementById('rest-timer-bar');
  if (!bar) return;
  const urgent = restTimeLeft <= 10;
  bar.className = 'rest-timer-bar' + (urgent ? ' urgent' : '');
  const m = Math.floor(restTimeLeft / 60);
  const s = restTimeLeft % 60;
  const display = m > 0 ? `${m}:${pad(s)}` : `${restTimeLeft}`;
  bar.innerHTML = `
    <div>
      <div class="rest-label">Rest Timer${restNextUp ? ` · <span class="rest-next">Next: ${restNextUp}</span>` : ''}</div>
      <div class="rest-countdown" id="rest-cd">${display}</div>
    </div>
    <div class="rest-controls">
      <button class="rest-btn" onclick="toggleRestPause()">${restPaused ? '▶ Resume' : '⏸ Pause'}</button>
      <button class="rest-btn" onclick="adjustRest(30)">+30s</button>
      <button class="rest-btn" onclick="adjustRest(-15)">−15s</button>
      <button class="rest-btn rest-skip" onclick="skipRest()">Skip ✕</button>
    </div>
  `;
}

function stopRestTimer() {
  clearInterval(restInterval);
  restInterval = null;
  _restoreTitle();
  document.getElementById('rest-timer-bar')?.remove();
}


window.toggleRestPause = () => {
  restPaused = !restPaused;
  updateRestBar();
};
window.adjustRest = (delta) => {
  restTimeLeft = Math.max(1, restTimeLeft + delta);
  updateRestBar();
};
window.skipRest = () => stopRestTimer();

// ── SESSION BOOTSTRAP ──

/**
 * Start an active workout session.
 * @param {string} workoutId    - e.g. 'Monday-phase2' or 'freestyle'
 * @param {string} workoutLabel - Human-readable label
 * @param {Array}  exercises    - [{ id, name, sets (str), reps (str), ... }]
 * @param {string} [workoutType] - optional type tag e.g. 'calisthenics'
 */
export function startActiveWorkout(workoutId, workoutLabel, exercises, workoutType, programContext = null) {
  if (!exercises?.length) {
    alert('No exercises to log for this session.');
    return;
  }

  startTime = Date.now();

  sessionState = {
    workoutId,
    workoutLabel,
    ...(programContext || {}),
    workoutType: workoutType || 'strength',
    date: new Date().toISOString(),
    exercises: exercises.map(ex => {
      const exData = EXERCISES[ex.id] || {};
      return {
        exId:   ex.id,
        exName: ex.name || exData.name || ex.id,
        targetSets: parseInt(ex.sets) || 3,
        targetReps: ex.reps || '8–10',
        timed:      isTimed(ex.id, exData),
        unilateral: isUnilateral(ex.id, exData),
        groupId:    null,   // superset group (shared id links adjacent exercises)
        sets: [],
      };
    }),
    notes: '',
  };

  renderOverlay();
  startTimer();
  _saveDraft();
  cue('start');
  acquireWakeLock();   // keep the screen on for the whole session
}

// ── IN-PROGRESS DRAFT ──
// The session lived only in memory, so a reload, a crash, or a phone browser
// discarding the backgrounded tab between sets threw away the whole workout.
// Keep a draft beside the main state (not in it — an unfinished session must
// not reach backups, history or PRs) and pick it back up on boot.
const DRAFT_KEY = 'fitness_forge_active_session';
const DRAFT_MAX_AGE = 12 * 3600 * 1000;

function _saveDraft() {
  if (!sessionState) return;
  const notes = document.getElementById('session-notes')?.value;
  if (notes != null) sessionState.notes = notes;
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ v: 1, startTime, session: sessionState })); } catch { /* storage full/blocked — the save banner covers it */ }
}
window.saveSessionDraft = _saveDraft;
function _clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* nothing to clear */ }
}

/** Reopen an unfinished session saved before a reload. Returns true if one was resumed. */
export function resumeActiveWorkout() {
  if (sessionState) return false;
  let d = null;
  try { d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { d = null; }
  const s = d?.session;
  const fresh = Number.isFinite(d?.startTime) && Date.now() - d.startTime < DRAFT_MAX_AGE;
  // Ids go into inline handlers: only ones this app could have written.
  const exercises = Array.isArray(s?.exercises)
    ? s.exercises.filter(e => typeof e?.exId === 'string' && /^[A-Za-z0-9_]{1,80}$/.test(e.exId) && EXERCISES[e.exId])
        .map(e => ({ ...e, targetSets: parseInt(e.targetSets) || 3, sets: Array.isArray(e.sets) ? e.sets : [],
                     exName: String(e.exName || EXERCISES[e.exId].name).replace(/[<>"]/g, '') }))
    : [];
  if (!fresh || !exercises.length) { _clearDraft(); return false; }
  sessionState = { ...s, exercises,
    workoutLabel: String(s.workoutLabel || 'Workout').replace(/[<>"]/g, ''),
    notes: typeof s.notes === 'string' ? s.notes : '' };
  startTime = d.startTime;
  renderOverlay();
  const notesEl = document.getElementById('session-notes');
  if (notesEl) notesEl.value = sessionState.notes;
  updateVolumeDisplay();
  startTimer();
  acquireWakeLock();
  toast('Resumed your unfinished session');
  return true;
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
  document.body.classList.add('session-active');  // focus mode: hide nav chrome
  window.scrollTo(0, 0);   // started from low on a page — open at the header
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
  <span class="mono fire" id="session-volume">${formatWeight(0)}</span>
  <span class="label" style="margin-left:16px">Sets Done:</span>
  <span class="mono" id="session-sets-done">0</span>
</div>

<div id="session-exercises">
  ${s.exercises.map((ex, exIdx) => renderExerciseBlock(ex, exIdx)).join('')}
</div>

<button class="btn btn-ghost w100" style="margin-top:8px" onclick="addExerciseToSession()">+ Add Exercise</button>

<div class="session-notes-wrap">
  <label class="label">Session Notes (optional)</label>
  <textarea id="session-notes" oninput="saveSessionDraft()" placeholder="How did it feel? Any PRs, pain points, notes..."
    style="width:100%;margin-top:8px;padding:10px;background:var(--bg-2);border:1px solid var(--border);color:var(--text);font-family:var(--ff-body);font-size:13px;border-radius:4px;resize:vertical;min-height:60px;box-sizing:border-box"></textarea>
</div>

<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:24px;padding-bottom:40px">
  <button class="btn btn-fire btn-lg" onclick="finishActiveWorkout()">✓ Finish &amp; Save Session</button>
  <button class="btn btn-ghost btn-lg" onclick="cancelActiveWorkout()">✕ Discard</button>
</div>
`;
}

function renderExerciseBlock(ex, exIdx) {
  const suggestion = programSuggestion(ex.exId, ex.targetReps, state.sessions,
    programProfile(state.profile || {}, state.bodyLog || []),
    sessionState.programProgression ? { ...sessionState, targetSets: ex.targetSets } : null,
    state.settings?.progression || 'double');
  const pr = state.prs[ex.exId];
  const isBodyweight = suggestion.isBodyweight;
  const exData = EXERCISES[ex.exId];

  // Ghosted "last session" performance — confirm-not-type (Hevy/Strong pattern).
  const lastPerf = (() => {
    for (const s of (state.sessions || [])) {
      const e = s.exercises?.find(x => x.exId === ex.exId);
      const done = e?.sets?.filter(x => x.completed) || [];
      if (done.length) {
        const mw = Math.max(...done.map(x => x.weight || 0));
        const top = done.find(x => (x.weight || 0) === mw) || done[0];
        return isBodyweight ? `${top.reps} reps` : `${formatWeight(mw)} × ${top.reps}`;
      }
    }
    return null;
  })();

  // Build existing sets
  const existingSets = ex.sets.map((set, setIdx) => renderSetRow(exIdx, setIdx, set, isBodyweight)).join('');

  // Next set input row
  const nextSetNum = ex.sets.length;
  const setsLeft = ex.targetSets - ex.sets.filter(s => s.completed && !s.warmup).length;

  // Muscle tags
  const primaryMuscles  = exData?.musclesFull?.primary  || [];
  const secondaryMuscles = exData?.musclesFull?.secondary || [];
  const muscleTagsHTML = primaryMuscles.length ? `
    <div class="ex-muscles-row">
      ${primaryMuscles.map(m => `<span class="muscle-tag">${m}</span>`).join('')}
      ${secondaryMuscles.slice(0,2).map(m => `<span class="muscle-tag secondary">${m}</span>`).join('')}
    </div>` : '';

  // Form cues
  const cuesHTML = exData?.cues?.length ? `
    <details class="ex-cues">
      <summary>Form cues</summary>
      <ul>${exData.cues.map(c => `<li>${c}</li>`).join('')}</ul>
    </details>` : '';

  // Superset context: is this block grouped with the one above/below?
  const groupedAbove = exIdx > 0 && ex.groupId && sessionState.exercises[exIdx-1]?.groupId === ex.groupId;
  const groupedBelow = ex.groupId && sessionState.exercises[exIdx+1]?.groupId === ex.groupId;
  const inSuperset = !!(groupedAbove || groupedBelow);

  return `
<div class="session-ex-block${inSuperset ? ' in-superset' : ''}" id="ex-block-${exIdx}" data-group="${ex.groupId || ''}">
  ${inSuperset && !groupedAbove ? `<div class="superset-label">⛓ Superset</div>` : ''}
  <div class="session-ex-header">
    <div style="flex:1">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
<div class="session-ex-name">${exThumbHTML({ id: ex.exId, ...(EXERCISES[ex.exId] || {}) })}<span>${ex.exName}</span></div>
        <span class="tag t-dim" style="font-size:9px">${ex.targetSets}×${ex.timed ? 'time' : ex.targetReps}</span>
        ${ex.timed ? `<span class="tag t-steel" style="font-size:9px">⏱ timed</span>` : ''}
        ${ex.unilateral ? `<span class="tag t-steel" style="font-size:9px">↔ per side</span>` : ''}
        ${pr ? `<span class="tag t-green" style="font-size:9px" title="1RM ~${formatWeight(pr.e1rm)}">PR: ${formatWeight(pr.weight, false)}×${pr.reps}</span>` : ''}
      </div>
      ${muscleTagsHTML}
      ${suggestion && !suggestion.isColdStart ? `
        <div class="overload-suggest">
          💡 ${isBodyweight
            ? `Target: ${suggestion.reps} reps — ${suggestion.rationale}`
            : `${formatWeight(suggestion.weight)} × ${suggestion.reps} — ${suggestion.rationale}`
          }
        </div>
      ` : suggestion.isColdStart && suggestion.weight ? `
        <div class="overload-suggest">💡 Start ~${isBodyweight ? 'Bodyweight' : formatWeight(suggestion.weight)}</div>
      ` : ''}
      ${cuesHTML}
    </div>
    <div class="ex-actions">
      <button class="ex-act-btn" title="How to do it — demo, step-by-step walkthrough and video" onclick="openExDetail('${ex.exId}')">▶</button>
      ${exIdx > 0 ? `<button class="ex-act-btn" title="${groupedAbove ? 'Un-superset' : 'Superset with exercise above'}" onclick="toggleSuperset(${exIdx})">${groupedAbove ? '⛓✕' : '⛓'}</button>` : ''}
      <button class="ex-act-btn" title="Swap for a similar exercise" onclick="swapExercise(${exIdx})">⇄</button>
      <button class="ex-act-btn" title="Remove exercise" onclick="removeExerciseFromSession(${exIdx})">🗑</button>
      ${!ex.timed ? `<button class="ex-act-btn" title="Log all remaining sets with the shown weight × reps" onclick="logRemainingSets(${exIdx})">✓✓</button>` : ''}
      <button class="btn btn-ghost btn-sm" onclick="addSetRow(${exIdx})">+ Set</button>
    </div>
  </div>

  <div class="set-rows-header">
    <span class="label" style="width:32px">#</span>
    ${isBodyweight ? '' : `<span class="label" style="flex:1">Weight (${weightUnitLabel()})</span>`}
    <span class="label" style="flex:1">${ex.timed ? 'Time (s)' : ex.unilateral ? 'Reps/side' : 'Reps'}</span>
    <span class="label" style="width:90px">RIR</span>
    <span style="width:60px"></span>
  </div>

  <div id="set-rows-${exIdx}">
    ${existingSets}
  </div>

  ${lastPerf ? `<div class="set-prev mt-2">↩ Last session: ${lastPerf}</div>` : ''}

  ${nextSetNum < ex.targetSets + 3 ? `
  <div class="set-input-row" id="next-set-${exIdx}">
    <span class="set-num">${nextSetNum + 1}</span>
    ${isBodyweight ? '' : `<input type="number" class="set-input" id="wi-${exIdx}" placeholder="${toDisplayWeight(suggestion.weight) || ''}" min="0" step="${weightInputStep()}" value="${toDisplayWeight(suggestion.weight) || ''}" onkeydown="if(event.key==='Enter')logSet(${exIdx})"><button class="plate-calc-btn" title="Plate calculator" aria-label="Plate calculator" onclick="openPlateCalc(document.getElementById('wi-${exIdx}')?.value)">🏋</button>`}
    <input type="number" class="set-input" id="ri-${exIdx}" placeholder="${ex.timed ? '30' : (suggestion.reps || ex.targetReps.split('–')[0] || 8)}" min="1" step="1" value="${ex.timed ? '' : (suggestion.reps || '')}" onkeydown="if(event.key==='Enter')logSet(${exIdx})">
    ${ex.timed ? `<button class="ex-act-btn" id="tmr-${exIdx}" title="Hold timer" onclick="toggleSetTimer(${exIdx})">⏱</button>` : ''}
    <div class="rir-selector" id="rir-${exIdx}">
      ${[0,1,2,3,4,5].map(r => `<button class="rir-btn" data-rir="${r}" onclick="setRIR(${exIdx}, ${r})">${r}</button>`).join('')}
    </div>
    <button class="warmup-toggle" id="wu-${exIdx}" title="Mark as warm-up set (excluded from volume & PRs)" onclick="toggleWarmup(${exIdx})">W</button>
    <button class="btn-log-set" onclick="logSet(${exIdx})">✓</button>
  </div>
  ` : `<div class="muted fs12" style="padding:8px 0">All target sets logged — use + Set for more.</div>`}
</div>
`;
}

function renderSetRow(exIdx, setIdx, set, isBodyweight) {
  // Inline edit mode for this row?
  if (editingSet && editingSet.exIdx === exIdx && editingSet.setIdx === setIdx) {
    return `
<div class="set-row set-row-edit" id="set-row-${exIdx}-${setIdx}">
  <span class="set-num">${setIdx + 1}</span>
  ${isBodyweight ? '' : `<input type="number" class="set-input" id="edit-w-${exIdx}-${setIdx}" value="${toDisplayWeight(set.weight) || ''}" min="0" step="${weightInputStep()}">`}
  <input type="number" class="set-input" id="edit-r-${exIdx}-${setIdx}" value="${set.timed ? (set.seconds ?? '') : (set.reps ?? '')}" min="1" step="1">
  <button class="btn-log-set" title="Save" onclick="saveEditSet(${exIdx},${setIdx})">✓</button>
  <button class="ex-act-btn" title="Cancel" onclick="cancelEditSet(${exIdx})">✕</button>
</div>`;
  }
  const cls = set.completed ? 'set-row set-row-done' : 'set-row';
  const rirLabel = set.rir != null ? set.rir : '–';
  const valDisplay = set.timed ? `${set.seconds ?? '–'}s` : `${set.reps || '–'}${set.perSide ? '/side' : ''}`;
  return `
<div class="${cls}${set.warmup ? ' set-row-warmup' : ''}" id="set-row-${exIdx}-${setIdx}">
  <span class="set-num">${set.warmup ? 'W' : setIdx + 1}</span>
  ${isBodyweight ? '' : `<span class="set-val">${set.weight ? formatWeight(set.weight) : '–'}</span>`}
  <span class="set-val">${valDisplay}</span>
  <span class="set-rir">${rirLabel !== '–' ? 'RIR ' + rirLabel : '–'}</span>
  <span class="set-row-acts">
    <button class="ex-act-btn" title="Edit set" onclick="startEditSet(${exIdx},${setIdx})">✎</button>
    <button class="ex-act-btn" title="Delete set" onclick="deleteSet(${exIdx},${setIdx})">🗑</button>
  </span>
</div>
`;
}

// ── GLOBAL HANDLERS ──

window.addSetRow = (exIdx) => {
  if (!sessionState) return;
  sessionState.exercises[exIdx].targetSets += 1;   // was a no-op Math.min self-max
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

// Warm-up toggle for the pending set (excluded from volume + PRs).
window.toggleWarmup = (exIdx) => {
  const block = document.getElementById(`ex-block-${exIdx}`);
  if (!block) return;
  const on = block.dataset.pendingWarmup === '1';
  block.dataset.pendingWarmup = on ? '' : '1';
  document.getElementById(`wu-${exIdx}`)?.classList.toggle('active', !on);
};

// Inline count-up timer that fills the seconds field for timed holds/carries.
let _setTimer = null;
window.toggleSetTimer = (exIdx) => {
  const input = document.getElementById(`ri-${exIdx}`);
  const btn   = document.getElementById(`tmr-${exIdx}`);
  if (!input) return;
  if (_setTimer && _setTimer.exIdx === exIdx) { _stopSetTimer(); btn?.classList.remove('active'); return; }
  _stopSetTimer();
  let sec = parseInt(input.value) || 0;
  btn?.classList.add('active');
  _setTimer = { exIdx, iv: setInterval(() => { sec++; input.value = sec; }, 1000) };
};
function _stopSetTimer() { if (_setTimer) { clearInterval(_setTimer.iv); _setTimer = null; } }

// The next exercise in the same superset group that still owes sets, else null.
function _nextInSuperset(exIdx) {
  const ex = sessionState.exercises[exIdx];
  if (!ex?.groupId) return null;
  for (let j = exIdx + 1; j < sessionState.exercises.length; j++) {
    const e = sessionState.exercises[j];
    if (e.groupId !== ex.groupId) break;
    if (e.sets.filter(s => s.completed && !s.warmup).length < e.targetSets) return j;
  }
  // wrap to the first group member if this was the last member
  for (let j = 0; j < exIdx; j++) {
    const e = sessionState.exercises[j];
    if (e.groupId === ex.groupId && e.sets.filter(s => s.completed && !s.warmup).length < e.targetSets) return j;
  }
  return null;
}

function _nextUpLabel(exIdx) {
  const ex = sessionState.exercises[exIdx];
  const done = ex.sets.filter(s => s.completed && !s.warmup).length;
  if (done < ex.targetSets) return `${ex.exName} · set ${done + 1}`;
  const nx = sessionState.exercises[exIdx + 1];
  return nx ? `${nx.exName} · set 1` : 'Last exercise — finish strong';
}

// Read a typed weight in the display unit. `null` = reject and re-prompt:
// negative, zero, or above the store's ceiling. Clamping instead turned a
// typo of 1e308 lbs into a logged 5,000 lb set and a PR nothing could beat.
// An empty field is allowed (0) — bands and unloaded variations have no load.
function _readWeight(el) {
  const raw = String(el?.value ?? '').trim();
  if (raw === '') return 0;
  const n = parseFloat(raw);
  const lbs = n * toStoredWeight(1);          // 1 display unit in stored lbs
  if (!Number.isFinite(lbs) || lbs <= 0 || lbs > MAX_WEIGHT_LB) return null;
  return toStoredWeight(raw);
}
// Reps/seconds: 0 = reject (empty, < 1, or past the ceiling — not clamped).
function _readCount(el, timed) {
  const n = Math.round(Number(el?.value));
  if (!timed && n > MAX_REPS) return 0;
  return timed ? clampSeconds(el?.value) : clampReps(el?.value);
}
function _flagInput(el) {
  if (!el) return;
  el.classList.add('input-error');
  cue('error');
  setTimeout(() => el.classList.remove('input-error'), 800);
}

// Best estimated 1RM already on record for this lift: the stored PR, or a
// working set earlier in this session. PRs are only written to the store when
// the session is saved, so a typo you delete — or a session you discard —
// can no longer leave behind a record nothing will ever beat.
function _bestE1rm(exId, exclude) {
  let best = state.prs[exId]?.e1rm || 0;
  for (const e of sessionState?.exercises || []) {
    if (e.exId !== exId) continue;
    for (const st of e.sets) {
      if (st === exclude || !st.completed || st.warmup || st.timed || !(st.weight > 0) || !(st.reps <= 30)) continue;
      best = Math.max(best, estimateOneRepMax(st.weight, st.reps) || 0);
    }
  }
  return best;
}

window.logSet = (exIdx) => {
  if (!sessionState) return;
  const ex = sessionState.exercises[exIdx];
  const isBodyweight = !document.getElementById(`wi-${exIdx}`);

  const weightEl = document.getElementById(`wi-${exIdx}`);
  const repsEl   = document.getElementById(`ri-${exIdx}`);
  const block    = document.getElementById(`ex-block-${exIdx}`);
  _stopSetTimer();

  // Inputs are in the user's display unit; convert back to canonical lbs to store.
  // A typed negative or an out-of-range value re-prompts rather than being
  // clamped into something the user did not lift.
  const weight = isBodyweight ? 0 : _readWeight(weightEl);
  if (weight === null) { _flagInput(weightEl); return; }
  const count = _readCount(repsEl, ex.timed);
  if (!count || count < 1) { _flagInput(repsEl); return; }

  const warmup     = block?.dataset.pendingWarmup === '1';
  const pendingRir = block?.dataset.pendingRir != null ? parseInt(block.dataset.pendingRir) : null;

  const setData = {
    setNum:    ex.sets.length + 1,
    weight:    isBodyweight ? 0 : weight,
    reps:      ex.timed ? null : count,
    seconds:   ex.timed ? count : null,
    timed:     !!ex.timed,
    perSide:   !!ex.unilateral,
    warmup,
    rir:       warmup ? null : pendingRir,
    completed: true,
    timestamp: Date.now(),
  };

  ex.sets.push(setData);

  // PR only for real working sets: non-warmup, weighted, rep-based.
  let wasPR = false;
  if (!warmup && !ex.timed && !isBodyweight && weight > 0) {
    const best = _bestE1rm(ex.exId, setData);
    const { isPR } = detectPR(ex.exId, weight, count, best ? { [ex.exId]: { e1rm: best } } : {});
    if (isPR) {
      wasPR = true;
      showPRToast(ex.exName, weight, count, estimateOneRepMax(weight, count));
      cue('pr');
    }
  }
  if (!wasPR && !_quickLog) cue(warmup ? 'warmup' : 'setDone');
  // Sparks off the anvil where the set landed.
  if (!_quickLog) sparkBurst(document.querySelector(`#ex-block-${exIdx} .btn-log-set`));

  if (block) block.dataset.pendingWarmup = '';   // warm-up is per-set, reset after logging
  updateVolumeDisplay();
  refreshExerciseBlock(exIdx);

  // Rest handling. Warm-ups don't trigger a rest; quick-log batches rest once at
  // the end. In a superset, alternate to the paired exercise with no rest;
  // otherwise start the rest timer with a "next up".
  if (warmup || _quickLog) return;
  const ss = _nextInSuperset(exIdx);
  if (ss != null) {
    cue('go');
    scrollToExercise(ss);
  } else {
    const restSecs = sessionState?.programRestSeconds ?? state.settings?.restSeconds ?? 90;
    startRestTimer(restSecs, _nextUpLabel(exIdx));
  }
};

// ── QUICK-LOG: one tap logs every remaining target set with the shown values ──
// (confirm-not-type: the inputs re-render with the suggested weight × reps after
// each log, so each pass logs the suggestion unless the user typed otherwise.)
let _quickLog = false;
window.logRemainingSets = (exIdx) => {
  if (!sessionState) return;
  const ex = sessionState.exercises[exIdx];
  if (!ex || ex.timed) return;
  const remaining = () => ex.targetSets - ex.sets.filter(s => s.completed && !s.warmup).length;
  if (remaining() <= 0) return;
  _quickLog = true;
  let guard = 12;                       // hard stop if validation ever fails
  let before;
  do {
    before = ex.sets.length;
    window.logSet(exIdx);
  } while (remaining() > 0 && ex.sets.length > before && guard-- > 0);
  _quickLog = false;
  cue('setDone');
  const restSecs = sessionState?.programRestSeconds ?? state.settings?.restSeconds ?? 90;
  startRestTimer(restSecs, _nextUpLabel(exIdx));
};

// ── EDIT / DELETE LOGGED SETS ──
window.startEditSet = (exIdx, setIdx) => { editingSet = { exIdx, setIdx }; refreshExerciseBlock(exIdx); };
window.cancelEditSet = (exIdx) => { editingSet = null; refreshExerciseBlock(exIdx); };
window.saveEditSet = (exIdx, setIdx) => {
  const ex = sessionState?.exercises[exIdx];
  const set = ex?.sets[setIdx];
  if (!set) return;
  const wEl = document.getElementById(`edit-w-${exIdx}-${setIdx}`);
  const rEl = document.getElementById(`edit-r-${exIdx}-${setIdx}`);
  const count = _readCount(rEl, set.timed);
  if (!count || count < 1) { _flagInput(rEl); return; }
  // Same rule as logging: a negative or absurd weight re-prompts instead of
  // silently becoming a 0-load set.
  const w = wEl ? _readWeight(wEl) : 0;
  if (w === null) { _flagInput(wEl); return; }
  if (wEl) set.weight = w;
  if (set.timed) set.seconds = count; else set.reps = count;
  editingSet = null;
  updateVolumeDisplay();
  refreshExerciseBlock(exIdx);
  // PRs are written at finish from the sets as they stand, so an edit counts.
};
window.deleteSet = (exIdx, setIdx) => {
  const ex = sessionState?.exercises[exIdx];
  if (!ex) return;
  ex.sets.splice(setIdx, 1);
  ex.sets.forEach((s, i) => s.setNum = i + 1);
  if (editingSet && editingSet.exIdx === exIdx) editingSet = null;
  updateVolumeDisplay();
  refreshExerciseBlock(exIdx);
};

// ── SUPERSETS ──
window.toggleSuperset = (exIdx) => {
  if (!sessionState || exIdx < 1) return;
  const ex = sessionState.exercises[exIdx];
  const prev = sessionState.exercises[exIdx - 1];
  if (ex.groupId && ex.groupId === prev.groupId) {
    ex.groupId = null;   // unlink from the group above
  } else {
    ex.groupId = prev.groupId || (prev.groupId = Date.now() + '_' + exIdx);
  }
  refreshAllExercises();
};

// ── ADD / REMOVE EXERCISE MID-SESSION ──
window.removeExerciseFromSession = (exIdx) => {
  if (!sessionState) return;
  const ex = sessionState.exercises[exIdx];
  const hasLogged = ex.sets.some(s => s.completed);
  if (hasLogged && !confirm(`Remove ${ex.exName}? Its logged sets will be discarded.`)) return;
  sessionState.exercises.splice(exIdx, 1);
  refreshAllExercises();
  updateVolumeDisplay();
};

window.addExerciseToSession = (exId) => {
  if (!exId) { openExercisePicker(); return; }
  const exData = EXERCISES[exId];
  if (!exData) return;
  // Swap mode: replace the targeted exercise instead of appending.
  if (_swapIdx != null) {
    const i = _swapIdx; _swapIdx = null;
    const cur = sessionState.exercises[i];
    if (cur) {
      cur.exId = exId;
      cur.exName = exData.name || exId;
      cur.timed = isTimed(exId, exData);
      cur.unilateral = isUnilateral(exId, exData);
      cur.sets = [];   // different lift → start fresh
    }
    closeExercisePicker();
    refreshAllExercises();
    updateVolumeDisplay();
    return;
  }
  sessionState.exercises.push({
    exId, exName: exData.name || exId,
    targetSets: 3, targetReps: '8–10',
    timed: isTimed(exId, exData), unilateral: isUnilateral(exId, exData),
    groupId: null, sets: [],
  });
  closeExercisePicker();
  refreshAllExercises();
  scrollToExercise(sessionState.exercises.length - 1);
};

window.cancelActiveWorkout = () => {
  if (confirm('Discard this session? All logged sets will be lost.')) {
    closeOverlay();
  }
};

window.finishActiveWorkout = () => {
  if (!sessionState) return;
  const totalSets = sessionState.exercises.reduce((s, ex) => s + ex.sets.filter(x => x.completed && !x.warmup).length, 0);
  if (totalSets === 0 && !confirm('No working sets logged. Save anyway?')) return;

  clearInterval(timerInterval);
  const durationMs = Date.now() - startTime;
  const durationMinutes = Math.round(durationMs / 60000);

  sessionState.notes = document.getElementById('session-notes')?.value || '';
  sessionState.totalVolume = computeSessionVolume(sessionState);
  sessionState.durationMinutes = durationMinutes;

  const sessionId = Date.now();
  sessionState.id = sessionId;

  // Records are written now, from the sets as they finally stand — edited,
  // deleted and discarded sets never reach the PR board. Which lifts beat
  // their previous best is worked out first, for the summary.
  const prExIds = new Set();
  for (const ex of sessionState.exercises) {
    for (const st of ex.sets) {
      if (!st.completed || st.warmup || st.timed || !(st.weight > 0)) continue;
      if (detectPR(ex.exId, st.weight, st.reps, state.prs).isPR && recordPR(ex.exId, st.weight, st.reps)) {
        prExIds.add(ex.exId);
      }
    }
  }
  sessionState.prExIds = [...prExIds];

  const gp = state.goalProgram;
  const key = completedProgramKey(sessionState, gp, gp && getProgram(gp.id));
  const previousDone = Array.isArray(gp?.done) ? gp.done : [];
  if (key) gp.done = [...new Set([...previousDone, key])];
  // Persist the workout and program progress together; restore progress on failure.
  logSession({ ...sessionState });
  const persisted = saveOk();
  if (!persisted && key) gp.done = previousDone;
  updateStreak();
  checkFirstSession();

  showSessionSummary(sessionState, persisted);
  closeOverlay();
};

// ── HELPERS ──

function refreshExerciseBlock(exIdx) {
  const ex = sessionState.exercises[exIdx];
  const block = document.getElementById(`ex-block-${exIdx}`);
  if (!block) return;
  block.outerHTML = renderExerciseBlock(ex, exIdx);
  updateVolumeDisplay();
}

// Rebuild the whole exercise list (after add/remove/superset changes so every
// block's index and grouping context is correct).
function refreshAllExercises() {
  const host = document.getElementById('session-exercises');
  if (!host || !sessionState) return;
  host.innerHTML = sessionState.exercises.map((ex, i) => renderExerciseBlock(ex, i)).join('');
  _saveDraft();
}

function scrollToExercise(exIdx) {
  document.getElementById(`ex-block-${exIdx}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── EXERCISE PICKER (add mid-session) ──
let _pickerQ = '';
let _swapIdx = null;   // when set, the picker replaces this exercise instead of adding
let _swapGroup = '';   // muscle group a swap is restricted to
window.pickerSearch = (v) => { _pickerQ = (v || '').trim().toLowerCase(); _renderPickerResults(); };

// Swap an exercise mid-session for a similar one (same primary muscle group,
// available under the active gym profile). Opens the picker pre-filtered.
window.swapExercise = (exIdx) => {
  if (!sessionState) return;
  const ex = sessionState.exercises[exIdx];
  _swapIdx = exIdx;
  openExercisePicker();
  // Restrict to the same primary muscle, ranked like every generator ranks.
  // Pre-filling the search box with the group id matched names instead, so
  // swapping Chin-Ups ("back") offered Barbell Back Squat first.
  const g = (EXERCISES[ex.exId]?.groups || [])[0] || '';
  if (g) {
    _swapGroup = g;
    const inp = document.querySelector('#exercise-picker .lib-search');
    if (inp) inp.placeholder = `Search ${g} exercises…`;
    _renderPickerResults();
  }
  const title = document.querySelector('#exercise-picker .display');
  if (title) title.textContent = 'SWAP EXERCISE';
};

function _pickerList() {
  const inSession = new Set(sessionState.exercises.map(e => e.exId));
  const base = _swapGroup
    ? rankedForGroup(Object.entries(EXERCISES).map(([id, ex]) => ({ ...ex, id }))
        .filter(ex => ex.groups?.[0] === _swapGroup), _swapGroup).map(ex => [ex.id, ex])
    : Object.entries(EXERCISES);
  return base
    .filter(([id, ex]) => {
      if (inSession.has(id)) return false;
      if (!_pickerQ) return true;
      return `${ex.name} ${ex.muscle} ${id}`.toLowerCase().includes(_pickerQ);
    })
    .slice(0, 60);
}

function _renderPickerResults() {
  const el = document.getElementById('picker-results');
  if (!el) return;
  const list = _pickerList();
  el.innerHTML = list.length
    ? list.map(([id, ex]) => `
        <button class="picker-row" onclick="addExerciseToSession('${id}')">
          <span class="picker-name">${ex.name}</span>
          <span class="picker-muscle">${ex.muscle || ''}</span>
        </button>`).join('')
    : `<div class="dim fs12" style="padding:16px">No matches.</div>`;
}

function openExercisePicker() {
  document.getElementById('exercise-picker')?.remove();
  _pickerQ = '';
  _swapGroup = '';
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'exercise-picker';
  overlay.innerHTML = `
<div class="modal" style="max-width:460px" onclick="event.stopPropagation()">
  <div class="modal-head">
    <div><div class="label" style="margin-bottom:4px">Mid-session</div><div class="display" style="font-size:1.3rem">ADD EXERCISE</div></div>
    <button class="modal-close" onclick="closeExercisePicker()" aria-label="Close">✕</button>
  </div>
  <div class="modal-body">
    <input type="search" class="lib-search" placeholder="Search exercises…" oninput="pickerSearch(this.value)" autofocus>
    <div id="picker-results" class="picker-results"></div>
  </div>
</div>`;
  overlay.addEventListener('click', () => closeExercisePicker());
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  _renderPickerResults();
}
function closeExercisePicker() {
  document.getElementById('exercise-picker')?.remove();
  document.body.style.overflow = '';
  _swapIdx = null;   // cancel any pending swap
  _swapGroup = '';
}
window.closeExercisePicker = closeExercisePicker;

function updateVolumeDisplay() {
  if (!sessionState) return;
  const vol  = computeSessionVolume(sessionState);
  const sets = sessionState.exercises.reduce((s, ex) => s + ex.sets.filter(x => x.completed && !x.warmup).length, 0);
  const volEl  = document.getElementById('session-volume');
  const setsEl = document.getElementById('session-sets-done');
  if (volEl) countUp(volEl, vol, { format: (n) => formatWeight(Math.round(n)) });
  if (setsEl) setsEl.textContent = sets;
  _saveDraft();   // every set change funnels through here
}

function closeOverlay() {
  clearInterval(timerInterval);
  stopRestTimer();
  releaseWakeLock();
  _stopSetTimer();
  closeExercisePicker();
  _clearDraft();
  editingSet   = null;
  sessionState = null;
  startTime    = null;

  const overlay = document.getElementById('active-session-overlay');
  if (overlay) overlay.remove();
  document.body.classList.remove('session-active');  // exit focus mode

  // Restore pages
  const mainArea = document.getElementById('main-area');
  if (mainArea) {
    mainArea.querySelectorAll('.page').forEach(p => p.style.display = '');
  }

  // The page underneath was rendered before the session — re-render it so the
  // streak, session count and today's card reflect what was just logged.
  window.refreshCurrentPage?.();
}

function showPRToast(exName, weight, reps, e1rm) {
  const toast = document.createElement('div');
  toast.className = 'pr-toast pr-celebrate';
  toast.innerHTML = `🏆 NEW PR — ${exName}: ${formatWeight(weight)} × ${reps} (est. 1RM: ${formatWeight(e1rm)})`;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 50);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 3500);
  fireConfetti();
}

// Celebratory confetti burst in the design-system accent colors.
function fireConfetti() {
  const layer = document.createElement('div');
  layer.className = 'pr-confetti';
  const colors = ['var(--fire)', 'var(--forge-green)', 'var(--steel)', 'var(--ember)'];
  for (let i = 0; i < 60; i++) {
    const bit = document.createElement('i');
    bit.style.left = Math.random() * 100 + 'vw';
    bit.style.background = colors[i % colors.length];
    bit.style.animationDuration = (1.6 + Math.random() * 1.4) + 's';
    bit.style.animationDelay = (Math.random() * 0.5) + 's';
    bit.style.width = bit.style.height = (5 + Math.random() * 6) + 'px';
    layer.appendChild(bit);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 3600);
}

// ── PLATE CALCULATOR + WARM-UP RAMP ──
// Per-side plate breakdown for barbell loading, in the user's display unit.
// Opened from the 🏋 button beside any weight input (prefilled with that value).

const _PLATES = { lbs: [45, 35, 25, 10, 5, 2.5], kg: [25, 20, 15, 10, 5, 2.5, 1.25] };
const _BARS   = { lbs: [45, 35, 15],             kg: [20, 15, 10] };
let _pcBar = null;   // selected bar weight (in display unit)

const _isKg = () => weightUnitLabel() === 'kg';

// Round to the smallest achievable total increment (2 × smallest plate).
function _roundLoadable(w, unit, bar) {
  const inc = _PLATES[unit][_PLATES[unit].length - 1] * 2;
  return Math.max(bar, Math.round(w / inc) * inc);
}

function _plateBreakdown(total, bar, unit) {
  const perSide = (total - bar) / 2;
  if (perSide < -0.01) return null;
  const counts = [];
  let rem = perSide + 1e-9;
  for (const p of _PLATES[unit]) {
    const n = Math.floor(rem / p);
    if (n > 0) { counts.push([p, n]); rem -= n * p; }
  }
  return { counts, leftover: rem > 0.01 ? rem : 0 };
}

function _pcOutHTML(target, bar, unit) {
  const bd = _plateBreakdown(target, bar, unit);
  if (bd === null) {
    return `<div class="dim fs12" style="padding:12px 0">Target is below the bar weight (${bar} ${unit}) — no plates needed. Lighter? Use dumbbells.</div>`;
  }
  const plateRows = bd.counts.length ? bd.counts.map(([p, n]) => `
    <div class="plate-row">
      <span class="plate-count">${n}×</span>
      <span class="plate-label">${p} ${unit} plate${n > 1 ? 's' : ''}</span>
      <span class="plate-viz">${Array.from({ length: n }, () =>
        `<i style="height:${Math.round(14 + (p / _PLATES[unit][0]) * 22)}px"></i>`).join('')}</span>
    </div>`).join('')
    : `<div class="dim fs12" style="padding:8px 0">Empty bar — no plates.</div>`;

  const loadable = Math.round((target - bd.leftover * 2) * 100) / 100;
  const warmups = [
    { label: 'Empty bar', w: bar,            reps: 10 },
    { label: '55%',       w: loadable * 0.55, reps: 5 },
    { label: '70%',       w: loadable * 0.70, reps: 3 },
    { label: '85%',       w: loadable * 0.85, reps: 1 },
    { label: 'Work',      w: loadable,        reps: null },
  ].map(s => ({ ...s, w: _roundLoadable(s.w, unit, bar) }));

  return `
  <div class="sec-head" style="margin-bottom:4px">Per Side</div>
  <div class="plate-rows">${plateRows}</div>
  ${bd.leftover ? `<div class="dim fs11" style="margin-bottom:12px">≈ ${bd.leftover.toFixed(1)} ${unit}/side not loadable with standard plates — closest is <strong style="color:var(--fire)">${loadable} ${unit}</strong>.</div>` : ''}
  <div class="sec-head" style="margin:16px 0 4px">Warm-Up Ramp</div>
  ${warmups.map(s => `
    <div class="warmup-row">
      <span class="warmup-pct">${s.label}</span>
      <span class="warmup-w">${s.w} ${unit}</span>
      <span class="warmup-scheme">${s.reps ? `× ${s.reps}` : 'your sets'}</span>
    </div>`).join('')}`;
}

window.pcUpdate = () => {
  const unit = _isKg() ? 'kg' : 'lbs';
  const target = parseFloat(document.getElementById('pc-weight')?.value) || 0;
  const out = document.getElementById('pc-out');
  if (out) out.innerHTML = target > 0 ? _pcOutHTML(target, _pcBar, unit) : '<div class="dim fs12" style="padding:12px 0">Enter a target weight above.</div>';
};

window.pcSetBar = (b) => {
  _pcBar = b;
  document.querySelectorAll('#pc-bars .seg-btn').forEach(btn =>
    btn.classList.toggle('active', parseFloat(btn.dataset.bar) === b));
  window.pcUpdate();
};

window.closePlateCalc = () => {
  document.getElementById('plate-calc-modal')?.remove();
  document.body.style.overflow = '';
};

window.openPlateCalc = (weightDisp = null) => {
  document.getElementById('plate-calc-modal')?.remove();
  const unit = _isKg() ? 'kg' : 'lbs';
  if (_pcBar == null || !_BARS[unit].includes(_pcBar)) _pcBar = _BARS[unit][0];

  // The set-weight input is already in the user's display unit — use as-is.
  const initial = parseFloat(weightDisp);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'plate-calc-modal';
  overlay.innerHTML = `
<div class="modal" style="max-width:420px" onclick="event.stopPropagation()">
  <div class="modal-head">
    <div>
      <div class="label" style="margin-bottom:4px">Barbell Loading</div>
      <div class="display" style="font-size:1.3rem">PLATE CALCULATOR</div>
    </div>
    <button class="modal-close" onclick="closePlateCalc()" aria-label="Close">✕</button>
  </div>
  <div class="modal-body">
    <label class="label">Target Weight (${unit})</label>
    <input type="number" class="set-input" id="pc-weight" style="width:100%;box-sizing:border-box;margin:8px 0 14px"
           min="0" step="${unit === 'kg' ? 2.5 : 5}" value="${!isNaN(initial) && initial > 0 ? initial : ''}"
           oninput="pcUpdate()" placeholder="e.g. ${unit === 'kg' ? 60 : 135}">
    <label class="label">Bar</label>
    <div class="seg" id="pc-bars" style="margin:8px 0 4px">
      ${_BARS[unit].map(b => `<button class="seg-btn ${b === _pcBar ? 'active' : ''}" data-bar="${b}" onclick="pcSetBar(${b})">${b} ${unit}</button>`).join('')}
    </div>
    <div id="pc-out"></div>
  </div>
</div>`;
  overlay.addEventListener('click', () => window.closePlateCalc());
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  window.pcUpdate();
  document.getElementById('pc-weight')?.focus();
};

function showSessionSummary(session, persisted = true) {
  const vol   = session.totalVolume || 0;
  const sets  = session.exercises.reduce((s, ex) => s + ex.sets.filter(x => x.completed && !x.warmup).length, 0);
  const dur   = session.durationMinutes;
  const prs   = session.prExIds || [];

  // The muscles this session actually worked — strength sets only, primary
  // target, most-hit first — so the cool-down offer stretches what you used.
  // A stretch routine gets no offer: you have just done one.
  const hits = {};
  for (const ex of session.exercises) {
    const data = EXERCISES[ex.exId];
    if (!data || isStretch({ id: ex.exId, ...data })) continue;
    if (!ex.sets.some(x => x.completed && !x.warmup)) continue;
    const g = subOf({ id: ex.exId, ...data });   // lower back, not "back", after back extensions
    if (g) hits[g] = (hits[g] || 0) + 1;
  }
  const worked = Object.entries(hits).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([g]) => g)
    .filter(g => /^[a-z_]+$/.test(g));   // group ids go into an inline handler

  const toast = document.createElement('div');
  toast.className = 'session-summary-toast';
  toast.innerHTML = `
<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
  <span style="font-family:var(--ff-display);font-size:20px">${persisted ? 'SESSION COMPLETE 🔥' : 'SESSION NOT SAVED'}</span>
</div>
<div style="font-family:var(--ff-mono);font-size:10px;color:var(--${persisted ? 'forge-green' : 'danger'});margin-bottom:12px;letter-spacing:0.12em">
  ${persisted ? '✓ SAVED TO YOUR LOG' : '⚠ NOT SAVED — STORAGE FULL'}
</div>
<div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:8px">
  <div><div class="label">Sets</div><div class="mono fire">${sets}</div></div>
  <div><div class="label">Volume</div><div class="mono fire">${vol > 0 ? formatWeight(vol) : '—'}</div></div>
  <div><div class="label">Duration</div><div class="mono fire">${dur}m</div></div>
</div>
${prs.length ? `<div class="fs12" style="color:var(--forge-green);margin-bottom:8px">🏆 ${prs.length} PR${prs.length > 1 ? 's' : ''} this session!</div>` : ''}
<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
  ${worked.length ? `<button class="btn btn-secondary btn-sm" onclick="this.closest('.session-summary-toast').remove();bodyMapStretchFor(${JSON.stringify(worked).replace(/"/g, "'")})"
     title="A short hold routine for the muscles you just trained">🧘 Stretch what you trained</button>` : ''}
  <button class="btn btn-fire btn-sm" onclick="navigate('cardio');this.closest('.session-summary-toast').remove()">View Log →</button>
  <button class="btn btn-ghost btn-sm" onclick="this.closest('.session-summary-toast').remove()">Close</button>
</div>
`;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 50);
}
