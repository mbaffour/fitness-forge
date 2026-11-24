// ═══════════════════════════════════════════
//   FITNESS FORGE — Achievements & Streaks
// ═══════════════════════════════════════════

import { state, save, formatWeight, weightUnitLabel } from '../store.js';
import { summary, enabled as gamifyEnabled, weeklyGoal, BADGE_DEFS, TIERS, XP, STREAK_MILESTONES, tonnageEquivalent, RANKS, flameTier, FLAME_TIERS, titleFor, TITLE_ID_RE } from '../engine/gamify.js';
import { sectionHead, toast } from './ui.js';
import { cue, reducedMotion, fxBurst, fxFly, countUp, tokenColor } from './feedback.js';
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
${sectionHead('Rank road', `${G.rank.index + 1} of ${RANKS.length} ranks`)}
${_rankRoadHTML(G)}
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
${sectionHead('Titles', 'Wear what you earned')}
${_titlesHTML(G)}
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

// The daily fire evolves as it grows: orange, then gold at 7 days, blue-hot at
// 30, and a white "eternal" flame with a halo at 100.
export function flameHTML(days, { size = '', low = false } = {}) {
  const t = flameTier(days);
  return `<span class="gm-flame ${size ? `gm-flame-${size}` : ''} flame-${t.id} ${low ? 'is-low' : ''}" aria-hidden="true"><i></i><i></i><i></i>${t.id === 'eternal' ? '<b></b>' : ''}</span>`;
}

// The equipped title, if it is valid and still earned. Ids are validated on
// the way out as well as in: a restored backup can carry anything.
export function equippedTitle(G = summary()) {
  const id = state.gamify?.title;
  if (!gamifyEnabled() || !TITLE_ID_RE.test(String(id || ''))) return null;
  const t = G.titles.find((x) => x.id === id);
  return t && t.unlocked ? t : null;
}

function _titleReq(G, t) {
  if (!t.id.startsWith('badge:')) return t.req;
  const [, bid, tier] = t.id.split(':');
  const b = G.badges.find((x) => x.id === bid);
  return b ? `${TIERS[tier - 1]} ${b.name} · ${_badgeValue(b, b.th[tier - 1])}` : t.req;
}

// Circular progress ring (SVG). pct 0–1.
function _ring(pct, { r = 16, stroke = 3.5, cls = '' } = {}) {
  const c = 2 * Math.PI * r, box = (r + stroke) * 2;
  const p = Math.max(0, Math.min(1, pct));
  return `<svg class="gm-ring ${cls}" viewBox="0 0 ${box} ${box}" width="${box}" height="${box}" aria-hidden="true">
    <circle cx="${box / 2}" cy="${box / 2}" r="${r}" class="gm-ring-track" stroke-width="${stroke}"/>
    <circle cx="${box / 2}" cy="${box / 2}" r="${r}" class="gm-ring-fill" stroke-width="${stroke}"
      stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - p)).toFixed(2)}" style="--c:${c.toFixed(2)}" transform="rotate(-90 ${box / 2} ${box / 2})"/>
  </svg>`;
}

// What is closest to unlocking — something concrete to aim at today.
function _nextUnlock(G) {
  const opts = [];
  for (const b of G.badges) if (b.next != null && b.value > 0) opts.push({ pct: b.pct, art: medalSVG({ ...b, tier: Math.min(4, b.tier + 1) }, { size: 30 }),
    label: `${TIERS[b.tier]} ${b.name}`, need: `${_badgeValue(b, b.next - b.value)} to go`, title: b.tier + 1 >= 2 ? G.titles.find((t) => t.id === `badge:${b.id}:${b.tier + 1}`)?.name : null });
  if (G.rank.next) opts.push({ pct: 0, art: crestSVG(G.rank.index + 1, G.rank.next.min, { size: 26 }),
    label: G.rank.next.name, need: `Level ${G.rank.next.min}`, title: G.rank.next.name, rank: true });
  const f = G.flame.next;
  if (f && G.daily.current > 0) opts.push({ pct: G.daily.current / f.min, art: flameHTML(f.min, { size: 'sm' }),
    label: `${f.name} fire`, need: `${f.min - G.daily.current} more day${f.min - G.daily.current === 1 ? '' : 's'}`, title: null });
  const best = opts.filter((o) => !o.rank).sort((a, b) => b.pct - a.pct)[0] || opts[0];
  return best || null;
}

function _rankHeroHTML(G) {
  const next = G.rank.next;
  const vs = G.thisWeekXP - G.lastWeekSoFar;
  return `
<div class="card card-fire gm-hero">
  <div class="gm-hero-top">
    <div class="gm-crest-wrap" aria-hidden="true">${crestSVG(G.rank.index, G.level, { size: 88 })}</div>
    <div class="gm-hero-id">
      <div class="label">Level</div>
      <div class="gm-level display">${G.level}</div>
    </div>
    <div class="gm-hero-rank">
      <div class="gm-rank-name">${esc(G.rank.name)}</div>
      <div class="muted fs12">${esc(G.rank.blurb)}</div>
    </div>
  </div>
  ${_bar(G.pct, 'gm-bar-lg gm-bar-anim')}
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
    ${d.current > 0 ? flameHTML(d.current, { size: 'lg', low: !d.todayDone }) : '<div class="streak-flame" aria-hidden="true">💤</div>'}
    <div><div class="display gm-big" data-count="${d.current}">${d.current}</div><div class="muted fs12">day${d.current === 1 ? '' : 's'} lit${d.longest > d.current ? ` · best ${d.longest}` : ''}${d.current > 0 ? ` · <span class="gm-flame-name flame-${G.flame.id}">${G.flame.name}</span>` : ''}</div></div>
  </div>
  <div class="gm-streak-foot fs12">
    ${d.todayDone ? '<span style="color:var(--green)">✓ Lit today</span>'
      : d.current > 0 ? '<span class="fire">Not lit yet today — a workout, stretch, walk, or any log keeps it going</span>'
      : '<span class="muted">Do anything healthy today to light it — train, stretch, walk, or log sleep, food or weight</span>'}
    ${nextM ? `<span class="muted">Next: ${nextM[0]} days · +${nextM[1]} XP</span>` : ''}
    ${frozeRecently ? `<span class="muted">🧊 A freeze covered ${new Date(lastFrozen + 'T12:00').toLocaleDateString('en-US', { weekday: 'long' })}</span>` : ''}
  </div>
  <div class="gm-flame-ladder" aria-label="Flame stages">${FLAME_TIERS.map((t) => `<span class="${d.current >= t.min ? 'on' : ''}" title="${t.name} — ${t.min || 1}+ days">${flameHTML(t.min, { size: 'xs' })}<span class="fs10">${t.min || 1}</span></span>`).join('<i></i>')}</div>
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
  <div class="gm-badge-top"><span class="gm-badge-ic" aria-hidden="true">${medalSVG(b, { size: 46 })}</span>
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
// Dashboard player card: crest inside the XP ring, title, both streaks with the
// living flame, today's quests as progress rings, and the nearest unlock.
export function rankWidgetHTML() {
  if (!gamifyEnabled()) return '';
  const G = summary();
  const w = G.weekly, d = G.daily;
  const title = equippedTitle(G);
  const nu = _nextUnlock(G);
  const maxed = G.level >= 99;
  return `
<div class="card gm-player flame-${G.flame.id}">
  <div class="gm-embers" aria-hidden="true">${Array.from({ length: 9 }, (_, i) => `<i style="--x:${(i * 37 + 11) % 100}%;--d:${(i * 0.73) % 4}s;--t:${3.4 + (i % 4) * 0.7}s"></i>`).join('')}</div>
  <button class="gm-player-id" onclick="navigate('achievements')" aria-label="Level ${G.level} ${esc(G.rank.name)} — open Rank & Awards">
    <span class="gm-player-crest">
      ${_ring(maxed ? 1 : G.pct, { r: 44, stroke: 5, cls: 'gm-ring-xp' })}
      <span class="gm-player-crest-in">${crestSVG(G.rank.index, G.level, { size: 62 })}</span>
    </span>
    <span class="gm-player-who">
      <span class="label">Level ${G.level}</span>
      <span class="gm-player-rank">${esc(G.rank.name)}</span>
      ${title ? `<span class="gm-title-chip">${esc(title.name)}</span>` : ''}
      <span class="muted fs11 mono">${maxed ? 'Max level' : `${n0(G.into)} / ${n0(G.span)} XP`}</span>
      <span class="fs11 gm-player-today">+${n0(G.todayXP)} XP today</span>
    </span>
  </button>
  <div class="gm-player-streaks">
    <div class="gm-pstreak">
      ${d.current > 0 ? flameHTML(d.current, { low: !d.todayDone }) : '<span class="gm-pstreak-ic" aria-hidden="true">💤</span>'}
      <span><b class="mono">${d.current}</b><span class="muted fs11">day fire${d.current > 0 ? ` · ${G.flame.name}` : ''}</span>${_freezePips(d.bank)}</span>
    </div>
    <div class="gm-pstreak">
      <span class="gm-pstreak-ic" aria-hidden="true">🗓️</span>
      <span><b class="mono">${w.current}</b><span class="muted fs11">week${w.current === 1 ? '' : 's'} on goal</span>
        <span class="gm-week-dots gm-week-dots-sm" aria-label="${w.thisWeek} of ${w.goal} training days this week">${Array.from({ length: Math.max(w.goal, w.thisWeek) }, (_, i) => `<i class="${i < w.thisWeek ? 'on' : ''}"></i>`).join('')}</span></span>
    </div>
  </div>
  <div class="gm-player-quests">
    <div class="label">Today’s quests <span class="muted">${G.quests.filter((q) => q.done).length}/3</span></div>
    <div class="gm-qrings">
      ${G.quests.map((q) => {
        const [have, need] = q.progress || [q.done ? 1 : 0, 1];
        return `<div class="gm-qring ${q.done ? 'is-done' : ''}" title="${esc(q.hint)}">
          <span class="gm-qring-art">${_ring(q.done ? 1 : have / need, { r: 17, stroke: 3.5 })}<span class="gm-qring-ic" aria-hidden="true">${q.done ? '✓' : q.icon}</span></span>
          <span class="gm-qring-label">${esc(q.label)}</span>
          <span class="mono fs10 ${q.done ? 'gm-ok' : 'muted'}">${q.done ? 'done' : q.progress ? `${n0(have)}/${n0(need)} · ${q.xp} XP` : `${q.xp} XP`}</span>
        </div>`;
      }).join('')}
    </div>
  </div>
  ${nu ? `
  <button class="gm-player-next" onclick="navigate('achievements')">
    <span class="gm-next-art" aria-hidden="true">${nu.art}</span>
    <span class="gm-next-body"><span class="label">Next unlock</span>
      <span class="fs12">${esc(nu.label)} <span class="muted">· ${esc(nu.need)}</span></span>
      ${nu.title ? `<span class="muted fs11">Unlocks the title “${esc(nu.title)}”</span>` : ''}</span>
    ${nu.pct ? `<span class="gm-next-bar">${_bar(nu.pct, 'gm-bar-sm')}</span>` : ''}
  </button>` : ''}
</div>`;
}

// ── RANK ROAD + TITLES ───────────────────────────────────────────────────────
function _rankRoadHTML(G) {
  const cur = G.rank.index;
  return `
<div class="card gm-road" role="list">
  ${RANKS.map((r, i) => {
    const state_ = i < cur ? 'done' : i === cur ? 'here' : 'ahead';
    return `<div class="gm-road-stop is-${state_}" role="listitem" aria-label="${esc(r.name)}, level ${r.min}${i === cur ? ' — you are here' : ''}">
      <span class="gm-road-crest">${crestSVG(i, i <= cur ? (i === cur ? G.level : r.min) : r.min, { size: i === cur ? 58 : 40 })}</span>
      <span class="gm-road-name">${esc(r.name)}</span>
      <span class="mono fs10 muted">L${r.min}</span>
      ${i === cur && G.rank.next ? `<span class="fs10 gm-road-to">${n0(G.rankXPToNext)} XP to ${esc(G.rank.next.name)}</span>` : ''}
    </div>`;
  }).join('<span class="gm-road-link" aria-hidden="true"></span>')}
</div>`;
}

function _titlesHTML(G) {
  const eq = equippedTitle(G);
  const un = G.titles.filter((t) => t.unlocked);
  const locked = G.titles.filter((t) => !t.unlocked);
  // Show every unlocked title and the next few within reach, not all 50.
  const near = locked.filter((t) => t.id.startsWith('rank:')).slice(0, 1)
    .concat(locked.filter((t) => t.id.startsWith('badge:')).map((t) => {
      const [, bid, tier] = t.id.split(':'); const b = G.badges.find((x) => x.id === bid);
      return { t, k: b && b.tier === Number(tier) - 1 ? b.pct : -1 };
    }).filter((x) => x.k >= 0).sort((a, b) => b.k - a.k).slice(0, 5).map((x) => x.t));
  return `
<div class="card gm-titles">
  <p class="muted fs12" style="margin:0 0 12px">Every rank, and silver or better in any badge, unlocks a title. Equip one and it shows under your name on the dashboard.</p>
  <div class="gm-title-grid">
    <button class="gm-title-opt ${!eq ? 'is-on' : ''}" onclick="equipTitle('')" aria-pressed="${!eq}"><span class="gm-title-name">No title</span><span class="muted fs10">Just your name</span></button>
    ${un.map((t) => `<button class="gm-title-opt ${eq?.id === t.id ? 'is-on' : ''}" onclick="equipTitle('${t.id}')" aria-pressed="${eq?.id === t.id}">
      <span class="gm-title-name">${t.icon} ${esc(t.name)}</span><span class="muted fs10">${esc(_titleReq(G, t))}</span></button>`).join('')}
    ${near.map((t) => `<div class="gm-title-opt is-locked" aria-disabled="true">
      <span class="gm-title-name">🔒 ${esc(t.name)}</span><span class="muted fs10">${esc(_titleReq(G, t))}</span></div>`).join('')}
  </div>
  <div class="muted fs11" style="margin-top:10px">${un.length} of ${G.titles.length} titles unlocked</div>
</div>`;
}

// ── SETTINGS HANDLERS ────────────────────────────────────────────────────────
window.setWeeklyGoal = (n) => {
  const g = Math.max(1, Math.min(7, Math.round(Number(n) || 0)));
  state.settings.weeklyGoal = g;
  save();
  window.refreshCurrentPage?.();
};
window.equipTitle = (id) => {
  id = String(id || '');
  if (id && !TITLE_ID_RE.test(id)) return;
  const G = summary();
  if (id && !G.titles.find((t) => t.id === id && t.unlocked)) return;
  state.gamify = { ...(state.gamify || {}), title: id || null };
  save();
  cue('select');
  if (id) toast(`Title equipped: ${titleFor(id)}`, { type: 'success' });
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
    day: G.today, flame: G.flame.index,
    titles: G.titles.filter((t) => t.unlocked).length,
  };
}

const _queue = [];
let _showing = false;
function _celebrate(card) { _queue.push(card); if (!_showing) _next(); }

// Whatever removes a celebration — its button, the timer, or something else
// clearing the DOM — the queue must move on exactly once, or every later
// celebration is silently swallowed.
function _closer(el, delay = 240) {
  let done = false;
  return () => {
    if (done) return; done = true;
    if (!el.isConnected) { _next(); return; }
    el.classList.remove('show'); el.classList.add('hide');
    setTimeout(() => { el.remove(); _next(); }, delay);
  };
}

function _next() {
  const c = _queue.shift();
  if (!c) { _showing = false; return; }
  _showing = true;
  if (c.kind === 'level' || c.kind === 'welcome') return _levelUp(c);
  if (c.kind === 'badge' && c.badge?.tier >= 2) return _badgeUp(c);
  _toastCard(c);
}

// Non-blocking card at the top: quests, streak milestones, freezes, weekly
// goals, bronze badges. XP coins fly from it into the level chip.
function _toastCard(c) {
  const el = document.createElement('div');
  el.className = `gm-celebrate ${c.big ? 'is-big' : ''} is-${c.fx || 'plain'}`;
  el.setAttribute('role', 'status');
  el.innerHTML = `
    <span class="gm-cel-ic" aria-hidden="true">${c.art || c.icon}</span>
    <div class="gm-cel-body"><div class="gm-cel-title">${esc(c.title)}</div>${c.sub ? `<div class="gm-cel-sub">${esc(c.sub)}</div>` : ''}</div>
    <button class="bs-x" aria-label="Dismiss">✕</button>`;
  document.body.appendChild(el);
  const close = _closer(el);
  el.querySelector('button').onclick = close;
  el.onclick = (e) => { if (c.go && e.target.tagName !== 'BUTTON') { close(); window.navigate?.(c.go); } };
  requestAnimationFrame(() => {
    el.classList.add('show');
    const ic = el.querySelector('.gm-cel-ic');
    setTimeout(() => {
      if (c.fx === 'ice') fxBurst(ic, { kind: 'ice', count: 22 });
      else if (c.fx === 'fire') fxBurst(ic, { kind: 'embers', count: 30 });
      else fxBurst(ic, { kind: 'sparks', count: c.big ? 26 : 14, power: 0.8 });
      if (c.xp) _flyXP(ic, c.xp);
    }, 180);
  });
  cue(c.sound || 'achievement');
  setTimeout(close, c.big ? 6000 : 4200);
}

// Coins from `from` into the level chip in the status strip, which pulses as
// they land.
function _flyXP(from, amount) {
  const chip = document.getElementById('gm-strip-lv');
  if (!chip || !chip.getClientRects().length) { cue('xp'); return; }
  fxFly(from, chip, { count: Math.min(12, 4 + Math.round(amount / 15)), onArrive: () => {
    chip.classList.remove('gm-chip-hit'); void chip.offsetWidth; chip.classList.add('gm-chip-hit');
    cue('xp');
  } });
}

// LEVEL UP — a full-screen forging sequence: the crest drops onto the anvil,
// two hammer blows throw sparks (timed to the two strikes in the sound), the
// level stamps in, the bar fills. Tap anywhere or the button to continue.
function _levelUp(c) {
  const G = summary();
  const rankUp = c.kind === 'level' && c.newRank;
  const el = document.createElement('div');
  el.className = `gm-lu ${rankUp ? 'is-rank' : ''}`;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', c.title);
  el.innerHTML = `
    <div class="gm-lu-rays" aria-hidden="true"></div>
    <div class="gm-lu-card">
      <div class="gm-lu-stage">
        <div class="gm-lu-crest">${crestSVG(G.rank.index, G.level, { size: 150 })}</div>
        <div class="gm-lu-hammer" aria-hidden="true">${HAMMER_SVG}</div>
      </div>
      <div class="gm-lu-kicker label">${esc(c.kicker || (rankUp ? 'New rank' : 'Level up'))}</div>
      <div class="gm-lu-level display">${esc(c.title)}</div>
      <div class="gm-lu-rank">${esc(c.rankLine || `${G.rank.name}`)}</div>
      <div class="gm-bar gm-lu-bar"><i style="width:0%"></i></div>
      <div class="gm-lu-sub muted fs12">${esc(c.sub || '')}</div>
      ${rankUp ? `<div class="gm-title-chip gm-lu-title">Title unlocked · ${esc(G.rank.name)}</div>` : ''}
      <button class="btn btn-fire gm-lu-go">${esc(c.cta || 'Keep forging')}</button>
    </div>`;
  document.body.appendChild(el);
  const close = _closer(el, 320);
  el.querySelector('.gm-lu-go').onclick = (e) => { e.stopPropagation(); close(); };
  el.onclick = close;
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  requestAnimationFrame(() => {
    el.classList.add('show');
    el.querySelector('.gm-lu-go').focus({ preventScroll: true });
  });
  const crest = el.querySelector('.gm-lu-crest');
  cue(rankUp ? 'rankUp' : 'levelUp');
  // Strikes at 0 and 0.34s in the sound, so the visual hits land with them.
  const strike = (i) => {
    el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
    fxBurst(crest, { kind: 'sparks', count: 34 + i * 10, power: 1.25 });
  };
  setTimeout(() => strike(0), 30);
  setTimeout(() => strike(1), 370);
  if (rankUp) setTimeout(() => strike(2), 710);
  setTimeout(() => {
    el.classList.add('stamped');
    const bar = el.querySelector('.gm-lu-bar i');
    if (bar) bar.style.width = `${(G.pct * 100).toFixed(1)}%`;
    fxBurst({ x: innerWidth / 2, y: innerHeight * 0.3 }, { kind: rankUp ? 'confetti' : 'embers', count: rankUp ? 90 : 40, power: 1.2 });
  }, rankUp ? 900 : 640);
  setTimeout(close, rankUp ? 9000 : 7000);
}

// BADGE — the medal flips in with a sheen, sparks in the tier's metal.
function _badgeUp(c) {
  const b = c.badge;
  const el = document.createElement('div');
  el.className = `gm-lu gm-bu tier-${b.tier}`;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', c.title);
  el.innerHTML = `
    <div class="gm-lu-card">
      <div class="gm-bu-medal">${medalSVG(b, { size: 140 })}</div>
      <div class="gm-lu-kicker label">${TIERS[b.tier - 1]} badge</div>
      <div class="gm-lu-level display gm-bu-name">${esc(b.name)}</div>
      <div class="gm-lu-rank">${esc(_badgeValue(b, b.value))}</div>
      <div class="gm-lu-sub muted fs12">${esc(b.desc)}${b.next != null ? ` · next tier at ${esc(_badgeValue(b, b.next))}` : ' · maxed out'}</div>
      ${b.tier >= 2 && titleFor(`badge:${b.id}:${b.tier}`) ? `<div class="gm-title-chip gm-lu-title">Title unlocked · ${esc(titleFor(`badge:${b.id}:${b.tier}`))}</div>` : ''}
      <button class="btn btn-fire gm-lu-go">Nice</button>
    </div>`;
  document.body.appendChild(el);
  const close = _closer(el, 300);
  el.querySelector('.gm-lu-go').onclick = (e) => { e.stopPropagation(); close(); };
  el.onclick = close;
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  requestAnimationFrame(() => { el.classList.add('show'); el.querySelector('.gm-lu-go').focus({ preventScroll: true }); });
  cue(`badge${b.tier}`);
  const metal = METALS[TIER_METAL[b.tier]];
  setTimeout(() => fxBurst(el.querySelector('.gm-bu-medal'), { kind: 'sparks', count: 20 + b.tier * 12,
    colors: [tokenColor(metal[0]), tokenColor(metal[1]), tokenColor('--fire')] }), 420);
  if (b.tier >= 4) setTimeout(() => fxBurst({ x: innerWidth / 2, y: innerHeight * 0.3 }, { kind: 'confetti', count: 80 }), 700);
  setTimeout(close, 6500);
}

// ── ART ──────────────────────────────────────────────────────────────────────
// Forged crests and medals drawn as SVG. Metals are theme tokens (style.css,
// --metal-*), referenced through stop-color so every theme can retune them.
const METALS = {
  iron:     ['--metal-iron-hi', '--metal-iron', '--metal-iron-lo'],
  bronze:   ['--metal-bronze-hi', '--metal-bronze', '--metal-bronze-lo'],
  copper:   ['--metal-copper-hi', '--metal-copper', '--metal-copper-lo'],
  steel:    ['--metal-steel-hi', '--metal-steel', '--metal-steel-lo'],
  gold:     ['--metal-gold-hi', '--metal-gold', '--metal-gold-lo'],
  fire:     ['--metal-fire-hi', '--metal-fire', '--metal-fire-lo'],
  platinum: ['--metal-plat-hi', '--metal-plat', '--metal-plat-lo'],
  obsidian: ['--metal-obs-hi', '--metal-obs', '--metal-obs-lo'],
};
const RANK_METAL = ['iron', 'bronze', 'copper', 'steel', 'gold', 'fire', 'platinum', 'obsidian'];
const TIER_METAL = [null, 'bronze', 'steel', 'gold', 'platinum'];
let _uid = 0;
function _grad(id, metal, vertical = true) {
  const [hi, mid, lo] = METALS[metal];
  return `<linearGradient id="${id}" x1="0" y1="0" x2="${vertical ? 0 : 1}" y2="1">
    <stop offset="0" style="stop-color:var(${hi})"/><stop offset=".45" style="stop-color:var(${mid})"/>
    <stop offset=".55" style="stop-color:var(${lo})"/><stop offset="1" style="stop-color:var(${mid})"/></linearGradient>`;
}

const SHIELD = 'M60 6 L108 22 V66 C108 98 88 120 60 134 C32 120 12 98 12 66 V22 Z';
export function crestSVG(rankIndex, level, { size = 96 } = {}) {
  const id = `gmc${++_uid}`;
  const metal = RANK_METAL[Math.max(0, Math.min(7, rankIndex))];
  const flames = rankIndex >= 5;
  return `<svg class="gm-crest-svg ${flames ? 'has-flames' : ''}" viewBox="0 0 120 140" width="${size}" height="${Math.round(size * 140 / 120)}" aria-hidden="true">
  <defs>${_grad(id + 'm', metal)}
    <linearGradient id="${id}f" x1="0" y1="1" x2="0" y2="0"><stop offset="0" style="stop-color:var(--fire)"/><stop offset="1" style="stop-color:var(--ember);stop-opacity:0"/></linearGradient>
    <clipPath id="${id}c"><path d="${SHIELD}"/></clipPath></defs>
  ${flames ? `<g class="gm-crest-flames"><path d="M22 70 C10 40 30 30 26 6 C44 26 40 40 48 30 C52 16 60 12 60 0 C66 14 70 18 74 30 C82 40 76 26 94 6 C90 30 110 40 98 70 Z" fill="url(#${id}f)"/></g>` : ''}
  <path d="${SHIELD}" fill="url(#${id}m)" stroke="var(${METALS[metal][2]})" stroke-width="3"/>
  <path d="M60 18 L96 30 V66 C96 91 81 108 60 120 C39 108 24 91 24 66 V30 Z" fill="var(--bg)" opacity=".82"/>
  <g clip-path="url(#${id}c)"><rect class="gm-crest-sheen" x="-60" y="0" width="30" height="140" fill="#fff" opacity=".18" transform="skewX(-20)"/></g>
  <path d="M40 44 H80 V48 C74 48 72 52 72 56 H48 C48 52 46 48 40 48 Z M52 56 H68 V62 H74 V66 H46 V62 H52 Z" fill="url(#${id}m)"/>
  <text x="60" y="100" text-anchor="middle" font-family="'Fira Code', monospace" font-weight="700" font-size="${level >= 100 ? 26 : 32}" fill="url(#${id}m)">${level}</text>
  ${(() => { const n = Math.max(0, Math.min(7, rankIndex)) + 1;     // one rivet per rank reached
    return Array.from({ length: n }, (_, i) => `<circle cx="${60 + (i - (n - 1) / 2) * 9}" cy="14" r="2.4" fill="var(${METALS[metal][0]})"/>`).join(''); })()}
</svg>`;
}

export function medalSVG(b, { size = 64 } = {}) {
  const id = `gmm${++_uid}`;
  const locked = !b.tier;
  const metal = TIER_METAL[b.tier] || 'iron';
  return `<svg class="gm-medal-svg ${locked ? 'is-locked' : ''}" viewBox="0 0 100 120" width="${size}" height="${Math.round(size * 1.2)}" aria-hidden="true">
  <defs>${_grad(id, metal, false)}<clipPath id="${id}c"><circle cx="50" cy="70" r="38"/></clipPath></defs>
  <path d="M30 2 H48 L58 34 L40 40 Z" fill="${locked ? 'var(--bg-3)' : 'var(--fire)'}" opacity="${locked ? 1 : 0.85}"/>
  <path d="M70 2 H52 L42 34 L60 40 Z" fill="${locked ? 'var(--bg-4)' : 'var(--ember)'}" opacity="${locked ? 1 : 0.85}"/>
  ${locked
    ? `<circle cx="50" cy="70" r="38" fill="var(--bg-2)" stroke="var(--border-hi)" stroke-width="2" stroke-dasharray="4 4"/>`
    : `<circle cx="50" cy="70" r="38" fill="url(#${id})" stroke="var(${METALS[metal][2]})" stroke-width="2"/>
       <circle cx="50" cy="70" r="30" fill="none" stroke="var(${METALS[metal][0]})" stroke-width="1.5" opacity=".7"/>
       <g clip-path="url(#${id}c)"><rect class="gm-medal-sheen" x="-40" y="20" width="22" height="110" fill="#fff" opacity=".28" transform="skewX(-18)"/></g>`}
  <text x="50" y="81" text-anchor="middle" font-size="30" ${locked ? 'opacity=".35" style="filter:grayscale(1)"' : ''}>${b.icon}</text>
</svg>`;
}

const HAMMER_SVG = `<svg viewBox="0 0 80 80" width="74" height="74"><g transform="rotate(-35 40 40)">
  <rect x="36" y="26" width="8" height="50" rx="3" fill="var(--metal-bronze-lo)"/>
  <rect x="18" y="10" width="44" height="20" rx="3" fill="var(--metal-steel)" stroke="var(--metal-steel-lo)" stroke-width="2"/>
  <rect x="18" y="10" width="44" height="6" rx="2" fill="var(--metal-steel-hi)" opacity=".7"/></g></svg>`;

function _check() {
  if (!gamifyEnabled()) return;
  if (document.body.classList.contains('onboarding')) return;
  const G = summary();
  const seen = state.gamify?.seen;
  const snap = _snapshot(G);
  const commit = () => { state.gamify = { ...(state.gamify || {}), seen: snap }; save(); };

  if (!seen || typeof seen !== 'object') {
    if (G.xp > 0) {
      _celebrate({ kind: 'welcome', kicker: 'Forge Rank unlocked', title: `Level ${G.level}`, rankLine: G.rank.name,
        sub: `Your logged history is worth ${n0(G.xp)} XP. Daily quests, streaks and badges are live.`, cta: 'Let’s go' });
    }
    return commit();
  }

  const gained = G.xp - (Number(seen.xp) || 0);
  const cards = [];
  if (G.level > (Number(seen.level) || 1)) {
    const newRank = G.rank.index > (Number(seen.rank) || 0);
    cards.push({ kind: 'level', newRank, big: true, icon: G.rank.icon, title: `Level ${G.level}`,
      rankLine: newRank ? `${G.rank.name} — ${G.rank.blurb}` : G.rank.name,
      sub: `${n0(G.next - G.xp)} XP to level ${G.level + 1}`, go: 'achievements' });
  }
  for (const b of G.badges) {
    const was = Number(seen.badges?.[b.id]) || 0;
    if (b.tier > was) cards.push({ kind: 'badge', badge: b, big: b.tier >= 3, icon: b.icon, art: medalSVG(b, { size: 34 }), sound: 'badge1',
      title: `${TIERS[b.tier - 1]} · ${b.name}`, sub: `${_badgeValue(b, b.value)} — ${b.desc}`, go: 'achievements' });
  }
  const seenDaily = Number(seen.daily) || 0;
  // The biggest milestone crossed since last time — one card, not five.
  const crossed = STREAK_MILESTONES.filter(([n]) => seenDaily < n && G.daily.current >= n).pop();
  if (crossed) {
    const [n, xp] = crossed;
    cards.push({ big: n >= 7, icon: '🔥', art: flameHTML(G.daily.current), fx: 'fire', sound: 'streak', xp,
      title: `${n}-day fire!`, sub: `+${xp} XP${G.daily.bank > 0 ? ` · ${G.daily.bank} streak freeze${G.daily.bank > 1 ? 's' : ''} banked` : ''}`, go: 'achievements' });
  }
  // The fire changed colour — a moment worth marking on its own.
  if (seen.flame != null && G.flame.index > Number(seen.flame) && G.flame.index > 0) {
    const colour = G.flame.id === 'roaring' ? 'gold' : G.flame.id === 'blue' ? 'blue-hot' : 'eternal';
    const ms = cards.find((c) => c.sound === 'streak');
    // Stages sit on milestones (7 / 30 / 100), so usually this rides on that card.
    if (ms) Object.assign(ms, { big: true, art: flameHTML(G.daily.current, { size: 'lg' }),
      title: `${ms.title.replace(/!$/, '')} — your fire burns ${colour}!`, sub: `${ms.sub} · ${G.flame.name} stage unlocked` });
    else cards.push({ big: true, icon: '🔥', art: flameHTML(G.daily.current, { size: 'lg' }), fx: 'fire', sound: 'streak',
      title: `Your fire burns ${G.flame.id === 'roaring' ? 'gold' : G.flame.id === 'blue' ? 'blue-hot' : 'eternal'}`,
      sub: `${G.flame.name} — ${G.daily.current} days lit.${G.flame.next ? ` Next stage at ${G.flame.next.min} days.` : ' The highest stage there is.'}`, go: 'achievements' });
  }
  if (G.daily.frozen.length > (Number(seen.frozen) || 0)) {
    cards.push({ icon: '🧊', fx: 'ice', sound: 'freeze', title: 'A streak freeze saved your fire', sub: `Still ${G.daily.current} day${G.daily.current === 1 ? '' : 's'} and counting. Light it today to keep going.` });
  }
  if (snap.weeks.length && !(seen.weeks || []).includes(snap.weeks[0])) {
    cards.push({ icon: '🗓️', sound: 'weekly', xp: 100, title: 'Weekly goal hit · +100 XP', sub: `${G.weekly.current} week${G.weekly.current === 1 ? '' : 's'} in a row` });
  }
  const oldQ = new Set(Array.isArray(seen.quests) ? seen.quests : []);
  const newQ = G.quests.filter((q) => q.done && !oldQ.has(q.key));
  if (newQ.length) {
    const all = G.quests.every((q) => q.done);
    cards.push({ icon: all ? '🎯' : '📜', sound: 'quest', xp: newQ.reduce((a, q) => a + q.xp, 0) + Math.max(0, gained),
      title: all ? 'Clean sweep — all 3 quests done' : `Quest complete: ${newQ[0].label}`,
      sub: `+${newQ.reduce((a, q) => a + q.xp, 0)} XP${gained > 0 ? ` · +${n0(gained)} XP total` : ''}` });
  }
  const newTitles = seen.titles != null ? G.titles.filter((t) => t.unlocked).length - Number(seen.titles) : 0;
  if (newTitles > 0) {
    const host = cards.find((c) => c.kind === 'level' || c.kind === 'badge');
    const line = `New title${newTitles > 1 ? 's' : ''} unlocked — equip ${newTitles > 1 ? 'them' : 'it'} on Rank & Awards`;
    if (host) host.sub = `${host.sub ? host.sub + ' · ' : ''}${line}`;
  }
  // A burst (an old backup restored, a long offline gap) would otherwise be a
  // dozen cards in a row. More than three collapse into one summary.
  if (cards.length > 3) {
    const lv = cards.find((c) => c.kind === 'level');
    const badges = cards.filter((c) => c.kind === 'badge').length;
    _celebrate({ kind: 'level', newRank: !!lv?.newRank, kicker: lv ? (lv.newRank ? 'New rank' : 'Level up') : 'While you were away',
      title: lv ? lv.title : `+${n0(gained)} XP`, rankLine: G.rank.name,
      sub: `${badges ? `${badges} badge upgrade${badges > 1 ? 's' : ''} · ` : ''}${G.daily.current}-day fire · ${n0(G.next - G.xp)} XP to level ${G.level + 1}` });
  } else if (cards.length) cards.forEach(_celebrate);
  else if (gained >= 5) _xpPip(gained);
  const changed = JSON.stringify(snap) !== JSON.stringify(seen);
  if (changed) commit();
}

// A small "+N XP" that floats off the status strip — feedback for every save
// without a card for every save.
function _xpPip(n) {
  _flyXP({ x: innerWidth / 2, y: innerHeight * 0.75 }, n);
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
