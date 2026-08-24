// ═══════════════════════════════════════════
//   FITNESS FORGE — Import from other apps
//   Parses Strong / Hevy / FitNotes CSV exports
//   into Fitness Forge sessions. Weights are
//   normalized to canonical lbs on the way in.
// ═══════════════════════════════════════════

import { state, save, recordPR } from '../store.js';
import { EXERCISES } from '../data/exercises.js';

const LBS_PER_KG = 2.20462;

// ── CSV PARSER (quoted fields, comma or semicolon delimiter) ──
function _detectDelim(headerLine) {
  const c = (headerLine.match(/,/g) || []).length;
  const s = (headerLine.match(/;/g) || []).length;
  return s > c ? ';' : ',';
}

function _parseCSV(text) {
  const clean = text.replace(/^﻿/, '');           // strip BOM
  const firstLine = clean.slice(0, clean.indexOf('\n') < 0 ? clean.length : clean.indexOf('\n'));
  const delim = _detectDelim(firstLine);
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQ) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += ch;
    } else if (ch === '"') { inQ = true; }
    else if (ch === delim) { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch === '\r') { /* skip */ }
    else field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}

const _num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? 0 : n; };

// ── EXERCISE NAME MATCHING ──
let _nameIndex = null;
// Normalize a name for comparison: drop parenthetical equipment tags that other
// apps append ("Bench Press (Barbell)"), then reduce to significant word tokens.
const _STOP = new Set(['the', 'a', 'with', 'and', 'of']);
function _tokens(s) {
  return String(s).toLowerCase()
    .replace(/\([^)]*\)/g, ' ')                 // strip "(Barbell)" etc.
    .replace(/[^a-z0-9]+/g, ' ')
    .trim().split(/\s+/).filter(w => w && !_STOP.has(w));
}
function _buildNameIndex() {
  const flat = (s) => _tokens(s).join('');
  const idx = {};      // flattened-name -> id
  const tokMap = [];   // [{id, toks:Set}]
  for (const [id, ex] of Object.entries(EXERCISES)) {
    idx[flat(ex.name)] = id;
    tokMap.push({ id, toks: new Set(_tokens(ex.name)) });
  }
  return { idx, tokMap, flat };
}
function _matchExercise(name) {
  if (!_nameIndex) _nameIndex = _buildNameIndex();
  const { idx, tokMap, flat } = _nameIndex;
  const key = flat(name);
  if (idx[key]) return idx[key];
  for (const k in idx) if (k.includes(key) || key.includes(k)) return idx[k];
  // Token-overlap: best Jaccard over the incoming tokens (handles word order,
  // "Conventional Deadlift" vs "Deadlift (Barbell)").
  const inToks = new Set(_tokens(name));
  if (!inToks.size) return null;
  let best = null, bestScore = 0;
  for (const { id, toks } of tokMap) {
    let inter = 0; for (const t of inToks) if (toks.has(t)) inter++;
    const score = inter / (inToks.size + toks.size - inter);
    if (score > bestScore) { bestScore = score; best = id; }
  }
  return bestScore >= 0.5 ? best : null;   // require solid overlap, else keep by name
}

// ── FORMAT PARSERS → normalized session list ──
// Each returns { format, sourceUnit ('kg'|'lbs'|null), sessions:[{date,label,rows:[{exName,weight,reps,warmup}]}] }

function _col(header, ...names) {
  for (const n of names) { const i = header.indexOf(n); if (i >= 0) return i; }
  return -1;
}

function _parseHevy(rows, header) {
  const ci = {
    title: _col(header, 'title'), date: _col(header, 'start_time'),
    ex: _col(header, 'exercise_title'), w: _col(header, 'weight_kg', 'weight'),
    reps: _col(header, 'reps'), type: _col(header, 'set_type'),
  };
  const out = {};
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const date = (r[ci.date] || '').slice(0, 10);
    const key = `${date}|${r[ci.title] || 'Workout'}`;
    (out[key] = out[key] || { date, label: r[ci.title] || 'Imported Workout', rows: [] }).rows.push({
      exName: r[ci.ex] || '', weight: _num(r[ci.w]), reps: Math.round(_num(r[ci.reps])),
      warmup: /warm/i.test(r[ci.type] || ''),
    });
  }
  return { format: 'Hevy', sourceUnit: 'kg', sessions: Object.values(out) };
}

function _parseStrong(rows, header) {
  const ci = {
    date: _col(header, 'date'), name: _col(header, 'workout name', 'workout_name'),
    ex: _col(header, 'exercise name', 'exercise_name'), w: _col(header, 'weight', 'weight_kg', 'weight_lb'),
    reps: _col(header, 'reps'),
  };
  const out = {};
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const date = (r[ci.date] || '').slice(0, 10);
    const key = `${date}|${r[ci.name] || 'Workout'}`;
    (out[key] = out[key] || { date, label: r[ci.name] || 'Imported Workout', rows: [] }).rows.push({
      exName: r[ci.ex] || '', weight: _num(r[ci.w]), reps: Math.round(_num(r[ci.reps])), warmup: false,
    });
  }
  return { format: 'Strong', sourceUnit: null, sessions: Object.values(out) };
}

function _parseFitNotes(rows, header) {
  const ci = { date: _col(header, 'date'), ex: _col(header, 'exercise'), w: _col(header, 'weight'), reps: _col(header, 'reps') };
  const out = {};
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const date = (r[ci.date] || '').slice(0, 10);
    (out[date] = out[date] || { date, label: 'Imported Workout', rows: [] }).rows.push({
      exName: r[ci.ex] || '', weight: _num(r[ci.w]), reps: Math.round(_num(r[ci.reps])), warmup: false,
    });
  }
  return { format: 'FitNotes', sourceUnit: null, sessions: Object.values(out) };
}

export function parseWorkoutCSV(text) {
  const rows = _parseCSV(text);
  if (rows.length < 2) return { format: 'unknown', sessions: [] };
  const header = rows[0].map(h => h.trim().toLowerCase());
  if (header.includes('exercise_title') || header.includes('start_time')) return _parseHevy(rows, header);
  if (header.includes('set order') || header.includes('workout name') || header.includes('workout_name')) return _parseStrong(rows, header);
  if (header.includes('exercise') && header.includes('reps')) return _parseFitNotes(rows, header);
  return { format: 'unknown', sessions: [] };
}

// ── COMMIT PARSED DATA INTO STATE ──
// unit: the unit the source weights are in ('kg' | 'lbs').
export function importParsed(parsed, unit) {
  const toLbs = (w) => unit === 'kg' ? w * LBS_PER_KG : w;
  let sessCount = 0, setCount = 0, prCount = 0, matched = 0, unmatched = 0;

  for (const s of parsed.sessions) {
    const byEx = {};
    for (const row of s.rows) {
      if (!row.exName) continue;
      const exId = _matchExercise(row.exName) || `imp_${row.exName.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 24)}`;
      exId.startsWith('imp_') ? unmatched++ : matched++;
      (byEx[exId] = byEx[exId] || { exId, exName: EXERCISES[exId]?.name || row.exName, sets: [] }).sets.push({
        weight: Math.round(toLbs(row.weight)), reps: row.reps, warmup: !!row.warmup, completed: true, rir: null,
      });
      setCount++;
    }
    const exercises = Object.values(byEx);
    if (!exercises.length) continue;
    let vol = 0;
    for (const ex of exercises) for (const st of ex.sets) if (!st.warmup) vol += st.weight * st.reps;
    const id = Date.parse(s.date + 'T12:00:00') || (1700000000000 + sessCount);
    state.sessions.unshift({
      id, date: new Date((Date.parse(s.date) || id)).toISOString(),
      workoutLabel: s.label, workoutType: 'strength', exercises,
      totalVolume: vol, durationMinutes: 0, notes: `Imported from ${parsed.format}`, imported: true,
    });
    state.workoutLog.unshift({
      id, date: new Date((Date.parse(s.date) || id)).toISOString(),
      label: s.label, type: 'strength', phase: state.currentPhase, week: state.currentWeek,
      sessionId: id, totalVolume: vol, duration: 0, notes: `Imported from ${parsed.format}`,
    });
    // Record PRs from the best working set per exercise.
    for (const ex of exercises) {
      const best = ex.sets.filter(st => !st.warmup && st.weight > 0 && st.reps > 0).sort((a, b) => (b.weight * (1 + b.reps / 30)) - (a.weight * (1 + a.reps / 30)))[0];
      if (best && recordPR(ex.exId, best.weight, best.reps)) prCount++;
    }
    sessCount++;
  }
  if (state.sessions.length > 400) state.sessions.length = 400;
  if (state.workoutLog.length > 500) state.workoutLog.length = 500;
  save();
  return { sessCount, setCount, prCount, matched, unmatched };
}

// ── UI ──
window.closeImportDialog = () => { document.getElementById('import-modal')?.remove(); document.body.style.overflow = ''; };

let _pendingParsed = null;

window.openImportDialog = () => {
  document.getElementById('import-modal')?.remove();
  _pendingParsed = null;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'import-modal';
  overlay.innerHTML = `
<div class="modal" style="max-width:440px" onclick="event.stopPropagation()">
  <div class="modal-head">
    <div><div class="label" style="margin-bottom:4px">Migrate</div><div class="display" style="font-size:1.3rem">IMPORT WORKOUTS</div></div>
    <button class="modal-close" onclick="closeImportDialog()" aria-label="Close">✕</button>
  </div>
  <div class="modal-body">
    <p class="dim fs12" style="line-height:1.6;margin-bottom:14px">Import your history from <strong>Strong</strong>, <strong>Hevy</strong>, or <strong>FitNotes</strong>. Export a CSV from that app, then choose it here. Weights convert to your stored unit; sessions are added to your log.</p>
    <label class="label">Source weight unit</label>
    <select id="import-unit" class="form-input" style="width:100%;margin:6px 0 14px">
      <option value="lbs">Pounds (lbs)</option>
      <option value="kg">Kilograms (kg)</option>
    </select>
    <div class="dim fs11" style="margin-bottom:6px">(Hevy exports are always kg and auto-detected.)</div>
    <input type="file" id="import-csv-file" accept=".csv,text/csv" class="form-input" style="width:100%;box-sizing:border-box"
           onchange="previewImport(this.files[0])">
    <div id="import-preview" style="margin-top:14px"></div>
  </div>
</div>`;
  overlay.addEventListener('click', () => window.closeImportDialog());
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
};

window.previewImport = (file) => {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const parsed = parseWorkoutCSV(String(reader.result));
    _pendingParsed = parsed;
    const box = document.getElementById('import-preview');
    if (parsed.format === 'unknown' || !parsed.sessions.length) {
      box.innerHTML = `<div class="dim fs12" style="color:var(--danger)">Couldn't recognize this CSV. Make sure it's a Strong, Hevy, or FitNotes export.</div>`;
      return;
    }
    if (parsed.sourceUnit === 'kg') document.getElementById('import-unit').value = 'kg';
    const sets = parsed.sessions.reduce((n, s) => n + s.rows.length, 0);
    box.innerHTML = `
      <div class="card" style="padding:12px;margin-bottom:12px">
        <div class="fs13"><strong>${parsed.format}</strong> detected</div>
        <div class="dim fs12" style="margin-top:4px">${parsed.sessions.length} sessions · ${sets} sets</div>
      </div>
      <button class="btn btn-fire btn-lg w100" onclick="confirmImport()">Import ${parsed.sessions.length} Sessions</button>`;
  };
  reader.readAsText(file);
};

window.confirmImport = () => {
  if (!_pendingParsed) return;
  const unit = document.getElementById('import-unit')?.value || 'lbs';
  const r = importParsed(_pendingParsed, unit);
  const box = document.getElementById('import-preview');
  box.innerHTML = `
    <div class="card" style="padding:14px">
      <div class="fs13" style="color:var(--forge-green);margin-bottom:6px">✓ Imported ${r.sessCount} sessions</div>
      <div class="dim fs12" style="line-height:1.7">
        ${r.setCount} sets · ${r.prCount} PRs detected<br>
        ${r.matched} exercises matched${r.unmatched ? ` · ${r.unmatched} kept by name` : ''}
      </div>
      <button class="btn btn-fire w100" style="margin-top:12px" onclick="closeImportDialog();navigate('progress')">View Progress →</button>
    </div>`;
};
