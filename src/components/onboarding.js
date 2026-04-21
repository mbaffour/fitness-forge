import { GOAL_OPTIONS, LEVEL_OPTIONS, EQUIPMENT_OPTIONS, DAYS_OPTIONS, CARDIO_OPTIONS } from '../data/exercises.js';
import { generateProgram } from '../engine/generator.js';
import { setProfile, setProgram } from '../store.js';

const STEPS = [
  {
    id: 'name',
    q: "What's your name?",
    sub: "We'll use this to personalize your plan.",
    type: 'text',
    placeholder: 'Enter your name',
  },
  {
    id: 'goal',
    q: 'What is your primary goal?',
    sub: 'Your program structure changes significantly based on this.',
    type: 'options',
    options: GOAL_OPTIONS,
  },
  {
    id: 'level',
    q: 'What is your training experience?',
    sub: 'Be honest — the right program at the right level gets better results.',
    type: 'options',
    options: LEVEL_OPTIONS,
  },
  {
    id: 'equipment',
    q: 'What equipment do you have access to?',
    sub: 'Every program will be tailored to what you have available.',
    type: 'options',
    options: EQUIPMENT_OPTIONS,
  },
  {
    id: 'daysPerWeek',
    q: 'How many days per week can you train?',
    sub: 'Include both strength and cardio days.',
    type: 'options',
    options: DAYS_OPTIONS,
  },
  {
    id: 'cardioLevel',
    q: 'How much cardio do you want in your program?',
    sub: 'This affects VO2 max development and calorie burn.',
    type: 'options',
    options: CARDIO_OPTIONS,
  },
  {
    id: 'weight',
    q: 'What is your bodyweight?',
    sub: 'Used to calculate relative strength benchmarks. Optional.',
    type: 'number',
    placeholder: 'e.g. 180',
    unit: 'lbs',
    optional: true,
  },
];

export function renderOnboarding(onComplete) {
  const answers = {};
  let currentStep = 0;

  function render() {
    const step = STEPS[currentStep];
    const total = STEPS.length;

    document.getElementById('root').innerHTML = `
<div class="onboard-wrap">
  <div class="onboard-card">
    <div class="onboard-top">
      <div class="onboard-brand">
        <div class="onboard-logo">🔥</div>
        <div>
          <div class="display" style="font-size:20px;letter-spacing:0.06em">FITNESS FORGE</div>
          <div class="label" style="margin-top:2px">Build your program</div>
        </div>
      </div>

      <div class="label" style="margin-bottom:8px">Step ${currentStep + 1} of ${total}</div>
      <div class="quiz-progress">
        ${STEPS.map((_, i) => `
          <div class="quiz-pip ${i < currentStep ? 'done' : i === currentStep ? 'active' : ''}"></div>
        `).join('')}
      </div>
    </div>

    <div class="onboard-body">
      <div class="quiz-q">${step.q}</div>
      <div class="quiz-sub">${step.sub}${step.optional ? ' <span style="color:var(--text-3)">(optional — skip if preferred)</span>' : ''}</div>

      ${step.type === 'options' ? `
        <div class="option-grid" style="grid-template-columns:${step.options.length > 4 ? '1fr 1fr' : '1fr'}">
          ${step.options.map(opt => `
            <button class="option-btn ${answers[step.id] == opt.id ? 'selected' : ''}"
                    onclick="quizSelect('${step.id}', '${opt.id}', ${typeof opt.id === 'number' ? opt.id : `'${opt.id}'`})">
              ${opt.icon ? `<span class="option-icon">${opt.icon}</span>` : ''}
              <div>
                <div class="option-label">${opt.label}</div>
                ${opt.desc ? `<div class="option-desc">${opt.desc}</div>` : ''}
              </div>
            </button>
          `).join('')}
        </div>
      ` : ''}

      ${step.type === 'text' ? `
        <input class="input" id="text-input" type="text"
               placeholder="${step.placeholder}"
               value="${answers[step.id] || ''}"
               style="font-size:18px;padding:14px 16px"
               onkeydown="if(event.key==='Enter') quizNext()"
               oninput="answers_temp_name = this.value"/>
      ` : ''}

      ${step.type === 'number' ? `
        <div style="display:flex;align-items:center;gap:12px">
          <input class="input" id="num-input" type="number"
                 placeholder="${step.placeholder}"
                 value="${answers[step.id] || ''}"
                 style="font-size:18px;padding:14px 16px;max-width:180px"
                 onkeydown="if(event.key==='Enter') quizNext()"/>
          <span class="label">${step.unit || ''}</span>
        </div>
      ` : ''}

      <div class="quiz-nav">
        <button class="btn btn-ghost" onclick="quizBack()" ${currentStep === 0 ? 'style="visibility:hidden"' : ''}>
          ← Back
        </button>
        <button class="btn btn-fire btn-lg" onclick="quizNext()">
          ${currentStep === total - 1 ? 'Build My Program 🔥' : 'Continue →'}
        </button>
      </div>
    </div>
  </div>
</div>
    `;

    // Focus text/number inputs
    if (step.type === 'text' || step.type === 'number') {
      setTimeout(() => document.querySelector('#text-input, #num-input')?.focus(), 50);
    }
  }

  window.quizSelect = (id, val, numVal) => {
    answers[id] = numVal !== undefined ? numVal : val;
    render();
  };

  window.quizBack = () => {
    if (currentStep > 0) { currentStep--; render(); }
  };

  window.quizNext = () => {
    const step = STEPS[currentStep];

    // Collect text/number inputs
    if (step.type === 'text') {
      const val = document.querySelector('#text-input')?.value?.trim();
      if (!val) { shake(); return; }
      answers[step.id] = val;
    }
    if (step.type === 'number') {
      const val = document.querySelector('#num-input')?.value;
      if (val) answers[step.id] = parseFloat(val);
      // number is optional — allow skip
    }

    // Validate required options
    if (step.type === 'options' && !answers[step.id]) {
      shake(); return;
    }

    if (currentStep < STEPS.length - 1) {
      currentStep++;
      render();
    } else {
      // Generate program
      const profile = {
        name:         answers.name,
        goal:         answers.goal,
        level:        answers.level,
        equipment:    answers.equipment,
        daysPerWeek:  answers.daysPerWeek,
        cardioLevel:  answers.cardioLevel,
        weight:       answers.weight || null,
        weeks:        16,
      };
      setProfile(profile);
      const program = generateProgram(profile);
      setProgram(program);
      onComplete();
    }
  };

  function shake() {
    const card = document.querySelector('.onboard-card');
    if (!card) return;
    card.style.animation = 'none';
    card.offsetHeight;
    card.style.animation = 'shake 0.35s ease';
  }

  // Add shake animation
  const style = document.createElement('style');
  style.textContent = `@keyframes shake {
    0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 60%{transform:translateX(8px)} 80%{transform:translateX(-4px)}
  }`;
  document.head.appendChild(style);

  render();
}


// ── MANUAL BUILDER ──
export function renderBuilder(onSave) {
  const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const sessions = {};
  DAYS.forEach(d => { sessions[d] = { type: 'rest', label: '', exercises: [] }; });

  function render() {
    document.getElementById('root').innerHTML = `
<div class="onboard-wrap" style="align-items:flex-start;padding-top:60px">
  <div style="width:100%;max-width:700px">
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:32px">
      <div class="onboard-logo" style="width:44px;height:44px;font-size:22px">🔥</div>
      <div>
        <div class="display" style="font-size:28px;letter-spacing:0.05em">MANUAL BUILDER</div>
        <div class="label" style="margin-top:4px">Design your own weekly program</div>
      </div>
    </div>

    <div class="alert alert-neutral mb24" style="margin-bottom:24px">
      <span>ℹ️</span>
      <span>Assign a session type to each day. You can customize exercises after saving.</span>
    </div>

    <div class="card mb24" style="margin-bottom:24px">
      <div class="sec-head" style="margin-bottom:16px">Your Name</div>
      <input class="input" id="builder-name" type="text" placeholder="Enter your name" style="max-width:280px"/>
    </div>

    <div class="card" style="margin-bottom:24px">
      <div class="sec-head" style="margin-bottom:16px">Weekly Schedule</div>
      <div style="display:flex;flex-direction:column;gap:12px">
        ${DAYS.map(day => `
          <div style="display:grid;grid-template-columns:110px 1fr;gap:12px;align-items:center">
            <div style="font-family:var(--ff-display);font-size:18px;font-weight:800">${day.slice(0,3).toUpperCase()}</div>
            <select class="input" style="font-size:13px" onchange="builderSetDay('${day}', this.value)">
              <option value="rest">Rest / Active Recovery</option>
              <option value="lower">Lower Body Strength</option>
              <option value="upper_push">Upper Push</option>
              <option value="upper_pull">Upper Pull</option>
              <option value="upper">Upper Body (Push + Pull)</option>
              <option value="full_body">Full Body</option>
              <option value="cardio_easy">Easy Cardio (Zone 2)</option>
              <option value="cardio_hard">Hard Cardio (Intervals)</option>
              <option value="sport">Sport / Activity</option>
            </select>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="card mb24" style="margin-bottom:24px">
      <div class="sec-head" style="margin-bottom:16px">Settings</div>
      <div class="g2 gap16" style="gap:16px">
        <div class="field">
          <div class="field-label">Training Level</div>
          <select class="input" id="builder-level">
            <option value="beginner">Beginner</option>
            <option value="intermediate" selected>Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
        <div class="field">
          <div class="field-label">Equipment</div>
          <select class="input" id="builder-equip">
            <option value="full_gym">Full Gym</option>
            <option value="dumbbells">Dumbbells Only</option>
            <option value="bodyweight">Bodyweight</option>
            <option value="home_basic">Home Gym</option>
          </select>
        </div>
        <div class="field">
          <div class="field-label">Primary Goal</div>
          <select class="input" id="builder-goal">
            <option value="build_muscle">Build Muscle</option>
            <option value="lose_fat">Lose Fat</option>
            <option value="get_stronger">Get Stronger</option>
            <option value="general_fitness">General Fitness</option>
            <option value="athletic">Athletic Performance</option>
          </select>
        </div>
        <div class="field">
          <div class="field-label">Bodyweight (lbs, optional)</div>
          <input class="input" id="builder-weight" type="number" placeholder="e.g. 180"/>
        </div>
      </div>
    </div>

    <div style="display:flex;gap:12px;justify-content:flex-end">
      <button class="btn btn-ghost" onclick="window.navigate && navigate('dashboard')">Cancel</button>
      <button class="btn btn-fire btn-lg" onclick="builderSave()">Generate My Program 🔥</button>
    </div>
  </div>
</div>
    `;
  }

  window.builderSetDay = (day, val) => {
    sessions[day] = { type: val, label: val.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase()) };
  };

  window.builderSave = () => {
    const name   = document.getElementById('builder-name')?.value?.trim() || 'Athlete';
    const level  = document.getElementById('builder-level')?.value  || 'intermediate';
    const equip  = document.getElementById('builder-equip')?.value  || 'full_gym';
    const goal   = document.getElementById('builder-goal')?.value   || 'build_muscle';
    const weight = parseFloat(document.getElementById('builder-weight')?.value) || null;

    // Convert sessions into a split structure
    const typeToCategory = {
      lower:       'strength',
      upper_push:  'strength',
      upper_pull:  'strength',
      upper:       'strength',
      full_body:   'strength',
      cardio_easy: 'cardio',
      cardio_hard: 'cardio',
      sport:       'cardio',
      rest:        'rest',
    };
    const labelMap = {
      lower:       'Lower Body',
      upper_push:  'Upper Push',
      upper_pull:  'Upper Pull',
      upper:       'Upper Body',
      full_body:   'Full Body',
      cardio_easy: 'Zone 2 Cardio',
      cardio_hard: 'Intervals',
      sport:       'Sport / Activity',
      rest:        'Active Recovery',
    };

    const splitDays = Object.entries(sessions).map(([day, s]) => ({
      day,
      type: typeToCategory[s.type] || 'rest',
      label: labelMap[s.type] || s.label,
    }));

    const daysPerWeek = splitDays.filter(d => d.type !== 'rest').length;

    const profile = { name, goal, level, equipment: equip, daysPerWeek, cardioLevel: 'moderate', weight, weeks: 12 };
    const { generateProgram } = window.__forge_gen;
    setProfile(profile);
    const program = generateProgram(profile);
    // Override split with user's custom one
    program.splitDays = splitDays;
    setProgram(program);
    onSave();
  };

  render();
}
