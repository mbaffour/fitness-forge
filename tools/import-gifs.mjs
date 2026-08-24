#!/usr/bin/env node
// Dev-time generator: match our exercise database against the
// hasaneyldrm/exercises-dataset (metadata MIT) by name and emit
// src/data/exercise-gifs.js — a map of exercise id -> animation GIF path.
//
// IMPORTANT LICENSING NOTE: the GIF media is © Gym visual and is redistributed
// in the SOURCE repo with the rights holder's written permission. We do NOT
// copy the media here — this script stores only URLs; the app hotlinks them at
// runtime with the required "© Gym visual" attribution.
//
// Usage: node tools/import-gifs.mjs <path-to-exercises.json>

import { readFileSync, writeFileSync, copyFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Import the app's ESM exercise DB from a temp .mjs copy (the repo has no
// package.json, so .js files would be treated as CommonJS by Node).
const tmp = mkdtempSync(join(tmpdir(), 'forge-gifs-'));
let core = readFileSync(join(ROOT, 'src/data/exercises.js'), 'utf8');
core = core.replace(`'./exercises-library.js'`, `'./exercises-library.mjs'`);
writeFileSync(join(tmp, 'exercises.mjs'), core);
copyFileSync(join(ROOT, 'src/data/exercises-library.js'), join(tmp, 'exercises-library.mjs'));
const { EXERCISES } = await import(pathToFileURL(join(tmp, 'exercises.mjs')).href);

const datasetPath = process.argv[2];
if (!datasetPath) { console.error('Usage: node tools/import-gifs.mjs <exercises.json>'); process.exit(1); }
const DATASET = JSON.parse(readFileSync(datasetPath, 'utf8'));

// ── name matching (stricter than the in-app CSV importer: a wrong animation
//    is worse than none) ──
const STOP = new Set(['the', 'a', 'with', 'and', 'of', 'v', 'version']);
const tokens = (s) => String(s).toLowerCase()
  .replace(/\([^)]*\)/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim().split(/\s+/).filter(w => w && !STOP.has(w));
const flat = (s) => tokens(s).join('');

// Curated overrides for the staple lifts (our exId -> dataset name, compared
// flat-normalized) so the core movements are guaranteed the right animation.
const OVERRIDES = {
  squat_bb: 'barbell full squat',            squat_front: 'barbell front squat',
  squat_db: 'dumbbell goblet squat',         kb_goblet: 'kettlebell goblet squat',
  bench_bb: 'barbell bench press',           bench_db: 'dumbbell bench press',
  incline_bb: 'barbell incline bench press', incline_db: 'dumbbell incline bench press',
  ohp_bb: 'barbell standing wide military press', ohp_db: 'dumbbell seated shoulder press',
  deadlift: 'barbell deadlift',              rdl_bb: 'barbell romanian deadlift',
  rdl_db: 'dumbbell romanian deadlift',      row_bb: 'barbell bent over row',
  row_db: 'dumbbell bent over row',          row_cable: 'cable seated row',
  lat_pull: 'cable pulldown',                pullup: 'pull-up',
  chinup: 'chin-up',                         dips: 'triceps dip',
  pushup: 'push-up',                         curl_bb: 'barbell curl',
  curl_db: 'dumbbell biceps curl',           curl_hammer: 'dumbbell hammer curl',
  tri_push: 'cable pushdown',                skull: 'barbell lying triceps extension skull crusher',
  cgbench: 'barbell close-grip bench press', legpress: 'sled 45° leg press',
  legcurl: 'lever seated leg curl',          lunge_db: 'dumbbell lunge',
  lat_raise: 'dumbbell lateral raise',       shrug_bb: 'barbell shrug',
  shrug_db: 'dumbbell shrug',                calfr_bb: 'barbell standing calf raise',
  farmer: 'farmers walk',                    face_pull: 'cable standing rear delt row (with rope)',
};

// Modifier words that change the movement — if the candidate has one that the
// query didn't ask for, it's probably a different exercise.
const DANGER = new Set(['kneeling','knees','smith','jump','jumping','pause','pov','deficit',
  'zercher','jefferson','partial','half','quarter','isometric','chain','negative','assisted',
  'female','male','alternate','alternating','single','one','twist','twisting','side','reverse',
  'decline','incline','close','wide','behind','swiss','bosu','stability','floor','wall','plyo']);

// Equipment words — a candidate whose implement differs from the query is rejected.
const EQUIP_WORDS = ['barbell','dumbbell','kettlebell','cable','band','smith','lever','sled','ez'];

const dsByFlat = new Map();
const dsTok = [];
for (const r of DATASET) {
  if (!r.gif_url) continue;
  const f = flat(r.name);
  if (!dsByFlat.has(f)) dsByFlat.set(f, r);
  dsTok.push({ r, toks: new Set(tokens(r.name)) });
}

// Exercises with no correct animation in the dataset (only wrong-implement
// variants exist) — better no GIF than a misleading one.
const SKIP = new Set(['pushpress']);

function match(id, name) {
  if (SKIP.has(id)) return null;
  if (OVERRIDES[id]) {
    const r = dsByFlat.get(flat(OVERRIDES[id]));
    if (r) return { r, score: 1, kind: 'override' };
    console.warn(`override miss for ${id}: "${OVERRIDES[id]}"`);
  }
  const key = flat(name);
  if (dsByFlat.has(key)) return { r: dsByFlat.get(key), score: 1, kind: 'exact' };
  const inToks = new Set(tokens(name));
  if (!inToks.size) return null;
  const qEquip = EQUIP_WORDS.filter(w => inToks.has(w));
  let best = null, bestScore = 0;
  for (const { r, toks } of dsTok) {
    // equipment consistency: candidate must not use a different implement
    const cEquip = EQUIP_WORDS.filter(w => toks.has(w));
    if (qEquip.length && cEquip.length && !cEquip.some(w => qEquip.includes(w))) continue;
    if (!qEquip.length && cEquip.some(w => ['smith','lever','sled','cable','band'].includes(w))) continue;
    let inter = 0; for (const t of inToks) if (toks.has(t)) inter++;
    let score = inter / (inToks.size + toks.size - inter);
    for (const t of toks) if (!inToks.has(t) && DANGER.has(t)) score -= 0.2;   // unasked-for variant
    if (score > bestScore) { bestScore = score; best = r; }
  }
  return bestScore >= 0.6 ? { r: best, score: bestScore, kind: 'fuzzy' } : null;
}

const out = {};
let exact = 0, fuzzy = 0, override = 0;
for (const [id, ex] of Object.entries(EXERCISES)) {
  const m = match(id, ex.name || id);
  if (m) { out[id] = m.r.gif_url; m.kind === 'fuzzy' ? fuzzy++ : m.kind === 'override' ? override++ : exact++; }
}

const file = `// ═══════════════════════════════════════════
//   FITNESS FORGE — Exercise animation GIF references
//   GENERATED by tools/import-gifs.mjs — do not edit by hand.
//
//   URLS ONLY — no media is stored in this repository. The GIFs are
//   © Gym visual (https://gymvisual.com/) and are hosted in
//   github.com/hasaneyldrm/exercises-dataset, where they are redistributed
//   with the rights holder's written permission. The app hotlinks them at
//   runtime and shows the required "© Gym visual" attribution.
//   ${Object.keys(out).length} of ${Object.keys(EXERCISES).length} exercises matched by name.
// ═══════════════════════════════════════════

export const GIF_BASE = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/';

export const EXERCISE_GIFS = ${JSON.stringify(out, null, 0).replace(/","/g, '",\n"')};

export const GIF_ATTRIBUTION = '© Gym visual — gymvisual.com';
`;
writeFileSync(join(ROOT, 'src/data/exercise-gifs.js'), file);
console.log(`matched ${Object.keys(out).length}/${Object.keys(EXERCISES).length} (${override} override, ${exact} exact, ${fuzzy} fuzzy) -> src/data/exercise-gifs.js`);
