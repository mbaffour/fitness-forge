// ════════════════════════════════════
//   Exercise Detail Modal  v2.4
//   Order: header → GIF → muscles →
//          cues → errors → video → ref
// ════════════════════════════════════

import { GIF_BASE, EXERCISE_GIFS, GIF_ATTRIBUTION } from '../data/exercise-gifs.js';
import { WG_BASE, WG_ATTRIBUTION, WG_ATTRIBUTION_URL, EXERCISE_ANIM } from '../data/exercise-anim.js';

const GIF_CDN = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';

// Openly-licensed 3-frame animated illustration (workout-guide, CC BY-SA 4.0).
// Cycles frame-1→2→3 via the `wgFlip` keyframe. Hotlinked at runtime (never
// vendored); on error the wrap is removed so the next fallback shows.
function _wgAnim(ex, cls, name) {
  const wg = EXERCISE_ANIM[ex.id];
  if (!wg) return '';
  const frames = [1, 2, 3].slice(0, wg.frames || 3).map((i) =>
    `<img class="wf wf${i}" src="${WG_BASE}${wg.slug}/frame-${i}.svg" alt="${name} — frame ${i}" loading="lazy"
       ${i === 1 ? `onerror="const w=this.closest('.ex-gif-wrap');const f=w.nextElementSibling;if(f&&f.classList.contains('ex-gif-fallback'))f.style.display='';w.remove()"` : ''}>`
  ).join('');
  return `<div class="${cls} wg-anim wg-f${wg.frames || 3}">${frames}</div>`;
}

// Static preview: crossfaded free-exercise-db frames (public domain) when the
// exercise has an `imgKey`; else its YouTube demo thumbnail. '' when neither.
function _staticPreview(ex, cls, name) {
  if (ex?.imgKey) {
    return `
    <div class="${cls}">
      <img class="frame-0" src="${GIF_CDN}/${ex.imgKey}/0.jpg"
           onerror="this.closest('.ex-gif-wrap').style.display='none'"
           alt="${name} — start position" loading="lazy">
      <img class="frame-1" src="${GIF_CDN}/${ex.imgKey}/1.jpg"
           onerror="this.style.display='none'"
           alt="${name} — end position" loading="lazy">
    </div>`;
  }
  if (ex?.youtubeId) {
    return `
    <div class="${cls}">
      <img src="https://img.youtube.com/vi/${ex.youtubeId}/hqdefault.jpg"
           onerror="this.closest('.ex-gif-wrap').style.display='none'"
           alt="${name} — demo" loading="lazy">
    </div>`;
  }
  return '';
}

// Reusable exercise preview. In the full (modal) variant, exercises matched to
// the Gym visual animation set show the real animated GIF — hotlinked at
// runtime from the licensed source repo (never redistributed here) with the
// static crossfade as an offline/error fallback. `variant:'thumb'` keeps the
// lightweight static preview so the 900-card library stays fast.
export function exPreviewHTML(ex, { variant = 'full' } = {}) {
  const cls = variant === 'thumb' ? 'ex-gif-wrap ex-gif-thumb' : 'ex-gif-wrap';
  const name = ex?.name || 'exercise';
  // Prefer the openly-licensed workout-guide animation (CC BY-SA 4.0) when matched;
  // it errors → the licensed GIF or static crossfade shows as the next fallback.
  const wg = variant === 'full' && ex?.id ? EXERCISE_ANIM[ex.id] : null;
  if (wg) {
    const fallback = (EXERCISE_GIFS[ex.id] || ex.imgKey || ex.youtubeId) ? _staticPreview(ex, cls, name) : '';
    return `${_wgAnim(ex, cls, name)}${fallback ? `<div class="ex-gif-fallback" style="display:none">${fallback}</div>` : ''}`;
  }
  const gif = variant === 'full' && ex?.id ? EXERCISE_GIFS[ex.id] : null;
  if (gif) {
    const fallback = _staticPreview(ex, cls, name);
    return `
    <div class="${cls} ex-anim">
      <img src="${GIF_BASE}${gif}" alt="${name} — animated demo" loading="lazy"
           onerror="const w=this.closest('.ex-gif-wrap');const f=w.nextElementSibling;if(f&&f.classList.contains('ex-gif-fallback'))f.style.display='';w.remove()">
    </div>
    ${fallback ? `<div class="ex-gif-fallback" style="display:none">${fallback}</div>` : ''}`;
  }
  return _staticPreview(ex, cls, name);
}

export function showExerciseModal(ex) {
  // Remove any existing modal
  document.getElementById('ex-modal')?.remove();

  const mf          = ex.musclesFull || {};
  const primary     = mf.primary     || [];
  const secondary   = mf.secondary   || [];
  const stabilizers = mf.stabilizers || [];
  const isCali      = ex.tags?.includes('calisthenics');

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'ex-modal';

  overlay.innerHTML = `
<div class="modal" onclick="event.stopPropagation()">

  <!-- ── HEADER ────────────────────────── -->
  <div class="modal-head">
    <div style="flex:1;min-width:0">
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px">
        <span class="tag ${ex.type === 'compound' ? 't-fire' : 't-steel'}">${ex.type || 'exercise'}</span>
        <span class="tag t-dim">${ex.diff === 'beg' ? 'Beginner' : ex.diff === 'int' ? 'Intermediate' : 'Advanced'}</span>
        ${isCali ? `<span class="tag t-cali">Calisthenics</span>` : ''}
      </div>
      <div class="display" style="font-size:1.4rem;line-height:1.15;word-break:break-word">${ex.name.toUpperCase()}</div>
      <div style="font-size:0.8rem;color:var(--text-2);margin-top:4px;font-family:var(--ff-mono)">${ex.muscle}</div>
    </div>
    <button class="modal-close" onclick="closeExModal()" aria-label="Close">✕</button>
  </div>

  <div class="modal-body">

    <!-- ── ANIMATED EXERCISE PREVIEW ─────── -->
    ${(ex.id && (EXERCISE_ANIM[ex.id] || EXERCISE_GIFS[ex.id])) || ex.imgKey ? `
    ${exPreviewHTML(ex)}
    <div class="ex-gif-source">${
      ex.id && EXERCISE_ANIM[ex.id]
        ? `Animation <a href="${WG_ATTRIBUTION_URL}" target="_blank" rel="noopener" style="color:inherit">${WG_ATTRIBUTION} ↗</a>`
        : ex.id && EXERCISE_GIFS[ex.id] ? `Animation ${GIF_ATTRIBUTION}` : 'Images: free-exercise-db · public domain'
    }</div>
    ` : ''}

    <!-- ── MUSCLES TRAINED ─────────────── -->
    ${(primary.length || secondary.length || stabilizers.length) ? `
    <div class="sec-head" style="margin-bottom:12px">Muscles Trained</div>
    <div style="margin-bottom:20px">
      ${primary.length ? `
        <div class="label" style="margin-bottom:6px;color:var(--fire)">Primary</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px">
          ${primary.map(m => `<span class="muscle-pill muscle-primary">${m}</span>`).join('')}
        </div>` : ''}
      ${secondary.length ? `
        <div class="label" style="margin-bottom:6px;color:var(--steel)">Secondary</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px">
          ${secondary.map(m => `<span class="muscle-pill muscle-secondary">${m}</span>`).join('')}
        </div>` : ''}
      ${stabilizers.length ? `
        <div class="label" style="margin-bottom:6px;color:var(--text-3)">Stabilizers</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">
          ${stabilizers.map(m => `<span class="muscle-pill muscle-stab">${m}</span>`).join('')}
        </div>` : ''}
    </div>
    ` : ''}

    <!-- ── COACHING CUES ──────────────── -->
    ${ex.cues?.length ? `
    <div class="sec-head" style="margin-bottom:12px">Coaching Cues</div>
    <div style="margin-bottom:20px">
      ${ex.cues.map((cue, i) => `
        <div class="cue-item">
          <div class="cue-num">${i + 1}.</div>
          <div>${cue}</div>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <!-- ── COMMON MISTAKES ────────────── -->
    ${ex.commonErrors?.length ? `
    <div class="sec-head" style="margin-bottom:12px">Common Mistakes</div>
    <div style="margin-bottom:20px">
      ${ex.commonErrors.map(err => `
        <div class="error-item">
          <span style="color:var(--danger);font-size:14px;margin-top:1px;flex-shrink:0">✗</span>
          <span>${err}</span>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <!-- ── VIDEO DEMO (click-to-load) ── -->
    ${ex.youtubeId ? `
    <div class="sec-head" style="margin-bottom:12px">Form Demo</div>
    <div class="video-embed" id="video-wrap-${ex.id || 'ex'}" style="margin-bottom:20px">
      <div class="video-placeholder" onclick="loadVideo('${ex.youtubeId}', '${ex.id || 'ex'}')">
        <div style="position:absolute;inset:0;background:url('https://img.youtube.com/vi/${ex.youtubeId}/mqdefault.jpg') center/cover no-repeat;border-radius:6px;opacity:0.55"></div>
        <div class="play-btn" style="position:relative;z-index:1">▶</div>
        <div style="position:relative;z-index:1;font-family:var(--ff-mono);font-size:11px;color:var(--text);background:rgba(0,0,0,0.75);padding:4px 10px;border-radius:3px;letter-spacing:0.06em">CLICK TO LOAD VIDEO</div>
      </div>
    </div>
    ` : `
    <!-- No embedded demo → link to a YouTube search for real tutorials -->
    <div class="sec-head" style="margin-bottom:12px">Form Demo</div>
    <div style="margin-bottom:20px">
      <a href="https://www.youtube.com/results?search_query=${encodeURIComponent((ex.name || 'exercise') + ' proper form technique')}"
         target="_blank" rel="noopener"
         style="display:inline-flex;align-items:center;gap:8px;font-family:var(--ff-mono);font-size:0.72rem;color:var(--fire);text-decoration:none;border:1px solid var(--fire-glow);padding:8px 14px;border-radius:var(--r-md);background:var(--fire-dim);letter-spacing:0.06em">
        🔍 FIND VIDEO TUTORIALS ON YOUTUBE ↗
      </a>
    </div>
    `}

    <!-- ── EXRX REFERENCE ─────────────── -->
    ${ex.exrxSlug ? `
    <div>
      <a href="https://exrx.net/${ex.exrxSlug}" target="_blank" rel="noopener"
         style="display:inline-flex;align-items:center;gap:6px;font-family:var(--ff-mono);font-size:0.7rem;color:var(--steel);text-decoration:none;border:1px solid rgba(122,179,200,0.25);padding:6px 12px;border-radius:var(--r-sm);background:rgba(122,179,200,0.05);letter-spacing:0.06em">
        📖 FULL GUIDE ON EXRX.NET ↗
      </a>
    </div>
    ` : ''}

  </div>
</div>
  `;

  overlay.addEventListener('click', () => closeExModal());
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
}

export function closeExModal() {
  document.getElementById('ex-modal')?.remove();
  document.body.style.overflow = '';
}

export function loadVideo(youtubeId, exId) {
  const wrap = document.getElementById(`video-wrap-${exId}`);
  if (!wrap) return;
  wrap.innerHTML = `
    <iframe
      src="https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
      allowfullscreen>
    </iframe>`;
}

// Attach to window
window.closeExModal = closeExModal;
window.loadVideo    = loadVideo;

// ESC key to close
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeExModal();
});
