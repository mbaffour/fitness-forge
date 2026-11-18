#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
//   FITNESS FORGE — exercise metadata recovered from upstream sources
//
//   Emits src/data/exercise-meta.js with four things our own importers either
//   discarded or never asked for:
//     EX_EQUIP    exercise id → the specific kit it uses (below)
//     EX_STRETCH  ids the SOURCE classifies as a stretch
//     EX_FORCE    exercise id → push | pull | static
//     WG_STRETCHES / WG_STRETCH_ANIM  animated workout-guide stretches the
//                 strength importer skipped, so they never reached the app
//
//   Why stretch and force come from the source: `isStrengthExercise` decided
//   by NAME (/stretch|mobility|…/), and 57 of free-exercise-db's 123 stretches
//   do not say "stretch" — 90/90 Hamstring, Knee Circles, Ankle On The Knee —
//   so they were filed as strength work and leaked into strength pools.
//
//   ── fine-grained equipment ──
//
//   Our `requires` model has ten buckets (barbell, dumbbells, cable, machine,
//   …). That is the right granularity for "can I train with what I own", but
//   far too coarse for "what can I do at this station": a Smith machine, a
//   preacher bench, a leg press and a pec deck are all just `machine`.
//
//   EX_EQUIP — exercise id → fine station
//   tags — from three sources, in descending order of authority:
//
//     1. free-exercise-db's own `equipment` field (791 entries, 100% matched).
//        This is also the only place that remembers a medicine-ball throw
//        needs a medicine ball: the original importer folded `medicine ball`,
//        `exercise ball` and `foam roll` into `[]`, i.e. "bodyweight".
//     2. workout-guide's `equipment` field, joined on the animation slug.
//     3. The exercise NAME, when it states the kit outright ("Smith Machine
//        Squat", "EZ-Bar Curl", "Landmine Press"). A name that does not say
//        it is never guessed at — the near-name trap this project has hit
//        before (a kickstand RDL is not a single-leg RDL).
//
//   Usage: node tools/import-exercise-meta.mjs [path/to/fedb.json]
//   fedb.json: https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { EXERCISES } from '../src/data/exercises.js';
import { EXERCISE_ANIM } from '../src/data/exercise-anim.js';
import { MUS } from './wg-muscles.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const fedbPath = process.argv[2] || resolve(__dir, 'fedb.json');
const outPath  = resolve(__dir, '../src/data/exercise-meta.js');

if (!existsSync(fedbPath)) {
  console.error(`✗ ${fedbPath} not found.\n  curl -o tools/fedb.json https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json`);
  process.exit(1);
}
const fedb = JSON.parse(readFileSync(fedbPath, 'utf8'));
const wg   = JSON.parse(readFileSync(resolve(__dir, 'wg-manifest.json'), 'utf8'));

// ── source 1: free-exercise-db, keyed the way the importer built our ids ────
const FEDB_EQUIP = {
  'medicine ball': ['medicine_ball'],
  'exercise ball': ['stability_ball'],
  'e-z curl bar':  ['ez_bar'],
  'foam roll':     ['foam_roller'],
};
const byFx = new Map(fedb.map(e => ['fx_' + String(e.id).replace(/[^A-Za-z0-9]/g, '_'), e]));

// ── source 2: workout-guide, joined through the animation slug ─────────────
const WG_EQUIP = {
  'Plate': ['plate'], 'Box': ['plyo_box'], 'Wall': ['wall'], 'Towel': ['towel'],
  'Doorway': ['doorway'], 'Chair': ['chair'], 'Stability Ball': ['stability_ball'],
};
const bySlug = new Map();
for (const [ourId, a] of Object.entries(EXERCISE_ANIM)) bySlug.set(a.slug, ourId);
const wgBySlug = new Map(wg.map(e => [e.slug, e]));

// ── source 3: the name, where it names the kit ─────────────────────────────
// Every pattern here is a phrase that can only mean that piece of equipment.
// Deliberately absent: "ball" alone (medicine vs stability vs wall ball),
// "rack" (power rack vs rack pull vs dumbbell rack), "station".
const NAME_EQUIP = [
  ['smith',          /\bsmith\b/i],
  ['ez_bar',         /\bez[-\s]?bar|e-?z[-\s]?curl bar/i],
  ['trap_bar',       /\btrap bar|\bhex bar/i],
  ['landmine',       /\blandmine\b/i],
  ['tbar',           /\bt-?bar row/i],
  ['preacher',       /\bpreacher\b|\bspider curl/i],
  ['dip_station',    /\bdips?\b/i, /\bjerk dip|\bhip dip/i],
  ['leg_press',      /\bleg press\b/i],
  ['hack_squat',     /\bhack squat/i],
  ['leg_ext_curl',   /\bleg extension|\bleg curl|\bsissy squat/i],
  ['lat_tower',      /\bpulldown\b|\blat pull/i],
  ['pec_deck',       /\bpec[-\s]?deck\b|\bbutterfly\b/i],
  ['medicine_ball',  /\bmedicine ball|\bmed ball|\bwall ball/i],
  ['stability_ball', /\bstability ball|\bexercise ball|\bswiss ball|\bphysioball|\bball leg curl/i],
  ['plyo_box',       /\bbox jump|\bbox squat|\bbox skip|\bstep-?up|\bstep-?down/i],
  ['sled',           /\bsled\b|\bprowler\b/i],
  ['battle_ropes',   /\bbattl\w* rope|\brope slam/i],
  ['strongman',      /\batlas stone|\baxle\b|\bcar deadlift|\btyre\b|\btire flip|\bkeg\b|\byoke\b|\bsandbag\b|\bchain\b|\bfarmer'?s? walk/i],
  ['towel',          /\btowel\b/i],
  ['wall',           /\bwall sit|\bwall slide|\bwall walk|\bwall push/i],
  ['chair',          /\bchair\b/i],
  ['doorway',        /\bdoorway\b/i],
  ['ab_wheel',       /\bab wheel|\bwheel rollout|\bab roller/i],
  ['rings_trx',      /\brings?\b|\btrx\b|\bsuspension\b/i],
  ['parallette',     /\bparallette/i],
  ['plate',          /\bplate\b/i],
  ['bosu',           /\bbosu\b/i],
];

// ── merge ──────────────────────────────────────────────────────────────────
const out = {};
const add = (id, tags) => { if (!tags?.length) return; (out[id] ||= new Set()); for (const t of tags) out[id].add(t); };

for (const [id, ex] of Object.entries(EXERCISES)) {
  const u = byFx.get(id);
  if (u) add(id, FEDB_EQUIP[u.equipment]);

  const anim = EXERCISE_ANIM[id];
  if (anim) { const w = wgBySlug.get(anim.slug); if (w) add(id, WG_EQUIP[w.equipment]); }

  const name = ex.name || '';
  for (const [tag, re, not] of NAME_EQUIP) {
    if (!re.test(name) || (not && not.test(name))) continue;
    add(id, [tag]);
  }
}

// A name that calls the movement bodyweight outranks a source that says it
// needs a loaded implement: free-exercise-db files "Bodyweight Flyes" under
// `e-z curl bar`, which would have put it in the EZ-bar station. Same
// equipment-contradiction gate the video resolver uses — when two sources
// disagree the exercise keeps neither claim rather than the wrong one.
const LOADED = new Set(['ez_bar', 'trap_bar', 'plate', 'medicine_ball', 'smith',
                        'landmine', 'tbar', 'leg_press', 'hack_squat', 'sled']);
let contradictions = 0;
for (const [id, tags] of Object.entries(out)) {
  if (!/\bbodyweight\b|\bbody ?weight\b/i.test(EXERCISES[id]?.name || '')) continue;
  for (const t of [...tags]) if (LOADED.has(t)) { tags.delete(t); contradictions++; }
  if (!tags.size) delete out[id];
}

// ── stretches + force ───────────────────────────────────────────────────────
// Generated stretch ids carry a `wgs_` prefix and are ignored when deciding
// what is "already in the app". Without that, a re-run would see its own
// previous output merged into EXERCISES and drop every entry — the bug that
// once shrank exercises-wg.js and the library from 1057 to 900 (v3.18).
const isSelf = (id) => id.startsWith('wgs_');
const wgStretchSlugs = new Set(wg.filter(e => e.isStretch === true).map(e => e.slug));

const stretch = new Set();
const force = {};
for (const [id] of Object.entries(EXERCISES)) {
  if (isSelf(id)) continue;
  const u = byFx.get(id);
  if (u?.category === 'stretching') stretch.add(id);
  if (u && ['push', 'pull', 'static'].includes(u.force)) force[id] = u.force;
  const anim = EXERCISE_ANIM[id];
  if (anim && wgStretchSlugs.has(anim.slug)) stretch.add(id);
}

// Animated stretches the strength importer skipped outright. Their primary
// muscle is sometimes just "Mobility"; those take the first secondary muscle
// that maps. A hip-flexor stretch is filed by its stated name — the hip
// flexors are anterior (rectus femoris), and MUS sends "Hips" to glutes.
const inApp = new Set(Object.entries(EXERCISE_ANIM).filter(([id]) => !isSelf(id)).map(([, a]) => a.slug));
const WG_STRETCHES = {}, WG_STRETCH_ANIM = {};
let unmapped = 0;
for (const e of wg) {
  if (e.isStretch !== true || inApp.has(e.slug)) continue;
  let g = /hip flexor/i.test(e.name) ? 'quads' : MUS[e.primaryMuscle];
  if (!g) g = (e.secondaryMuscles || []).map(m => MUS[m]).find(Boolean);
  if (!g) { unmapped++; continue; }
  const id = 'wgs_' + e.slug.replace(/[^a-z0-9]+/gi, '_');
  const groups = [g];
  for (const m of (e.secondaryMuscles || [])) { const sg = MUS[m]; if (sg && !groups.includes(sg)) groups.push(sg); }
  WG_STRETCHES[id] = {
    name: e.name, muscle: e.primaryMuscle === 'Mobility' ? (e.secondaryMuscles?.[0] || 'Mobility') : e.primaryMuscle,
    groups, equip: ['bodyweight', 'home_basic', 'full_gym'], requires: [], diff: 'beg', type: 'isolation',
    trainingType: 'mobility',
    musclesFull: { primary: [e.primaryMuscle], secondary: e.secondaryMuscles || [], stabilizers: [] },
    cues: [], commonErrors: [], youtubeId: '', exrxSlug: '', source: 'workout-guide',
  };
  WG_STRETCH_ANIM[id] = { slug: e.slug, frames: (e.frames || []).length || 3 };
  stretch.add(id);
  // A doorway stretch needs a doorway — the same kit tag Stations already uses.
  if (e.equipment === 'Doorway') (out[id] ||= new Set()).add('doorway');
  if (e.equipment === 'Wall' || /\bwall\b/i.test(e.name)) (out[id] ||= new Set()).add('wall');
}
if (!stretch.size) { console.error('✗ refusing to write an empty stretch set'); process.exit(1); }

const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b))
  .map(([k, v]) => [k, [...v].sort()]));
const counts = {};
for (const tags of Object.values(sorted)) for (const t of tags) counts[t] = (counts[t] || 0) + 1;

if (!Object.keys(sorted).length) { console.error('✗ refusing to write an empty map'); process.exit(1); }

writeFileSync(outPath, `// ═══════════════════════════════════════════
//   FITNESS FORGE — exercise metadata recovered from upstream sources
//   GENERATED by tools/import-exercise-meta.mjs — do not edit by hand.
//
//   exercise id → the specific kit it uses, beyond the ten coarse \`requires\`
//   buckets. Sourced from free-exercise-db's \`equipment\` field, workout-guide's
//   \`equipment\` field (joined on the animation slug), and names that state the
//   kit outright. A name that does not state it is never guessed at.
//
//   ${Object.keys(sorted).length} exercises tagged across ${Object.keys(counts).length} kinds of equipment.
// ═══════════════════════════════════════════

export const EX_EQUIP = ${JSON.stringify(sorted)};

// Ids the source itself classifies as a stretch (free-exercise-db category
// "stretching", or a workout-guide animation flagged isStretch).
export const EX_STRETCH = ${JSON.stringify([...stretch].sort())};

// free-exercise-db's force field: push | pull | static.
export const EX_FORCE = ${JSON.stringify(Object.fromEntries(Object.entries(force).sort(([a], [b]) => a.localeCompare(b))))};

// Animated workout-guide stretches (CC BY-SA 4.0, © Bryl Lim / Everkinetic)
// that the strength importer skipped. Merged into EXERCISES and EXERCISE_ANIM
// at boot in exercises.js.
export const WG_STRETCHES = ${JSON.stringify(WG_STRETCHES)};
export const WG_STRETCH_ANIM = ${JSON.stringify(WG_STRETCH_ANIM)};
`);

console.log(`✓ ${outPath}`);
console.log(`  ${Object.keys(sorted).length} exercises tagged, ${Object.keys(counts).length} equipment kinds`);
console.log(`  ${contradictions} name/source contradiction${contradictions === 1 ? '' : 's'} dropped`);
console.log(`  ${stretch.size} stretches (source-classified) · ${Object.keys(force).length} force tags · ${Object.keys(WG_STRETCHES).length} animated stretches added${unmapped ? ` · ${unmapped} unmapped` : ''}`);
for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log('   ' + String(v).padStart(4), k);
