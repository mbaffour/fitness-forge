// ═══════════════════════════════════════════
//   FITNESS FORGE — Nutrition Tracker
// ═══════════════════════════════════════════

import { state, getTodayNutrition, addFoodEntry, removeFoodEntry, logWater, updateProfile } from '../store.js';
import { calcBMR, calcTDEE, calcMacros, ACTIVITY_MULTIPLIERS } from '../engine/bmr.js';
import { initMacroDonut, initCalorieChart, initMacroStackedChart } from './charts.js';

export function renderNutrition() {
  const { profile, nutritionLog } = state;
  const today = getTodayNutrition();
  const hasBMR = profile?.tdee;

  return `
<div class="page-header">
  <div class="label" style="margin-bottom:6px">Daily Tracking</div>
  <h1 class="display page-title">NUTRITION</h1>
  <div class="page-sub">Calories, macros &amp; hydration</div>
</div>

${!hasBMR ? `
<div class="alert alert-fire mb24" style="margin-bottom:24px">
  <span>⚡</span>
  <div>
    <div style="font-weight:500;margin-bottom:2px">Complete your profile for personalized targets</div>
    <div class="fs12">Add height, age &amp; activity level in <span style="cursor:pointer;text-decoration:underline;color:var(--fire)" onclick="navigate('settings')">Settings →</span></div>
  </div>
</div>
` : ''}

<!-- MACRO SUMMARY -->
<div class="g2 mb24" style="margin-bottom:24px">
  <div class="card">
    <div class="label mb16" style="margin-bottom:12px">Today's Macros</div>
    <div class="macro-ring-wrap">
      <canvas id="macro-donut" width="160" height="160"></canvas>
      <div class="macro-ring-center">
        <div class="display" style="font-size:28px;color:var(--fire)">${today.calories}</div>
        <div class="label">kcal</div>
        ${today.target?.calories ? `<div class="muted fs11">of ${today.target.calories}</div>` : ''}
      </div>
    </div>
    <div class="macro-bars" style="margin-top:16px">
      ${renderMacroBar('Protein', today.protein, today.target?.protein, 'var(--fire)')}
      ${renderMacroBar('Carbs',   today.carbs,   today.target?.carbs,   'var(--forge-green)')}
      ${renderMacroBar('Fat',     today.fat,     today.target?.fat,     'var(--steel)')}
    </div>
  </div>

  <div class="card">
    <div class="label mb16" style="margin-bottom:12px">Hydration</div>
    ${renderWaterTracker(today.water)}
    <div class="label" style="margin-top:20px;margin-bottom:12px">Macro Stats</div>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${[
        ['Calories', today.calories + (today.target?.calories ? ' / ' + today.target.calories : '')],
        ['Protein',  today.protein + 'g' + (today.target?.protein ? ' / ' + today.target.protein + 'g' : '')],
        ['Carbs',    today.carbs   + 'g' + (today.target?.carbs   ? ' / ' + today.target.carbs   + 'g' : '')],
        ['Fat',      today.fat     + 'g' + (today.target?.fat     ? ' / ' + today.target.fat     + 'g' : '')],
      ].map(([k,v]) => `
        <div style="display:flex;justify-content:space-between;font-size:12px;padding:5px 0;border-bottom:1px solid var(--border)">
          <span class="muted">${k}</span><span class="mono">${v}</span>
        </div>
      `).join('')}
    </div>
  </div>
</div>

<!-- ADD FOOD FORM -->
<div class="sec-head" style="margin-bottom:12px">Log Food</div>
<div class="card mb24" style="margin-bottom:24px">
  <div class="food-form-grid" id="food-form">
    <div>
      <label class="label">Food Name</label>
      <input type="text" id="food-name" class="form-input" placeholder="e.g. Chicken breast 4oz" style="width:100%;box-sizing:border-box">
    </div>
    <div>
      <label class="label">Meal</label>
      <select id="food-meal" class="form-input" style="width:100%;margin-top:0;box-sizing:border-box">
        <option value="Breakfast">Breakfast</option>
        <option value="Lunch">Lunch</option>
        <option value="Dinner">Dinner</option>
        <option value="Snack">Snack</option>
        <option value="Pre-Workout">Pre-Workout</option>
        <option value="Post-Workout">Post-Workout</option>
      </select>
    </div>
    <div>
      <label class="label">Calories</label>
      <input type="number" id="food-cal" class="form-input" placeholder="200" min="0" style="width:100%;box-sizing:border-box">
    </div>
    <div>
      <label class="label">Protein (g)</label>
      <input type="number" id="food-pro" class="form-input" placeholder="25" min="0" style="width:100%;box-sizing:border-box">
    </div>
    <div>
      <label class="label">Carbs (g)</label>
      <input type="number" id="food-car" class="form-input" placeholder="10" min="0" style="width:100%;box-sizing:border-box">
    </div>
    <div>
      <label class="label">Fat (g)</label>
      <input type="number" id="food-fat" class="form-input" placeholder="5" min="0" style="width:100%;box-sizing:border-box">
    </div>
    <div style="display:flex;align-items:flex-end">
      <button class="btn btn-fire w100" onclick="addFood()">+ Add</button>
    </div>
  </div>
</div>

<!-- FOOD LOG LIST -->
<div class="sec-head" style="margin-bottom:12px">Today's Food Log</div>
${today.entries.length > 0 ? `
<div class="card mb24" style="margin-bottom:24px">
  ${today.entries.map(e => `
    <div class="food-entry-row">
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-weight:500;font-size:13px">${e.name || 'Food item'}</span>
          ${e.meal ? `<span class="tag t-dim" style="font-size:9px">${e.meal}</span>` : ''}
        </div>
        <div class="muted fs11 mt4" style="margin-top:3px">${e.time || ''} · ${e.calories || 0} kcal · ${e.protein || 0}g P · ${e.carbs || 0}g C · ${e.fat || 0}g F</div>
      </div>
      <button class="btn-remove" onclick="removeFood(${e.id})" title="Remove">✕</button>
    </div>
  `).join('')}
</div>
` : `
<div class="card mb24 tc" style="margin-bottom:24px;padding:32px">
  <div style="font-size:32px;margin-bottom:8px">🥗</div>
  <div class="dim fs13">No food logged today. Add your first meal above.</div>
</div>
`}

<!-- 14-DAY CALORIE HISTORY -->
${nutritionLog.length > 1 ? `
<div class="sec-head" style="margin-bottom:12px">14-Day Calorie History</div>
<div class="card mb24" style="margin-bottom:24px">
  <div class="chart-wrap" style="height:180px">
    <canvas id="calorie-chart"></canvas>
  </div>
</div>

<div class="sec-head" style="margin-bottom:12px">7-Day Macro Breakdown</div>
<div class="card mb24" style="margin-bottom:24px">
  <div class="chart-wrap" style="height:180px">
    <canvas id="macro-stacked-chart"></canvas>
  </div>
</div>
` : ''}

<!-- DIET PROGRAM GUIDE -->
<div class="sec-head" style="margin-bottom:12px">Diet Program Guide</div>
<div class="card mb24" style="margin-bottom:24px">
  ${renderDietAccordion()}
</div>
`;
}

function renderMacroBar(label, current, target, color) {
  const pct  = target ? Math.min(Math.round((current / target) * 100), 100) : 0;
  const over  = target ? (current / target) : 0;
  const barColor = over > 1.1 ? 'var(--danger)' : over >= 0.9 ? 'var(--forge-green)' : color;
  const statusText = target
    ? (over > 1.1 ? '▲ OVER' : over >= 0.9 ? '✓ ON TARGET' : `${Math.round(target - current)}g remaining`)
    : '';
  return `
<div style="margin-bottom:12px">
  <div style="display:flex;justify-content:space-between;margin-bottom:4px">
    <span class="label">${label}</span>
    <span class="mono fs11" style="color:${barColor}">${current}g${target ? ' / ' + target + 'g' : ''}</span>
  </div>
  <div class="pbar-wrap">
    <div class="pbar" style="width:${pct}%;background:${barColor};transition:width 0.4s"></div>
  </div>
  ${statusText ? `<div style="font-size:9px;font-family:var(--ff-mono);letter-spacing:0.08em;margin-top:3px;color:${barColor}">${statusText}</div>` : ''}
</div>
`;
}

function renderDietAccordion() {
  const programs = [
    {
      id: 'fat_loss', label: 'Fat Loss / Cutting', icon: '🔥',
      desc: '300–500 kcal deficit. High protein preserves muscle while burning fat.',
      points: ['Deficit: 300–500 kcal below TDEE','Protein: 0.8–1g per lb bodyweight','Carbs: timed around workouts','Avoid: liquid calories, ultra-processed foods'],
    },
    {
      id: 'lean_bulk', label: 'Lean Bulk', icon: '💪',
      desc: 'Modest 150–300 kcal surplus for slow, quality muscle gain.',
      points: ['Surplus: 150–300 kcal above TDEE','Protein: 0.7–0.85g per lb','Aim for 0.5–1 lb/week gain','Carb-forward for training fuel'],
    },
    {
      id: 'aggressive_bulk', label: 'Aggressive Bulk', icon: '⚡',
      desc: '400–600 kcal surplus. Max mass, some fat gain expected.',
      points: ['Surplus: 400–600 kcal above TDEE','Protein: 0.7g per lb minimum','Calorie-dense whole foods','Best for hardgainers and off-season athletes'],
    },
    {
      id: 'maintenance', label: 'Maintenance / Recomp', icon: '⊞',
      desc: 'Eat at TDEE. Body recomposition possible with consistent training.',
      points: ['Calories = TDEE exactly','Protein: 0.8g per lb bodyweight','Time carbs around workouts','Ideal for intermediate lifters'],
    },
  ];
  return programs.map(p => `
<details style="border-bottom:1px solid var(--border);padding:12px 0">
  <summary style="cursor:pointer;display:flex;align-items:center;gap:10px;list-style:none;font-weight:600;font-size:13px;outline:none">
    <span style="font-size:18px">${p.icon}</span>
    <span>${p.label}</span>
    <span class="muted fs11" style="margin-left:auto">▼</span>
  </summary>
  <div style="margin-top:12px;padding-left:28px">
    <div class="dim fs13" style="margin-bottom:10px;line-height:1.6">${p.desc}</div>
    <ul style="list-style:none;display:flex;flex-direction:column;gap:6px">
      ${p.points.map(pt => `<li style="font-size:12px;display:flex;gap:8px"><span style="color:var(--fire)">◆</span><span>${pt}</span></li>`).join('')}
    </ul>
  </div>
</details>`).join('');
}

function renderWaterTracker(current) {
  const goal = 8;
  return `
<div class="water-tracker">
  <div class="label" style="margin-bottom:8px">Water — ${current} / ${goal} glasses</div>
  <div class="water-glasses">
    ${Array.from({ length: goal }, (_, i) => `
      <button class="water-glass ${i < current ? 'filled' : ''}" onclick="setWater(${i + 1})" title="${i+1} glass${i > 0 ? 'es' : ''}">
        ${i < current ? '🥤' : '🫙'}
      </button>
    `).join('')}
  </div>
  ${current >= goal ? '<div class="muted fs11" style="margin-top:6px;color:var(--forge-green)">✓ Daily goal reached!</div>' : ''}
</div>
`;
}

// ── GLOBAL HANDLERS ──

window.addFood = () => {
  const name = document.getElementById('food-name')?.value?.trim();
  const meal = document.getElementById('food-meal')?.value || 'Snack';
  const cal  = parseFloat(document.getElementById('food-cal')?.value  || 0);
  const pro  = parseFloat(document.getElementById('food-pro')?.value  || 0);
  const car  = parseFloat(document.getElementById('food-car')?.value  || 0);
  const fat  = parseFloat(document.getElementById('food-fat')?.value  || 0);

  if (!name && !cal) {
    document.getElementById('food-name')?.focus();
    return;
  }

  addFoodEntry({ name: name || 'Food item', meal, calories: cal, protein: pro, carbs: car, fat });
  refreshNutritionPage();
};

window.removeFood = (entryId) => {
  removeFoodEntry(entryId);
  refreshNutritionPage();
};

window.setWater = (glasses) => {
  logWater(glasses);
  refreshNutritionPage();
};

function refreshNutritionPage() {
  const el = document.getElementById('page-nutrition');
  if (!el) return;
  el.innerHTML = renderNutrition();
  scheduleCharts();
}

export function scheduleNutritionCharts() {
  scheduleCharts();
}

function scheduleCharts() {
  setTimeout(() => {
    const today = getTodayNutrition();
    if (today.protein || today.carbs || today.fat) {
      initMacroDonut('macro-donut', { protein: today.protein, carbs: today.carbs, fat: today.fat });
    }
    if (state.nutritionLog.length > 1) {
      initCalorieChart('calorie-chart', state.nutritionLog);
      initMacroStackedChart('macro-stacked-chart', state.nutritionLog);
    }
  }, 0);
}
