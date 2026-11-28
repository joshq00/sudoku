/**
 * Game state and rendering: board DOM, number input, notes, errors,
 * timer, win detection and the Auto/Trim notes tools.
 *
 * State lives in the global `S` (one object per game) plus a few UI globals
 * (`sel`, `noteMode`, `paused`, `HX` = current hint).
 */
let S = {},
  diff = 'medium',
  sel = -1,
  noteMode = false,
  HX = null,
  tick = null,
  paused = false;
Object.defineProperty(window, 'hintI', {
  get() {
    return HX ? HX.i : -1;
  },
  set(v) {
    if (v < 0) HX = null;
  },
});
const board = $('#board'),
  cells = [];
for (let i = 0; i < 81; i++) {
  const d = document.createElement('div');
  d.className = 'c';
  d.onclick = () => {
    if (!S.vals) return;
    sel = i;
    hintI = -1;
    render();
  };
  board.appendChild(d);
  cells.push(d);
}
const pad = $('#pad');
for (let v = 1; v <= 9; v++) {
  const b = document.createElement('button');
  b.textContent = v;
  b.dataset.v = v;
  b.onclick = () => input(v);
  pad.appendChild(b);
}

/** Starts a new game at the current difficulty. Pass a seed string to replay a specific puzzle. */
function newGame(seed) {
  clearInterval(tick);
  $('#ov').classList.remove('show');
  msg('Generating a ' + diff + ' puzzle…');
  board.style.opacity = 0.4;
  setTimeout(() => {
    const g = generate(diff, typeof seed === 'string' ? seed : undefined);
    board.style.opacity = 1;
    start(g);
  }, 30);
}
function start({ sol, puz, seed }) {
  S = {
    seed,
    sol,
    given: puz.map((v) => v > 0),
    vals: puz.slice(),
    notes: Array(81).fill(0),
    elim: Array(81).fill(0),
    redo: [],
    hist: [],
    mist: 0,
    hints: 0,
    t: 0,
    done: false,
  };
  begin(puz.findIndex((v) => !v));
}

// ---- Saving and resuming ----
// The whole game (board, notes, undo history, timer) is saved to localStorage after every
// change, so closing the app and coming back picks up exactly where you left off.
const SAVE_KEY = 'game';
const SAVE_VERSION = 1;
const HIST_KEPT = 60; // undo steps stored; older ones are dropped to keep the save small

/** Writes the current game to localStorage (silently does nothing if storage is blocked). */
function saveGame() {
  if (!S || !S.sol) return;
  if (S.done) {
    store.set(SAVE_KEY, null); // a finished puzzle is not resumed
    return;
  }
  store.set(SAVE_KEY, {
    v: SAVE_VERSION,
    noteMode,
    game: { ...S, hist: S.hist.slice(-HIST_KEPT), redo: S.redo.slice(-HIST_KEPT) },
  });
}

/** True when `g` looks like a complete, untampered saved game. */
function validSave(g) {
  const nine1 = (a, max) =>
    Array.isArray(a) &&
    a.length === 81 &&
    a.every((x) => Number.isInteger(x) && x >= 0 && x <= max);
  return (
    g &&
    typeof g.seed === 'string' &&
    nine1(g.sol, 9) &&
    nine1(g.vals, 9) &&
    nine1(g.notes, 0x3fe) &&
    nine1(g.elim, 0x3fe) &&
    Array.isArray(g.given) &&
    g.given.length === 81 &&
    Array.isArray(g.hist) &&
    Array.isArray(g.redo) &&
    Number.isFinite(g.t) &&
    !g.done
  );
}

/**
 * Restores the saved game, if there is a valid one. Returns true if it did.
 * Pass `onlySeed` to resume only when the saved puzzle has that seed.
 */
function resumeGame(onlySeed) {
  const saved = store.get(SAVE_KEY, null);
  if (!saved || saved.v !== SAVE_VERSION || !validSave(saved.game)) return false;
  if (onlySeed && saved.game.seed !== onlySeed) return false;
  S = saved.game;
  setDiff(SEED_LEVELS[S.seed[0]] || 'medium'); // the seed's first letter is the difficulty
  noteMode = !!saved.noteMode;
  begin(S.vals.findIndex((v) => !v));
  return true;
}

/** Shared by start() and resumeGame(): resets the UI around the current `S` and runs the timer. */
function begin(firstSel) {
  sel = firstSel;
  hintI = -1;
  paused = false;
  board.classList.remove('pause');
  $('#pz').innerHTML = ICON_PAUSE;
  $('#ov').classList.remove('show');
  msg('');
  $('#seedText').textContent = S.seed;
  clearInterval(tick);
  tick = setInterval(() => {
    if (!paused && !S.done) {
      S.t++;
      time();
      if (S.t % 5 === 0) saveGame(); // keep the saved clock close to the real one
    }
  }, 1000);
  time();
  render();
}
function time() {
  const t = S.t;
  $('#tm').textContent = ((t / 60) | 0) + ':' + String(t % 60).padStart(2, '0');
}
function msg(t) {
  $('#msg').textContent = t;
}
function snap() {
  S.hist.push({ v: S.vals.slice(), n: S.notes.slice(), e: S.elim.slice() });
  if (S.hist.length > 200) S.hist.shift();
  S.redo = [];
  FL = {};
}

function input(v) {
  if (S.done || paused || sel < 0 || S.given[sel]) return;
  hintI = -1;
  msg('');
  if (noteMode) {
    if (S.vals[sel]) return;
    snap();
    S.notes[sel] ^= 1 << v;
  } else {
    snap();
    if (S.vals[sel] === v) {
      S.vals[sel] = 0;
    } else {
      S.vals[sel] = v;
      S.notes[sel] = 0;
      if (v !== S.sol[sel]) S.mist++;
      if ($('#oClean').checked) for (const p of P[sel]) S.notes[p] &= ~(1 << v);
    }
  }
  render();
  check();
}
function erase() {
  if (S.done || paused || sel < 0 || S.given[sel]) return;
  if (!S.vals[sel] && !S.notes[sel]) return;
  snap();
  S.vals[sel] = 0;
  S.notes[sel] = 0;
  render();
}
function check() {
  if (S.vals.every((v, i) => v === S.sol[i])) {
    S.done = true;
    clearInterval(tick);
    saveGame(); // clears the saved game: a finished puzzle is not resumed
    $('#ovt').textContent =
      `${diff[0].toUpperCase() + diff.slice(1)} in ${$('#tm').textContent} with ${S.mist} mistake${S.mist == 1 ? '' : 's'} and ${S.hints} hint${S.hints == 1 ? '' : 's'}.`;
    setTimeout(() => $('#ov').classList.add('show'), 350);
  }
}

function conflict(i) {
  const v = S.vals[i];
  return v && P[i].some((p) => S.vals[p] === v);
}
function wrong(i) {
  return S.vals[i] && !S.given[i] && S.vals[i] !== S.sol[i];
}

function render() {
  saveGame();
  const sv = sel >= 0 ? S.vals[sel] : 0,
    showErr = $('#oErr').checked;
  const gh = {};
  if (HX && HX.elims) for (const [i, m] of HX.elims) gh[i] = (gh[i] || 0) | m;
  for (const i in FL) gh[i] = (gh[i] || 0) | FL[i].r;
  for (let i = 0; i < 81; i++) {
    const el = cells[i],
      v = S.vals[i];
    let cl = 'c';
    if (S.given[i]) cl += ' g';
    else if (v) cl += ' u';
    if (sel >= 0) {
      if (i === sel) cl += ' sel';
      else if (P[sel].includes(i) && $('#oPeer').checked) cl += ' p';
      if (sv && v === sv && i !== sel) cl += ' s2';
    }
    if (i === hintI && i !== sel) cl += ' hl';
    if (HX) {
      if (HX.pat.includes(i)) cl += ' hp';
      if (HX.tgt.includes(i)) cl += ' ht';
    }
    if (FL[i]) cl += ' fl';
    if (v && ((showErr && wrong(i)) || (!showErr && conflict(i)))) cl += ' bad';
    el.className = cl;
    if (v) el.textContent = v;
    else {
      const m = S.notes[i];
      let h = '';
      if (m || gh[i]) {
        h = '<div class="n">';
        for (let k = 1; k <= 9; k++)
          h += `<span class="${((gh[i] || 0) >> k) & 1 ? 'x' : sv === k && (m >> k) & 1 ? 'm' : ''}${(((FL[i] && FL[i].a) || 0) >> k) & 1 ? ' f' : ''}">${(m >> k) & 1 || ((gh[i] || 0) >> k) & 1 ? k : ''}</span>`;
        h += '</div>';
      }
      el.innerHTML = h;
    }
  }
  const cnt = Array(10).fill(0);
  S.vals.forEach((v) => cnt[v]++);
  pad.querySelectorAll('button').forEach((b) => b.classList.toggle('done', cnt[b.dataset.v] >= 9));
  $('#mist').textContent = 'Mistakes: ' + S.mist;
  $('#note').classList.toggle('on', noteMode);
  $('#hn').textContent = 'Hints: ' + S.hints;
  $('#undo').style.opacity = S.hist.length ? 1 : 0.4;
  $('#redo').style.opacity = S.redo.length ? 1 : 0.4;
}

$('#erase').onclick = erase;
$('#note').onclick = () => {
  noteMode = !noteMode;
  render();
};
$('#auto').onclick = () => {
  if (S.done || paused) return;
  snap();
  for (let i = 0; i < 81; i++) if (!S.vals[i]) S.notes[i] = cand(S.vals, i) & ~S.elim[i];
  msg('Filled in every possible candidate.');
  render();
};
$('#trim').onclick = () => {
  if (S.done || paused) return;
  snap();
  let n = 0;
  for (let i = 0; i < 81; i++) {
    if (S.vals[i]) {
      S.notes[i] = 0;
      continue;
    }
    const c = cand(S.vals, i),
      o = S.notes[i];
    S.notes[i] &= c;
    if (S.notes[i] !== o) n++;
  }
  msg(n ? `Cleaned up ${n} cell${n == 1 ? '' : 's'}.` : 'Nothing to trim.');
  render();
};
$('#ovn').onclick = () => newGame();
$('#ovc').onclick = () => $('#ov').classList.remove('show');
$('#oErr').onchange = render;
$('#oPeer').onchange = render;
$('#oTint').onchange = () => board.classList.toggle('notint', !$('#oTint').checked);
/** Selects a difficulty button and updates `diff` (does not start a game). */
function setDiff(d) {
  diff = d;
  document
    .querySelectorAll('#diff button')
    .forEach((x) => x.classList.toggle('on', x.dataset.d === d));
}
document.querySelectorAll('#diff button').forEach((b) => {
  b.onclick = () => {
    setDiff(b.dataset.d);
    newGame();
  };
});
