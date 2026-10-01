import { prescribedSession, sessionMinutes } from './program-tools.js';
const LABELS = { chest:'Chest', back:'Back', shoulders:'Shoulders', quads:'Quads', hamstrings:'Hamstrings', glutes:'Glutes', calves:'Lower legs', core:'Core', biceps:'Biceps', triceps:'Triceps', forearms:'Forearms', other:'Other' };
export function plannedWorkload(prog, exercises, profile = {}, week = 1) {
  const sessions = prog.sessions.map((_, i) => prescribedSession(prog, i, week, profile));
  const muscles = {}, ids = new Set();
  let sets = 0;
  for (const session of sessions) for (const e of session.exercises) {
    const count = Math.max(0, Number(e.sets) || 0);
    const group = exercises[e.id]?.groups?.[0];
    const key = Object.hasOwn(LABELS, group) ? group : 'other';
    muscles[key] = (muscles[key] || 0) + count;
    sets += count; ids.add(e.id);
  }
  return { sets, exercises: ids.size, minutes: sessions.reduce((n, s) => n + sessionMinutes(s), 0), muscles };
}
export function programVisualsHTML(prog, exercises, profile = {}, week = 1) {
  const now = plannedWorkload(prog, exercises, profile, week);
  const rows = Object.entries(now.muscles).sort((a, b) => b[1] - a[1]);
  const peak = Math.max(1, ...rows.map(r => r[1]));
  const weeks = Array.from({ length: prog.weeks }, (_, i) => {
    const w = i + 1;
    return { week:w, ...plannedWorkload(prog, exercises, profile, w), deload: prescribedSession(prog, 0, w, profile).deload };
  });
  const maxWeek = Math.max(1, ...weeks.map(w => w.sets));
  return `<section class="pg-viz" aria-label="Planned program workload">
    <div class="pg-viz-head"><b>Plan at a glance</b><span>Week ${week}</span></div>
    <div class="pg-viz-stats">
      <div><strong>${now.sets}</strong><span>planned sets / week</span></div>
      <div><strong>${now.exercises}</strong><span>different exercises</span></div>
      <div><strong>~${now.minutes}</strong><span>minutes / week</span></div>
    </div>
    <div class="pg-viz-grid">
      <div><div class="label">Primary-muscle sets</div>
        ${rows.map(([g, n]) => `<div class="pg-muscle-row"><span>${LABELS[g]}</span><progress max="${peak}" value="${n}" aria-label="${LABELS[g]}: ${n} planned primary-muscle sets">${n}</progress><b>${n}</b></div>`).join('')}
      </div>
      <div><div class="label">Weekly set forecast</div>
        <div class="pg-forecast" role="img" aria-label="Planned weekly sets: ${weeks.map(w => `week ${w.week}: ${w.sets}${w.deload ? ' recovery' : ''}`).join('; ')}">
          ${weeks.map(w => `<div class="pg-forecast-col ${w.week === week ? 'is-current' : ''} ${w.deload ? 'is-recovery' : ''}" title="Week ${w.week}: ${w.sets} planned sets${w.deload ? ' · recovery' : ''}">
            <span class="pg-forecast-value">${w.sets}</span><div class="pg-forecast-track"><i style="height:${Math.round(w.sets / maxWeek * 100)}%"></i></div><span>W${w.week}</span>
          </div>`).join('')}
        </div><p class="pg-viz-note">Outlined columns mark lighter recovery weeks. These are planned sets; completion is tracked separately.</p>
      </div>
    </div>
    <p class="pg-viz-note">Sets are credited to the first-listed muscle group for each movement. Compound exercises also train other muscles. Times include estimated work, rest and warm-up.</p>
  </section>`;
}
