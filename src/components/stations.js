// ═══════════════════════════════════════════
//   FITNESS FORGE — Stations
//   Pick one tool and work through everything you can do with it.
//
//   Distinct from the Equipment page, which asks what you OWN and hands back
//   a generated session. This is the view you want standing at the cable
//   stack: what does this machine do, what is worth doing on it, and what
//   should I load — then either learn a movement or train the whole station.
// ═══════════════════════════════════════════

import { state, formatWeight } from '../store.js';
import { EXERCISES, EQUIP_ITEMS, MUSCLE_GROUPS, isStrengthExercise, stapleRank } from '../data/exercises.js';
import { suggestNextSet } from '../engine/overload.js';
import { cue } from './feedback.js';
import { toast, pageHeader, sectionHead, emptyState } from './ui.js';
import { exThumbHTML } from './modal.js';

// A bench is a surface, not a station — on its own it has one movement, and
// every press and row that uses one is really a dumbbell or barbell movement.
// So it is allowed as a SUPPORT inside another station rather than listed.
const SUPPORTS = new Set(['bench']);

// Bodyweight gets a station of its own: it is the one everybody always has.
const BODYWEIGHT = { id: '__bw', label: 'Bodyweight', icon: '🤸', blurb: 'No kit at all — anywhere, any time' };

const BLURBS = {
  dumbbells:        'The most versatile thing in any gym',
  barbell:          'Heaviest loads, the classic strength lifts',
  kettlebell:       'Swings, carries and everything ballistic',
  resistance_bands: 'Packable, joint-friendly, constant tension',
  cable:            'Constant tension through the whole range',
  pull_up_bar:      'Hanging work — the cheapest upper body there is',
  machine:          'Fixed paths — easiest to learn and push close to failure',
};

// Minimum movements before a tool earns its own station. Rings/TRX currently
// resolves to zero and the ab wheel to one, so neither is listed; they still
// appear inside the Equipment page's coverage grid.
const MIN_MOVEMENTS = 5;

let _tool = null;      // selected station id, or null for the picker
let _muscle = 'all';   // muscle filter within a station

// Every strength movement performed with this tool and nothing else beyond a
// support. `__bw` means it needs no equipment at all.
function movementsFor(toolId) {
  const bodyweight = toolId === BODYWEIGHT.id;
  const allowed = new Set([toolId, ...SUPPORTS]);
  return Object.entries(EXERCISES)
    .filter(([, ex]) => {
      if (ex.caliOnly || !isStrengthExercise(ex)) return false;
      const req = ex.requires || [];
      if (bodyweight) return req.length === 0;
      return req.includes(toolId) && req.every((r) => allowed.has(r));
    })
    .map(([id, ex]) => ({ id, ...ex }));
}

function stations() {
  const list = EQUIP_ITEMS
    .filter((it) => !SUPPORTS.has(it.id))
    .map((it) => ({ ...it, blurb: BLURBS[it.id] || '', movements: movementsFor(it.id) }))
    .filter((s) => s.movements.length >= MIN_MOVEMENTS);
  return [{ ...BODYWEIGHT, movements: movementsFor(BODYWEIGHT.id) }, ...list];
}

const groupsOf = (movs) => MUSCLE_GROUPS.filter((g) => movs.some((m) => m.groups?.[0] === g.id));

// What to load, from the same engine every other surface uses — so a movement
// shows the weight your history says you should be on, not a generic number.
function loadFor(ex) {
  const sug = suggestNextSet(ex.id, '8–10', state.sessions || [], state.profile || {},
                             state.settings?.progression || 'double');
  if (sug.isBodyweight) return 'BW';
  if (sug.weight == null) return '';
  const perHand = (ex.requires || []).some((r) => r === 'dumbbells' || r === 'kettlebell')
    && !/goblet|single[- ]?arm|one[- ]?arm|suitcase|swing/i.test(ex.name || '');
  return `${formatWeight(sug.weight)}${perHand ? '/hand' : ''}`;
}

// ── PICKER ──────────────────────────────────────────────────────────────────
function pickerHTML() {
  const cards = stations().map((s) => {
    const cov = groupsOf(s.movements).length;
    return `
    <button class="st-card" onclick="stationOpen('${s.id}')">
      <span class="st-ic">${s.icon}</span>
      <span class="st-body">
        <span class="st-name">${s.label}</span>
        <span class="st-blurb">${s.blurb}</span>
      </span>
      <span class="st-meta">
        <b>${s.movements.length}</b><i>moves</i>
        <b>${cov}/${MUSCLE_GROUPS.length}</b><i>groups</i>
      </span>
    </button>`;
  }).join('');

  return `
${pageHeader('STATIONS', { eyebrow: 'Pick a tool', sub: 'Choose one piece of kit and work through everything it can do' })}
<div class="st-grid">${cards}</div>
<div class="dim fs12" style="margin-top:18px;line-height:1.6">
  A station lists every movement that needs <b>only</b> that tool — a bench counts as a
  surface, not a second piece of kit. Looking for what your whole gym can cover instead?
  <span class="is-tappable" style="color:var(--fire)" onclick="navigate('equipment')">Equipment →</span>
</div>`;
}

// ── STATION DETAIL ──────────────────────────────────────────────────────────
function detailHTML(station) {
  const movs = station.movements;
  const groups = groupsOf(movs);
  const active = _muscle !== 'all' && groups.some((g) => g.id === _muscle) ? _muscle : 'all';

  const chips = [`<button class="st-chip ${active === 'all' ? 'on' : ''}" onclick="stationMuscle('all')">All ${movs.length}</button>`]
    .concat(groups.map((g) => {
      const n = movs.filter((m) => m.groups?.[0] === g.id).length;
      return `<button class="st-chip ${active === g.id ? 'on' : ''}" onclick="stationMuscle('${g.id}')">${g.icon} ${g.label} ${n}</button>`;
    })).join('');

  const shown = groups.filter((g) => active === 'all' || g.id === active);
  const sections = shown.map((g) => {
    const rows = movs
      .filter((m) => m.groups?.[0] === g.id)
      .sort((a, b) => stapleRank(a, g.id) - stapleRank(b, g.id)
                   || (a.type === 'compound' ? 0 : 1) - (b.type === 'compound' ? 0 : 1)
                   || (a.name || '').localeCompare(b.name || ''))
      .map((m) => {
        const load = loadFor(m);
        return `
      <div class="st-row">
        <span class="st-row-main is-tappable" onclick="openExDetail('${m.id}')">
          ${exThumbHTML(m)}
          <span class="st-row-text">
            <span class="st-row-name">${m.name}</span>
            <span class="st-row-sub">${m.type || 'exercise'}${m.cues?.length ? ' · coached' : ''}</span>
          </span>
        </span>
        <span class="st-row-right">
          ${load ? `<span class="st-load">${load}</span>` : ''}
          <button class="bm-demo" onclick="event.stopPropagation();openExDetail('${m.id}')"
                  title="How to do it — demo, form cues and video" aria-label="How to do this exercise">▶</button>
        </span>
      </div>`;
      }).join('');
    return `${sectionHead(`${g.icon} ${g.label}`)}<div class="st-list">${rows}</div>`;
  }).join('');

  return `
${pageHeader(station.label.toUpperCase(), { eyebrow: 'Station', sub: station.blurb })}
<div class="st-bar">
  <button class="btn btn-ghost btn-sm" onclick="stationOpen(null)">← All stations</button>
  <button class="btn btn-fire btn-sm" onclick="stationStart('${station.id}')">⚡ Train this station</button>
</div>
<div class="st-chips">${chips}</div>
${movs.length ? sections : emptyState('🔧', 'No movements found for this station.')}`;
}

export function renderStations() {
  const all = stations();
  const station = _tool ? all.find((s) => s.id === _tool) : null;
  return station ? detailHTML(station) : pickerHTML();
}

function rerender() {
  const el = document.getElementById('page-stations');
  if (el) el.innerHTML = renderStations();
  document.getElementById('main-area')?.scrollTo(0, 0);
}

// ── HANDLERS ────────────────────────────────────────────────────────────────
window.stationOpen = (id) => {
  _tool = id || null;
  _muscle = 'all';
  if (id) cue('select');
  rerender();
};

window.stationMuscle = (m) => { _muscle = m; cue('select'); rerender(); };

// Build a balanced session from this station alone: the best movement per
// muscle group, then compounds first across the whole session.
//
// Taking groups in a fixed order and stopping at six filled the slots with
// whatever each group offered in turn, so a cable session opened with Standing
// Hip Adduction and a Pull-Through while the lat pulldown and chest press
// never made the cut. Choosing the candidates first and ranking them globally
// puts the real work at the front.
const GROUP_ORDER = ['quads', 'back', 'chest', 'hamstrings', 'shoulders', 'glutes',
                     'biceps', 'triceps', 'core', 'calves', 'traps', 'forearms'];

window.stationStart = (id) => {
  const station = stations().find((s) => s.id === id);
  if (!station) return;

  const candidates = GROUP_ORDER.map((gid) => {
    const best = station.movements
      .filter((m) => m.groups?.[0] === gid)
      .sort((a, b) => stapleRank(a, gid) - stapleRank(b, gid)
                   || (a.type === 'compound' ? 0 : 1) - (b.type === 'compound' ? 0 : 1))[0];
    return best ? { ex: best, gi: GROUP_ORDER.indexOf(gid) } : null;
  }).filter(Boolean);

  const picked = candidates
    .sort((a, b) => (a.ex.type === 'compound' ? 0 : 1) - (b.ex.type === 'compound' ? 0 : 1) || a.gi - b.gi)
    .slice(0, 6)
    .map((c) => c.ex);

  if (!picked.length) { toast('No movements available for this station.'); return; }
  window.startActiveWorkout(
    `station-${id}`,
    `${station.label.toUpperCase()} STATION`,
    picked.map((m) => ({ id: m.id, name: m.name, sets: 3, reps: '8–10', muscle: m.muscle })),
    'strength',
  );
};
