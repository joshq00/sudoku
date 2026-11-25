/**
 * Wiring that sits around the board: keyboard shortcuts, header controls
 * (pause, settings menu, theme) and persisted preferences (localStorage).
 */
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey) {
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) {
      e.preventDefault();
      $('#undo').click();
    } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
      e.preventDefault();
      $('#redo').click();
    }
    return;
  }
  if (/^[1-9]$/.test(e.key)) input(+e.key);
  else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') erase();
  else if (e.key === 'n' || e.key === 'N' || e.key === ' ') {
    e.preventDefault();
    noteMode = !noteMode;
    render();
  } else if (e.key === 'h' || e.key === 'H') $('#hint').click();
  else if (e.key.startsWith('Arrow')) {
    e.preventDefault();
    if (sel < 0) sel = 0;
    let r = (sel / 9) | 0,
      c = sel % 9;
    if (e.key === 'ArrowUp') r = (r + 8) % 9;
    if (e.key === 'ArrowDown') r = (r + 1) % 9;
    if (e.key === 'ArrowLeft') c = (c + 8) % 9;
    if (e.key === 'ArrowRight') c = (c + 1) % 9;
    sel = r * 9 + c;
    hintI = -1;
    render();
  }
});

// ---- header controls, settings menu, theme ----
const ICON_PAUSE =
    '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
  ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
$('#pz').innerHTML = ICON_PAUSE;
$('#pz').onclick = () => {
  if (S.done) return;
  paused = !paused;
  board.classList.toggle('pause', paused);
  $('#pz').innerHTML = paused ? ICON_PLAY : ICON_PAUSE;
  $('#pz').setAttribute('aria-label', paused ? 'Resume' : 'Pause');
};
const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem('sdk.' + k);
      return v === null ? d : JSON.parse(v);
    } catch (e) {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem('sdk.' + k, JSON.stringify(v));
    } catch (e) {}
  },
};
function setTheme(t) {
  store.set('theme', t);
  const r = document.documentElement;
  t === 'auto' ? r.removeAttribute('data-theme') : r.setAttribute('data-theme', t);
  $('#theme')
    .querySelectorAll('[data-t]')
    .forEach((b) => b.classList.toggle('on', b.dataset.t === t));
  requestAnimationFrame(() => {
    const bg = getComputedStyle(document.body).backgroundColor;
    document.querySelectorAll('meta[name=theme-color]').forEach((m) => {
      m.removeAttribute('media');
      m.setAttribute('content', bg);
    });
  });
}
$('#theme')
  .querySelectorAll('[data-t]')
  .forEach((b) => (b.onclick = () => setTheme(b.dataset.t)));
try {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () =>
    setTheme(store.get('theme', 'auto')),
  );
} catch (e) {}
setTheme(store.get('theme', 'auto'));
for (const id of ['oErr', 'oClean', 'oPeer', 'oTint']) {
  const e = $('#' + id);
  e.checked = store.get(id, true);
  e.addEventListener('change', () => store.set(id, e.checked));
}
board.classList.toggle('notint', !$('#oTint').checked);
const menu = $('#menu'),
  gear = $('#gear');
const menuOpen = (o) => {
  menu.classList.toggle('open', o);
  gear.setAttribute('aria-expanded', o);
};
gear.onclick = () => menuOpen(!menu.classList.contains('open'));
document.addEventListener('pointerdown', (e) => {
  if (menu.classList.contains('open') && !menu.contains(e.target) && !gear.contains(e.target))
    menuOpen(false);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') menuOpen(false);
});
$('#trim').addEventListener('click', () => menuOpen(false));
