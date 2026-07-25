import { renderOnboarding, renderBuilder } from './components/onboarding.js';
import {
  renderDashboard, renderWorkout, renderSchedule,
  renderProgress, renderLog, renderSettings,
} from './components/pages.js';
import { renderFreestyle } from './components/freestyle.js';
import { renderCalisthenics } from './components/calisthenics.js';
import { renderNutrition, scheduleNutritionCharts } from './components/nutrition.js';
import { renderBodyStats, scheduleBodyCharts } from './components/body-stats.js';
import { renderAchievements } from './components/achievements.js';
import { showExerciseModal, closeExModal, loadVideo } from './components/modal.js';
import { renderFasting, scheduleFastingTimer } from './components/fasting.js';
import { renderSleep, scheduleSleepCharts } from './components/sleep.js';
import { renderActivity, scheduleActivityCharts } from './components/activity.js';
import { renderAnalytics, scheduleAnalyticsCharts } from './components/analytics.js';
import { renderHIIT, scheduleHIITCharts } from './components/hiit.js';
import { renderOverloadMode } from './components/overload-mode.js';
import { renderEquipment } from './components/equipment.js';
import {
  state, save, setPhase, setWeek, logWorkout, clearLog, resetAll,
  logSession, addCardioEntry, addBodyCheckIn, getTodayNutrition,
  addFoodEntry, logWater, updateProfile, recordPR, awardAchievement, updateStreak,
  startFast, endFast, getActiveFast,
  addSleepEntry, removeSleepEntry,
  addActivityEntry, removeActivityEntry,
  formatWeight, weightUnitLabel,
} from './store.js';
import { generateProgram } from './engine/generator.js';
import { EXERCISES } from './data/exercises.js';
import { startActiveWorkout } from './components/active-workout.js';

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
  const el = document.getElementById(`page-${currentPage}`);
  if (el) {
    el.innerHTML = PAGES[currentPage]?.render() || '';
    if (CHART_PAGES[currentPage]) CHART_PAGES[currentPage]();
  }
};

// ── PAGES ──
// Per-page display metadata (label + icon), used by the sidebar, sub-tabs,
// and mobile tab bar.
const PAGE_META = {
  dashboard:    { label: 'Dashboard',    icon: '◈' },
  workout:      { label: 'Workout',      icon: '⚡' },
  overload:     { label: 'Overload',     icon: '📈' },
  equipment:    { label: 'Equipment',    icon: '🎒' },
  freestyle:    { label: 'Freestyle',    icon: '🔀' },
  calisthenics: { label: 'Calisthenics', icon: '🤸' },
  hiit:         { label: 'HIIT',         icon: '🔥' },
  schedule:     { label: 'Schedule',     icon: '⊞' },
  nutrition:    { label: 'Nutrition',    icon: '⊕' },
  fasting:      { label: 'Fasting',      icon: '⏱' },
  sleep:        { label: 'Sleep',        icon: '🌙' },
  activity:     { label: 'Activity',     icon: '⚑' },
  body:         { label: 'Body Stats',   icon: '◉' },
  cardio:       { label: 'Cardio',       icon: '≡' },
  achievements: { label: 'Achievements', icon: '★' },
  analytics:    { label: 'Analytics',    icon: '◎' },
  progress:     { label: 'Progress',     icon: '↑' },
  settings:     { label: 'Settings',     icon: '⚙' },
};

// Consolidated information architecture: 5 hubs. Each hub's pages appear as
// sub-tabs at the top of the content, and the hubs drive the mobile tab bar.
const HUBS = [
  { id: 'today',    label: 'Today',    icon: '◈', pages: ['dashboard'] },
  { id: 'train',    label: 'Train',    icon: '⚡', pages: ['workout','overload','equipment','freestyle','calisthenics','hiit','schedule'] },
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
  equipment:    { render: renderEquipment    },
  freestyle:    { render: renderFreestyle    },
  calisthenics: { render: renderCalisthenics },
  hiit:         { render: renderHIIT         },
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
  analytics:  scheduleAnalyticsCharts,
  hiit:       scheduleHIITCharts,
};

window.openExDetail = (exId) => {
  const ex = EXERCISES[exId];
  if (ex) showExerciseModal({ id: exId, ...ex });
};

let currentPage = 'dashboard';
const navHistory = [];

const PAGE_LABELS = {
  dashboard:    'Dashboard',    workout:      'Workout',
  overload:     'Overload',     equipment:    'Equipment',
  freestyle:    'Freestyle',    calisthenics: 'Calisthenics',
  hiit:         'HIIT',
  schedule:     'Schedule',
  nutrition:    'Nutrition',    fasting:      'Fasting',
  sleep:        'Sleep',        activity:     'Activity',
  body:         'Body Stats',   cardio:       'Cardio Log',
  achievements: 'Achievements', analytics:    'Analytics',
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
  const today = new Date().toISOString().slice(0, 10);
  const calories = state.nutritionLog.find(d => d.date === today)?.calories || 0;
  const lastSleep = state.sleepLog[0];
  const fast = state.activeFast;
  let fastLabel = 'Not fasting';
  if (fast) {
    const elapsed = (Date.now() - new Date(fast.startTime).getTime()) / 3600000;
    const rem = Math.max(fast.plannedHours - elapsed, 0);
    fastLabel = `${fast.protocol} · ${Math.floor(rem)}h left`;
  }
  return `
  <span class="strip-item">🔥 <strong>${state.streak.current}d</strong> streak</span>
  <span class="strip-item">⊕ <strong>${calories}</strong> kcal today</span>
  <span class="strip-item">⏱ ${fastLabel}</span>
  <span class="strip-item">🌙 Sleep: <strong>${lastSleep ? lastSleep.score + '/100' : '—'}</strong></span>`;
}

function _updateStatsStrip() {
  const el = document.getElementById('stats-strip');
  if (el) el.innerHTML = _buildStatsStrip();
}

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

  if (CHART_PAGES[currentPage]) CHART_PAGES[currentPage]();
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

  if (pageId === 'onboard') {
    renderOnboarding(() => { currentPage = 'dashboard'; navHistory.length = 0; buildShell(); });
    return;
  }
  if (pageId === 'builder') {
    renderBuilder(() => { currentPage = 'dashboard'; navHistory.length = 0; buildShell(); });
    return;
  }
  if (!PAGES[pageId] || pageId === currentPage) return;

  if (pushHistory) {
    navHistory.push(currentPage);
    if (navHistory.length > 15) navHistory.shift();
  }

  currentPage = pageId;
  closeSidebar();
  updateTopbar(pageId);

  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === pageId);
  });

  // Refresh hub sub-tabs + mobile tab-bar active state.
  const sub = document.getElementById('hub-subtabs');
  if (sub) sub.innerHTML = hubSubtabsHTML(pageId);
  const activeHub = hubOf(pageId).id;
  document.querySelectorAll('.tabbar-btn').forEach((btn, i) => {
    btn.classList.toggle('active', HUBS[i]?.id === activeHub);
  });

  const el = document.getElementById(`page-${pageId}`);
  if (el) {
    el.innerHTML = PAGES[pageId].render();
    el.classList.add('active');
    if (CHART_PAGES[pageId]) CHART_PAGES[pageId]();
  }

  document.getElementById('main-area')?.scrollTo(0, 0);
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

// ── GLOBAL HANDLERS ──
window.navigate = navigate;

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
    btn.style.color = '#0d0d0b';
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
window.startActiveWorkout = (workoutId, workoutLabel, exercises, workoutType) => {
  startActiveWorkout(workoutId, workoutLabel, exercises, workoutType);
};

// ── BOOT ──
function boot() {
  if (!state.onboarded || !state.program) {
    renderOnboarding(() => {
      currentPage = 'dashboard';
      buildShell();
      setInterval(_updateStatsStrip, 30000);
    });
  } else {
    buildShell();
    setInterval(_updateStatsStrip, 30000);
  }
}

boot();
