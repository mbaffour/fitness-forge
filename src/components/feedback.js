// ═══════════════════════════════════════════
//   FITNESS FORGE — Audio + Haptic Feedback
//   One shared cue() for every timer transition,
//   set completion, countdown tick, and PR.
//   Respects Settings → Sound / Haptics toggles.
//   Zero dependencies: WebAudio + navigator.vibrate.
// ═══════════════════════════════════════════

import { state } from '../store.js';

let _ctx = null;
function ctx() {
  if (_ctx) return _ctx;
  try { _ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { _ctx = null; }
  return _ctx;
}

const soundOn  = () => state.settings?.sound   !== false;
const hapticOn = () => state.settings?.haptics !== false;

// Play a single sine tone at `start` seconds from now.
function tone(freq, start, dur, vol = 0.3) {
  const c = ctx();
  if (!c) return;
  if (c.state === 'suspended') { try { c.resume(); } catch {} }
  const osc = c.createOscillator();
  const g   = c.createGain();
  osc.connect(g); g.connect(c.destination);
  osc.type = 'sine';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(vol, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + start + dur);
  osc.start(c.currentTime + start);
  osc.stop(c.currentTime + start + dur);
}

function buzz(pattern) { try { navigator.vibrate?.(pattern); } catch {} }

// Sound signatures per cue type.
const SOUNDS = {
  tick:       () => tone(660, 0, 0.05, 0.16),
  go:         () => tone(1046, 0, 0.18, 0.3),
  rest:       () => tone(523, 0, 0.20, 0.26),
  transition: () => { tone(784, 0, 0.12); tone(1046, 0.13, 0.16); },
  setDone:    () => { tone(880, 0, 0.06, 0.22); tone(1320, 0.06, 0.09, 0.22); },
  pr:         () => { tone(784, 0, 0.12); tone(988, 0.12, 0.12); tone(1319, 0.24, 0.28); },
  finish:     () => { tone(880, 0, 0.12); tone(1100, 0.14, 0.12); tone(1320, 0.28, 0.20); },
};

// Haptic patterns per cue type (ms on/off).
const HAPTICS = {
  tick:       [15],
  go:         [90],
  rest:       [45],
  transition: [60, 40, 60],
  setDone:    [25],
  pr:         [120, 50, 120, 50, 220],
  finish:     [120, 60, 120],
};

// Fire a feedback cue. Safe to call anywhere; no-ops when muted/unsupported.
export function cue(type) {
  if (soundOn()  && SOUNDS[type])  { try { SOUNDS[type](); } catch {} }
  if (hapticOn() && HAPTICS[type]) buzz(HAPTICS[type]);
}

// ── SCREEN WAKE LOCK ──
// Keeps the display on during an active workout or HIIT timer so the phone
// doesn't sleep mid-set. No-ops where unsupported (falls back silently).
let _wakeLock = null;
let _wantWake = false;

async function _requestWake() {
  try {
    _wakeLock = await navigator.wakeLock?.request('screen');
    // The browser can release it on its own (e.g. tab hidden) — track that so
    // the visibilitychange handler knows to reacquire.
    _wakeLock?.addEventListener('release', () => { _wakeLock = null; });
  } catch { _wakeLock = null; }
}

// The lock is auto-released when the tab is hidden; reacquire on return.
document.addEventListener('visibilitychange', () => {
  if (_wantWake && document.visibilityState === 'visible' && !_wakeLock) _requestWake();
});

export function acquireWakeLock() {
  _wantWake = true;
  if (!_wakeLock) _requestWake();
}

export function releaseWakeLock() {
  _wantWake = false;
  try { _wakeLock?.release(); } catch {}
  _wakeLock = null;
}

// ── LOCAL NOTIFICATIONS ──
// Fully offline: uses the Notification API (+ the service worker where present).
// Handy for a rest-timer alert when the app is backgrounded. No server involved.
export async function requestNotifyPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  try { return await Notification.requestPermission(); } catch { return 'denied'; }
}

export function notify(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const opts = { body, icon: './icons/icon-192.png', badge: './icons/icon-192.png', tag: 'forge-rest', silent: false };
  try {
    if (navigator.serviceWorker?.getRegistration) {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (reg?.showNotification) reg.showNotification(title, opts);
        else new Notification(title, opts);
      }).catch(() => { try { new Notification(title, opts); } catch {} });
    } else {
      new Notification(title, opts);
    }
  } catch {}
}
