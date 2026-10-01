// One in-app tutorial player shared by every exercise detail modal.
import { EXERCISE_VIDEOS } from '../data/exercise-videos.js';

const escapeHTML = value => String(value).replace(/[&<>"']/g, ch => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
})[ch]);
export function youtubeId(value) {
  const text = String(value || '').trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(text)) return text;
  try {
    const url = new URL(text);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    const host = url.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
    const candidate = host === 'youtu.be' ? url.pathname.split('/')[1]
      : ['youtube.com','youtube-nocookie.com'].includes(host)
        ? url.searchParams.get('v') || (/^\/(?:embed|shorts|live)\//.test(url.pathname) ? url.pathname.split('/')[2] : '') : '';
    return /^[A-Za-z0-9_-]{11}$/.test(candidate || '') ? candidate : '';
  } catch { return ''; }
}
export function tutorialId(ex) {
  return youtubeId(ex?.youtubeId) || youtubeId(EXERCISE_VIDEOS[ex?.id]);
}
export function exerciseVideoHTML(ex) {
  const id = tutorialId(ex);
  return `<section class="exercise-video" aria-label="Video tutorial">
    <div class="sec-head">Video Tutorial</div>
    <div class="exercise-video-stage">${id ? '<div class="video-embed"><div id="exercise-youtube-player"></div></div>' : ''}</div>
    <p class="exercise-video-status" role="status">${id ? 'Loading the in-app video player…' : 'A tutorial has not been matched for this movement yet. Paste a YouTube link below to play it here.'}</p>
    <button type="button" class="btn btn-secondary exercise-video-retry" hidden>Retry video</button>
    <details class="exercise-video-replace">
      <summary>${id ? 'Use another tutorial' : 'Play a tutorial in the app'}</summary>
      <form>
        <label for="exercise-video-url">YouTube video link</label>
        <input id="exercise-video-url" type="url" inputmode="url" placeholder="https://www.youtube.com/watch?v=…" aria-describedby="exercise-video-feedback">
        <button type="submit" class="btn btn-primary">Play here</button>
        <p id="exercise-video-feedback" role="status"></p>
      </form>
    </details>
    <p class="pg-note">Videos need an internet connection. Playback stays in this window. Some video owners restrict embedded playback.</p>
  </section>`;
}
let apiPromise;
function youtubeAPI() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    let timer;
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timer);
      try { previous?.(); } catch {}
      resolve(window.YT);
    };
    let script = document.getElementById('forge-youtube-api');
    if (!script) {
      script = document.createElement('script');
      script.id = 'forge-youtube-api';
      script.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(script);
    }
    script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('The video service could not be reached.')); };
    timer = setTimeout(() => { script.remove(); reject(new Error('The video service did not respond.')); }, 15000);
  }).catch(error => { apiPromise = undefined; throw error; });
  return apiPromise;
}
export function playbackError(code) {
  if (code === 101 || code === 150) return 'This video owner has disabled playback inside other apps. Use another tutorial below.';
  if (code === 100) return 'This video is private or unavailable. Use another tutorial below.';
  if (code === 153) return 'YouTube could not verify this player. Retry, or use another tutorial below.';
  return 'This tutorial could not play. Check your connection, retry, or use another tutorial below.';
}
export function mountExerciseVideo(container, ex) {
  const section = container.querySelector('.exercise-video');
  if (!section) return () => {};
  const stage = section.querySelector('.exercise-video-stage');
  const status = section.querySelector('.exercise-video-status');
  const retry = section.querySelector('.exercise-video-retry');
  const input = section.querySelector('input');
  const feedback = section.querySelector('#exercise-video-feedback');
  let player, disposed = false, generation = 0, readyTimer, activeId = tutorialId(ex);
  const stop = () => {
    clearTimeout(readyTimer);
    if (player) { try { player.destroy(); } catch {} player = undefined; }
  };
  const fail = message => { status.textContent = message; retry.hidden = !activeId; };
  async function play(id) {
    const turn = ++generation;
    stop();
    activeId = id;
    retry.hidden = true;
    status.textContent = 'Loading the in-app video player…';
    stage.innerHTML = '<div class="video-embed"><div id="exercise-youtube-player"></div></div>';
    try {
      const YT = await youtubeAPI();
      if (disposed || turn !== generation) return;
      readyTimer = setTimeout(() => { if (!disposed && turn === generation) fail('The video is taking too long to load. Check your connection and retry.'); }, 15000);
      player = new YT.Player(stage.querySelector('#exercise-youtube-player'), {
        host: 'https://www.youtube-nocookie.com',
        videoId: id,
        playerVars: { playsinline:1, rel:0, origin:window.location.origin, autoplay:0 },
        events: {
          onReady: () => { if (disposed || turn !== generation) return; clearTimeout(readyTimer); status.textContent = 'Press Play to watch here. Fullscreen is available in the player.'; },
          onError: event => { if (disposed || turn !== generation) return; clearTimeout(readyTimer); fail(playbackError(event.data)); },
        },
      });
    } catch (error) { if (!disposed && turn === generation) fail(error.message); }
  }
  retry.addEventListener('click', () => { if (activeId) play(activeId); });
  section.querySelector('form').addEventListener('submit', event => {
    event.preventDefault();
    const id = youtubeId(input.value);
    if (!id) { feedback.textContent = 'Enter a valid YouTube video link.'; return; }
    feedback.textContent = 'Tutorial selected. Press Play in the player.';
    play(id);
  });
  if (activeId) play(activeId);
  return () => { disposed = true; generation++; stop(); };
}
