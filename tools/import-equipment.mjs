#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
//   FITNESS FORGE — fine-grained equipment tagger
//
//   Our `requires` model has ten buckets (barbell, dumbbells, cable, machine,
//   …). That is the right granularity for "can I train with what I own", but
//   far too coarse for "what can I do at this station": a Smith machine, a
//   preacher bench, a leg press and a pec deck are all just `machine`.
//
//   This emits src/data/exercise-equipment.js — exercise id → fine station
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
//   Usage: node tools/import-equipment.mjs [path/to/fedb.json]
//   fedb.json: https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { EXERCISES } from '../src/data/exercises.js';
import { EXERCISE_ANIM } from '../src/data/exercise-anim.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const fedbPath = process.argv[2] || resolve(__dir, 'fedb.json');
const outPath  = resolve(__dir, '../src/data/exercise-equipment.js');

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

const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b))
  .map(([k, v]) => [k, [...v].sort()]));
const counts = {};
for (const tags of Object.values(sorted)) for (const t of tags) counts[t] = (counts[t] || 0) + 1;

if (!Object.keys(sorted).length) { console.error('✗ refusing to write an empty map'); process.exit(1); }

writeFileSync(outPath, `// ═══════════════════════════════════════════
//   FITNESS FORGE — fine-grained equipment tags
//   GENERATED by tools/import-equipment.mjs — do not edit by hand.
//
//   exercise id → the specific kit it uses, beyond the ten coarse \`requires\`
//   buckets. Sourced from free-exercise-db's \`equipment\` field, workout-guide's
//   \`equipment\` field (joined on the animation slug), and names that state the
//   kit outright. A name that does not state it is never guessed at.
//
//   ${Object.keys(sorted).length} exercises tagged across ${Object.keys(counts).length} kinds of equipment.
// ═══════════════════════════════════════════

export const EX_EQUIP = ${JSON.stringify(sorted)};
`);

console.log(`✓ ${outPath}`);
console.log(`  ${Object.keys(sorted).length} exercises tagged, ${Object.keys(counts).length} equipment kinds`);
console.log(`  ${contradictions} name/source contradiction${contradictions === 1 ? '' : 's'} dropped`);
for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log('   ' + String(v).padStart(4), k);
