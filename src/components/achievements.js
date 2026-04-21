// ═══════════════════════════════════════════
//   FITNESS FORGE — Achievements & Streaks
// ═══════════════════════════════════════════

import { state } from '../store.js';
import { estimateOneRepMax } from '../engine/overload.js';
import { EXERCISES } from '../data/exercises.js';

// All possible achievements (unlocked ones show as lit, locked as dim)
const ALL_ACHIEVEMENTS = [
  { id: 'first_session',   label: 'First Rep',      desc: 'Log your first workout',    icon: '🔥' },
  { id: 'ten_sessions',    label: 'Ten Down',       desc: 'Log 10 workout sessions',   icon: '💪' },
  { id: 'fifty_sessions',  label: 'Half Century',   desc: 'Log 50 sessions',            icon: '🏆' },
  { id: 'streak_3',        label: '3-Day Streak',   desc: '3 consecutive training days', icon: '⚡' },
  { id: 'streak_7',        label: 'Week Warrior',   desc: '7-day training streak',      icon: '🗓️' },
  { id: 'streak_30',       label: 'Iron Will',      desc: '30-day streak',              icon: '🔩' },
  { id: 'first_pr',        label: 'Personal Best',  desc: 'Log any personal record',    icon: '📈' },
  { id: 'first_checkin',   label: 'Body Aware',     desc: 'Log a body stats check-in',  icon: '📏' },
  { id: 'first_nutrition', label: 'Fueled',         desc: 'Log a full day of nutrition', icon: '🥗' },
  { id: 'first_cardio',    label: 'Cardio King',    desc: 'Log a cardio session',        icon: '🏃' },
];

export function renderAchievements() {
  const { achievements, streak, prs, sessions, workoutLog, bodyLog, nutritionLog, cardioLog } = state;
  const unlockedIds = new Set(achievements.map(a => a.id));

  // Check for PR achievement
  const hasPR = Object.keys(prs).length > 0;
  if (hasPR) unlockedIds.add('first_pr');
  if (bodyLog.length > 0) unlockedIds.add('first_checkin');
  if (nutritionLog.some(d => d.calories > 0)) unlockedIds.add('first_nutrition');
  if (cardioLog.length > 0) unlockedIds.add('first_cardio');

  const totalSessions = workoutLog.length + cardioLog.length;

  return `
<div class="page-header">
  <div class="label" style="margin-bottom:6px">Milestones</div>
  <h1 class="display page-title">ACHIEVEMENTS</h1>
  <div class="page-sub">${unlockedIds.size} / ${ALL_ACHIEVEMENTS.length} unlocked · ${totalSessions} total sessions</div>
</div>

<!-- STREAK CARD -->
<div class="g2 mb24" style="margin-bottom:24px">
  <div class="card card-fire">
    <div class="label mb16" style="margin-bottom:8px">Current Streak</div>
    <div style="display:flex;align-items:center;gap:16px">
      <div class="streak-flame">${streak.current > 0 ? '🔥' : '💤'}</div>
      <div>
        <div class="display" style="font-size:64px;line-height:1">${streak.current}</div>
        <div class="muted fs13">day${streak.current !== 1 ? 's' : ''} in a row</div>
      </div>
    </div>
    ${streak.current === 0 ? '<div class="dim fs12" style="margin-top:12px">Complete a workout today to start a streak!</div>' : ''}
  </div>

  <div class="card">
    <div class="label mb16" style="margin-bottom:8px">Streak Stats</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${[
        ['Current Streak', streak.current + ' days'],
        ['Longest Streak', streak.longest + ' days'],
        ['Total Sessions', totalSessions],
        ['Sessions Logged', sessions.length + ' detailed'],
      ].map(([k,v]) => `
        <div style="display:flex;justify-content:space-between;font-size:13px;padding:7px 0;border-bottom:1px solid var(--border)">
          <span class="muted">${k}</span>
          <span class="mono">${v}</span>
        </div>
      `).join('')}
    </div>
  </div>
</div>

<!-- STREAK CALENDAR -->
${buildStreakCalendar(workoutLog)}

<!-- PERSONAL RECORDS -->
${Object.keys(prs).length > 0 ? `
<div class="sec-head" style="margin-bottom:16px">Personal Records</div>
<div class="g-auto mb24" style="margin-bottom:24px">
  ${Object.entries(prs).map(([exId, pr]) => {
    const exName = EXERCISES[exId]?.name || exId.replace(/_/g,' ');
    return `
    <div class="pr-card">
      <div class="label" style="margin-bottom:4px">${exName}</div>
      <div class="display" style="font-size:24px;color:var(--fire)">${pr.weight} <span style="font-size:14px">lbs</span></div>
      <div class="mono muted fs11">${pr.reps} reps · est. 1RM ${pr.e1rm} lbs</div>
      <div class="muted fs10 mt8" style="margin-top:6px">${new Date(pr.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>
    </div>
    `;
  }).join('')}
</div>
` : ''}

<!-- ACHIEVEMENT BADGES -->
<div class="sec-head" style="margin-bottom:16px">Badges</div>
<div class="achievement-grid">
  ${ALL_ACHIEVEMENTS.map(a => {
    const unlocked = unlockedIds.has(a.id);
    const achieved = achievements.find(ua => ua.id === a.id);
    return `
    <div class="achievement-badge ${unlocked ? 'unlocked' : 'locked'}">
      <div class="badge-icon">${unlocked ? a.icon : '🔒'}</div>
      <div class="badge-label">${unlocked ? a.label : '???'}</div>
      <div class="badge-desc">${unlocked ? a.desc : '???'}</div>
      ${achieved ? `<div class="badge-date">${new Date(achieved.unlockedAt).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</div>` : ''}
    </div>
    `;
  }).join('')}
</div>
`;
}

function buildStreakCalendar(workoutLog) {
  // Build a set of dates that had a workout
  const activeDates = new Set(
    workoutLog.map(l => new Date(l.date).toISOString().slice(0, 10))
  );

  // 12 weeks × 7 days
  const weeks = 12;
  const days  = weeks * 7;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cells = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    const active = activeDates.has(key);
    const isToday = i === 0;
    cells.push({ key, active, isToday, dow: d.getDay() });
  }

  return `
<div class="sec-head" style="margin-bottom:12px">12-Week Activity</div>
<div class="streak-calendar mb24" style="margin-bottom:24px">
  <div class="cal-dow-labels">
    ${['S','M','T','W','T','F','S'].map(d => `<span>${d}</span>`).join('')}
  </div>
  <div class="cal-grid">
    ${cells.map(c => `
      <div class="cal-cell ${c.active ? 'active' : ''} ${c.isToday ? 'today' : ''}" title="${c.key}"></div>
    `).join('')}
  </div>
  <div class="muted fs11" style="margin-top:8px;display:flex;align-items:center;gap:6px">
    <span>Less</span>
    <span class="cal-cell" style="display:inline-block"></span>
    <span class="cal-cell active" style="display:inline-block"></span>
    <span>More</span>
  </div>
</div>
`;
}
