// ═══════════════════════════════════════════
//   FITNESS FORGE — Exercise Library
//   Searchable, filterable browser over the
//   full exercise database. Cards open the
//   existing detail modal (openExDetail).
// ═══════════════════════════════════════════

import { EXERCISES, MUSCLE_GROUPS, EQUIPMENT_OPTIONS } from '../data/exercises.js';
import { exPreviewHTML } from './modal.js';
import { MOVEMENT_PATTERNS, movementPattern } from './movement-patterns.js';
import { pageHeader, sectionHead } from './ui.js';
import { addCustomExercise, deleteCustomExercise } from '../store.js';

// Filter state (module-level so it survives re-renders within a visit)
let _q     = '';
let _grp   = 'all';
let _equip = 'all';
let _diff  = 'all';
let _pattern = 'all';
let _collection = 'all';
let _shown = 60;
const attr = value => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const DIFF_OPTIONS = [
  { id: 'all', label: 'All Levels' },
  { id: 'beg', label: 'Beginner' },
  { id: 'int', label: 'Intermediate' },
  { id: 'adv', label: 'Advanced' },
];

function _matches(id, ex) {
  if (_pattern !== 'all' && movementPattern(ex) !== _pattern) return false;
  if (_collection === 'coached' && !ex.coached) return false;
  if (_grp !== 'all' && !(ex.groups || []).includes(_grp)) return false;
  if (_equip !== 'all' && !(ex.equip || []).includes(_equip)) return false;
  if (_diff !== 'all' && ex.diff !== _diff) return false;
  if (_q) {
    const hay = `${ex.name} ${ex.muscle} ${id}`.toLowerCase();
    if (!hay.includes(_q)) return false;
  }
  return true;
}

function _filtered() {
  return Object.entries(EXERCISES).filter(([id, ex]) => _matches(id, ex));
}

function _cardHTML(id, ex) {
  const diffLabel = ex.diff === 'beg' ? 'Beginner' : ex.diff === 'int' ? 'Intermediate' : 'Advanced';
  return `
<div class="lib-card" onclick="openExDetail('${id}')" role="button" tabindex="0"
     onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openExDetail('${id}')}">
  ${exPreviewHTML({ ...ex, id }, { variant: 'thumb' }) || `<div class="ex-gif-wrap ex-gif-thumb lib-noimg">🏋</div>`}
  <div class="lib-card-body">
    <div class="lib-card-name">${ex.name}</div>
    <div class="lib-card-muscle">${ex.muscle || ''}</div>
    <div class="lib-card-tags">
      <span class="tag ${ex.type === 'compound' ? 't-fire' : 't-steel'}">${ex.type}</span>
      <span class="tag t-dim">${diffLabel}</span>
      ${ex.custom ? `<span class="tag t-green">Custom</span>` : ''}
      ${ex.coached ? '<span class="tag t-fire">Coached</span>' : ''}
    </div>
  </div>
  ${ex.custom ? `<button class="lib-del-custom" title="Delete custom exercise" onclick="event.stopPropagation();libDeleteCustom('${id}')">🗑</button>` : ''}
</div>`;
}

const _CAP = 60;  // cap rendered cards so the ~900-exercise DB stays fast on mobile

function _resultsHTML() {
  const list = _filtered();
  if (!list.length) {
    return `<div class="card tc p-6"><div style="font-size:40px;margin-bottom:12px">🔍</div>
      <div class="dim fs13">No exercises match. Try clearing a filter.</div></div>`;
  }
  const shown = list.slice(0, _shown);
  const more  = list.length - shown.length;
  return `
<div class="dim fs12" style="margin-bottom:12px">${list.length} exercise${list.length === 1 ? '' : 's'}${more > 0 ? ` · showing ${shown.length}` : ''}</div>
<div class="lib-grid">${shown.map(([id, ex]) => _cardHTML(id, ex)).join('')}</div>
${more > 0 ? `<button class="btn btn-secondary lib-load-more" onclick="libLoadMore()">Show ${Math.min(_CAP, more)} more · ${more} remaining</button>` : ''}`;
}

function _refreshResults() {
  const el = document.getElementById('lib-results');
  if (el) el.innerHTML = _resultsHTML();
}

function _refreshChips() {
  document.querySelectorAll('#lib-pattern-seg .seg-btn').forEach(b => { b.classList.toggle('active', b.dataset.pattern === _pattern); b.setAttribute('aria-pressed', String(b.dataset.pattern === _pattern)); });
  document.querySelectorAll('#lib-collection-seg .seg-btn').forEach(b => { b.classList.toggle('active', b.dataset.collection === _collection); b.setAttribute('aria-pressed', String(b.dataset.collection === _collection)); });
  document.querySelectorAll('#lib-grp-chips .lib-chip').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.grp === _grp);
  });
  document.querySelectorAll('#lib-equip-seg .seg-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.equip === _equip);
  });
  document.querySelectorAll('#lib-diff-seg .seg-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.diff === _diff);
  });
}

window.libSetQ = (v) => { _q = (v || '').trim().toLowerCase(); _shown = _CAP; _refreshResults(); };
window.libSetGrp = (g) => { _grp = g; _shown = _CAP; _refreshChips(); _refreshResults(); };
window.libSetEquip = (e) => { _equip = e; _shown = _CAP; _refreshChips(); _refreshResults(); };
window.libSetDiff = (d) => { _diff = d; _shown = _CAP; _refreshChips(); _refreshResults(); };

window.libSetPattern = p => { _pattern = p; _shown = _CAP; _refreshChips(); _refreshResults(); };
window.libSetCollection = c => { _collection = c; _shown = _CAP; _refreshChips(); _refreshResults(); };
window.libLoadMore = () => { _shown += _CAP; _refreshResults(); };
// ── CREATE / DELETE CUSTOM EXERCISE ──
const _createGroups = new Set();

window.libDeleteCustom = (id) => {
  if (!confirm('Delete this custom exercise?')) return;
  deleteCustomExercise(id);
  _refreshResults();
};

window.libToggleCreateGrp = (gid) => {
  _createGroups.has(gid) ? _createGroups.delete(gid) : _createGroups.add(gid);
  document.querySelector(`#create-grps .lib-chip[data-grp="${gid}"]`)?.classList.toggle('active');
};

window.libSaveCreate = () => {
  const name = document.getElementById('create-name')?.value.trim();
  if (!name) { document.getElementById('create-name')?.focus(); return; }
  const type  = document.getElementById('create-type')?.value || 'compound';
  const diff  = document.getElementById('create-diff')?.value || 'int';
  const equip = document.getElementById('create-equip')?.value || 'full_gym';
  const groups = [..._createGroups];
  const muscle = groups.map(g => MUSCLE_GROUPS.find(m => m.id === g)?.label).filter(Boolean).join(' / ') || 'General';
  const id = addCustomExercise({ name, type, diff, equip: [equip], groups, muscle });
  _createGroups.clear();
  window.libCloseCreate();
  // surface the new exercise: clear filters and search for it
  _q = name.toLowerCase(); _grp = 'all'; _equip = 'all'; _diff = 'all'; _pattern = 'all'; _collection = 'all'; _shown = _CAP;
  const page = document.getElementById('page-library');
  if (page) page.innerHTML = renderLibrary();
};

window.libCloseCreate = () => {
  document.getElementById('create-ex-modal')?.remove();
  document.body.style.overflow = '';
};

window.libOpenCreate = () => {
  document.getElementById('create-ex-modal')?.remove();
  _createGroups.clear();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'create-ex-modal';
  overlay.innerHTML = `
<div class="modal" style="max-width:440px" onclick="event.stopPropagation()">
  <div class="modal-head">
    <div><div class="label" style="margin-bottom:4px">Your Library</div><div class="display" style="font-size:1.3rem">CREATE EXERCISE</div></div>
    <button class="modal-close" onclick="libCloseCreate()" aria-label="Close">✕</button>
  </div>
  <div class="modal-body">
    <label class="label">Name</label>
    <input id="create-name" class="lib-search" style="margin:6px 0 14px" placeholder="e.g. Landmine Press" autofocus>
    <div class="g2" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
      <div>
        <label class="label">Type</label>
        <select id="create-type" class="form-input" style="width:100%;margin-top:6px">
          <option value="compound">Compound</option>
          <option value="isolation">Isolation</option>
        </select>
      </div>
      <div>
        <label class="label">Level</label>
        <select id="create-diff" class="form-input" style="width:100%;margin-top:6px">
          <option value="beg">Beginner</option>
          <option value="int" selected>Intermediate</option>
          <option value="adv">Advanced</option>
        </select>
      </div>
    </div>
    <label class="label">Equipment</label>
    <select id="create-equip" class="form-input" style="width:100%;margin:6px 0 14px">
      ${EQUIPMENT_OPTIONS.map(o => `<option value="${o.id}">${o.label}</option>`).join('')}
    </select>
    <label class="label">Muscle groups</label>
    <div id="create-grps" class="lib-chips" style="margin-top:6px">
      ${MUSCLE_GROUPS.map(g => `<button class="lib-chip" data-grp="${g.id}" style="--chip:${g.color}" onclick="libToggleCreateGrp('${g.id}')">${g.icon} ${g.label}</button>`).join('')}
    </div>
    <button class="btn btn-fire btn-lg w100" style="margin-top:18px" onclick="libSaveCreate()">Save Exercise</button>
  </div>
</div>`;
  overlay.addEventListener('click', () => window.libCloseCreate());
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  document.getElementById('create-name')?.focus();
};

export function renderLibrary() {
  const total = Object.keys(EXERCISES).length;
  return `
${pageHeader('Exercise Library', { eyebrow: 'Reference', sub: `${total} exercises · cues, mistakes & demos — tap any card` })}

<div style="display:flex;gap:8px;align-items:center;margin-bottom:var(--s-4)">
  <input type="search" class="lib-search" style="margin:0;flex:1" placeholder="Search exercises… (press / anywhere)"
         value="${attr(_q)}" oninput="libSetQ(this.value)" aria-label="Search exercises">
  <button class="btn btn-fire" style="white-space:nowrap" onclick="libOpenCreate()">＋ Create</button>
</div>

<div class="lib-filters">
  <div id="lib-collection-seg" class="seg" style="margin-bottom:10px">
    <button class="seg-btn ${_collection === 'all' ? 'active' : ''}" data-collection="all" onclick="libSetCollection('all')" aria-pressed="${_collection === 'all'}">All exercises</button>
    <button class="seg-btn ${_collection === 'coached' ? 'active' : ''}" data-collection="coached" onclick="libSetCollection('coached')" aria-pressed="${_collection === 'coached'}">New coached movements · ${Object.values(EXERCISES).filter(e => e.coached).length}</button>
  </div>
  <div id="lib-pattern-seg" class="seg lib-pattern-seg" style="margin-bottom:10px">
    <button class="seg-btn ${_pattern === 'all' ? 'active' : ''}" data-pattern="all" onclick="libSetPattern('all')" aria-pressed="${_pattern === 'all'}">All patterns</button>
    ${MOVEMENT_PATTERNS.map(p => `<button class="seg-btn ${_pattern === p.id ? 'active' : ''}" data-pattern="${p.id}" onclick="libSetPattern('${p.id}')" aria-pressed="${_pattern === p.id}">${p.label}</button>`).join('')}
  </div>
  <div id="lib-equip-seg" class="seg" style="margin-bottom:10px">
    <button class="seg-btn ${_equip === 'all' ? 'active' : ''}" data-equip="all" onclick="libSetEquip('all')">All Equipment</button>
    ${EQUIPMENT_OPTIONS.map(o => `
      <button class="seg-btn ${_equip === o.id ? 'active' : ''}" data-equip="${o.id}" onclick="libSetEquip('${o.id}')">${o.icon} ${o.label}</button>`).join('')}
  </div>
  <div id="lib-diff-seg" class="seg" style="margin-bottom:10px">
    ${DIFF_OPTIONS.map(o => `
      <button class="seg-btn ${_diff === o.id ? 'active' : ''}" data-diff="${o.id}" onclick="libSetDiff('${o.id}')">${o.label}</button>`).join('')}
  </div>
  <div id="lib-grp-chips" class="lib-chips">
    <button class="lib-chip ${_grp === 'all' ? 'active' : ''}" data-grp="all" onclick="libSetGrp('all')">All</button>
    ${MUSCLE_GROUPS.map(g => `
      <button class="lib-chip ${_grp === g.id ? 'active' : ''}" data-grp="${g.id}" style="--chip:${g.color}" onclick="libSetGrp('${g.id}')">${g.icon} ${g.label}</button>`).join('')}
  </div>
</div>

<div id="lib-results">${_resultsHTML()}</div>

<div class="dim fs11 tc" style="margin-top:28px;padding-top:14px;border-top:1px solid var(--border)">
  New coaching notes and pattern diagrams: Fitness Forge. Movement diagrams are schematic labels; use the written technique steps.<br>Imported exercise data &amp; images: <a href="https://github.com/yuhonas/free-exercise-db" target="_blank" rel="noopener" style="color:var(--text-2)">free-exercise-db</a> (public domain). Tutorials link to YouTube.
</div>
`;
}
