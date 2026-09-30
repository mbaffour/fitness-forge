// Pure program helpers, shared with the workout logger.
export const sessionKey = (week, index) => `w${week}d${index}`;
export function programProgress(gp, prog) {
  const perWeek = prog.sessions.length, total = perWeek * prog.weeks;
  const valid = new Set();
  for (let w = 1; w <= prog.weeks; w++)
    for (let i = 0; i < perWeek; i++) valid.add(sessionKey(w, i));
  const completed = new Set((Array.isArray(gp.done) ? gp.done : []).filter(k => valid.has(k)));
  let week = 1;
  while (week < prog.weeks && prog.sessions.every((_, i) => completed.has(sessionKey(week, i)))) week++;
  return { done: completed.size, total, perWeek, week, pct: total ? Math.round(completed.size / total * 100) : 0 };
}
export function requiredItems(prog, exercises) {
  return [...new Set([...(prog.requires || []),
    ...prog.sessions.flatMap(s => s.exercises.flatMap(e => exercises[e.id]?.requires || []))])];
}
export function sessionMinutes(session) {
  const seconds = session.exercises.reduce((sum, e) => {
    const work = /s$/.test(e.reps) ? parseInt(e.reps) : (parseInt(e.reps) || 10) * 3;
    return sum + e.sets * work + Math.max(0, e.sets - 1) * 75;
  }, 300);
  return Math.round(seconds / 60 / 5) * 5;
}
export function prescribedSession(prog, index, week, profile = {}) {
  const session = prog.sessions[index];
  if (!session) return null;
  const beginner = !profile.level || profile.level === 'beginner';
  const deload = !!prog.deloadEvery && week % prog.deloadEvery === 0;
  return { ...session, deload, exercises: session.exercises.map(e => ({
    ...e,
    reps: prog.personalized ? e.role === 'hold' ? (beginner ? '20s' : '30s') : e.role === 'core' ? '8-12' : e.role === 'isolation' ? '10-15' : prog.intent === 'strength' ? (beginner ? '6-8' : '5-8') : '8-12' : e.reps,
    sets: deload ? Math.max(1, Math.ceil(e.sets / 2)) :
      ((prog.personalized && beginner && week <= 2) || (prog.foundation && (week <= 2 || week === prog.weeks))) ? Math.max(1, e.sets - 1) : e.sets,
  })) };
}
export function completedProgramKey(session, gp, prog) {
  if (!gp || !prog || gp.id !== prog.id) return null;
  const prefix = `program-${prog.id}-`;
  if (!session.workoutId?.startsWith(prefix)) return null;
  const key = session.workoutId.slice(prefix.length);
  const valid = prog.sessions.some((_, i) =>
    Array.from({ length: prog.weeks }, (_, w) => sessionKey(w + 1, i)).includes(key));
  const worked = session.exercises?.some(e => e.sets?.some(s =>
    s.completed && !s.warmup && (s.reps > 0 || s.seconds > 0)));
  return valid && worked ? key : null;
}
