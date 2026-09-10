// ═══════════════════════════════════════════
//   Fitness Forge — keyless YouTube tutorial resolver
//   One-time generator (NOT shipped to the app).
//
//   Finds a real, relevant tutorial video for every exercise that has no
//   curated `youtubeId`, by reading YouTube's PUBLIC search results page and
//   parsing the `ytInitialData` blob it already serves to browsers.
//   NO API KEY, NO QUOTA — the Data API costs 100 units per search (≈90
//   lookups/day), which is why the earlier key-based importer never ran.
//
//   Nothing is fabricated: an id is only written if it came back from a real
//   search AND its title passes the relevance gate below. Anything that fails
//   is left unmapped, so the exercise keeps the "Watch a tutorial" search card.
//
//   Usage:
//     node tools/resolve-youtube.mjs --dry --limit 5
//     node tools/resolve-youtube.mjs --tier 1            # curated + programs
//     node tools/resolve-youtube.mjs --tier 2 --limit 200
//     node tools/resolve-youtube.mjs                     # everything left
//   Resumable: exercises already in exercise-videos.js are skipped.
//   Follow with: node tools/verify-videos.mjs
// ═══════════════════════════════════════════
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const val  = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const DRY = flag('--dry');
const LIMIT = parseInt(val('--limit', '0')) || Infinity;
const TIER = parseInt(val('--tier', '0')) || 0;

const { EXERCISES } = await import('../src/data/exercises.js');
const { EXERCISE_VIDEOS } = await import('../src/data/exercise-videos.js');
const { PROGRAMS } = await import('../src/data/programs.js');

const UA = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};

// ── relevance gate ──────────────────────────────────────────────────────────
// Equipment words must not contradict (a "Barbell Curl" must not resolve to a
// dumbbell video — that exact bug shipped once and is what v3.17 cleaned up).
const GEAR = ['barbell', 'dumbbell', 'cable', 'machine', 'kettlebell', 'band', 'smith', 'bodyweight'];
const gearOf = (s) => GEAR.filter(g => new RegExp(`\\b${g}`, 'i').test(s));
const STOP = new Set(['the', 'a', 'an', 'with', 'on', 'in', 'to', 'for', 'and', 'of', 'over', 'up',
  'exercise', 'variation', 'version', 'style']);
const words = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ')
  .filter(w => w.length > 2 && !STOP.has(w));
// Singular/plural and common spelling variants shouldn't count as a miss.
const stem = (w) => w.replace(/ies$/, 'y').replace(/(ss)$/, '$1').replace(/s$/, '')
  .replace(/^flye?$/, 'fly').replace(/^pushup$/, 'push').replace(/^pullup$/, 'pull');

function score(ex, v) {
  if (!v.id || !v.title) return -1;
  const t = v.title.toLowerCase();
  // 1. every non-gear word of the exercise name must appear in the title
  const core = [...new Set(words(ex.name).filter(w => !GEAR.includes(w)).map(stem))];
  const hits = core.filter(w => stem(t).includes(w) || t.includes(w));
  const cover = core.length ? hits.length / core.length : 0;
  if (cover < (core.length <= 2 ? 1 : 0.75)) return -1;
  // 2. no contradicting equipment
  const want = gearOf(ex.name), got = gearOf(v.title);
  if (want.length && got.length && !want.some(w => got.includes(w))) return -1;
  // 3. a tutorial, not a vlog or a 90-minute stream
  const secs = (v.len || '').split(':').reduce((a, p) => a * 60 + (+p || 0), 0);
  if (!secs || secs > 20 * 60) return -1;
  let s = cover * 100;
  if (secs >= 20 && secs <= 12 * 60) s += 20;
  if (want.length && got.length && want.some(w => got.includes(w))) s += 15;
  if (/how to|proper form|technique|tutorial|guide|demo/i.test(v.title)) s += 12;
  const views = parseInt(String(v.views || '').replace(/[^0-9]/g, '')) || 0;
  s += Math.min(20, Math.log10(views + 1) * 3);
  return s;
}

async function searchYouTube(query, tries = 3) {
  const url = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query)
            + '&sp=EgIQAQ%253D%253D';   // filter: videos only
  for (let a = 0; a < tries; a++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const html = await r.text();
      const m = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
      if (!m) throw new Error('no ytInitialData');
      const out = [];
      (function walk(o) {
        if (!o || typeof o !== 'object') return;
        if (o.videoRenderer) {
          const v = o.videoRenderer;
          out.push({
            id: v.videoId,
            title: v.title?.runs?.[0]?.text,
            len: v.lengthText?.simpleText,
            ch: v.ownerText?.runs?.[0]?.text,
            views: v.viewCountText?.simpleText,
          });
        }
        for (const k in o) walk(o[k]);
      })(JSON.parse(m[1]));
      return out;
    } catch (e) {
      if (a === tries - 1) return { error: e.message };
      await new Promise(r => setTimeout(r, 1500 * (a + 1)));
    }
  }
}

// ── which exercises to resolve ──────────────────────────────────────────────
const programRefs = new Set();
JSON.stringify(PROGRAMS).replace(/"(?:ex|id)":"([a-zA-Z0-9_]+)"/g, (m, g) => { programRefs.add(g); return m; });
const tierOf = (id) => (!id.startsWith('fx_') && !id.startsWith('wg_')) || programRefs.has(id) ? 1
                     : id.startsWith('wg_') ? 2 : 3;

const todo = Object.entries(EXERCISES)
  .filter(([id, ex]) => !(ex.youtubeId || '').trim() && !EXERCISE_VIDEOS[id])
  .filter(([id]) => !TIER || tierOf(id) === TIER)
  .map(([id, ex]) => ({ id, ex, tier: tierOf(id) }))
  .sort((a, b) => a.tier - b.tier)
  .slice(0, LIMIT);

console.log(`${Object.keys(EXERCISES).length} exercises · ${Object.keys(EXERCISE_VIDEOS).length} already mapped`);
console.log(`resolving ${todo.length}${TIER ? ` (tier ${TIER})` : ''}${DRY ? ' — DRY RUN' : ''}\n`);

const found = { ...EXERCISE_VIDEOS };
let ok = 0, rejected = 0, errored = 0;
for (let i = 0; i < todo.length; i++) {
  const { id, ex } = todo[i];
  const res = await searchYouTube(`${ex.name} exercise proper form how to`);
  if (!Array.isArray(res)) { errored++; console.log(`  ! ${id} — ${res?.error}`); continue; }
  const ranked = res.map(v => ({ v, s: score(ex, v) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s);
  if (!ranked.length) { rejected++; console.log(`  – ${id} (${ex.name}) — no result passed the relevance gate`); }
  else {
    const best = ranked[0].v;
    found[id] = best.id;
    ok++;
    console.log(`  ✓ ${id.padEnd(34)} ${best.id}  "${best.title.slice(0, 58)}" · ${best.ch}`);
  }
  if ((i + 1) % 25 === 0) {
    console.log(`  … ${i + 1}/${todo.length} (matched ${ok}, rejected ${rejected}, errors ${errored})`);
    if (!DRY) writeMap(found);   // checkpoint so a long run is never lost
  }
  await new Promise(r => setTimeout(r, 350));
}

function writeMap(map) {
  const sorted = Object.fromEntries(Object.keys(map).sort().map(k => [k, map[k]]));
  writeFileSync(resolve(__dir, '../src/data/exercise-videos.js'),
    `// ═══════════════════════════════════════════
//   FITNESS FORGE — Exercise → YouTube tutorial ids
//   GENERATED by tools/resolve-youtube.mjs — do not edit by hand.
//
//   Resolved from YouTube's public search results (no API key, no quota) and
//   gated on title relevance + equipment consistency, then checked for 404s by
//   tools/verify-videos.mjs. Ids only — no video is hosted or redistributed;
//   the app embeds them via youtube-nocookie. ${Object.keys(sorted).length} exercises mapped.
// ═══════════════════════════════════════════

export const EXERCISE_VIDEOS = ${JSON.stringify(sorted, null, 0)};
`);
}

console.log(`\nmatched ${ok} · rejected ${rejected} · errors ${errored}`);
if (DRY) { console.log('(dry run — nothing written)'); process.exit(0); }
writeMap(found);
console.log(`wrote src/data/exercise-videos.js — ${Object.keys(found).length} total`);
console.log('next: node tools/verify-videos.mjs');
