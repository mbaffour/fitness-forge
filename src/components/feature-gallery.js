import { EXERCISES } from '../data/exercises.js';
import { COACHED_EXERCISES } from '../data/exercises-coached.js';
import { EXTRA_PROGRAMS } from '../data/programs-extra.js';
import { programVisualsHTML } from './program-visuals.js';
import { exPreviewHTML, showExerciseModal } from './modal.js';

const NEW_PROGRAM_IDS = [
  'bands_fullbody', 'kb_strength_base', 'kb_engine', 'lowimpact_floor',
  'posterior_db', 'core_carry', 'mobility_reset', 'balance_floor',
  'shoulder_control', 'lower_leg_base',
];
export const galleryPrograms = EXTRA_PROGRAMS.filter(p => NEW_PROGRAM_IDS.includes(p.id));
const escapeHTML = value => String(value).replace(/[&<>"']/g, ch => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
})[ch]);

export function galleryProgramHTML(plan) {
  return `<h3>${escapeHTML(plan.name)}</h3>
    <p>${plan.weeks} weeks · ${plan.days} days / week · ${escapeHTML(plan.blurb)}</p>
    ${programVisualsHTML(plan, EXERCISES, {}, 1)}
    ${plan.sessions.map(s => `<section class="gallery-session"><b>${escapeHTML(s.label)}</b><ul>
      ${s.exercises.map(e => `<li>${escapeHTML(EXERCISES[e.id]?.name || e.id)} · ${e.sets} × ${escapeHTML(e.reps)}</li>`).join('')}
    </ul></section>`).join('')}`;
}
export function galleryExerciseHTML(id, ex) {
  return `<button type="button" class="lib-card" data-exercise="${escapeHTML(id)}">
    ${exPreviewHTML({...ex,id}, {variant:'thumb'})}
    <div class="lib-card-body">
      <div class="lib-card-name">${escapeHTML(ex.name)}</div>
      <div class="lib-card-muscle">${escapeHTML(ex.muscle)}</div>
      <span class="tag t-fire">Coached · open technique steps</span>
    </div>
  </button>`;
}
export function mountGallery() {
  const picker = document.getElementById('gallery-plan');
  picker.innerHTML = galleryPrograms.map(p => `<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)}</option>`).join('');
  const renderPlan = () => {
    const plan = galleryPrograms.find(p => p.id === picker.value);
    if (plan) document.getElementById('gallery-program').innerHTML = galleryProgramHTML(plan);
  };
  picker.addEventListener('change', renderPlan);
  renderPlan();
  const cards = document.getElementById('gallery-exercises');
  cards.innerHTML = Object.entries(COACHED_EXERCISES).map(([id, ex]) => galleryExerciseHTML(id, ex)).join('');
  cards.addEventListener('click', event => {
    const button = event.target.closest('[data-exercise]');
    if (!button || !cards.contains(button)) return;
    const id = button.dataset.exercise;
    if (Object.hasOwn(COACHED_EXERCISES, id)) showExerciseModal({...EXERCISES[id], id});
  });
}
try { mountGallery(); }
catch (error) {
  const notice = document.getElementById('gallery-error');
  if (notice) { notice.hidden = false; notice.textContent = 'The gallery could not load. Please reload this page while connected to the internet.'; }
  console.error(error);
}
