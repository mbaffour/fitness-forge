import { renderOnboarding, renderBuilder } from './components/onboarding.js';
import {
  renderDashboard, renderWorkout, renderSchedule,
  renderProgress, renderLog, renderSettings,
} from './components/pages.js';
import { renderFreestyle } from './components/freestyle.js';
import { renderNutrition, scheduleNutritionCharts } from './components/nutrition.js';
import { renderBodyStats, scheduleBodyCharts } from './components/body-stats.js';
import { renderAchievements } from './components/achievements.js';
import { showExerciseModal, closeExModal, loadVideo } from './components/modal.js';
import {
  state, setPhase, setWeek, logWorkout, clearLog, resetAll,
  logSession, addCardioEntry, addBodyCheckIn, getTodayNutrition,
  addFoodEntry, logWater, updateProfile, recordPR, awardAchievement, updateStreak,
} from './store.js';
import { generateProgram } from './engine/generator.js';
import { EXERCISES } from './data/exercises.js';
import { startActiveWorkout } from './components/active-workout.js';

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
      { id: 'freestyle', label: 'Freestyle', icon: '🔀' },
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
  freestyle:    { render: renderFreestyle   },
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

// ── SHELL ──
function buildShell() {
  const { profile, program, currentPhase, currentWeek } = state;
  const displayName = profile?.name || 'Athlete';
  const phaseName   = ['Foundation','Hypertrophy','Strength','Peak & Power'][currentPhase - 1] || '';

  document.getElementById('root').innerHTML = `
<div class="shell">

  <!-- SIDEBAR -->
  <nav class="sidebar">
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

  // Schedule charts for the initial page
  if (CHART_PAGES[currentPage]) CHART_PAGES[currentPage]();
}

// ── NAVIGATE ──
function navigate(pageId) {
  if (pageId === 'onboard') {
    renderOnboarding(() => { currentPage = 'dashboard'; buildShell(); });
    return;
  }
  if (pageId === 'builder') {
    renderBuilder(() => { currentPage = 'dashboard'; buildShell(); });
    return;
  }
  if (!PAGES[pageId]) return;

  currentPage = pageId;

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
window.startActiveWorkout = (workoutId, workoutLabel, exercises) => {
  startActiveWorkout(workoutId, workoutLabel, exercises);
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
