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

// Browsers only let audio start from a user gesture. Celebrations fire a beat
// AFTER the tap that caused them (the save settles, then XP is worked out), so
// a context created then is born suspended and every celebration played into
// silence. Unlock on the first touch — and on every touch after, because iOS
// suspends the context again whenever the app is backgrounded.
function unlockAudio() {
  const c = ctx();
  if (!c) return;
  try {
    if (c.state === 'suspended') c.resume();
    const b = c.createBuffer(1, 1, 22050);
    const src = c.createBufferSource();
    src.buffer = b; src.connect(c.destination); src.start(0);
  } catch { /* unsupported — sound simply stays off */ }
}
if (typeof window !== 'undefined') {
  for (const ev of ['pointerdown', 'touchend', 'keydown']) {
    window.addEventListener(ev, unlockAudio, { capture: true, passive: true });
  }
}

const soundOn  = () => state.settings?.sound   !== false;
const hapticOn = () => state.settings?.haptics !== false;

// ── SYNTH ──────────────────────────────────────────────────────────────────
// Everything is synthesised: no audio files, so it works offline and costs
// nothing to load. A compressor on the master bus keeps stacked layers (an
// anvil strike over a fanfare) from clipping on phone speakers.
let _bus = null;
function bus() {
  const c = ctx();
  if (!c) return null;
  if (c.state === 'suspended') { try { c.resume(); } catch {} }
  if (!_bus) {
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2;
    _bus = c.createGain(); _bus.gain.value = 0.9;
    _bus.connect(comp); comp.connect(c.destination);
  }
  return _bus;
}

// One oscillator voice with an attack/decay envelope, optional pitch glide and
// low-pass filter.
function voice({ freq, start = 0, dur = 0.2, vol = 0.2, type = 'sine', attack = 0.004, glide = null, lp = null }) {
  const c = ctx(), out = bus();
  if (!c || !out) return;
  const t = c.currentTime + start;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (glide) osc.frequency.exponentialRampToValueAtTime(glide, t + dur);
  let node = osc;
  if (lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; osc.connect(f); node = f; }
  node.connect(g); g.connect(out);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.start(t); osc.stop(t + dur + 0.02);
}

// Filtered white noise — the hiss of a strike, the rush of a flame.
function noise({ start = 0, dur = 0.2, vol = 0.15, type = 'bandpass', freq = 2000, freqEnd = null, q = 1 }) {
  const c = ctx(), out = bus();
  if (!c || !out) return;
  const t = c.currentTime + start;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(out);
  src.start(t); src.stop(t + dur + 0.02);
}

// Hammer on an anvil: inharmonic partials (a struck metal bar rings at
// roughly 1 : 2.76 : 5.40 : 8.93) with fast, uneven decay, over a bright
// transient of noise.
function anvil(start = 0, vol = 0.32, pitch = 1) {
  const base = 523 * pitch;
  [[1, 1.0, 0.9], [2.76, 0.55, 0.55], [5.40, 0.35, 0.32], [8.93, 0.2, 0.18]].forEach(([m, v, d]) =>
    voice({ freq: base * m, start, dur: d, vol: vol * v, attack: 0.002 }));
  noise({ start, dur: 0.05, vol: vol * 0.7, type: 'highpass', freq: 3500 });
}

// A bell: near-harmonic partials with a long tail.
function bell(freq, start = 0, vol = 0.18, dur = 1.1) {
  [[1, 1], [2, 0.45], [2.4, 0.3], [3, 0.2], [4.2, 0.12]].forEach(([m, v]) =>
    voice({ freq: freq * m, start, dur: dur / Math.sqrt(m), vol: vol * v, attack: 0.003 }));
}

const N = (semi) => 440 * Math.pow(2, (semi - 9) / 12);     // semitones from C4 → Hz
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];       // C major pentatonic

// Sound signatures per cue type.
const SOUNDS = {
  tick:       () => voice({ freq: 660, dur: 0.05, vol: 0.16 }),
  go:         () => voice({ freq: 1046, dur: 0.18, vol: 0.3 }),
  rest:       () => voice({ freq: 523, dur: 0.20, vol: 0.26 }),
  transition: () => { voice({ freq: 784, dur: 0.12, vol: 0.28 }); voice({ freq: 1046, start: 0.13, dur: 0.16, vol: 0.28 }); },
  // A set landing is a light clink on the anvil.
  setDone:    () => anvil(0, 0.14, 1.6),
  pr:         () => { anvil(0, 0.28, 1.2); bell(N(12), 0.12, 0.16); bell(N(19), 0.26, 0.16); bell(N(24), 0.40, 0.2, 1.4); },
  finish:     () => { anvil(0, 0.22, 1); [N(12), N(16), N(19), N(24)].forEach((f, i) => voice({ freq: f, start: 0.15 + i * 0.09, dur: 0.5, vol: 0.12, type: 'triangle' })); },
  // ── v3.29 ──
  select:     () => voice({ freq: 1200, dur: 0.03, vol: 0.10 }),
  warmup:     () => voice({ freq: 560, dur: 0.05, vol: 0.14 }),
  error:      () => { voice({ freq: 220, dur: 0.09, vol: 0.2, type: 'square', lp: 900 }); voice({ freq: 165, start: 0.09, dur: 0.13, vol: 0.2, type: 'square', lp: 700 }); },
  start:      () => { voice({ freq: 392, dur: 0.10, vol: 0.25 }); voice({ freq: 523, start: 0.10, dur: 0.10, vol: 0.25 }); voice({ freq: 784, start: 0.20, dur: 0.22, vol: 0.25 }); },
  milestone:  () => { bell(N(16), 0, 0.14); bell(N(19), 0.1, 0.14); bell(N(24), 0.2, 0.18, 1.3); },
  achievement:() => { bell(N(12), 0, 0.12); bell(N(16), 0.1, 0.12); bell(N(19), 0.2, 0.12); bell(N(24), 0.3, 0.18, 1.4); },
  // ── v3.39: Forge Rank ──
  // XP ticking in: a soft two-note coin, quiet enough to hear on every save.
  xp:         () => { voice({ freq: N(28), dur: 0.07, vol: 0.07, type: 'triangle' }); voice({ freq: N(35), start: 0.06, dur: 0.12, vol: 0.07, type: 'triangle' }); },
  // Quest complete: a proper coin, then a sparkle.
  quest:      () => { voice({ freq: N(23), dur: 0.08, vol: 0.13, type: 'square', lp: 4000 }); voice({ freq: N(28), start: 0.08, dur: 0.32, vol: 0.13, type: 'square', lp: 4000 });
                      bell(N(40), 0.16, 0.05, 0.6); },
  // Badge: a bell run that climbs higher the better the tier.
  badge1:     () => { bell(N(12), 0, 0.14); bell(N(19), 0.12, 0.16, 1.3); },
  badge2:     () => { bell(N(12), 0, 0.13); bell(N(16), 0.1, 0.13); bell(N(19), 0.2, 0.16, 1.3); },
  badge3:     () => { anvil(0, 0.18, 1.3); [0, 4, 7, 12].forEach((s, i) => bell(N(12 + s), 0.1 + i * 0.1, 0.13, 1.2)); noise({ start: 0.1, dur: 0.9, vol: 0.03, type: 'highpass', freq: 7000 }); },
  badge4:     () => { anvil(0, 0.22, 1.2); [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => bell(N(12 + s), 0.1 + i * 0.08, 0.12, 1.3)); noise({ start: 0.1, dur: 1.4, vol: 0.04, type: 'highpass', freq: 7000 }); },
  // Level up: two hammer blows, a low boom, then the fanfare.
  levelUp:    () => {
    anvil(0, 0.34, 1); anvil(0.34, 0.36, 1.12);
    voice({ freq: 110, start: 0.34, dur: 0.7, vol: 0.32, glide: 45 });
    noise({ start: 0.3, dur: 0.8, vol: 0.05, type: 'lowpass', freq: 3000, freqEnd: 300 });
    [0, 4, 7, 12, 16].forEach((s, i) => voice({ freq: N(12 + s), start: 0.62 + i * 0.075, dur: 0.6, vol: 0.11, type: 'sawtooth', lp: 2600 }));
    [12, 16, 19, 24].forEach((s) => voice({ freq: N(s), start: 1.0, dur: 1.4, vol: 0.07, type: 'triangle' }));
    bell(N(36), 1.0, 0.06, 1.6);
  },
  // New rank: the same, bigger — three blows and a fuller final chord.
  rankUp:     () => {
    SOUNDS.levelUp();
    anvil(0.68, 0.36, 1.25);
    [0, 7, 12, 16, 19, 24].forEach((s) => voice({ freq: N(s), start: 1.2, dur: 2.0, vol: 0.06, type: 'sawtooth', lp: 1800 }));
    noise({ start: 1.1, dur: 1.8, vol: 0.035, type: 'highpass', freq: 6000 });
  },
  // Streak milestone: a flame catching, then two bells.
  streak:     () => { noise({ dur: 0.7, vol: 0.12, type: 'lowpass', freq: 250, freqEnd: 4000, q: 0.7 }); bell(N(19), 0.35, 0.14); bell(N(24), 0.5, 0.18, 1.4); },
  // Freeze used: glassy, cold, falling.
  freeze:     () => { [40, 36, 31, 28].forEach((s, i) => voice({ freq: N(s), start: i * 0.07, dur: 0.35, vol: 0.06 })); noise({ dur: 0.25, vol: 0.04, type: 'highpass', freq: 8000 }); },
  weekly:     () => { anvil(0, 0.2, 1.1); [PENTA[2], PENTA[4], PENTA[5]].forEach((s, i) => bell(N(12 + s), 0.1 + i * 0.1, 0.13)); },
};

// ── HAPTICS ────────────────────────────────────────────────────────────────
// navigator.vibrate on Android. iPhones have no vibration API at all — but
// Safari (iOS 18+) plays the system tick when an <input switch> toggles, so a
// hidden switch is clicked once per pulse. Pulse lengths cannot be shaped
// there; the rhythm of the pattern still comes through.
const IOS = typeof navigator !== 'undefined' && /iP(hone|ad|od)/.test(navigator.userAgent || '')
  || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let _switch = null;
function iosTick() {
  try {
    if (!_switch) {
      _switch = document.createElement('label');
      _switch.setAttribute('aria-hidden', 'true');
      _switch.style.cssText = 'position:fixed;left:-200px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden';
      const inp = document.createElement('input');
      inp.type = 'checkbox'; inp.setAttribute('switch', ''); inp.tabIndex = -1;
      _switch.appendChild(inp);
      document.body.appendChild(_switch);
    }
    _switch.click();
  } catch { /* nothing to do */ }
}
function buzz(pattern) {
  if (typeof navigator.vibrate === 'function') { try { navigator.vibrate(pattern); } catch {} return; }
  if (!IOS) return;
  let t = 0;
  pattern.forEach((ms, i) => { if (i % 2 === 0) setTimeout(iosTick, t); t += ms; });
}

// Haptic patterns per cue type (ms on/off).
const HAPTICS = {
  tick:       [15],
  go:         [90],
  rest:       [45],
  transition: [60, 40, 60],
  setDone:    [25],
  pr:         [120, 50, 120, 50, 220],
  finish:     [120, 60, 120],
  // ── v3.29 ──
  // Distinct shapes, not just different lengths — you should be able to tell
  // these apart in a pocket without looking. A warm-up feels lighter than a
  // working set; an error is one blunt buzz; a milestone climbs.
  select:     [8],
  warmup:     [12],
  error:      [70, 40, 70],
  start:      [50, 40, 50, 40, 140],
  milestone:  [40, 30, 40, 30, 160],
  achievement:[100, 40, 60, 40, 60, 40, 240],
  // ── v3.39 ──
  xp:         [10],
  quest:      [20, 60, 40],
  badge1:     [30, 60, 90],
  badge2:     [30, 50, 30, 50, 110],
  badge3:     [60, 50, 30, 40, 30, 40, 160],
  badge4:     [80, 50, 30, 40, 30, 40, 30, 40, 260],
  levelUp:    [35, 300, 45, 220, 400],          // two hammer blows, then the boom
  rankUp:     [35, 300, 45, 300, 55, 200, 600],
  streak:     [15, 25, 20, 25, 25, 25, 140],    // a flame catching
  freeze:     [8, 40, 8, 40, 8],
  weekly:     [40, 60, 40, 60, 120],
};

// Fire a feedback cue. Safe to call anywhere; no-ops when muted/unsupported.
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

export function cue(type) {
  if (soundOn()  && own(SOUNDS, type))  { try { SOUNDS[type](); } catch {} }
  if (hapticOn() && own(HAPTICS, type)) buzz(HAPTICS[type]);
}

// True when the user (or the OS) has asked for less motion. Every decorative
// animation checks this — celebration should never fight an accessibility
// preference.
export function reducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch { return false; }
}

// Animate a number counting up to its new value. Used for session volume and
// the summary stats, where watching the tonnage climb is half the reward.
export function countUp(el, to, { ms = 650, format = (n) => Math.round(n).toLocaleString() } = {}) {
  if (!el) return;
  const from = parseFloat(String(el.dataset.countFrom ?? el.textContent).replace(/[^0-9.-]/g, '')) || 0;
  el.dataset.countFrom = String(to);
  if (reducedMotion() || !Number.isFinite(to) || Math.abs(to - from) < 1) { el.textContent = format(to); return; }
  const t0 = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - t0) / ms);
    const eased = 1 - Math.pow(1 - p, 3);           // ease-out cubic
    el.textContent = format(from + (to - from) * eased);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// A short burst of sparks from an element — the forge motif, used when a set
// lands. Self-cleaning, and a no-op under reduced motion.
export function sparkBurst(anchor, count = 7) {
  if (!anchor || reducedMotion()) return;
  const r = anchor.getBoundingClientRect();
  const host = document.createElement('div');
  host.className = 'spark-host';
  host.style.left = `${r.left + r.width / 2}px`;
  host.style.top  = `${r.top + r.height / 2}px`;
  for (let i = 0; i < count; i++) {
    const sp = document.createElement('i');
    const ang = (Math.PI * 2 * i) / count + Math.random() * 0.6;
    const dist = 18 + Math.random() * 26;
    sp.style.setProperty('--dx', `${Math.cos(ang) * dist}px`);
    sp.style.setProperty('--dy', `${Math.sin(ang) * dist}px`);
    sp.style.animationDelay = `${Math.random() * 60}ms`;
    host.appendChild(sp);
  }
  document.body.appendChild(host);
  setTimeout(() => host.remove(), 700);
}

// ── PARTICLES ──────────────────────────────────────────────────────────────
// One full-viewport canvas, created on first use, drawing only while there is
// something alive on it (the rAF loop stops itself when the last particle
// dies). Colours are read from the theme tokens at the moment of the burst, so
// every theme gets its own sparks. Everything here is decorative, so all of it
// is skipped under prefers-reduced-motion.
let _fx = null, _fxCtx = null, _parts = [], _raf = 0, _dpr = 1;
function fxCanvas() {
  if (_fx && _fx.isConnected) return _fxCtx;
  _fx = document.createElement('canvas');
  _fx.className = 'fx-canvas';
  _fx.setAttribute('aria-hidden', 'true');
  document.body.appendChild(_fx);
  _fxCtx = _fx.getContext('2d');
  const size = () => {
    _dpr = Math.min(2, window.devicePixelRatio || 1);
    _fx.width = innerWidth * _dpr; _fx.height = innerHeight * _dpr;
    _fxCtx.setTransform(_dpr, 0, 0, _dpr, 0, 0);
  };
  size();
  window.addEventListener('resize', size);
  return _fxCtx;
}
export function tokenColor(name, fallback = '#ff6b1a') {
  try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback; } catch { return fallback; }
}
function fxLoop() {
  const c = _fxCtx;
  c.clearRect(0, 0, innerWidth, innerHeight);
  const now = performance.now();
  _parts = _parts.filter((p) => now - p.t0 < p.life);
  for (const p of _parts) {
    if (now < p.t0) continue;                      // staggered: not launched yet
    const k = (now - p.t0) / p.life;               // 0 → 1 over the particle's life
    if (p.target) {
      // Homing: a quadratic curve from the origin, bowed upward, to the target.
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const mx = (p.x0 + p.target.x) / 2 + p.bow, my = Math.min(p.y0, p.target.y) - 80 - Math.abs(p.bow);
      p.x = (1 - e) * (1 - e) * p.x0 + 2 * (1 - e) * e * mx + e * e * p.target.x;
      p.y = (1 - e) * (1 - e) * p.y0 + 2 * (1 - e) * e * my + e * e * p.target.y;
      if (k > 0.97 && !p.hit && p.onHit) { p.hit = true; p.onHit(); }
    } else {
      p.vx *= p.drag; p.vy = p.vy * p.drag + p.g;
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
    }
    const a = p.target ? 1 : Math.max(0, 1 - k * k);
    c.globalAlpha = a;
    c.fillStyle = p.color;
    if (p.shape === 'confetti') {
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.scale(1, Math.cos(p.rot * 2));
      c.fillRect(-p.size, -p.size / 2, p.size * 2, p.size); c.restore();
    } else if (p.shape === 'streak') {
      // A spark drawn as a short streak along its velocity — reads as hot metal.
      c.strokeStyle = p.color; c.lineWidth = p.size; c.lineCap = 'round';
      c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 2.6, p.y - p.vy * 2.6); c.stroke();
    } else {
      c.beginPath(); c.arc(p.x, p.y, p.size * (p.target ? 1 : 1 - k * 0.6), 0, Math.PI * 2); c.fill();
    }
  }
  c.globalAlpha = 1;
  _raf = _parts.length ? requestAnimationFrame(fxLoop) : 0;
  if (!_raf) c.clearRect(0, 0, innerWidth, innerHeight);
}
function fxStart() { if (!_raf) _raf = requestAnimationFrame(fxLoop); }
const at = (a) => {
  if (a && typeof a.getBoundingClientRect === 'function') { const r = a.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  return a && Number.isFinite(a.x) ? a : { x: innerWidth / 2, y: innerHeight / 2 };
};

// A burst from a point or element. kind: 'sparks' (hot streaks that fall),
// 'confetti' (tumbling flakes), 'embers' (rising glow), 'ice' (cold shards).
export function fxBurst(anchor, { kind = 'sparks', count = 28, colors = null, power = 1 } = {}) {
  if (reducedMotion() || typeof document === 'undefined') return;
  fxCanvas();
  const { x, y } = at(anchor);
  const pal = colors || (kind === 'ice' ? [tokenColor('--steel', '#7ab3c8'), '#e8f6ff']
    : kind === 'confetti' ? [tokenColor('--fire'), tokenColor('--ember', '#ffb347'), tokenColor('--green', '#4dffaa'), tokenColor('--steel', '#7ab3c8')]
    : [tokenColor('--fire'), tokenColor('--ember', '#ffb347'), '#fff3d6']);
  const now = performance.now();
  for (let i = 0; i < count; i++) {
    const ang = kind === 'embers' ? -Math.PI / 2 + (Math.random() - 0.5) * 1.4 : Math.random() * Math.PI * 2;
    const sp = (kind === 'confetti' ? 3 + Math.random() * 6 : kind === 'embers' ? 1 + Math.random() * 2.5 : 3 + Math.random() * 7) * power;
    _parts.push({
      x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - (kind === 'confetti' ? 4 : 0),
      g: kind === 'embers' ? -0.02 : kind === 'confetti' ? 0.16 : 0.22, drag: kind === 'confetti' ? 0.985 : 0.965,
      size: kind === 'confetti' ? 3 + Math.random() * 3 : kind === 'sparks' ? 1.4 + Math.random() * 1.4 : 1.5 + Math.random() * 2.5,
      color: pal[i % pal.length], shape: kind === 'confetti' ? 'confetti' : kind === 'sparks' ? 'streak' : 'dot',
      rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
      life: (kind === 'confetti' ? 1600 : kind === 'embers' ? 1400 : 750) + Math.random() * 400, t0: now + Math.random() * 40,
    });
  }
  fxStart();
}

// Particles that fly from one place to another — XP coins into the level chip.
// `onArrive` fires once, as the first lands.
export function fxFly(from, to, { count = 8, color = null, onArrive = null } = {}) {
  if (reducedMotion() || typeof document === 'undefined') { onArrive?.(); return; }
  fxCanvas();
  const a = at(from), b = at(to);
  const now = performance.now();
  let fired = false;
  const hit = () => { if (!fired) { fired = true; onArrive?.(); } };
  for (let i = 0; i < count; i++) {
    _parts.push({ x0: a.x + (Math.random() - 0.5) * 30, y0: a.y + (Math.random() - 0.5) * 16, x: a.x, y: a.y,
      target: b, bow: (Math.random() - 0.5) * 160, size: 2.6 + Math.random() * 1.6,
      color: color || (i % 2 ? tokenColor('--ember', '#ffb347') : tokenColor('--fire')),
      life: 700 + i * 55, t0: now + i * 45, onHit: hit, shape: 'dot' });
  }
  fxStart();
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
