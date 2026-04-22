// ═══════════════════════════════════════════
//   FITNESS FORGE — Chart.js Wrappers
//   All charts use design-system colors
// ═══════════════════════════════════════════
import { EXERCISES } from '../data/exercises.js';

const COLORS = {
  fire:   '#ff6b1a',
  green:  '#4dffaa',
  steel:  '#7ab3c8',
  ember:  '#ffb347',
  border: '#2e2c28',
  bg2:    '#1a1917',
  text2:  '#a09880',
  text3:  '#5a5545',
};

const chartInstances = new Map();

function destroyIfExists(canvasId) {
  if (chartInstances.has(canvasId)) {
    chartInstances.get(canvasId).destroy();
    chartInstances.delete(canvasId);
  }
}

function applyGlobalDefaults() {
  if (!window.Chart) return;
  Chart.defaults.color            = COLORS.text2;
  Chart.defaults.borderColor      = COLORS.border;
  Chart.defaults.font.family      = "'Fira Code', monospace";
  Chart.defaults.font.size        = 10;
  Chart.defaults.plugins.legend.display = false;
  Chart.defaults.plugins.tooltip.backgroundColor = '#242320';
  Chart.defaults.plugins.tooltip.borderColor      = '#403e38';
  Chart.defaults.plugins.tooltip.borderWidth      = 1;
  Chart.defaults.plugins.tooltip.titleColor       = COLORS.fire;
  Chart.defaults.plugins.tooltip.bodyColor        = '#f2ede4';
  Chart.defaults.plugins.tooltip.padding          = 10;
}

let defaultsApplied = false;
function ensureDefaults() {
  if (!defaultsApplied && window.Chart) {
    applyGlobalDefaults();
    defaultsApplied = true;
  }
}

// ── WEIGHT TREND LINE CHART ──
export function initWeightTrendChart(canvasId, bodyLog) {
  ensureDefaults();
  if (!window.Chart) return;
  destroyIfExists(canvasId);

  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const sorted = [...bodyLog].reverse().slice(-60); // last 60 check-ins
  const labels = sorted.map(e => {
    const d = new Date(e.date);
    return `${d.getMonth()+1}/${d.getDate()}`;
  });
  const weights = sorted.map(e => e.weight);

  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: weights,
        borderColor: COLORS.fire,
        backgroundColor: 'rgba(255,107,26,0.08)',
        pointBackgroundColor: COLORS.fire,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.3,
        fill: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { color: COLORS.border }, ticks: { maxRotation: 45, maxTicksLimit: 12 } },
        y: { grid: { color: COLORS.border }, ticks: { callback: v => v + ' lbs' } },
      },
    },
  });
  chartInstances.set(canvasId, chart);
}

// ── MACRO DONUT CHART ──
export function initMacroDonut(canvasId, { protein, carbs, fat }) {
  ensureDefaults();
  if (!window.Chart) return;
  destroyIfExists(canvasId);

  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const chart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Protein', 'Carbs', 'Fat'],
      datasets: [{
        data: [protein * 4, carbs * 4, fat * 9],
        backgroundColor: [COLORS.fire, COLORS.green, COLORS.steel],
        borderColor: '#0d0d0b',
        borderWidth: 3,
        hoverOffset: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { display: true, position: 'bottom', labels: { color: COLORS.text2, padding: 14, font: { size: 10 } } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${Math.round(ctx.raw / 4 || ctx.raw / 9)}g (${ctx.raw} kcal)`,
          },
        },
      },
    },
  });
  chartInstances.set(canvasId, chart);
}

// ── STRENGTH PROGRESSION LINE CHART ──
export function initStrengthChart(canvasId, sessions, exId) {
  ensureDefaults();
  if (!window.Chart) return;
  destroyIfExists(canvasId);

  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // Extract best weight per session for this exercise
  const relevant = sessions
    .filter(s => s.exercises?.some(e => e.exId === exId))
    .reverse()
    .slice(-20);

  if (relevant.length < 2) {
    canvas.parentElement.innerHTML = '<div class="dim fs12 tc" style="padding:20px">Log at least 2 sessions to see chart</div>';
    return;
  }

  const labels = relevant.map(s => {
    const d = new Date(s.date);
    return `${d.getMonth()+1}/${d.getDate()}`;
  });
  const weights = relevant.map(s => {
    const ex = s.exercises.find(e => e.exId === exId);
    const maxW = Math.max(...(ex?.sets || []).filter(s => s.completed).map(s => s.weight || 0));
    return maxW || null;
  });

  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Top Weight',
        data: weights,
        borderColor: COLORS.green,
        backgroundColor: 'rgba(77,255,170,0.08)',
        pointBackgroundColor: COLORS.green,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.2,
        fill: true,
        spanGaps: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { color: COLORS.border } },
        y: { grid: { color: COLORS.border }, ticks: { callback: v => v + ' lbs' } },
      },
    },
  });
  chartInstances.set(canvasId, chart);
}

// ── WEEKLY CALORIE BAR CHART ──
export function initCalorieChart(canvasId, nutritionLog) {
  ensureDefaults();
  if (!window.Chart) return;
  destroyIfExists(canvasId);

  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const sorted = [...nutritionLog].reverse().slice(-14);
  const labels = sorted.map(d => {
    const dt = new Date(d.date + 'T12:00:00');
    return `${dt.getMonth()+1}/${dt.getDate()}`;
  });
  const calories = sorted.map(d => d.calories);
  const targets  = sorted.map(d => d.target?.calories || null);

  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Calories',
          data: calories,
          backgroundColor: COLORS.fire + 'cc',
          borderRadius: 3,
        },
        {
          label: 'Target',
          data: targets,
          type: 'line',
          borderColor: COLORS.steel,
          borderDash: [4, 4],
          pointRadius: 0,
          tension: 0,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true, position: 'bottom', labels: { color: COLORS.text2, padding: 14, font: { size: 10 } } } },
      scales: {
        x: { grid: { color: COLORS.border } },
        y: { grid: { color: COLORS.border }, beginAtZero: true },
      },
    },
  });
  chartInstances.set(canvasId, chart);
}

// ── CARDIO DISTANCE BAR CHART ──
export function initCardioChart(canvasId, cardioLog) {
  ensureDefaults();
  if (!window.Chart) return;
  destroyIfExists(canvasId);

  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // Last 30 entries
  const sorted = [...cardioLog].reverse().slice(-30);
  const labels   = sorted.map(e => {
    const d = new Date(e.date);
    return `${d.getMonth()+1}/${d.getDate()}`;
  });
  const distances = sorted.map(e => e.distanceMiles || 0);
  const colors    = sorted.map(e => {
    const map = { run: COLORS.fire, bike: COLORS.green, swim: COLORS.steel, row: COLORS.ember };
    return map[e.type] || COLORS.fire;
  });

  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Distance (mi)',
        data: distances,
        backgroundColor: colors,
        borderRadius: 3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { color: COLORS.border } },
        y: { grid: { color: COLORS.border }, beginAtZero: true, ticks: { callback: v => v + ' mi' } },
      },
    },
  });
  chartInstances.set(canvasId, chart);
}

// ── WEEKLY WORKOUT FREQUENCY BAR CHART ──
export function initWeeklyFrequencyChart(canvasId, sessions) {
  ensureDefaults();
  if (!window.Chart) return;
  destroyIfExists(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const now = new Date();
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay() - (11 - i) * 7);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return { start, end, count: 0 };
  });

  sessions.forEach(s => {
    const d = new Date(s.date);
    for (const w of weeks) {
      if (d >= w.start && d < w.end) { w.count++; break; }
    }
  });

  const labels = weeks.map((_, i) => i === 11 ? 'This wk' : `−${11 - i}w`);
  const counts = weeks.map(w => w.count);
  const colors = counts.map((_, i) => i === 11 ? COLORS.fire : COLORS.fire + '55');

  const chart = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Sessions', data: counts, backgroundColor: colors, borderRadius: 4 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { grid: { color: COLORS.border } },
        y: { grid: { color: COLORS.border }, beginAtZero: true, ticks: { stepSize: 1 } },
      },
    },
  });
  chartInstances.set(canvasId, chart);
}

// ── MUSCLE GROUP FREQUENCY HORIZONTAL BAR ──
export function initMuscleFrequencyChart(canvasId, sessions) {
  ensureDefaults();
  if (!window.Chart) return;
  destroyIfExists(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const counts = {};
  sessions.forEach(s => {
    s.exercises?.forEach(ex => {
      EXERCISES[ex.exId]?.groups?.forEach(g => { counts[g] = (counts[g] || 0) + 1; });
    });
  });

  if (!Object.keys(counts).length) {
    canvas.parentElement.innerHTML = '<div class="dim fs12 tc" style="padding:20px">Log sessions to see muscle data</div>';
    return;
  }

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const labels = sorted.map(([g]) => g.charAt(0).toUpperCase() + g.slice(1));
  const data   = sorted.map(([, c]) => c);
  const palette = [COLORS.fire, COLORS.green, COLORS.steel, COLORS.ember,
                   COLORS.fire, COLORS.green, COLORS.steel, COLORS.ember, COLORS.fire, COLORS.green];

  const chart = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Sets', data, backgroundColor: palette.slice(0, data.length), borderRadius: 4 }] },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { grid: { color: COLORS.border }, beginAtZero: true, ticks: { stepSize: 1 } },
        y: { grid: { color: COLORS.border } },
      },
    },
  });
  chartInstances.set(canvasId, chart);
}

// ── VOLUME BREAKDOWN BAR CHART ──
export function initVolumeChart(canvasId, sessions) {
  ensureDefaults();
  if (!window.Chart) return;
  destroyIfExists(canvasId);

  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const recent = sessions.slice(0, 12).reverse();
  const labels  = recent.map(s => {
    const d = new Date(s.date);
    return `${d.getMonth()+1}/${d.getDate()}`;
  });
  const volumes = recent.map(s => s.totalVolume || 0);

  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Volume (lbs)',
        data: volumes,
        backgroundColor: COLORS.steel + 'bb',
        borderRadius: 3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { color: COLORS.border } },
        y: { grid: { color: COLORS.border }, beginAtZero: true },
      },
    },
  });
  chartInstances.set(canvasId, chart);
}
