// ═══════════════════════════════════════════
//   FITNESS FORGE — Stations
//   Pick one piece of kit and work through everything you can do with it.
//
//   Distinct from the Equipment page, which asks what you OWN and hands back
//   a generated session. This is the view you want standing in front of the
//   cable stack: what does this thing do, what is worth doing on it, what
//   should I load — then either learn a movement or train the whole station.
//
//   Two kinds of station:
//     • an OWNED ITEM (barbell, dumbbells, cable, machine…) — one of the ten
//       coarse `requires` buckets. Listed exclusively: a movement appears only
//       if that tool plus a support is all it needs, so the Barbell station
//       never quietly asks you for a cable too.
//     • a FINE TAG (smith, preacher, leg press, landmine…) from the generated
//       equipment map. These are specific pieces of furniture that the coarse
//       model lumps together as `machine`, `barbell` or `bench`; a movement is
//       listed when the data or its own name says it uses that thing.
// ═══════════════════════════════════════════

import { state, formatWeight } from '../store.js';
import { EXERCISES, MUSCLE_GROUPS, isStrengthExercise, stapleRank, equipTags } from '../data/exercises.js';
import { suggestNextSet } from '../engine/overload.js';
import { cue } from './feedback.js';
import { toast, pageHeader, sectionHead, emptyState, photoLayer } from './ui.js';
import { exThumbHTML, exPhotoURL } from './modal.js';

// A bench is a surface, not a second piece of kit — every press and row done
// on one is really a dumbbell or barbell movement. So for an item station it
// counts as a support rather than disqualifying the movement.
const SUPPORTS = new Set(['bench']);

const CATEGORIES = [
  { id: 'free', label: 'Free Weights',  note: 'Load it yourself' },
  { id: 'rig',  label: 'Bars & Rigs',   note: 'Benches, bars and things you hang from' },
  { id: 'mach', label: 'Machines',      note: 'Fixed paths and selectorised stacks' },
  { id: 'kit',  label: 'Small Kit',     note: 'Fits in a bag or a corner' },
  { id: 'cond', label: 'Bodyweight & Conditioning', note: 'No stack to set' },
];

// Every station, in the order each category lists them. `item` matches one of
// the coarse requires buckets exclusively; `tags` matches the fine equipment
// map. A station with no movements is dropped rather than shown as an empty
// room — nothing here is padded to look fuller than it is.
const CATALOG = [
  // ── free weights ─────────────────────────────────────────────────────────
  { id:'barbell',    cat:'free', icon:'🏋️‍♂️', label:'Barbell',          item:'barbell',    blurb:'Heaviest loads, the classic strength lifts' },
  { id:'dumbbells',  cat:'free', icon:'🏋️',   label:'Dumbbells',        item:'dumbbells',  blurb:'The most versatile thing in any gym' },
  { id:'kettlebell', cat:'free', icon:'🔔',   label:'Kettlebell',       item:'kettlebell', blurb:'Swings, carries and everything ballistic' },
  { id:'ez_bar',     cat:'free', icon:'〰️',   label:'EZ-Curl Bar',      tags:['ez_bar'],   blurb:'Angled grip — kinder to the wrists than a straight bar' },
  { id:'trap_bar',   cat:'free', icon:'⬡',    label:'Trap / Hex Bar',   tags:['trap_bar'], blurb:'Neutral grip with the load in line with you' },
  { id:'plate',      cat:'free', icon:'🥏',   label:'Weight Plate',     tags:['plate'],    blurb:'One plate — raises, carries and loaded twists' },

  // ── bars & rigs ──────────────────────────────────────────────────────────
  { id:'bench',      cat:'rig', icon:'🛋️', label:'Bench',           item:'bench', inclusive:true, blurb:'Flat, incline and decline — paired with a bar or dumbbells' },
  { id:'pull_up_bar',cat:'rig', icon:'🚧', label:'Pull-Up Bar',     item:'pull_up_bar',  blurb:'Hanging work — the cheapest upper body there is' },
  { id:'dip_station',cat:'rig', icon:'🤸‍♂️', label:'Dip Station',   tags:['dip_station'],blurb:'Parallel bars — the upper-body squat' },
  { id:'smith',      cat:'rig', icon:'🏗️', label:'Smith Machine',   tags:['smith'],      blurb:'A bar on rails — press and squat heavy without a spotter' },
  { id:'preacher',   cat:'rig', icon:'💺', label:'Preacher Bench',  tags:['preacher'],   blurb:'Arm pinned to the pad — no swinging the curl up' },
  { id:'landmine',   cat:'rig', icon:'📐', label:'Landmine',        tags:['landmine'],   blurb:'One end of a bar pinned — arcing presses, rows and twists' },
  { id:'tbar',       cat:'rig', icon:'⚓', label:'T-Bar Row',       tags:['tbar'],       blurb:'Chest-supported rowing, loaded with plates' },
  { id:'rings_trx',  cat:'rig', icon:'💍', label:'Rings / TRX',     tags:['rings_trx'],  blurb:'Unstable straps — bodyweight at any angle' },

  // ── machines ─────────────────────────────────────────────────────────────
  { id:'cable',      cat:'mach', icon:'🔌', label:'Cable Machine',   item:'cable',          blurb:'Constant tension through the whole range' },
  { id:'lat_tower',  cat:'mach', icon:'🗼', label:'Lat Pulldown',    tags:['lat_tower'],    blurb:'Vertical pulling when a pull-up is still out of reach' },
  { id:'leg_press',  cat:'mach', icon:'🦵', label:'Leg Press',       tags:['leg_press'],    blurb:'Heavy legs with your back supported' },
  { id:'hack_squat', cat:'mach', icon:'⛰️', label:'Hack Squat',      tags:['hack_squat'],   blurb:'Squat pattern on a fixed track — quad-biased' },
  { id:'leg_ext_curl',cat:'mach',icon:'🪑', label:'Leg Ext / Curl',  tags:['leg_ext_curl'], blurb:'Isolating the quads and hamstrings one joint at a time' },
  { id:'pec_deck',   cat:'mach', icon:'🦋', label:'Pec Deck',        tags:['pec_deck'],     blurb:'Chest and rear-delt flyes on a fixed arc' },
  { id:'machine',    cat:'mach', icon:'⚙️', label:'Weight Machines', item:'machine',        blurb:'The rest of the selectorised floor — easiest to learn' },

  // ── small kit ────────────────────────────────────────────────────────────
  { id:'resistance_bands',cat:'kit', icon:'🎗️', label:'Resistance Bands', item:'resistance_bands', blurb:'Packable, joint-friendly, constant tension' },
  { id:'medicine_ball',   cat:'kit', icon:'⚽',  label:'Medicine Ball',    item:'medicine_ball',    blurb:'Throws and slams — power you cannot practise with a stack' },
  { id:'stability_ball',  cat:'kit', icon:'🔵',  label:'Stability Ball',   item:'stability_ball',   blurb:'Take the floor away and the core has to work' },
  { id:'ab_wheel',        cat:'kit', icon:'🎡',  label:'Ab Wheel',         item:'ab_wheel',         blurb:'The hardest core movement most people will ever try' },
  { id:'towel',           cat:'kit', icon:'🧻',  label:'Towel',            tags:['towel'],          blurb:'A towel and a door frame — rows and curls from nothing' },
  { id:'bosu',            cat:'kit', icon:'🌗',  label:'Bosu',             tags:['bosu'],           blurb:'Half-ball balance work' },

  // ── bodyweight & conditioning ────────────────────────────────────────────
  { id:'__bw',        cat:'cond', icon:'🤸', label:'Bodyweight',    bodyweight:true,        blurb:'No kit at all — anywhere, any time' },
  { id:'plyo_box',    cat:'cond', icon:'📦', label:'Plyo Box',      tags:['plyo_box'],      blurb:'Step, jump and land — the cheapest power work there is' },
  { id:'sled',        cat:'cond', icon:'🛷', label:'Sled / Prowler',tags:['sled'],          blurb:'Push, drag, repeat — all effort, no eccentric' },
  { id:'battle_ropes',cat:'cond', icon:'🪢', label:'Battle Ropes',  tags:['battle_ropes'],  blurb:'Arms and lungs, no joint load' },
  { id:'strongman',   cat:'cond', icon:'🪨', label:'Strongman',     tags:['strongman'],     blurb:'Stones, axles, chains and carries' },
  { id:'wall',        cat:'cond', icon:'🧱', label:'Wall',          tags:['wall'],          blurb:'A flat vertical surface is a piece of equipment' },
  { id:'chair',       cat:'cond', icon:'🪑', label:'Chair / Doorway',tags:['chair','doorway'],blurb:'Training with the furniture you already own' },
];

let _tool = null;      // selected station id, or null for the picker
let _muscle = 'all';   // muscle filter within a station

const asList = () => Object.entries(EXERCISES).map(([id, ex]) => ({ id, ...ex }));

// Every strength movement this station can perform.
function movementsFor(def) {
  return asList().filter((ex) => {
    if (ex.caliOnly || !isStrengthExercise(ex)) return false;
    const req = ex.requires || [];
    if (def.bodyweight) return req.length === 0;
    if (def.tags) return def.tags.some((t) => equipTags(ex.id).includes(t));
    // An item station is exclusive: the tool plus a support has to be enough,
    // or the Barbell station would quietly ask you for a cable as well. The
    // bench is the exception — it is a surface you bring weights to, so it
    // lists everything performed on one.
    if (def.inclusive) return req.includes(def.item);
    const allowed = new Set([def.item, ...SUPPORTS]);
    return req.includes(def.item) && req.every((r) => allowed.has(r));
  });
}

function stations() {
  return CATALOG
    .map((def) => ({ ...def, movements: movementsFor(def) }))
    .filter((s) => s.movements.length > 0);
}

const groupsOf = (movs) => MUSCLE_GROUPS.filter((g) => movs.some((m) => m.groups?.[0] === g.id));

// The photograph that represents a station: the best-ranked movement it has
// that actually owns one. Deterministic, so a station keeps the same face
// between renders. 870 of 1077 exercises have a photo pair; a station whose
// movements have none (towel, battle ropes) simply renders without one rather
// than borrowing a picture of something else.
function coverFor(station) {
  const best = station.movements
    .filter((m) => m.imgKey)
    .sort((a, b) => stapleRank(a, a.groups?.[0]) - stapleRank(b, b.groups?.[0])
                 || (a.type === 'compound' ? 0 : 1) - (b.type === 'compound' ? 0 : 1)
                 || (a.name || '').localeCompare(b.name || ''))[0];
  return best ? exPhotoURL(best, 0) : '';
}


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
function cardHTML(s) {
  const cov = groupsOf(s.movements).length;
  const cover = coverFor(s);
  return `
  <button class="st-card${cover ? ' has-photo' : ''}" onclick="stationOpen('${s.id}')">
    ${photoLayer(cover)}
    <span class="st-ic">${s.icon}</span>
    <span class="st-body">
      <span class="st-top">
        <span class="st-name">${s.label}</span>
        <span class="st-meta">
          <b>${s.movements.length}</b><i>move${s.movements.length === 1 ? '' : 's'}</i>
          <b>${cov}/${MUSCLE_GROUPS.length}</b><i>groups</i>
        </span>
      </span>
      <span class="st-blurb">${s.blurb}</span>
    </span>
  </button>`;
}

function pickerHTML() {
  const all = stations();
  const sections = CATEGORIES.map((c) => {
    const mine = all.filter((s) => s.cat === c.id);
    if (!mine.length) return '';
    return `${sectionHead(c.label, c.note)}<div class="st-grid">${mine.map(cardHTML).join('')}</div>`;
  }).join('');

  const totalMoves = new Set(all.flatMap((s) => s.movements.map((m) => m.id))).size;

  return `
${pageHeader('STATIONS', { eyebrow: 'Pick a tool', sub: 'Choose a piece of kit and work through everything it can do' })}
<div class="st-intro">
  <b>${all.length}</b> stations · <b>${totalMoves}</b> movements between them
</div>
${sections}
<div class="dim fs12" style="margin-top:18px;line-height:1.6">
  A station for a tool you own lists only what that tool can do on its own — a bench counts
  as a surface, not a second piece of kit. The specific stations (Smith, preacher, leg press,
  landmine…) list a movement when the source data or its own name says it uses that thing;
  nothing is guessed at from a near-name. Looking for what your whole gym covers instead?
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

  const cover = coverFor(station);
  const hero = cover ? `
<div class="st-hero">
  ${photoLayer(cover, `${station.label} station`)}
  <div class="st-hero-text">
    <span class="st-hero-eyebrow">Station</span>
    <h1 class="st-hero-title">${station.label.toUpperCase()}</h1>
    <p class="st-hero-sub">${station.blurb}</p>
    <span class="st-hero-stats"><b>${movs.length}</b> move${movs.length === 1 ? '' : 's'}
      · <b>${groups.length}</b>/${MUSCLE_GROUPS.length} muscle groups</span>
  </div>
</div>` : pageHeader(station.label.toUpperCase(), { eyebrow: 'Station', sub: station.blurb });

  return `
${hero}
<div class="st-bar">
  <button class="btn btn-ghost btn-sm" onclick="stationOpen(null)">← All stations</button>
  <button class="btn btn-fire btn-sm" onclick="stationStart('${station.id}')">⚡ Train this station</button>
</div>
<div class="st-chips">${chips}</div>
${movs.length ? sections : emptyState('🔧', 'No movements found for this station.')}`;
}

export function renderStations() {
  const station = _tool ? stations().find((s) => s.id === _tool) : null;
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

  // One movement per muscle group is the right shape for a station that spans
  // the body, but a specialised one covers a single group — a preacher bench
  // is nine ways to curl — and was handing back a one-exercise "session".
  // Top up from what is left so a narrow station still gives you something to
  // work through; a station that genuinely only has one movement stays at one.
  if (picked.length < 4) {
    const have = new Set(picked.map((m) => m.id));
    const rest = station.movements
      .filter((m) => !have.has(m.id))
      .sort((a, b) => stapleRank(a, a.groups?.[0]) - stapleRank(b, b.groups?.[0])
                   || (a.type === 'compound' ? 0 : 1) - (b.type === 'compound' ? 0 : 1)
                   || (a.name || '').localeCompare(b.name || ''));
    while (picked.length < 4 && rest.length) picked.push(rest.shift());
  }

  if (!picked.length) { toast('No movements available for this station.'); return; }
  window.startActiveWorkout(
    `station-${id}`,
    `${station.label.toUpperCase()} STATION`,
    picked.map((m) => ({ id: m.id, name: m.name, sets: 3, reps: '8–10', muscle: m.muscle })),
    'strength',
  );
};
