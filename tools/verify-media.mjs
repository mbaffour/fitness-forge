// ═══════════════════════════════════════════
//   Verifies every exercise media URL the app can render — workout-guide
//   animation frames, Gym Visual GIFs, and free-exercise-db stills.
//   No API key: plain HEAD requests against the public hosts.
//
//   Usage:
//     node tools/verify-media.mjs          # report
//     node tools/verify-media.mjs --fix    # clear broken imgKeys so the
//                                          # exercise falls back cleanly
//
//   Media rots and ids get mistyped, so run this alongside verify-videos.mjs.
// ═══════════════════════════════════════════
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const fix = process.argv.includes('--fix');
const EXDB = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';

const { EXERCISES } = await import('../src/data/exercises.js');
const { EXERCISE_ANIM, WG_BASE } = await import('../src/data/exercise-anim.js');
const { EXERCISE_GIFS, GIF_BASE } = await import('../src/data/exercise-gifs.js');

const jobs = [];
for (const id of Object.keys(EXERCISE_ANIM))
  jobs.push({ kind: 'anim', id, url: WG_BASE + EXERCISE_ANIM[id].slug + '/frame-1.svg' });
for (const id of Object.keys(EXERCISE_GIFS))
  jobs.push({ kind: 'gif', id, url: GIF_BASE + EXERCISE_GIFS[id] });
for (const [id, x] of Object.entries(EXERCISES))
  if (x.imgKey) jobs.push({ kind: 'still', id, url: `${EXDB}/${x.imgKey}/0.jpg` });

console.log(`checking ${jobs.length} media URLs…`);
// Hammering the CDN produces network errors that look exactly like breakage.
// So: modest concurrency, retries with backoff, and a hard rule that only a
// definitive HTTP status ever counts as broken — a network error is reported
// as "unknown" and is NEVER acted on by --fix. Without this, one throttled run
// would clear hundreds of working URLs.
const bad = [], unknown = [];
const queue = jobs.slice();
await Promise.all(Array.from({ length: 8 }, async () => {
  while (queue.length) {
    const j = queue.pop();
    let status = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try { status = (await fetch(j.url, { method: 'HEAD' })).status; }
      catch { status = null; }
      if (status === 200) break;
      await new Promise(r => setTimeout(r, 350 * (attempt + 1)));
    }
    if (status === 200) continue;
    (status === null ? unknown : bad).push({ ...j, status: status ?? 'neterr' });
    await new Promise(r => setTimeout(r, 60));
  }
}));

const by = k => bad.filter(b => b.kind === k);
console.log(`\nbroken (definitive HTTP error): ${bad.length} of ${jobs.length}`);
if (unknown.length) console.log(`unreachable (network/throttling — NOT treated as broken): ${unknown.length}`);
for (const k of ['anim', 'gif', 'still']) {
  const list = by(k);
  console.log(`  ${k.padEnd(6)} ${list.length}`);
  list.forEach(b => console.log(`     ✗ ${b.id} (${EXERCISES[b.id]?.name || '?'}) [${b.status}]`));
}

if (!fix) { console.log('\n(run with --fix to clear broken imgKeys)'); process.exit(bad.length ? 1 : 0); }

const stills = by('still');
if (!stills.length) { console.log('\nnothing to fix.'); process.exit(0); }
const p = resolve(__dir, '../src/data/exercises.js');
let src = readFileSync(p, 'utf8');
let cleared = 0;
for (const b of stills) {
  const key = EXERCISES[b.id]?.imgKey;
  if (!key) continue;
  const re = new RegExp(`(imgKey:\\s*)'${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`, 'g');
  if (re.test(src)) { src = src.replace(re, "$1''"); cleared++; }
}
writeFileSync(p, src);
console.log(`\ncleared ${cleared} broken imgKeys — those exercises now fall back to their animation/GIF, or to no still.`);
