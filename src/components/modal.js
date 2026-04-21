// ════════════════════════════════════
//   Exercise Detail Modal
//   Shows: muscles, cues, errors, video
// ════════════════════════════════════

export function showExerciseModal(ex) {
  // Remove any existing modal
  document.getElementById('ex-modal')?.remove();

  const mf = ex.musclesFull || {};
  const primary    = mf.primary    || [];
  const secondary  = mf.secondary  || [];
  const stabilizers = mf.stabilizers || [];

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'ex-modal';

  overlay.innerHTML = `
<div class="modal" onclick="event.stopPropagation()">

  <div class="modal-head">
    <div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <span class="tag ${ex.type === 'compound' ? 't-fire' : 't-steel'}">${ex.type || 'exercise'}</span>
        <span class="tag t-dim">${ex.diff === 'beg' ? 'Beginner' : ex.diff === 'int' ? 'Intermediate' : 'Advanced'}</span>
      </div>
      <div class="display" style="font-size:28px;line-height:1.1">${ex.name.toUpperCase()}</div>
      <div class="dim" style="font-size:13px;margin-top:4px">${ex.muscle}</div>
    </div>
    <button class="modal-close" onclick="closeExModal()">✕</button>
  </div>

  <div class="modal-body">

    <!-- MUSCLES TRAINED -->
    <div class="sec-head" style="margin-bottom:12px">Muscles Trained</div>
    <div style="margin-bottom:20px">
      ${primary.length ? `
        <div class="label" style="margin-bottom:6px">Primary</div>
        <div style="display:flex;flex-wrap:wrap;margin-bottom:8px">
          ${primary.map(m => `<span class="muscle-pill muscle-primary">${m}</span>`).join('')}
        </div>` : ''}
      ${secondary.length ? `
        <div class="label" style="margin-bottom:6px">Secondary</div>
        <div style="display:flex;flex-wrap:wrap;margin-bottom:8px">
          ${secondary.map(m => `<span class="muscle-pill muscle-secondary">${m}</span>`).join('')}
        </div>` : ''}
      ${stabilizers.length ? `
        <div class="label" style="margin-bottom:6px">Stabilizers</div>
        <div style="display:flex;flex-wrap:wrap">
          ${stabilizers.map(m => `<span class="muscle-pill muscle-stab">${m}</span>`).join('')}
        </div>` : ''}
    </div>

    <!-- VIDEO DEMO -->
    ${ex.youtubeId ? `
    <div class="sec-head" style="margin-bottom:12px">Form Demo</div>
    <div class="video-embed mb24" id="video-wrap-${ex.id}" style="margin-bottom:20px">
      <div class="video-placeholder" onclick="loadVideo('${ex.youtubeId}', '${ex.id}')">
        <div style="position:absolute;inset:0;background:url('https://img.youtube.com/vi/${ex.youtubeId}/mqdefault.jpg') center/cover no-repeat;border-radius:6px;opacity:0.6"></div>
        <div class="play-btn" style="position:relative;z-index:1">▶</div>
        <div style="position:relative;z-index:1;font-family:var(--ff-mono);font-size:11px;color:var(--text);background:rgba(0,0,0,0.7);padding:4px 10px;border-radius:3px">Click to load video</div>
      </div>
    </div>
    ` : ''}

    <!-- FULL REFERENCE -->
    ${ex.exrxSlug ? `
    <div style="margin-bottom:20px">
      <a href="https://exrx.net/${ex.exrxSlug}" target="_blank" rel="noopener"
         style="display:inline-flex;align-items:center;gap:6px;font-family:var(--ff-mono);font-size:10px;color:var(--steel);text-decoration:none;border:1px solid rgba(122,179,200,0.3);padding:6px 12px;border-radius:3px;background:rgba(122,179,200,0.06)">
        📖 Full exercise guide on ExRx.net ↗
      </a>
    </div>
    ` : ''}

    <!-- COACHING CUES -->
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

    <!-- COMMON ERRORS -->
    ${ex.commonErrors?.length ? `
    <div class="sec-head" style="margin-bottom:12px">Common Mistakes</div>
    <div>
      ${ex.commonErrors.map(err => `
        <div class="error-item">
          <span style="color:var(--danger);font-size:14px;margin-top:1px">✗</span>
          <span>${err}</span>
        </div>
      `).join('')}
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
