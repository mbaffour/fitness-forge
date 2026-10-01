import { EXERCISES } from '../data/exercises.js';
// Bodyweight informs the first estimate; recorded working sets drive progression.
import { suggestNextSet } from '../engine/overload.js';
export function programProfile(profile = {}, bodyLog = []) {
  const latest = (bodyLog || []).filter(e => e && Number.isFinite(Number(e.weight)) && Number(e.weight) > 0 && Number.isFinite(Date.parse(e.date)))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0];
  const weight = Number(latest?.weight ?? profile?.weight);
  return { ...profile, weight: Number.isFinite(weight) && weight > 0 ? weight : null,
    level: ['beginner','intermediate','advanced'].includes(profile?.level) ? profile.level : 'beginner' };
}
export function programSuggestion(exId, reps, sessions, profile, context = null, fallbackMode = 'double') {
  if (!context) return suggestNextSet(exId, reps, sessions || [], profile, fallbackMode);
  const history = (sessions || []).filter(s => !s.programDeload).map(s => ({
    ...s, exercises: (s.exercises || []).map(e => ({
      ...e, sets: (e.sets || []).filter(set => set.completed && !set.warmup),
    })),
  })).filter(s => s.exercises.some(e => e.exId === exId && e.sets.length));
  const suggestion = suggestNextSet(exId, reps, history, profile, context.programProgression || fallbackMode);
  const last = history[0]?.exercises.find(e => e.exId === exId);
  const lastLoad = last?.sets.length ? Math.max(...last.sets.map(s => s.weight || 0)) : null;
  if (EXERCISES[exId]?.timed && !context.programDeload) return {
    ...suggestion, weight: suggestion.isBodyweight ? null : lastLoad ?? suggestion.weight,
    reps: parseInt(reps) || suggestion.reps,
    rationale: 'Timed hold or carry — build control at the prescribed duration before choosing a heavier load.',
  };
  if (context.programDeload) return {
    ...suggestion, weight: suggestion.isBodyweight ? null : lastLoad ?? suggestion.weight,
    reps: parseInt(reps) || suggestion.reps,
    rationale: 'Recovery week — fewer sets, last working load, leave 3–4 reps in reserve.',
  };
  const range = String(reps).match(/\d+/g) || ['8','12'];
  const threshold = Number(context.programProgression === 'linear' ? range[0] : range[1] || range[0]);
  const enoughSets = !context.targetSets || (last?.sets.length || 0) >= context.targetSets;
  const allReached = last?.sets.every(s => s.reps >= threshold && (s.rir == null || s.rir >= 1));
  if (lastLoad != null && suggestion.weight > lastLoad && (!enoughSets || !allReached)) return {
    ...suggestion, weight: lastLoad,
    rationale: 'Keep this load until all prescribed working sets reach the target with controlled form and at least one rep in reserve.',
  };
  return suggestion;
}
