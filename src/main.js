import { renderOnboarding, renderBuilder } from './components/onboarding.js';
import {
  renderDashboard, renderWorkout, renderSchedule,
  renderProgress, renderLog, renderSettings,
} from './components/pages.js';
import { renderFreestyle } from './components/freestyle.js';
import { renderCalisthenics } from './components/calisthenics.js';
import { renderNutrition, scheduleNutritionCharts } from './components/nutrition.js';
import { renderBodyStats, scheduleBodyCharts } from './components/body-stats.js';
import { renderAchievements, initGamifyCelebrations } from './components/achievements.js';
import { summary as gamifySummary, enabled as gamifyEnabled } from './engine/gamify.js';
import { showExerciseModal, closeExModal, loadVideo } from './components/modal.js';
import { renderFasting, scheduleFastingTimer } from './components/fasting.js';
import { renderSleep, scheduleSleepCharts } from './components/sleep.js';
import { renderActivity, scheduleActivityCharts } from './components/activity.js';
import { scheduleCardioCharts } from './components/cardio-log.js';
import { renderAnalytics, scheduleAnalyticsCharts } from './components/analytics.js';
import { renderHIIT, scheduleHIITCharts } from './components/hiit.js';
import { renderTimer, scheduleTimerPage } from './components/interval-timer.js';
import { renderOverloadMode } from './components/overload-mode.js';
import { renderBodyMap } from './components/body-map.js';
import { renderStations } from './components/stations.js';
import { renderPrograms } from './components/programs.js';
import { renderEquipment } from './components/equipment.js';
import { renderLibrary } from './components/library.js';
import './components/import-workouts.js';   // registers window.openImportDialog (Settings → Import)
import {
  state, save, setPhase, setWeek, logWorkout, clearLog, resetAll,
  logSession, addCardioEntry, addBodyCheckIn, getTodayNutrition,
  addFoodEntry, logWater, updateProfile, recordPR, awardAchievement, updateStreak,
  startFast, endFast, getActiveFast,
  addSleepEntry, removeSleepEntry,
  addActivityEntry, removeActivityEntry,
  formatWeight, weightUnitLabel, localDateStr, currentStreak,
} from './store.js';
import { generateProgram } from './engine/generator.js';
import { EXERCISES } from './data/exercises.js';
import { startActiveWorkout, resumeActiveWorkout } from './components/active-workout.js';

// ── THEME ──
// 'forge' is the base (no attribute = Machinist). 'heat' is the default look.
function applyTheme(name) {
  const valid = ['forge', 'heat', 'instrument', 'vivid', 'day', 'ambient', 'steel', 'ember'];
  const t = valid.includes(name) ? name : 'heat';
  if (t === 'forge') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.dataset.theme = t;
  }
  // Keep the phone status bar / address bar color matched to the active theme.
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
}

// Apply immediately on load to avoid flash
applyTheme(state.settings?.theme || 'heat');

window.setTheme = (name) => {
  state.settings.theme = name;
  save();
  applyTheme(name);
  // Refresh settings page swatches to show new active state
  const el = document.getElementById('page-settings');
  if (el && el.innerHTML.trim()) el.innerHTML = PAGES.settings.render();
};

// expose to sub-components
window.__forge_gen   = { generateProgram };
window.__forge_store = {
  logWorkout, logSession, addCardioEntry, addBodyCheckIn,
  getTodayNutrition, addFoodEntry, logWater, updateProfile,
  recordPR, awardAchievement, updateStreak, state, save,
  startFast, endFast, getActiveFast,
  addSleepEntry, removeSleepEntry,
  addActivityEntry, removeActivityEntry,
  formatWeight, weightUnitLabel,
};

// ── WEIGHT UNIT TOGGLE (display-only preference) ──
window.setWeightUnit = (unit) => {
  const u = unit === 'kg' ? 'kg' : 'lbs';
  state.settings.weightUnit = u;
  save();
  // Re-render the current page so weight displays pick up the new unit.
  refreshCurrentPage();
};

window.setDistanceUnit = (unit) => {
  state.settings.distanceUnit = unit === 'km' ? 'km' : 'miles';
  save();
  refreshCurrentPage();
};

// ── INSTALL (Add to Home Screen) ──
// Capture the Android/Chromium install prompt so we can surface an in-app button;
// iOS has no such event, so Settings shows manual instructions there instead.
let _deferredInstall = null;
window.isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
window.canInstallApp = () => !!_deferredInstall;
window.isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;

function refreshInstallUI() {
  const el = document.getElementById('page-settings');
  if (el && el.innerHTML.trim()) el.innerHTML = PAGES.settings.render();
}
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); _deferredInstall = e; refreshInstallUI(); });
window.addEventListener('appinstalled', () => { _deferredInstall = null; refreshInstallUI(); });
window.installApp = async () => {
  if (!_deferredInstall) return;
  _deferredInstall.prompt();
  try { await _deferredInstall.userChoice; } catch {}
  _deferredInstall = null;
  refreshInstallUI();
};

// ── FIRST-RUN COACH TOUR ──
// A short product tour shown once after onboarding, using the coach-mark styles.
// Persisted via settings.tourDone; replayable from Settings.
const TOUR_STEPS = [
  { icon: '🔥', title: 'Welcome to the Forge', body: 'Your training, nutrition, and recovery — all offline, all yours. No account, nothing leaves this device.' },
  { icon: '⚡', title: 'Train', body: 'Start today\'s workout, run Progressive Overload, build a Freestyle session, or do HIIT. The live logger tracks every set, superset, and rest.' },
  { icon: '📚', title: 'Exercise Library', body: '900+ exercises with form cues and demos — search, filter, or create your own. Tap any to see how it\'s done.' },
  { icon: '📈', title: 'Progress & Analytics', body: 'Volume trends, estimated-1RM progression, PR history, a muscle map, and a consistency heatmap show the work paying off.' },
];
let _tourIdx = 0;

function renderTourStep() {
  const s = TOUR_STEPS[_tourIdx];
  const last = _tourIdx === TOUR_STEPS.length - 1;
  let ov = document.getElementById('coach-tour');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'coach-tour';
    ov.className = 'coach-overlay';
    document.body.appendChild(ov);
  }
  ov.innerHTML = `
    <div class="coach-card">
      <div style="font-size:40px;margin-bottom:8px">${s.icon}</div>
      <h3>${s.title}</h3>
      <p>${s.body}</p>
      <div style="display:flex;gap:8px;justify-content:center;align-items:center;margin-bottom:12px">
        ${TOUR_STEPS.map((_, i) => `<span style="width:7px;height:7px;border-radius:50%;background:${i === _tourIdx ? 'var(--fire)' : 'var(--border-hi)'}"></span>`).join('')}
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="endTour()">${last ? 'Close' : 'Skip'}</button>
        <button class="btn btn-fire btn-sm" style="flex:1" onclick="${last ? 'endTour()' : 'tourNext()'}">${last ? 'Start Training' : 'Next →'}</button>
      </div>
    </div>`;
}

window.tourNext = () => { _tourIdx = Math.min(_tourIdx + 1, TOUR_STEPS.length - 1); renderTourStep(); };
window.endTour = () => {
  document.getElementById('coach-tour')?.remove();
  state.settings.tourDone = true;
  save();
};
window.replayTour = () => { _tourIdx = 0; renderTourStep(); };

function maybeShowTour() {
  if (!state.settings?.tourDone) { _tourIdx = 0; setTimeout(renderTourStep, 400); }
}

// ── PAGES ──
// Per-page display metadata (label + icon), used by the sidebar, sub-tabs,
// and mobile tab bar.
const PAGE_META = {
  dashboard:    { label: 'Dashboard',    icon: '◈' },
  workout:      { label: 'Workout',      icon: '⚡' },
  overload:     { label: 'Overload',     icon: '📈' },
  bodymap:      { label: 'Body Map',     icon: '🎯' },
  stations:     { label: 'Stations',     icon: '🔧' },
  programs:     { label: 'Programs',     icon: '🗺' },
  equipment:    { label: 'Equipment',    icon: '🎒' },
  freestyle:    { label: 'Freestyle',    icon: '🔀' },
  calisthenics: { label: 'Calisthenics', icon: '🤸' },
  hiit:         { label: 'HIIT',         icon: '🔥' },
  timer:        { label: 'Timer',        icon: '⏲' },
  library:      { label: 'Library',      icon: '📚' },
  schedule:     { label: 'Schedule',     icon: '⊞' },
  nutrition:    { label: 'Nutrition',    icon: '⊕' },
  fasting:      { label: 'Fasting',      icon: '⏱' },
  sleep:        { label: 'Sleep',        icon: '🌙' },
  activity:     { label: 'Activity',     icon: '⚑' },
  body:         { label: 'Body & Metrics', icon: '◉' },
  cardio:       { label: 'Cardio',       icon: '≡' },
  achievements: { label: 'Rank & Awards', icon: '★' },
  analytics:    { label: 'Analytics',    icon: '◎' },
  progress:     { label: 'Progress',     icon: '↑' },
  settings:     { label: 'Settings',     icon: '⚙' },
};

// Consolidated information architecture: 5 hubs. Each hub's pages appear as
// sub-tabs at the top of the content, and the hubs drive the mobile tab bar.
const HUBS = [
  { id: 'today',    label: 'Today',    icon: '◈', pages: ['dashboard'] },
  { id: 'train',    label: 'Train',    icon: '⚡', pages: ['workout','programs','overload','bodymap','stations','equipment','freestyle','calisthenics','hiit','timer','library','schedule'] },
  { id: 'log',      label: 'Log',      icon: '✎', pages: ['nutrition','fasting','sleep','activity','body','cardio'] },
  { id: 'progress', label: 'Progress', icon: '↑', pages: ['progress','analytics','achievements'] },
  { id: 'profile',  label: 'Profile',  icon: '⚙', pages: ['settings'] },
];

// Sidebar groups derived from the hubs (keeps the grouped desktop sidebar).
const NAV_GROUPS = HUBS.map(h => ({
  label: h.label,
  pages: h.pages.map(id => ({ id, ...PAGE_META[id] })),
}));

const hubOf = (pageId) => HUBS.find(h => h.pages.includes(pageId)) || HUBS[0];

const PAGES = {
  dashboard:    { render: renderDashboard    },
  workout:      { render: renderWorkout      },
  overload:     { render: renderOverloadMode },
  bodymap:      { render: renderBodyMap      },
  stations:     { render: renderStations     },
  programs:     { render: renderPrograms     },
  equipment:    { render: renderEquipment    },
  freestyle:    { render: renderFreestyle    },
  calisthenics: { render: renderCalisthenics },
  hiit:         { render: renderHIIT         },
  timer:        { render: renderTimer        },
  library:      { render: renderLibrary      },
  schedule:     { render: renderSchedule     },
  nutrition:    { render: renderNutrition    },
  fasting:      { render: renderFasting      },
  sleep:        { render: renderSleep        },
  activity:     { render: renderActivity     },
  body:         { render: renderBodyStats    },
  cardio:       { render: renderLog          },
  achievements: { render: renderAchievements },
  analytics:    { render: renderAnalytics    },
  progress:     { render: renderProgress     },
  settings:     { render: renderSettings     },
};

// Sub-tab bar for the hub containing `pageId` (empty for single-page hubs).
function hubSubtabsHTML(pageId) {
  const hub = hubOf(pageId);
  if (!hub || hub.pages.length < 2) return '';
  return `<div class="hub-tabs">${hub.pages.map(id => `
    <button class="hub-tab ${id === pageId ? 'active' : ''}" onclick="navigate('${id}')">
      <span>${PAGE_META[id].icon}</span>${PAGE_META[id].label}
    </button>`).join('')}</div>`;
}

// The Train hub has eleven sub-tabs; on a phone the active one (HIIT, Library…)
// sat off-screen to the right, so nothing showed where you were. Centre it.
function revealActiveSubtab() {
  const bar = document.querySelector('#hub-subtabs .hub-tabs');
  const tab = bar?.querySelector('.hub-tab.active');
  if (!bar || !tab || bar.scrollWidth <= bar.clientWidth) return;
  bar.scrollLeft = tab.offsetLeft - bar.offsetLeft - (bar.clientWidth - tab.offsetWidth) / 2;
}

// Mobile bottom tab bar (one entry per hub).
function tabbarHTML(pageId) {
  const activeHub = hubOf(pageId).id;
  return `<nav class="tabbar" id="tabbar">${HUBS.map(h => `
    <button class="tabbar-btn ${h.id === activeHub ? 'active' : ''}" onclick="gotoHub('${h.id}')">
      <span class="tb-ic">${h.icon}</span>${h.label}
    </button>`).join('')}</nav>`;
}

// pages that need Chart.js post-render scheduling
const CHART_PAGES = {
  nutrition:  scheduleNutritionCharts,
  body:       scheduleBodyCharts,
  sleep:      scheduleSleepCharts,
  fasting:    scheduleFastingTimer,
  activity:   scheduleActivityCharts,
  cardio:     scheduleCardioCharts,
  analytics:  scheduleAnalyticsCharts,
  hiit:       scheduleHIITCharts,
  timer:      scheduleTimerPage,
};

window.openExDetail = (exId) => {
  const ex = EXERCISES[exId];
  if (ex) showExerciseModal({ id: exId, ...ex });
};

let currentPage = 'dashboard';
const navHistory = [];

// ── URL HASH ROUTING ──
// Keeps the address bar in sync so refresh restores the page, deep links work
// (e.g. …/#library), and the browser back/forward buttons navigate the app.
let _suppressHashEvent = false;

// Membership test that ignores inherited keys. `PAGES['__proto__']` and
// `PAGES['constructor']` are truthy on any plain object, so a crafted hash
// walked straight past `if (PAGES[p])`, deactivated every page and rendered
// nothing — the app went blank with no error to show for it.
// Flare the dashboard flame on the first render after the streak grows — the
// one number in the app that rewards simply turning up.
let _seenStreak = null;
function maybeFlareStreak() {
  const cur = gamifySummary().daily.current;
  if (_seenStreak != null && cur > _seenStreak) {
    document.querySelectorAll('.streak-flame').forEach((el) => {
      el.classList.add('streak-flare');
      setTimeout(() => el.classList.remove('streak-flare'), 950);
    });
  }
  _seenStreak = cur;
}

const isPage = (id) => Object.prototype.hasOwnProperty.call(PAGES, id);
const chartFor = (id) => (Object.prototype.hasOwnProperty.call(CHART_PAGES, id) ? CHART_PAGES[id] : null);

function syncHash(pageId) {
  if (location.hash === `#${pageId}`) return;
  _suppressHashEvent = true;           // our own assignment — don't re-navigate
  location.hash = pageId;
}

window.addEventListener('hashchange', () => {
  if (_suppressHashEvent) { _suppressHashEvent = false; return; }
  const p = location.hash.slice(1);
  if (isPage(p) && p !== currentPage) navigate(p, false);
});

// Initial page from the URL (only honored once onboarded, in boot()).
function pageFromHash() {
  const p = location.hash.slice(1);
  return isPage(p) ? p : 'dashboard';
}

const PAGE_LABELS = {
  dashboard:    'Dashboard',    workout:      'Workout',
  overload:     'Overload',     bodymap:      'Body Map',
  stations:     'Stations',
  programs:     'Programs',
  equipment:    'Equipment',    freestyle:    'Freestyle',
  calisthenics: 'Calisthenics',
  hiit:         'HIIT',         timer:        'Timer',
  library:      'Exercise Library',
  schedule:     'Schedule',
  nutrition:    'Nutrition',    fasting:      'Fasting',
  sleep:        'Sleep',        activity:     'Activity',
  body:         'Body & Metrics', cardio:       'Cardio Log',
  achievements: 'Rank & Awards', analytics:    'Analytics',
  progress:     'Progress',     settings:     'Settings',
};

// ── DRAWER ──
window.toggleSidebar = () => {
  document.getElementById('sidebar')?.classList.toggle('open');
  document.getElementById('sidebar-backdrop')?.classList.toggle('visible');
};
window.closeSidebar = () => {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-backdrop')?.classList.remove('visible');
};

function updateTopbar(pageId) {
  const titleEl = document.getElementById('topbar-title');
  const backEl  = document.getElementById('topbar-back');
  if (titleEl) titleEl.textContent = PAGE_LABELS[pageId] || 'FITNESS FORGE';
  if (backEl)  backEl.classList.toggle('visible', navHistory.length > 0);
}

// ── STATS STRIP ──
function _buildStatsStrip() {
  // Local day, matching the Nutrition page (which keys days by local date).
  const today = localDateStr();
  const calories = Math.round(state.nutritionLog.find(d => d?.date === today)?.calories || 0);
  // Latest night by date, and only an entry that actually has a score — a
  // sleep entry without one used to render "Sleep: undefined/100".
  const lastSleep = state.sleepLog.find(e => Number.isFinite(e?.score));
  const fast = state.activeFast;
  let fastLabel = 'Not fasting';
  if (fast) {
    const elapsed = (Date.now() - new Date(fast.startTime).getTime()) / 3600000;
    const rem = Math.max((Number(fast.plannedHours) || 0) - elapsed, 0);
    fastLabel = rem > 0
      ? `${fast.protocol} · ${rem < 1 ? Math.max(1, Math.round(rem * 60)) + 'm' : Math.ceil(rem) + 'h'} left`
      : `${fast.protocol} · goal reached ✓`;
  }
  return `
  <span class="strip-item" title="Daily fire — days in a row with any workout, stretch, walk or log">🔥 <strong>${gamifySummary().daily.current}d</strong> fire</span>
  ${gamifyEnabled() ? `<span class="strip-item gm-strip-lv" id="gm-strip-lv" title="Forge Rank — ${gamifySummary().xp.toLocaleString()} XP" onclick="navigate('achievements')">⚡ <strong>Lv ${gamifySummary().level}</strong> ${gamifySummary().rank.name}</span>` : ''}
  <span class="strip-item">⊕ <strong>${calories}</strong> kcal today</span>
  <span class="strip-item">⏱ ${fastLabel}</span>
  <span class="strip-item">🌙 Sleep: <strong>${lastSleep ? Math.round(lastSleep.score) + '/100' : '—'}</strong></span>`;
}

function _updateStatsStrip() {
  const el = document.getElementById('stats-strip');
  if (el) el.innerHTML = _buildStatsStrip();
}
// The strip summarises state, so refresh it whenever state is written — it
// used to update only on a 30s timer, so logging food, sleep or a fast left
// it showing the old numbers. Coalesced to one rebuild per frame.
let _stripQueued = false;
window.addEventListener('forge:saved', () => {
  if (_stripQueued) return;
  _stripQueued = true;
  requestAnimationFrame(() => { _stripQueued = false; _updateStatsStrip(); });
});

// ── SHELL ──
function buildShell() {
  const { profile, program, currentPhase, currentWeek } = state;
  const displayName = profile?.name || 'Athlete';
  const phaseName   = ['Foundation','Hypertrophy','Strength','Peak & Power'][currentPhase - 1] || '';

  document.getElementById('root').innerHTML = `
<!-- mobile topbar -->
<div class="mobile-topbar" id="mobile-topbar">
  <button class="topbar-hamburger" onclick="toggleSidebar()" aria-label="Open menu">☰</button>
  <span class="topbar-title" id="topbar-title">${PAGE_LABELS[currentPage] || 'FITNESS FORGE'}</span>
  <button class="topbar-back" id="topbar-back" onclick="goBack()">← Back</button>
</div>
<!-- drawer backdrop -->
<div class="sidebar-backdrop" id="sidebar-backdrop" onclick="closeSidebar()"></div>

<!-- STATS STRIP -->
<div class="stats-strip" id="stats-strip">
  ${_buildStatsStrip()}
</div>

<div class="shell">
  <!-- SIDEBAR -->
  <nav class="sidebar" id="sidebar">
    <div class="sidebar-head">
      <div class="brand">
        <div class="brand-icon">🔥</div>
        <div>
          <div class="brand-name">FITNESS FORGE</div>
          <div class="brand-tag">Build. Track. Progress.</div>
        </div>
      </div>
    </div>

    <div class="sidebar-body">
      ${NAV_GROUPS.map(group => `
        <div class="nav-group">
          <div class="nav-group-label">${group.label}</div>
          ${group.pages.map(p => `
            <button class="nav-btn ${p.id === currentPage ? 'active' : ''}" data-page="${p.id}" onclick="navigate('${p.id}')">
              <span class="nav-icon">${p.icon}</span>${p.label}
            </button>
          `).join('')}
        </div>
      `).join('')}
    </div>

    <div class="sidebar-foot">
      <div class="user-chip">
        <div class="name">${displayName.toUpperCase()}</div>
        <div class="meta">Phase ${currentPhase} · Week ${currentWeek} · ${phaseName}</div>
      </div>
    </div>
  </nav>

  <!-- MAIN -->
  <main class="main" id="main-area">
    <div id="hub-subtabs">${hubSubtabsHTML(currentPage)}</div>
    ${Object.entries(PAGES).map(([id, p]) => `
      <div class="page ${id === currentPage ? 'active' : ''}" id="page-${id}">
        ${id === currentPage ? p.render() : ''}
      </div>
    `).join('')}
  </main>
</div>

<!-- MOBILE BOTTOM TAB BAR -->
${tabbarHTML(currentPage)}
  `;

  revealActiveSubtab();
  chartFor(currentPage)?.();
}

// ── NAVIGATE ──
function navigate(pageId, pushHistory = true) {
  // Clean up page-specific intervals/modals on navigate away
  if (currentPage === 'fasting') clearInterval(window._fastTimerInterval);
  if (currentPage === 'hiit') {
    clearInterval(window._hiitTimerInterval);
    const mo = document.getElementById('hiit-modal-overlay');
    if (mo) { mo.classList.remove('open'); const mb = document.getElementById('hiit-media-box'); if (mb) mb.innerHTML = ''; }
  }

  // Both flows replace the whole shell. Done → a fresh dashboard (with the
  // URL to match, or a refresh reopened the page you started from); Cancel →
  // the page you came from, program untouched.
  const done = () => { currentPage = 'dashboard'; navHistory.length = 0; syncHash('dashboard'); buildShell(); };
  const cancel = () => buildShell();
  if (pageId === 'onboard') { renderOnboarding(done, cancel); return; }
  if (pageId === 'builder') { renderBuilder(done, cancel); return; }
  if (!isPage(pageId) || pageId === currentPage) return;

  if (pushHistory) {
    navHistory.push(currentPage);
    if (navHistory.length > 15) navHistory.shift();
  }

  currentPage = pageId;
  syncHash(pageId);
  closeSidebar();
  updateTopbar(pageId);

  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === pageId);
  });

  // Refresh hub sub-tabs + mobile tab-bar active state.
  const sub = document.getElementById('hub-subtabs');
  if (sub) { sub.innerHTML = hubSubtabsHTML(pageId); revealActiveSubtab(); }
  const activeHub = hubOf(pageId).id;
  document.querySelectorAll('.tabbar-btn').forEach((btn, i) => {
    btn.classList.toggle('active', HUBS[i]?.id === activeHub);
  });

  const el = document.getElementById(`page-${pageId}`);
  if (el) {
    el.innerHTML = PAGES[pageId].render();
    el.classList.add('active');
    if (pageId === 'dashboard') maybeFlareStreak();
    chartFor(pageId)?.();
  }

  // The window is the scroller, not #main-area (which never overflows), so a
  // page used to open wherever the previous one had been scrolled to.
  document.getElementById('main-area')?.scrollTo(0, 0);
  window.scrollTo(0, 0);
}

// Navigate to a hub — land on the hub's current page if already inside it,
// otherwise its first page.
function gotoHub(hubId) {
  const hub = HUBS.find(h => h.id === hubId);
  if (!hub) return;
  if (hub.pages.includes(currentPage)) return; // already here
  navigate(hub.pages[0]);
}
window.gotoHub = gotoHub;

// ── STORAGE FAILURE ──────────────────────────────────────────────────────────
// localStorage is the only place user data lives. When a write fails — the
// quota is full, or the browser is blocking site data — everything after that
// point is lost on reload. The app used to swallow the error and still tell
// you the session was saved, so the only way to find out was to lose a
// workout. Say it loudly instead, and keep saying it until a write succeeds.
let _storageBannerUp = false;

function showStorageBanner(detail) {
  if (_storageBannerUp) return;
  _storageBannerUp = true;
  const quota = /quota/i.test(detail?.name || '') || /quota/i.test(detail?.message || '');
  const el = document.createElement('div');
  el.id = 'storage-banner';
  el.className = 'storage-banner';
  el.innerHTML = `
    <span class="storage-banner-ic">⚠</span>
    <div class="storage-banner-body">
      <b>Not saving — your data is at risk.</b>
      <span>${quota
        ? 'This browser will not store more app data — storage is full, or you are in private browsing.'
        : 'The browser refused to store app data. Site data may be blocked for this page.'}
        Anything you log now is lost on reload. Export a backup from Settings before you continue.</span>
    </div>
    <button class="btn btn-fire btn-sm" onclick="navigate('settings')">Back up →</button>
    <button class="storage-banner-x" onclick="this.closest('.storage-banner').remove()" aria-label="Dismiss">✕</button>`;
  document.body.appendChild(el);
}

window.addEventListener('forge:save-failed', (e) => showStorageBanner(e.detail));
window.addEventListener('forge:save-recovered', () => {
  document.getElementById('storage-banner')?.remove();
  _storageBannerUp = false;
});

// ── GLOBAL HANDLERS ──
window.navigate = navigate;

// Re-render whatever page is on screen, in place (no history entry, no scroll
// reset). Used whenever state changes behind an overlay — finishing a workout
// updates the streak, session count and today's card, and the page underneath
// would otherwise keep showing the pre-workout numbers until you navigated away.
function refreshCurrentPage() {
  const el = document.getElementById(`page-${currentPage}`);
  if (!el || !isPage(currentPage)) return;
  el.innerHTML = PAGES[currentPage].render();
  chartFor(currentPage)?.();
  if (currentPage === 'dashboard') maybeFlareStreak();
}
window.refreshCurrentPage = refreshCurrentPage;

window.goBack = () => {
  if (!navHistory.length) return;
  navigate(navHistory.pop(), false);
};

window.changePhase = (n) => {
  setPhase(n);
  const el = document.getElementById(`page-${currentPage}`);
  if (el) el.innerHTML = PAGES[currentPage]?.render() || '';
  const chip = document.querySelector('.user-chip .meta');
  if (chip) {
    const phaseName = ['Foundation','Hypertrophy','Strength','Peak & Power'][n-1] || '';
    chip.textContent = `Phase ${n} · Week ${state.currentWeek} · ${phaseName}`;
  }
};

window.changeWeek = (n) => {
  setWeek(n);
  const el = document.getElementById(`page-${currentPage}`);
  if (el) el.innerHTML = PAGES[currentPage]?.render() || '';
  const chip = document.querySelector('.user-chip .meta');
  if (chip) {
    const phaseName = ['Foundation','Hypertrophy','Strength','Peak & Power'][state.currentPhase-1] || '';
    chip.textContent = `Phase ${state.currentPhase} · Week ${n} · ${phaseName}`;
  }
};

window.logToday = (label, type) => {
  logWorkout({
    date: new Date().toISOString(),
    label, type,
    phase: state.currentPhase,
    week: state.currentWeek,
    notes: '',
  });
  updateStreak();
  const btn = document.getElementById('log-btn');
  if (btn) {
    btn.textContent = '✓ Logged!';
    btn.style.background = 'var(--forge-green)';
    btn.style.color = 'var(--bg)';
    setTimeout(() => {
      btn.textContent = '✓ Mark Complete';
      btn.style.background = '';
      btn.style.color = '';
    }, 2000);
  }
};

window.clearWorkoutLog = () => {
  clearLog();
  const el = document.getElementById('page-cardio');
  if (el) el.innerHTML = PAGES.cardio.render();
};

window.resetProgram = () => {
  resetAll();
  boot();
};

// ── ACTIVE WORKOUT ──
// Pass every argument through: Programs sends a 5th (programContext — its
// overload rule and rest period), which this wrapper used to drop.
window.startActiveWorkout = (...args) => startActiveWorkout(...args);

// ── KEYBOARD SHORTCUT: "/" jumps to the Exercise Library search ──
document.addEventListener('keydown', (e) => {
  if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
  if (document.body.classList.contains('session-active')) return;   // not during a workout
  if (!state.onboarded) return;
  e.preventDefault();
  if (currentPage !== 'library') navigate('library');
  setTimeout(() => document.querySelector('.lib-search')?.focus(), 50);
});

// ── DEMO THUMBNAIL CYCLING ──
// A thumbnail shows one frame of a movement that has two or three. On hover
// the next frame is fetched and crossfaded, so a list of exercises animates
// under the cursor instead of sitting still — without paying for a second
// image on every row up front (a 153-row station would be ~10 MB).
//
// Delegated from the document because every page rebuilds its own markup, and
// capture-phase because `mouseenter` does not bubble.
const _prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Start / stop one thumbnail's cycle. Shared by the hover path (desktop) and
// the in-view path (touch), so the two cannot drift apart.
function _startCycle(thumb) {
  // Bail if a second frame is already present, not merely if it is already
  // showing: removing one mid-hover changes the element under the cursor and
  // fires `mouseenter` again, which otherwise stacks up a fresh image whose
  // `is-cycling` class has not landed yet.
  if (!thumb || thumb.querySelector('img.f2') || _prefersReducedMotion()) return;
  const url = thumb.dataset.f2;
  if (!url) return;
  const img = document.createElement('img');
  img.className = 'f2';
  img.alt = '';
  img.decoding = 'async';
  // Only reveal the second frame once it has actually decoded: a half-loaded
  // crossfade reads as a flicker, and a 404 should leave the first frame alone.
  // `isConnected` guards the race where the cycle is stopped before the image
  // arrives — marking the thumbnail then left the class stuck on with nothing
  // to show.
  img.onload = () => { if (img.isConnected) thumb.classList.add('is-cycling'); };
  img.onerror = () => { img.remove(); delete thumb.dataset.f2; };
  img.src = url;
  thumb.appendChild(img);
}
function _stopCycle(thumb) {
  if (!thumb) return;
  thumb.classList.remove('is-cycling');
  thumb.querySelector('img.f2')?.remove();
}

document.addEventListener('mouseenter', (e) => {
  const thumb = e.target instanceof Element ? e.target.closest?.('.ex-thumb[data-f2]') : null;
  _startCycle(thumb);
}, true);

document.addEventListener('mouseleave', (e) => {
  // Matches any thumbnail, not just one already marked `is-cycling` — the
  // replacement described above can still be waiting on its `onload`.
  const thumb = e.target instanceof Element ? e.target.closest?.('.ex-thumb') : null;
  if (!thumb) return;
  // `mouseleave` also fires on the thumbnail's own children as the pointer
  // crosses between them. Only tear down when it has actually left the thumb.
  if (e.relatedTarget instanceof Node && thumb.contains(e.relatedTarget)) return;
  _stopCycle(thumb);
}, true);

// Touch devices never hover, so the cycling above never ran on a phone — most
// of the people using this at a gym. There, exactly ONE thumbnail cycles: the
// one nearest the middle of the screen as you scroll. One extra image at a
// time, never a list's worth, and it reads as the list coming alive under
// your thumb.
const _noHover = () => window.matchMedia?.('(hover: none)').matches;
let _focusThumb = null;
let _focusQueued = false;

function _refocusThumb() {
  _focusQueued = false;
  if (!_noHover() || _prefersReducedMotion()) return;
  const mid = window.innerHeight / 2;
  let best = null, bestDist = Infinity;
  for (const t of document.querySelectorAll('.ex-thumb[data-f2]')) {
    const r = t.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight || !r.width) continue;   // off screen or hidden
    const d = Math.abs(r.top + r.height / 2 - mid);
    if (d < bestDist) { best = t; bestDist = d; }
  }
  if (best === _focusThumb) return;
  _stopCycle(_focusThumb);
  _focusThumb = best;
  _startCycle(best);
}
// rAF-throttled: a scroll fires dozens of events a frame.
function _queueRefocus() {
  if (_focusQueued) return;
  _focusQueued = true;
  requestAnimationFrame(_refocusThumb);
}
// Capture phase, so scrolling inside the app's own scroll container is seen too.
document.addEventListener('scroll', _queueRefocus, { capture: true, passive: true });
window.addEventListener('resize', _queueRefocus, { passive: true });
// Pages rebuild their markup on navigation; pick a new focus when they do.
new MutationObserver(_queueRefocus).observe(document.getElementById('root') || document.body, { childList: true, subtree: true });

// ── KEYBOARD + SCREEN-READER BASICS, APPLIED ONCE FOR EVERY PAGE ──
// Pages render with template literals and many tappable things are a <div> or
// <span> with an inline onclick (stat tiles, exercise cards, muscle tiles, HIIT
// checks): unreachable by Tab, silent to a screen reader. And form labels are
// written as a sibling <label> without `for`, so inputs announce no name.
// Fixing ~100 call sites one by one would rot the moment a page adds another,
// so this pass runs after each render and patches the markup in place.
const NATIVE_CTRL = /^(BUTTON|A|INPUT|SELECT|TEXTAREA|LABEL|SUMMARY|OPTION)$/;
const IS_CTRL = 'input, select, textarea';
// Backdrops and stopPropagation wrappers carry onclick but are not controls.
const NOT_A_CONTROL = /^\s*(event\.stopPropagation\(\);?|if\s*\(\s*event\.target\s*===\s*this\s*\))/;
function _a11yPass(root) {
  root.querySelectorAll('[onclick]').forEach(el => {
    if (NATIVE_CTRL.test(el.tagName) || el.hasAttribute('tabindex') || el.closest('svg')) return;
    const fn = el.getAttribute('onclick') || '';
    if (NOT_A_CONTROL.test(fn) || /backdrop|overlay/.test(el.className)) return;
    // A wordless thumbnail beside a named twin that does the same thing (the
    // Overload/Equipment media + name pair): one Tab stop, the named one.
    if (!el.textContent.trim() && !el.hasAttribute('aria-label')) {
      const twin = [...(el.parentElement?.parentElement || el).querySelectorAll('[onclick]')]
        .find(o => o !== el && o.getAttribute('onclick') === fn && o.textContent.trim());
      if (twin) { el.setAttribute('aria-hidden', 'true'); el.tabIndex = -1; return; }
    }
    el.tabIndex = 0;
    // role=button makes children presentational — only safe when there are
    // no real controls inside to hide.
    if (!el.hasAttribute('role') && !el.querySelector('button, a, input, select, textarea')) el.setAttribute('role', 'button');
  });
  root.querySelectorAll('label:not([for])').forEach(lab => {
    if (lab.querySelector(IS_CTRL)) return;
    const next = lab.nextElementSibling;
    if (!next || !next.matches(IS_CTRL) || next.hasAttribute('aria-label')) return;
    if (!next.id) next.id = 'ff-ctl-' + Math.random().toString(36).slice(2, 9);
    lab.htmlFor = next.id;
  });
}
let _a11yQueued = false;
new MutationObserver(() => {
  if (_a11yQueued) return;
  _a11yQueued = true;
  requestAnimationFrame(() => { _a11yQueued = false; _a11yPass(document.body); });
}).observe(document.body, { childList: true, subtree: true });
// Enter / Space on a patched element does what a click does.
document.addEventListener('keydown', (e) => {
  if ((e.key !== 'Enter' && e.key !== ' ') || e.defaultPrevented) return;
  const el = e.target;
  if (!(el instanceof HTMLElement) || NATIVE_CTRL.test(el.tagName) || !el.hasAttribute('onclick') || el.hasAttribute('onkeydown')) return;
  if (el.getAttribute('role') !== 'button' && el.getAttribute('role') !== 'checkbox' && el.tabIndex !== 0) return;
  e.preventDefault();
  el.click();
});

// ── BOOT ──
// Reset All re-runs boot(); one strip timer is enough.
let _stripTimer = null;
function _startStripTimer() { if (!_stripTimer) _stripTimer = setInterval(_updateStatsStrip, 30000); }

function boot() {
  initGamifyCelebrations();
  if (!state.onboarded || !state.program) {
    renderOnboarding(() => {
      currentPage = 'dashboard';
      navHistory.length = 0;
      syncHash('dashboard');
      buildShell();
      _startStripTimer();
      maybeShowTour();               // first-run product tour after onboarding
    });
  } else {
    currentPage = pageFromHash();      // deep link / refresh restores the page
    syncHash(currentPage);
    buildShell();
    _startStripTimer();
    maybeShowTour();
    resumeActiveWorkout();           // a reload mid-session picks the workout back up
  }
}

boot();
