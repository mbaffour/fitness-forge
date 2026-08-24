// ═══════════════════════════════════════════
//   FITNESS FORGE — Shared UI Helpers
//   Tiny pure-function render helpers so pages
//   stop hand-rolling markup + inline styles.
//   Import what you need; everything returns an
//   HTML string.
// ═══════════════════════════════════════════

import { MUSCLE_GROUPS } from '../data/exercises.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Page header block (eyebrow label + title + optional subtitle).
export function pageHeader(title, { eyebrow = '', sub = '' } = {}) {
  return `
<div class="page-header">
  ${eyebrow ? `<div class="label mb-2">${esc(eyebrow)}</div>` : ''}
  <h1 class="display page-title">${esc(title).toUpperCase()}</h1>
  ${sub ? `<div class="page-sub">${sub}</div>` : ''}
</div>`;
}

// Section header with the design-system underline rule (::after draws the line).
export function sectionHead(label) {
  return `<div class="sec-head">${esc(label)}</div>`;
}

// Generic card. `accent` adds the fire left-border; `pad` overrides padding.
export function card(inner, { accent = false, cls = '', style = '' } = {}) {
  return `<div class="card${accent ? ' card--active' : ''} ${cls}" ${style ? `style="${style}"` : ''}>${inner}</div>`;
}

// Compact stat tile. tone: fire | green | steel | ember.
export function statTile(value, label, { tone = 'fire', onClick = '' } = {}) {
  return `
<div class="stat s-${tone}" ${onClick ? `style="cursor:pointer" onclick="${onClick}"` : ''}>
  <div class="label">${esc(label)}</div>
  <div class="stat-val" style="font-size:28px">${value}</div>
</div>`;
}

// Segmented control. items: [{id,label}], active id, and a JS onclick template
// where `%` is replaced by the item id (e.g. "window.setMode('%')").
export function segGroup(items, activeId, onClickTpl) {
  return `<div class="seg">${items.map(it => {
    const on = it.id === activeId ? ' active' : '';
    const oc = onClickTpl.replace(/%/g, it.id);
    return `<button class="seg-btn${on}" onclick="${oc}">${esc(it.label)}</button>`;
  }).join('')}</div>`;
}

// Hub sub-tabs (bottom-border style).
export function hubTabs(items, activeId, onClickTpl) {
  return `<div class="hub-tabs">${items.map(it => {
    const on = it.id === activeId ? ' active' : '';
    const oc = onClickTpl.replace(/%/g, it.id);
    return `<button class="hub-tab${on}" onclick="${oc}">${it.icon ? `<span>${it.icon}</span>` : ''}${esc(it.label)}</button>`;
  }).join('')}</div>`;
}

// Primary CTA.
export function primaryBtn(label, onClick, { size = 'lg', cls = '' } = {}) {
  return `<button class="btn btn-fire btn-${size} ${cls}" onclick="${onClick}">${label}</button>`;
}

// Single muscle-group color chip (consolidated helper — replaces the two
// near-identical copies previously in pages.js and overload-mode.js).
export function muscleChip(groupId) {
  const g = MUSCLE_GROUPS.find(m => m.id === groupId);
  if (!g) return '';
  return `<span class="muscle-chip" style="--chip:${g.color}">${g.icon} ${esc(g.label)}</span>`;
}

export function chipRow(groupIds = []) {
  return `<div class="flex f-wrap gap-1">${groupIds.map(muscleChip).join('')}</div>`;
}

// Empty / zero-state block.
export function emptyState(icon, msg, cta = '') {
  return `<div class="card tc p-6"><div style="font-size:40px;margin-bottom:12px">${icon}</div><div class="dim fs13">${msg}</div>${cta ? `<div class="mt-4">${cta}</div>` : ''}</div>`;
}

// ── SHARED TOAST ──
// One transient bottom toast for lightweight confirmations. Rich celebration
// cards (PR / session summary) stay bespoke; this replaces the ad-hoc inline
// toasts. type: 'fire' (default) | 'green' | 'danger'.
export function toast(msg, { type = 'fire', ms = 3000 } = {}) {
  let t = document.getElementById('forge-toast');
  if (!t) { t = document.createElement('div'); t.id = 'forge-toast'; t.className = 'forge-toast'; document.body.appendChild(t); }
  t.dataset.type = type;
  t.textContent = msg;
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(t._hideTimer);
  t._hideTimer = setTimeout(() => t.classList.remove('show'), ms);
}
if (typeof window !== 'undefined') window.forgeToast = toast;
