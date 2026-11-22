// ═══════════════════════════════════════════
//   FITNESS FORGE — Achievements & Streaks
// ═══════════════════════════════════════════

import { state, save, formatWeight, weightUnitLabel } from '../store.js';
import { summary, enabled as gamifyEnabled, weeklyGoal, BADGE_DEFS, TIERS, XP, STREAK_MILESTONES, tonnageEquivalent, RANKS } from '../engine/gamify.js';
import { sectionHead, toast } from './ui.js';
import { cue, sparkBurst, reducedMotion } from './feedback.js';
import { estimateOneRepMax } from '../engine/overload.js';
import { EXERCISES } from '../data/exercises.js';
import { exThumbHTML } from './modal.js';

// All possible achievements (unlocked ones show as lit, locked as dim)
const ALL_ACHIEVEMENTS = [
  { id: 'first_session',   label: 'First Rep',      desc: 'Log your first workout',    icon: '🔥' },
  { id: 'ten_sessions',    label: 'Ten Down',       desc: 'Log 10 workout sessions',   icon: '💪' },
  { id: 'fifty_sessions',  label: 'Half Century',   desc: 'Log 50 sessions',            icon: '🏆' },
  { id: 'streak_3',        label: '3-Day Fire',     desc: '3-day daily fire',            icon: '⚡' },
  { id: 'streak_7',        label: 'Week Warrior',   desc: '7-day daily fire',            icon: '🗓️' },
  { id: 'streak_30',       label: 'Iron Will',      desc: '30-day daily fire',           icon: '🔩' },
  { id: 'first_pr',        label: 'Personal Best',  desc: 'Log any personal record',    icon: '📈' },
  { id: 'first_checkin',   label: 'Body Aware',     desc: 'Log a body stats check-in',  icon: '📏' },
  { id: 'first_nutrition', label: 'Fueled',         desc: 'Log a full day of nutrition', icon: '🥗' },
  { id: 'first_cardio',    label: 'Cardio King',    desc: 'Log a cardio session',        icon: '🏃' },
];

export function renderAchievements() {
  const { achievements, prs, workoutLog, bodyLog, nutritionLog, cardioLog } = state;
  const unlockedIds = new Set(achievements.map(a => a.id));
  if (Object.keys(prs).length > 0) unlockedIds.add('first_pr');
  if (bodyLog.length > 0) unlockedIds.add('first_checkin');
  if (nutritionLog.some(d => d.calories > 0)) unlockedIds.add('first_nutrition');
  if (cardioLog.length > 0) unlockedIds.add('first_cardio');

  const on = gamifyEnabled();
  const G = summary();
  // Firsts are derived from history too. They used to be awarded only at the
  // moment they happened, so imported or restored history showed "First Rep"
  // locked beside forty logged workouts.
  const V = G.values;
  if (V.sessions >= 1) unlockedIds.add('first_session');
  if (V.sessions >= 10) unlockedIds.add('ten_sessions');
  if (V.sessions >= 50) unlockedIds.add('fifty_sessions');
  if (V.daily >= 3) unlockedIds.add('streak_3');
  if (V.daily >= 7) unlockedIds.add('streak_7');
  if (V.daily >= 30) unlockedIds.add('streak_30');
  if (V.prs >= 1) unlockedIds.add('first_pr');
  const earned = G.badges.filter((b) => b.tier > 0).length;

  return `
<div class="page-header">
  <div class="label" style="margin-bottom:6px">Forge Rank</div>
  <h1 class="display page-title">RANK &amp; AWARDS</h1>
  <div class="page-sub">${on ? `Level ${G.level} ${esc(G.rank.name)} · ${G.xp.toLocaleString()} XP · ${earned} of ${G.badges.length} badge tracks started` : 'Streaks, records and badges'}</div>
</div>

${on ? `
${_rankHeroHTML(G)}
<div class="g2 gm-streaks">
  ${_dailyCardHTML(G)}
  ${_weeklyCardHTML(G)}
</div>
${sectionHead('Today’s quests', 'New ones every day')}
${_questsHTML(G, { full: true })}
${sectionHead('XP by week', 'You vs. last week')}
${_weeksHTML(G)}
${sectionHead('Badge cabinet', 'Bronze · Silver · Gold · Platinum')}
${_badgesHTML(G)}
${_rulesHTML()}
` : `
<div class="card gm-off">
  <div class="label">Rank &amp; quests are off</div>
  <p class="muted fs13">XP, levels, daily quests and celebrations are switched off. Your history is untouched — turn them back on and everything is where you left it.</p>
  <button class="btn btn-fire btn-sm" onclick="setGamify(true)">Turn on Forge Rank</button>
</div>
${_dailyCardHTML(G)}
`}

<!-- STREAK CALENDAR -->
${buildStreakCalendar(workoutLog)}

<!-- PERSONAL RECORDS -->
${Object.keys(prs).length > 0 ? `
<div class="sec-head" style="margin-bottom:16px">Personal Records</div>
<div class="g-auto mb24" style="margin-bottom:24px">
  ${Object.entries(prs).map(([exId, pr]) => {
    const exName = EXERCISES[exId]?.name || exId.replace(/_/g,' ');
    return `
    <div class="pr-card is-tappable" role="button" tabindex="0"
         onclick="openExDetail('${exId}')"
         onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openExDetail('${exId}')}"
         title="View ${exName} — demo, walkthrough and video">
      <div class="pr-card-head">${exThumbHTML({ id: exId, ...(EXERCISES[exId] || {}) })}<span class="label">${exName}</span></div>
      <div class="display" style="font-size:24px;color:var(--fire)">${formatWeight(pr.weight, false)} <span style="font-size:14px">${weightUnitLabel()}</span></div>
      <div class="mono muted fs11">${pr.reps} reps · est. 1RM ${formatWeight(pr.e1rm)}</div>
      <div class="muted fs10 mt8" style="margin-top:6px">${new Date(pr.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>
    </div>
    `;
  }).join('')}
</div>
` : ''}

<!-- FIRST-TIME MILESTONES -->
<div class="sec-head" style="margin-bottom:16px">Firsts</div>
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
  // Local calendar days throughout: the cells are labelled S–S, so they are
  // the user's days. Keys used to come from toISOString() on LOCAL midnight,
  // which east of UTC is the previous day — today's workout lit yesterday.
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const activeDates = new Set(
    workoutLog.map(l => new Date(l.date)).filter(d => !isNaN(d)).map(ymd)
  );

  // 12 weeks × 7 days, starting on a Sunday so each column matches its S M T…
  // header. It used to start exactly 83 days back, on whatever weekday that
  // was, so every column sat under the wrong letter.
  const weeks = 12;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay() - (weeks - 1) * 7);

  const cells = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);          // setDate, not +86400000: DST-safe
    if (d > today) break;
    const key = ymd(d);
    cells.push({ key, active: activeDates.has(key), isToday: key === ymd(today), dow: d.getDay() });
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
    <span class="cal-cell" style="display:inline-block;width:12px"></span>
    <span class="cal-cell active" style="display:inline-block;width:12px"></span>
    <span>More</span>
  </div>
</div>
`;
}

// ═══════════════════════════════════════════
//   FORGE RANK — XP, streaks, quests, badges
//   (numbers come from engine/gamify.js; this is presentation)
// ═══════════════════════════════════════════

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n0 = (v) => Math.round(v).toLocaleString();

function _bar(pct, cls = '') {
  return `<div class="gm-bar ${cls}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct * 100)}"><i style="width:${Math.max(0, Math.min(100, pct * 100)).toFixed(1)}%"></i></div>`;
}

function _rankHeroHTML(G) {
  const next = G.rank.next;
  const vs = G.thisWeekXP - G.lastWeekSoFar;
  return `
<div class="card card-fire gm-hero">
  <div class="gm-hero-top">
    <div class="gm-crest" aria-hidden="true">${G.rank.icon}</div>
    <div class="gm-hero-id">
      <div class="label">Level</div>
      <div class="gm-level display">${G.level}</div>
    </div>
    <div class="gm-hero-rank">
      <div class="gm-rank-name">${esc(G.rank.name)}</div>
      <div class="muted fs12">${esc(G.rank.blurb)}</div>
    </div>
  </div>
  ${_bar(G.pct, 'gm-bar-lg')}
  <div class="gm-hero-meta">
    <span class="mono">${n0(G.into)} / ${n0(G.span)} XP</span>
    <span class="muted">${G.level >= 99 ? 'Max level' : `${n0(G.next - G.xp)} XP to level ${G.level + 1}`}</span>
  </div>
  <div class="gm-hero-stats">
    <div><span class="label">Today</span><b class="mono">+${n0(G.todayXP)}</b></div>
    <div><span class="label">This week</span><b class="mono">${n0(G.thisWeekXP)}</b></div>
    <div><span class="label">Vs last week</span><b class="mono" style="color:${vs >= 0 ? 'var(--green)' : 'var(--text-2)'}">${vs >= 0 ? '+' : '−'}${n0(Math.abs(vs))}</b></div>
    <div><span class="label">Next rank</span><b class="mono">${next ? `${esc(next.name)} · L${next.min}` : '—'}</b></div>
  </div>
</div>`;
}

function _freezePips(bank) {
  return `<span class="gm-freezes" title="Streak freezes banked — each covers one missed day automatically">${[0, 1].map((i) => `<i class="${i < bank ? 'on' : ''}">🧊</i>`).join('')}</span>`;
}

function _dailyCardHTML(G) {
  const d = G.daily;
  const nextM = STREAK_MILESTONES.find(([n]) => n > d.current);
  const lastFrozen = d.frozen[d.frozen.length - 1];
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  const frozeRecently = lastFrozen && (Date.now() - new Date(lastFrozen + 'T12:00').getTime()) < 3 * 864e5;
  return `
<div class="card gm-streak ${d.current > 0 ? 'is-lit' : ''}">
  <div class="gm-streak-head"><div class="label">Daily fire</div>${_freezePips(d.bank)}</div>
  <div class="gm-streak-main">
    <div class="streak-flame" aria-hidden="true">${d.current > 0 ? '🔥' : '💤'}</div>
    <div><div class="display gm-big">${d.current}</div><div class="muted fs12">day${d.current === 1 ? '' : 's'} lit${d.longest > d.current ? ` · best ${d.longest}` : ''}</div></div>
  </div>
  <div class="gm-streak-foot fs12">
    ${d.todayDone ? '<span style="color:var(--green)">✓ Lit today</span>'
      : d.current > 0 ? '<span class="fire">Not lit yet today — a workout, stretch, walk, or any log keeps it going</span>'
      : '<span class="muted">Do anything healthy today to light it — train, stretch, walk, or log sleep, food or weight</span>'}
    ${nextM ? `<span class="muted">Next: ${nextM[0]} days · +${nextM[1]} XP</span>` : ''}
    ${frozeRecently ? `<span class="muted">🧊 A freeze covered ${new Date(lastFrozen + 'T12:00').toLocaleDateString('en-US', { weekday: 'long' })}</span>` : ''}
  </div>
  <div class="muted fs11 gm-note">Every 7 lit days banks a freeze (max 2). A missed day spends one automatically — rest is part of training.</div>
</div>`;
}

function _weeklyCardHTML(G) {
  const w = G.weekly;
  const met = w.thisWeek >= w.goal;
  return `
<div class="card gm-streak ${w.current > 0 ? 'is-lit' : ''}">
  <div class="gm-streak-head"><div class="label">Training weeks</div>
    <span class="gm-goal" aria-label="Weekly goal">
      <button class="bs-x" onclick="setWeeklyGoal(${w.goal - 1})" aria-label="Lower weekly goal" ${w.goal <= 1 ? 'disabled' : ''}>−</button>
      <span class="mono fs12">${w.goal}×/wk</span>
      <button class="bs-x" onclick="setWeeklyGoal(${w.goal + 1})" aria-label="Raise weekly goal" ${w.goal >= 7 ? 'disabled' : ''}>＋</button>
    </span></div>
  <div class="gm-streak-main">
    <div class="streak-flame" aria-hidden="true">🗓️</div>
    <div><div class="display gm-big">${w.current}</div><div class="muted fs12">week${w.current === 1 ? '' : 's'} in a row${w.longest > w.current ? ` · best ${w.longest}` : ''}</div></div>
  </div>
  <div class="gm-week-dots" aria-label="${w.thisWeek} of ${w.goal} training days this week">
    ${Array.from({ length: Math.max(w.goal, w.thisWeek) }, (_, i) => `<i class="${i < w.thisWeek ? 'on' : ''}"></i>`).join('')}
  </div>
  <div class="gm-streak-foot fs12">${met ? `<span style="color:var(--green)">✓ Goal hit this week · +100 XP</span>`
    : `<span class="muted">${w.goal - w.thisWeek} more training day${w.goal - w.thisWeek === 1 ? '' : 's'} this week (ends Sunday)</span>`}</div>
</div>`;
}

function _questRow(q) {
  const [have, need] = q.progress || [q.done ? 1 : 0, 1];
  return `
<div class="gm-quest ${q.done ? 'is-done' : ''}">
  <span class="gm-quest-ic" aria-hidden="true">${q.done ? '✓' : q.icon}</span>
  <div class="gm-quest-body">
    <div class="gm-quest-label">${esc(q.label)}</div>
    <div class="muted fs11">${esc(q.hint)}</div>
    ${q.progress && !q.done ? _bar(have / need, 'gm-bar-sm') : ''}
  </div>
  <span class="gm-quest-xp mono">${q.done ? '' : '+'}${q.xp} XP</span>
</div>`;
}

function _questsHTML(G, { full = false } = {}) {
  const w = G.weekly;
  const done = G.quests.filter((q) => q.done).length;
  return `
<div class="card gm-quests">
  ${G.quests.map(_questRow).join('')}
  ${full ? `
  <div class="gm-quest gm-weekly ${w.thisWeek >= w.goal ? 'is-done' : ''}">
    <span class="gm-quest-ic" aria-hidden="true">${w.thisWeek >= w.goal ? '✓' : '🗓️'}</span>
    <div class="gm-quest-body">
      <div class="gm-quest-label">Weekly: train ${w.goal} day${w.goal === 1 ? '' : 's'}</div>
      <div class="muted fs11">${Math.min(w.thisWeek, w.goal)} of ${w.goal} this week</div>
      ${w.thisWeek < w.goal ? _bar(w.thisWeek / w.goal, 'gm-bar-sm') : ''}
    </div>
    <span class="gm-quest-xp mono">100 XP</span>
  </div>` : ''}
  <div class="muted fs11 gm-quest-foot">${done}/3 done today${done === 3 ? ' · clean sweep 🎯' : ''}</div>
</div>`;
}

function _weeksHTML(G) {
  const max = Math.max(1, ...G.weeksXP.map((w) => w.xp));
  return `
<div class="card gm-weeks">
  <div class="gm-weeks-bars">
    ${G.weeksXP.map((w, i) => {
      const cur = i === G.weeksXP.length - 1;
      const d = new Date(w.week + 'T12:00');
      return `<div class="gm-wk ${cur ? 'is-cur' : ''}" title="Week of ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${n0(w.xp)} XP">
        <span class="gm-wk-v mono">${w.xp ? n0(w.xp) : ''}</span>
        <i style="height:${Math.max(2, (w.xp / max) * 100)}%"></i>
        <span class="gm-wk-l">${cur ? 'Now' : d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}</span>
      </div>`;
    }).join('')}
  </div>
  <div class="muted fs12">${G.thisWeekXP >= G.lastWeekSoFar
    ? `Ahead of last week by ${n0(G.thisWeekXP - G.lastWeekSoFar)} XP at this point.`
    : `${n0(G.lastWeekSoFar - G.thisWeekXP)} XP behind last week at this point — one workout closes it.`} The only rival here is you.</div>
</div>`;
}

function _badgeValue(b, v) {
  if (b.weight) {
    const kg = weightUnitLabel() === 'kg';
    return `${n0(kg ? v / 2.20462 : v)} ${kg ? 'kg' : 'lbs'}`;
  }
  return `${n0(v)} ${b.unit}`;
}

function _badgesHTML(G) {
  return `<div class="gm-badges">${G.badges.map((b) => {
    const eq = b.id === 'tonnage' ? tonnageEquivalent(b.value) : null;
    const tierName = b.tier ? TIERS[b.tier - 1] : 'Locked';
    return `
<div class="gm-badge tier-${b.tier}" title="${esc(b.desc)}">
  <div class="gm-badge-top"><span class="gm-badge-ic" aria-hidden="true">${b.icon}</span>
    <span class="gm-pips" aria-label="${tierName}">${[1, 2, 3, 4].map((t) => `<i class="${t <= b.tier ? 'on' : ''}"></i>`).join('')}</span></div>
  <div class="gm-badge-name">${esc(b.name)}</div>
  <div class="gm-badge-tier label">${tierName}</div>
  <div class="mono fs12">${_badgeValue(b, b.value)}</div>
  ${b.next != null ? `${_bar(b.pct, 'gm-bar-sm')}<div class="muted fs11">Next: ${_badgeValue(b, b.next)}</div>` : '<div class="fs11" style="color:var(--green)">Maxed out</div>'}
  ${eq ? `<div class="muted fs11">≈ ${eq.times > 1 ? `${eq.times}× ` : ''}${esc(eq.what)}</div>` : ''}
</div>`;
  }).join('')}</div>`;
}

function _rulesHTML() {
  const L = {
    workout: 'Strength workout', set: 'Working set (warm-ups excluded)', pr: 'Personal record', mobility: 'Stretch / mobility session',
    cardio: 'Cardio session', hiit: 'HIIT session', activity: 'Logged activity', moveMin: 'Active minute',
    checkin: 'Weigh-in / check-in', sleep: 'Sleep logged', food: 'Food logged (per day)', protein: 'Protein target hit',
    metric: 'Custom metric logged', fast: 'Fast completed',
  };
  return `
<details class="card gm-rules">
  <summary class="label">How XP works</summary>
  <p class="muted fs12">XP is worked out from what you have logged, so deleting a mistake removes its XP and restoring a backup restores your rank exactly. Every source has a daily cap — logging the same thing twenty times earns what logging it once does.</p>
  <table class="tbl w100"><thead><tr><th>Action</th><th>XP</th><th>Daily cap</th></tr></thead><tbody>
    ${Object.entries(XP).map(([k, [xp, cap]]) => `<tr><td>${L[k] || k}</td><td class="mono">${xp}</td><td class="mono muted">${k === 'moveMin' ? `${cap} min` : `${cap}×`}</td></tr>`).join('')}
    <tr><td>Daily quest</td><td class="mono">10–40</td><td class="mono muted">3</td></tr>
    <tr><td>Weekly goal hit</td><td class="mono">100</td><td class="mono muted">1/wk</td></tr>
    <tr><td>Streak milestone (3, 7, 14, 30 … 365 days)</td><td class="mono">20–1000</td><td class="mono muted">once</td></tr>
  </tbody></table>
  <p class="muted fs12">Ranks: ${RANKS.map((r) => `${r.icon} ${esc(r.name)} (L${r.min})`).join(' · ')}. Level L needs 75·(L−1)² XP in total.</p>
</details>`;
}

// ── DASHBOARD WIDGET ─────────────────────────────────────────────────────────
export function rankWidgetHTML() {
  if (!gamifyEnabled()) return '';
  const G = summary();
  const w = G.weekly;
  return `
<div class="card gm-widget">
  <button class="gm-widget-rank" onclick="navigate('achievements')" aria-label="Open Rank & Awards">
    <span class="gm-crest gm-crest-sm" aria-hidden="true">${G.rank.icon}</span>
    <span class="gm-widget-id"><span class="label">Level ${G.level} · ${esc(G.rank.name)}</span>
      ${_bar(G.pct)}
      <span class="muted fs11">${G.level >= 99 ? 'Max level' : `${n0(G.next - G.xp)} XP to level ${G.level + 1}`} · +${n0(G.todayXP)} today</span></span>
  </button>
  <div class="gm-widget-streaks">
    <span title="Daily fire"><b class="mono">${G.daily.current > 0 ? '🔥' : '💤'} ${G.daily.current}</b><span class="muted fs11">day fire ${_freezePips(G.daily.bank)}</span></span>
    <span title="Training weeks in a row"><b class="mono">🗓️ ${w.current}</b><span class="muted fs11">wk · ${Math.min(w.thisWeek, w.goal)}/${w.goal} this week</span></span>
  </div>
  <div class="gm-widget-quests">
    <div class="label">Today’s quests</div>
    ${G.quests.map((q) => `<div class="gm-mini-q ${q.done ? 'is-done' : ''}"><span aria-hidden="true">${q.done ? '✓' : q.icon}</span><span>${esc(q.label)}</span><span class="mono muted">${q.xp}</span></div>`).join('')}
  </div>
</div>`;
}

// ── SETTINGS HANDLERS ────────────────────────────────────────────────────────
window.setWeeklyGoal = (n) => {
  const g = Math.max(1, Math.min(7, Math.round(Number(n) || 0)));
  state.settings.weeklyGoal = g;
  save();
  window.refreshCurrentPage?.();
};
window.setGamify = (on) => {
  state.settings.gamify = !!on;
  if (on) state.gamify = { ...(state.gamify || {}), seen: null };   // re-baseline: no flood of old news
  save();
  window.refreshCurrentPage?.();
  window.dispatchEvent(new CustomEvent('forge:saved'));
};

// ── CELEBRATIONS ─────────────────────────────────────────────────────────────
// After anything is saved, compare the engine's numbers with what the person
// has already been shown, and celebrate only what is genuinely new. The
// baseline lives in state.gamify.seen; the very first run sets it silently
// (with one welcome card), so years of imported history do not arrive as a
// hundred pop-ups.

function _snapshot(G) {
  return {
    xp: G.xp, level: G.level, rank: G.rank.index,
    badges: Object.fromEntries(G.badges.map((b) => [b.id, b.tier])),
    quests: G.quests.filter((q) => q.done).map((q) => q.key),
    daily: G.daily.current, frozen: G.daily.frozen.length,
    weeks: G.weekly.thisWeek >= G.weekly.goal ? [G.weekly.weekStart] : [],
    day: G.today,
  };
}

const _queue = [];
let _showing = false;
function _celebrate(card) { _queue.push(card); if (!_showing) _next(); }
function _next() {
  const c = _queue.shift();
  if (!c) { _showing = false; return; }
  _showing = true;
  const el = document.createElement('div');
  el.className = `gm-celebrate ${c.big ? 'is-big' : ''}`;
  el.setAttribute('role', 'status');
  el.innerHTML = `
    <span class="gm-cel-ic" aria-hidden="true">${c.icon}</span>
    <div class="gm-cel-body"><div class="gm-cel-title">${esc(c.title)}</div>${c.sub ? `<div class="gm-cel-sub">${esc(c.sub)}</div>` : ''}</div>
    <button class="bs-x" aria-label="Dismiss">✕</button>`;
  document.body.appendChild(el);
  // Whatever removes the card — its button, the timer, or something else
  // clearing the DOM — the queue must move on exactly once, or every later
  // celebration is silently swallowed.
  let done = false;
  const close = () => {
    if (done) return; done = true;
    if (!el.isConnected) { _next(); return; }
    el.classList.remove('show');
    setTimeout(() => { el.remove(); _next(); }, 220);
  };
  el.querySelector('button').onclick = close;
  el.onclick = (e) => { if (c.go && e.target.tagName !== 'BUTTON') { close(); window.navigate?.(c.go); } };
  requestAnimationFrame(() => {
    el.classList.add('show');
    if (c.big && !reducedMotion()) sparkBurst(el.querySelector('.gm-cel-ic'), 14);
  });
  cue(c.big ? 'milestone' : 'achievement');
  setTimeout(close, c.big ? 6500 : 4200);
}

function _check() {
  if (!gamifyEnabled()) return;
  if (document.body.classList.contains('onboarding')) return;
  const G = summary();
  const seen = state.gamify?.seen;
  const snap = _snapshot(G);
  const commit = () => { state.gamify = { ...(state.gamify || {}), seen: snap }; save(); };

  if (!seen || typeof seen !== 'object') {
    if (G.xp > 0) {
      _celebrate({ big: true, icon: G.rank.icon, title: `Forge Rank: Level ${G.level} ${G.rank.name}`,
        sub: `Your logged history is worth ${n0(G.xp)} XP. Daily quests, streaks and badges are live.`, go: 'achievements' });
    }
    return commit();
  }

  const gained = G.xp - (Number(seen.xp) || 0);
  const cards = [];
  if (G.level > (Number(seen.level) || 1)) {
    const newRank = G.rank.index > (Number(seen.rank) || 0);
    cards.push({ kind: 'level', big: true, icon: G.rank.icon, title: `Level ${G.level}!`,
      sub: newRank ? `New rank: ${G.rank.name}. ${G.rank.blurb}` : `${G.rank.name} · ${n0(G.next - G.xp)} XP to the next level`, go: 'achievements' });
  }
  for (const b of G.badges) {
    const was = Number(seen.badges?.[b.id]) || 0;
    if (b.tier > was) cards.push({ kind: 'badge', big: b.tier >= 3, icon: b.icon, title: `${TIERS[b.tier - 1]} · ${b.name}`, sub: `${_badgeValue(b, b.value)} — ${b.desc}`, go: 'achievements' });
  }
  const seenDaily = Number(seen.daily) || 0;
  // The biggest milestone crossed since last time — one card, not five.
  const crossed = STREAK_MILESTONES.filter(([n]) => seenDaily < n && G.daily.current >= n).pop();
  if (crossed) {
    const [n, xp] = crossed;
    cards.push({ big: n >= 7, icon: '🔥', title: `${n}-day fire!`, sub: `+${xp} XP${G.daily.bank > 0 ? ` · ${G.daily.bank} streak freeze${G.daily.bank > 1 ? 's' : ''} banked` : ''}`, go: 'achievements' });
  }
  if (G.daily.frozen.length > (Number(seen.frozen) || 0)) {
    cards.push({ icon: '🧊', title: 'A streak freeze saved your fire', sub: `Still ${G.daily.current} day${G.daily.current === 1 ? '' : 's'} and counting. Light it today to keep going.` });
  }
  if (snap.weeks.length && !(seen.weeks || []).includes(snap.weeks[0])) {
    cards.push({ icon: '🗓️', title: 'Weekly goal hit · +100 XP', sub: `${G.weekly.current} week${G.weekly.current === 1 ? '' : 's'} in a row` });
  }
  const oldQ = new Set(Array.isArray(seen.quests) ? seen.quests : []);
  const newQ = G.quests.filter((q) => q.done && !oldQ.has(q.key));
  if (newQ.length) {
    const all = G.quests.every((q) => q.done);
    cards.push({ icon: all ? '🎯' : '📜', title: all ? 'Clean sweep — all 3 quests done' : `Quest complete: ${newQ[0].label}`,
      sub: `+${newQ.reduce((a, q) => a + q.xp, 0)} XP${gained > 0 ? ` · +${n0(gained)} XP total` : ''}` });
  }
  // A burst (an old backup restored, a long offline gap) would otherwise be a
  // dozen cards in a row. More than three collapse into one summary.
  if (cards.length > 3) {
    const lv = cards.find((c) => c.kind === 'level');
    const badges = cards.filter((c) => c.kind === 'badge').length;
    _celebrate({ big: true, icon: G.rank.icon, title: lv ? lv.title : `+${n0(gained)} XP`,
      sub: `${badges ? `${badges} badge upgrade${badges > 1 ? 's' : ''} · ` : ''}${G.daily.current}-day fire · Level ${G.level} ${G.rank.name}`, go: 'achievements' });
  } else if (cards.length) cards.forEach(_celebrate);
  else if (gained >= 5) _xpPip(gained);
  const changed = JSON.stringify(snap) !== JSON.stringify(seen);
  if (changed) commit();
}

// A small "+N XP" that floats off the status strip — feedback for every save
// without a card for every save.
function _xpPip(n) {
  const host = document.getElementById('stats-strip') || document.body;
  const el = document.createElement('span');
  el.className = 'gm-xp-pip';
  el.textContent = `+${n0(n)} XP`;
  host.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}

let _checkQueued = null;
export function initGamifyCelebrations() {
  window.addEventListener('forge:saved', () => {
    clearTimeout(_checkQueued);
    _checkQueued = setTimeout(_check, 350);
  });
  setTimeout(_check, 1200);
}
