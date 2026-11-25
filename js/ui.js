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

// Build stamp: show when the deployed commit was made, in the viewer's local time.
// Without a stamped value (local development) it just says "dev build".
(() => {
  const el = $('#build');
  const when = Date.parse(el.dataset.commit);
  el.textContent = Number.isNaN(when)
    ? 'dev build'
    : `${new Date(when).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} \u00b7 ${el.dataset.sha}`;
})();

// ---- Seeds: copy/share the current puzzle, or load someone else's ----
const seedLink = () => {
  const url = new URL(location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('seed', S.seed);
  return url.toString();
};

/** Copies text to the clipboard (with a fallback for older browsers). Resolves true/false. */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e2) {}
    ta.remove();
    return ok;
  }
}

/** Briefly replaces a button's label, e.g. "Copied!". */
function flashLabel(btn, text) {
  const old = btn.dataset.label || btn.textContent;
  btn.dataset.label = old;
  btn.textContent = text;
  setTimeout(() => (btn.textContent = old), 1500);
}

$('#copySeed').addEventListener('click', async (e) => {
  flashLabel(e.currentTarget, (await copyText(S.seed)) ? 'Copied!' : 'Press & hold');
});

/** Last resort when the browser blocks sharing and copying: show the link to long-press. */
function showLink(url) {
  const out = $('#linkOut');
  $('#linkBox').hidden = false;
  out.value = url;
  out.focus();
  out.select();
  out.setSelectionRange(0, url.length);
}

$('#shareSeed').addEventListener('click', async (e) => {
  const btn = e.currentTarget,
    url = seedLink();
  $('#linkBox').hidden = true;
  if (navigator.share) {
    // Phones: open the native share sheet. Cancelling it is fine and needs no fallback.
    try {
      await navigator.share({ title: 'Sudoku', text: 'Try this Sudoku (' + S.seed + ')', url });
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
  }
  if (await copyText(url)) flashLabel(btn, 'Link copied!');
  else showLink(url);
});

$('#seedForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const parsed = parseSeed($('#seedIn').value);
  const err = $('#seedErr');
  if (!parsed) {
    err.textContent = 'That is not a valid seed. Seeds look like M-7K3F2Q.';
    err.hidden = false;
    return;
  }
  err.hidden = true;
  $('#seedIn').value = '';
  menuOpen(false);
  setDiff(parsed.difficulty);
  newGame(parsed.seed);
});
$('#seedIn').addEventListener('input', () => ($('#seedErr').hidden = true));
