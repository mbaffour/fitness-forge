// Original movement-category diagrams; they are schematic labels, not exercise demonstrations.
export const MOVEMENT_PATTERNS = [
  {id:'push',label:'Push'}, {id:'pull',label:'Pull'}, {id:'squat',label:'Squat'},
  {id:'hinge',label:'Hinge'}, {id:'core',label:'Core'}, {id:'carry',label:'Carry'},
  {id:'mobility',label:'Mobility'}, {id:'other',label:'Other'},
];
export function movementPattern(ex) {
  if (MOVEMENT_PATTERNS.some(p => p.id === ex?.pattern)) return ex.pattern;
  const n = ex?.name || '';
  if (/stretch|mobility|smr|yoga|pose|arm circles/i.test(n)) return 'mobility';
  if (/carry|farmer|suitcase|march/i.test(n)) return 'carry';
  if (/deadlift|rdl|hinge|good morning|hip thrust|glute bridge|swing|hamstring curl/i.test(n)) return 'hinge';
  if (/squat|lunge|leg press|step.?up|calf|leg extension/i.test(n)) return 'squat';
  if (/row|pull.?up|pull.?down|chin.?up|curl|face pull/i.test(n)) return 'pull';
  if (/press|push.?up|dip|tricep|fly|raise/i.test(n)) return 'push';
  if (ex?.groups?.[0] === 'core' || /plank|crunch|dead ?bug|hollow|sit.?up/i.test(n)) return 'core';
  return 'other';
}
const ART = {
  push:'<circle cx="42" cy="28" r="7"/><path d="M42 35v32m0-22 23-2 18-12m-41 36-13 31m13-31 13 31M84 20v25"/>',
  pull:'<circle cx="70" cy="28" r="7"/><path d="M70 35v32m0-22-22 4-16-17m38 35-13 31m13-31 13 31M26 20v25"/>',
  squat:'<circle cx="52" cy="27" r="7"/><path d="M52 34l-7 28 28 8-11 25m-17-33-15 15 8 18m14-50 28-4M20 98h75"/>',
  hinge:'<circle cx="78" cy="33" r="7"/><path d="M72 36 42 57l7 26-11 16m4-42-13 25-2 17m31-51 10 36M61 85h18"/>',
  core:'<circle cx="25" cy="59" r="7"/><path d="M33 60h51l14 24M44 60l-5 24m45-24 8 24M20 88h82"/>',
  carry:'<circle cx="55" cy="25" r="7"/><path d="M55 32v38m0-23-20 22m20-22 17 22m-17 1-15 28m15-28 16 28M26 70h18v16H26z"/>',
  mobility:'<circle cx="52" cy="33" r="7"/><path d="M52 40v31m0-22-24-13m24 13 25-15m-25 37-21 23m21-23 24 23"/><path class="movement-arc" d="M18 28q34-30 67 0"/>',
  other:'<path d="M25 60h60M32 43v34m8-40v46m30-46v46m8-40v34"/>',
};
export function movementDiagram(ex, compact = false) {
  const pattern = movementPattern(ex), label = MOVEMENT_PATTERNS.find(p => p.id === pattern).label;
  return `<div class="movement-diagram ${compact ? 'is-compact' : ''}">
    <svg viewBox="0 0 110 110" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ART[pattern]}</svg>
    ${compact ? '' : `<span>${label} pattern</span>`}
  </div>`;
}
