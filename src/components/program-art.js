// Original inline illustrations, available offline in every theme.
const paths = {
  strength: '<path d="M25 60h110M40 38v44m10-51v58m60-58v58m10-51v44"/><path class="pg-art-accent" d="M50 47h60v26H50z"/>',
  skill: '<path d="M24 25h112M38 25v14m84-14v14M58 37l12 23h20l12-23M80 60v22m0 0-18 23m18-23 18 23"/><circle cx="80" cy="47" r="8"/>',
  physique: '<path d="M58 35l-17 9-10 24 17 13 12-19m42-27 17 9 10 24-17 13-12-19M60 62v42h40V62"/><path class="pg-art-accent" d="M60 74h40m-20 0v30"/><circle cx="80" cy="30" r="11"/>',
  event: '<path d="M26 102h110M60 50l20-10 23 19 23 2M80 40l-7 31-20 29m20-29 27 6 12 23M60 50 47 68"/><circle cx="87" cy="23" r="10"/><path class="pg-art-accent" d="M27 35h23m-30 12h23m-18 12h16"/>',
  health: '<path d="M25 68h28l10-23 17 45 17-35 10 13h28"/><path class="pg-art-accent" d="M48 28c-12 0-21 10-21 22 0 26 53 59 53 59s53-33 53-59c0-12-9-22-21-22-16 0-24 10-32 20-8-10-16-20-32-20z"/>',
};
export function programArt(category) {
  return `<svg class="pg-art" viewBox="0 0 160 125" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path class="pg-art-grid" d="M16 16h128v96H16zM16 48h128M16 80h128M48 16v96M80 16v96M112 16v96"/>${paths[category === 'routine' ? 'strength' : category] || paths.health}</svg>`;
}
