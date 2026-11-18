#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
//   FITNESS FORGE — reviewed imports from wger (https://wger.de)
//
//   wger's exercise data is openly licensed per record (CC BY-SA 3/4, CC BY 4,
//   CC0; ODbL records are refused — they would put the whole derived dataset
//   under ODbL). Of its 973 exercises, 287 carry an image under a compatible
//   licence; a token-set dedupe against our library left 104; a manual review
//   kept the 22 below. The 82 refused were duplicates under another name
//   ("Tate Press", "Runners Lunge Stretch" = our Runner's Stretch), mislabelled
//   languages ("Military Press mit SZ-Bar", "Remo maquina agarre estrecho"),
//   not exercises in our sense ("Blackroll" is a foam-roller brand), or carried
//   equipment that contradicts their own name ("Barbell Clean and press"
//   tagged Dumbbell). The allowlist is explicit for the same reason the
//   workout-guide ALIAS table is: a wrong import is worse than none — a
//   duplicate splits someone's history and PRs across two ids.
//
//   Every record is re-fetched live and re-validated: English name, compatible
//   record licence, at least one compatibly-licensed image on wger.de. Media is
//   hotlinked, never vendored. All third-party text (names, descriptions,
//   authors) is reduced to plain text here, before it can reach innerHTML.
//
//   Usage: node tools/import-wger.mjs
// ═══════════════════════════════════════════════════════════════════════════
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dir, '../src/data/exercises-wger.js');

// wger id → what wger's data does not say. `group` where a record has no
// muscle data (the name states it); `primary` to name the region precisely
// (Neck, Obliques); `mobility` for stretches; `timed` for holds.
const ALLOW = {
  31:   { group: 'forearms', timed: true },                 // Axe Hold — a grip hold
  79:   { type: 'compound' },                              // Bent High Pulls — wger lists one muscle, but it is a multi-joint pull
  828:  {},                                                 // Incline Bench Reverse Fly
  915:  { group: 'shoulders' },                             // Bus Drivers
  975:  {},                                                 // One-Handed Kettlebell Curls
  1007: { group: 'traps', primary: 'Neck', mobility: true, timed: false },   // Head Turns
  1018: { group: 'traps', primary: 'Neck', mobility: true, timed: false },   // Head Tilts
  1141: {},                                                 // Arabesque
  1227: {},                                                 // Dumbbell Rear Delt Row
  1275: { group: 'calves', mobility: true, timed: true },   // Plantarflexion Stretch with Band
  1479: { primary: 'Obliques' },                            // Sit Up Elbow Thrust
  1556: {},                                                 // Devil's Press
  1869: { group: 'glutes', mobility: true, timed: true },   // Lying Figure Four Stretch
  // Pigeon Stretch and Tuck Planche: wger's only "step" is "View the video to
  // undestand the exercise" and a one-line description respectively — neither
  // teaches anything. These cues are written for Fitness Forge (not wger text).
  1872: { group: 'glutes', mobility: true, timed: true, authoredCues: [
    'From hands and knees, slide one knee forward behind the same-side wrist, shin angled across the body.',
    'Extend the other leg straight back with the top of the foot on the floor.',
    'Square the hips toward the floor and keep them level instead of tipping onto the front hip.',
    'Stay tall on your hands, or walk them forward and lower the chest for a deeper stretch.',
    'Breathe slowly through the hold, then switch sides.'] },
  1889: {},                                                 // Decline Bench Leg Raise
  1916: { timed: true, diff: 'adv', authoredCues: [
    'Hands on the floor or parallettes, shoulder-width apart, fingers turned slightly out.',
    'Lean the shoulders forward past the hands and push the floor away so the upper back rounds.',
    'Lift the feet with the knees tucked tight to the chest, arms locked straight.',
    'Balance on the hands and hold; build time in short, clean holds.',
    'If you cannot hold the forward lean, regress to a frog stand first.'] },
  2494: {},                                                 // Band Terminal Knee Extension
  2680: { group: 'forearms', mobility: true, timed: false },// Wrist Rocks
  2763: { requires: ['rings_trx'] },                        // TRX/Rings Chest Fly
  2764: { requires: ['rings_trx'] },                        // TRX/Rings Push-Up
  2765: { requires: ['rings_trx'] },                        // TRX/Rings Y Raise
  2766: { requires: ['rings_trx'] },                        // TRX/Rings Face Pull
};

const OK_LICENCE = { 1: 'CC BY-SA 3.0', 2: 'CC BY-SA 4.0', 3: 'CC0 1.0', 4: 'CC BY 4.0' };
const LICENCE_URL = {
  1: 'https://creativecommons.org/licenses/by-sa/3.0/', 2: 'https://creativecommons.org/licenses/by-sa/4.0/',
  3: 'https://creativecommons.org/publicdomain/zero/1.0/', 4: 'https://creativecommons.org/licenses/by/4.0/',
};
const IMG_RE = /^https:\/\/wger\.de\/media\/exercise-images\/[\w\-./]+\.(png|jpe?g|gif|webp|svg)$/i;

// wger muscle → our group, and the English name kept as the primary muscle.
const WMUS = {
  'biceps': 'biceps', 'brachialis': 'biceps', 'shoulders': 'shoulders', 'anterior deltoid': 'shoulders',
  'chest': 'chest', 'pectoralis major': 'chest', 'triceps': 'triceps', 'abs': 'core', 'rectus abdominis': 'core',
  'obliquus externus abdominis': 'core', 'calves': 'calves', 'soleus': 'calves', 'gastrocnemius': 'calves',
  'glutes': 'glutes', 'gluteus maximus': 'glutes', 'hamstrings': 'hamstrings', 'biceps femoris': 'hamstrings',
  'quads': 'quads', 'quadriceps femoris': 'quads', 'lats': 'back', 'latissimus dorsi': 'back', 'trapezius': 'traps',
};
const PRETTY = { 'obliquus externus abdominis': 'Obliques', 'serratus anterior': 'Serratus Anterior' };
// wger equipment → our `requires`. An unknown name aborts that record rather than guessing.
const WEQ = {
  'barbell': ['barbell'], 'sz-bar': ['barbell'], 'dumbbell': ['dumbbells'], 'kettlebell': ['kettlebell'],
  'cable machine': ['cable'], 'resistance band': ['resistance_bands'], 'pull-up bar': ['pull_up_bar'],
  'bench': ['bench'], 'incline bench': ['bench'], 'swiss ball': ['stability_ball'], 'gym mat': [],
  'none (bodyweight exercise)': [],
};
const HOME = new Set(['dumbbells', 'kettlebell', 'resistance_bands', 'pull_up_bar', 'bench']);
const ISO_RE = /curl|raise|extension|fly|kickback|pushdown|shrug|adduction|abduction|crunch|sit-?up|twist|wrist|rocks?\b|turns?\b|tilts?\b/i;

const ENT = { '&nbsp;': ' ', '&amp;': '&', '&quot;': '"', '&#39;': "'", '&#x27;': "'", '&rsquo;': '’', '&lsquo;': '‘', '&ldquo;': '“', '&rdquo;': '”', '&lt;': '<', '&gt;': '>' };
// Plain text only. Tags are stripped, THEN entities decoded, THEN angle
// brackets removed — in that order, so `&lt;script&gt;` cannot decode back
// into a tag. Double quotes become a double prime, as cleanText does in the app.
function plain(s, max = 220) {
  let t = String(s || '').replace(/<[^>]*>/g, ' ');
  t = t.replace(/&[#\w]+;/g, (m) => ENT[m] ?? ' ');
  return t.replace(/[<>]/g, '').replace(/"/g, '″').replace(/\s+/g, ' ').trim().slice(0, max);
}
const title = (s) => s.replace(/(^|[\s/-])([a-z])/g, (m, a, b) => a + b.toUpperCase());

function steps(html) {
  const li = [...String(html || '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => m[1]);
  const raw = li.length ? li
    : String(html || '').replace(/<\/p>|<br\s*\/?>/gi, '\n').split(/\n|(?<=[.!?])\s+(?=[A-Z])/);
  // A step that points at a video or picture teaches nothing here — wger's
  // videos are not shown in this app, and "see the image" is not an instruction.
  const POINTER = /\b(view|watch|see|check)\b.{0,20}\b(video|image|picture|photo|gif)\b/i;
  return raw.map((s) => plain(s)).filter((s) => s.length >= 8 && !POINTER.test(s)).slice(0, 8);
}

const out = {}, refused = [];
for (const [idStr, o] of Object.entries(ALLOW)) {
  const id = +idStr;
  const r = await (await fetch(`https://wger.de/api/v2/exerciseinfo/${id}/`)).json();
  await new Promise((z) => setTimeout(z, 250));
  const t = (r.translations || []).find((x) => x.language === 2);
  const lic = r.license?.id;
  if (!t) { refused.push([id, 'no English translation']); continue; }
  if (!OK_LICENCE[lic]) { refused.push([id, `record licence ${r.license?.short_name}`]); continue; }
  const imgs = (r.images || []).filter((i) => OK_LICENCE[i.license?.id ?? i.license] && IMG_RE.test(i.image || ''));
  if (!imgs.length) { refused.push([id, 'no compatibly-licensed image']); continue; }
  const main = imgs.find((i) => i.is_main) || imgs[0];
  const second = imgs.find((i) => i !== main);

  const reqs = [];
  for (const e of r.equipment || []) {
    const m = WEQ[String(e.name || '').toLowerCase()];
    if (!m) { refused.push([id, `unknown equipment ${e.name}`]); reqs.length = 0; reqs.push(null); break; }
    for (const x of m) if (!reqs.includes(x)) reqs.push(x);
  }
  if (reqs.includes(null)) continue;
  const requires = o.requires || reqs;

  const mus = (r.muscles || []).map((m) => String(m.name_en || m.name || '').toLowerCase());
  const mus2 = (r.muscles_secondary || []).map((m) => String(m.name_en || m.name || '').toLowerCase());
  const group = o.group || mus.map((m) => WMUS[m]).find(Boolean);
  if (!group) { refused.push([id, 'no mappable muscle and no override']); continue; }
  const groups = [group];
  for (const m of [...mus, ...mus2]) { const g = WMUS[m]; if (g && !groups.includes(g)) groups.push(g); }
  const pretty = (m) => PRETTY[m] || title(m);
  const name = title(plain(t.name, 80));
  const lid = OK_LICENCE[main.license?.id ?? main.license];
  const author = plain(main.license_author || r.license_author || '', 60);

  out[`wgr_${id}`] = {
    name,
    muscle: o.primary || (mus[0] ? pretty(mus[0]) : title(group)),
    groups,
    equip: requires.length === 0 ? ['bodyweight', 'home_basic', 'full_gym']
         : requires.every((x) => HOME.has(x)) ? ['home_basic', 'full_gym'] : ['full_gym'],
    requires,
    diff: o.diff || (o.mobility ? 'beg' : 'int'),
    type: o.type || (o.mobility || ISO_RE.test(name) || groups.length === 1 ? 'isolation' : 'compound'),
    ...(o.mobility ? { trainingType: 'mobility' } : {}),
    ...(o.timed != null ? { timed: o.timed } : {}),
    musclesFull: { primary: [o.primary || (mus[0] ? pretty(mus[0]) : title(group))],
                   secondary: mus2.map(pretty), stabilizers: [] },
    cues: o.authoredCues || steps(t.description),
    ...(o.authoredCues ? { cuesBy: 'Fitness Forge' } : {}),
    commonErrors: [], youtubeId: '', exrxSlug: '', source: 'wger',
    img: {
      src: main.image,
      ...(second ? { src2: second.image } : {}),
      credit: {
        author: author && !/@/.test(author) ? author : 'wger.de contributors',
        licence: lid, licenceUrl: LICENCE_URL[main.license?.id ?? main.license],
        page: `https://wger.de/en/exercise/${id}/view/`,
      },
    },
  };
}

if (!Object.keys(out).length) { console.error('✗ refusing to write an empty file'); process.exit(1); }
writeFileSync(outPath, `// ═══════════════════════════════════════════
//   FITNESS FORGE — reviewed exercises from wger (https://wger.de)
//   GENERATED by tools/import-wger.mjs — do not edit by hand.
//
//   ${Object.keys(out).length} exercises, each kept by hand from wger's 973 (see the generator
//   for why the rest were refused). Text and images are licensed per record —
//   CC BY-SA 4.0 for every entry here — and credited on each one in \`img.credit\`.
//   Images are hotlinked from wger.de, never copied into this repository.
// ═══════════════════════════════════════════

export const WGER_EXERCISES = ${JSON.stringify(out)};
`);
console.log(`✓ ${outPath}`);
console.log(`  ${Object.keys(out).length} imported${refused.length ? `, ${refused.length} refused on re-validation:` : ''}`);
for (const [id, why] of refused) console.log(`    ✗ ${id}: ${why}`);
for (const [id, e] of Object.entries(out)) console.log(`    ${id.padEnd(9)} ${e.name.padEnd(34)} ${e.groups[0].padEnd(10)} ${(e.requires.join('+') || 'BW').padEnd(16)} ${e.trainingType || e.type}${e.timed ? ' ⏱' : ''} · ${e.cues.length} steps`);
