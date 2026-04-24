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
import {
  state, save, setPhase, setWeek, logWorkout, clearLog, resetAll,
  logSession, addCardioEntry, addBodyCheckIn, getTodayNutrition,
  addFoodEntry, logWater, updateProfile, recordPR, awardAchievement, updateStreak,
} from './store.js';
import { generateProgram } from './engine/generator.js';
import { EXERCISES } from './data/exercises.js';
import { startActiveWorkout } from './components/active-workout.js';

// ── THEME ──
function applyTheme(name) {
  const valid = ['forge', 'day', 'ambient', 'steel', 'ember'];
  const t = valid.includes(name) ? name : 'forge';
  if (t === 'forge') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.dataset.theme = t;
  }
}

// Apply immediately on load to avoid flash
applyTheme(state.settings?.theme || 'forge');

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
  recordPR, awardAchievement, updateStreak, state,
};

// ── PAGES ──
const NAV_GROUPS = [
  {
    label: 'Train',
    pages: [
      { id: 'dashboard', label: 'Dashboard', icon: '◈' },
      { id: 'workout',   label: 'Workout',   icon: '⚡' },
      { id: 'freestyle',     label: 'Freestyle',     icon: '🔀' },
      { id: 'calisthenics', label: 'Calisthenics',  icon: '🤸' },
      { id: 'schedule',  label: 'Schedule',  icon: '⊞'  },
    ],
  },
  {
    label: 'Track',
    pages: [
      { id: 'nutrition',    label: 'Nutrition',    icon: '⊕' },
      { id: 'body',         label: 'Body Stats',   icon: '◉' },
      { id: 'log',          label: 'Log',          icon: '≡' },
      { id: 'achievements', label: 'Achievements', icon: '★' },
    ],
  },
  {
    label: 'Manage',
    pages: [
      { id: 'progress', label: 'Progress', icon: '↑' },
      { id: 'settings', label: 'Settings', icon: '⚙' },
    ],
  },
];

const PAGES = {
  dashboard:    { render: renderDashboard   },
  workout:      { render: renderWorkout     },
  freestyle:    { render: renderFreestyle    },
  calisthenics: { render: renderCalisthenics },
  schedule:     { render: renderSchedule    },
  nutrition:    { render: renderNutrition   },
  body:         { render: renderBodyStats   },
  log:          { render: renderLog         },
  achievements: { render: renderAchievements },
  progress:     { render: renderProgress    },
  settings:     { render: renderSettings    },
};

// pages that need Chart.js post-render scheduling
const CHART_PAGES = {
  nutrition:    scheduleNutritionCharts,
  body:         scheduleBodyCharts,
};

window.openExDetail = (exId) => {
  const ex = EXERCISES[exId];
  if (ex) showExerciseModal({ id: exId, ...ex });
};

let currentPage = 'dashboard';
const navHistory = [];

const PAGE_LABELS = {
  dashboard:    'Dashboard',    workout:      'Workout',
  freestyle:    'Freestyle',    calisthenics: 'Calisthenics',
  schedule:     'Schedule',
  nutrition:    'Nutrition',    body:         'Body Stats',
  log:          'Log',          achievements: 'Achievements',
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
    ${Object.entries(PAGES).map(([id, p]) => `
      <div class="page ${id === currentPage ? 'active' : ''}" id="page-${id}">
        ${id === currentPage ? p.render() : ''}
      </div>
    `).join('')}
  </main>
</div>
  `;

  if (CHART_PAGES[currentPage]) CHART_PAGES[currentPage]();
}

// ── NAVIGATE ──
function navigate(pageId, pushHistory = true) {
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

  const el = document.getElementById(`page-${pageId}`);
  if (el) {
    el.innerHTML = PAGES[pageId].render();
    el.classList.add('active');
    if (CHART_PAGES[pageId]) CHART_PAGES[pageId]();
  }

  document.getElementById('main-area')?.scrollTo(0, 0);
}

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
  const el = document.getElementById('page-log');
  if (el) el.innerHTML = PAGES.log.render();
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
    });
  } else {
    buildShell();
  }
}

boot();
