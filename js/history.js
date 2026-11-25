/**
 * Undo / redo, plus a short flash that shows exactly which cells changed.
 * Also remembers eliminations the player made by hand so the same hint
 * is not offered twice (`syncPend`).
 */
// ---- Undo / redo, showing exactly what changed ----
let FL = {},
  flt = 0;
const cur = () => ({ v: S.vals.slice(), n: S.notes.slice(), e: S.elim.slice() });
function flash(label, a, b) {
  const w = (i) => 'R' + (((i / 9) | 0) + 1) + 'C' + ((i % 9) + 1),
    vi = [],
    na = [],
    nr = [];
  let first = -1,
    fv = -1;
  FL = {};
  for (let i = 0; i < 81; i++) {
    const vc = a.v[i] !== b.v[i],
      ad = b.n[i] & ~a.n[i],
      rm = a.n[i] & ~b.n[i];
    if (!vc && !ad && !rm) continue;
    if (first < 0) first = i;
    if (vc && fv < 0) fv = i;
    FL[i] = { a: ad, r: rm };
    if (vc) vi.push(b.v[i] ? `${w(i)} is now ${b.v[i]}` : `${w(i)}: ${a.v[i]} removed`);
    if (ad) na.push(`note ${dig(ad)} added to ${w(i)}`);
    if (rm) nr.push(`note ${dig(rm)} removed from ${w(i)}`);
  }
  const sm = (l, t) => (l.length > 3 ? `${l.length} ${t}` : l.join('; '));
  const parts = [
    sm(vi, 'cells changed'),
    sm(na, 'cells got notes added'),
    sm(nr, 'cells lost notes'),
  ].filter(Boolean);
  msg(`${label}: ${parts.join('; ') || 'nothing changed'}. (dashed = changed)`);
  if (fv >= 0) sel = fv;
  else if (first >= 0) sel = first;
  render();
  clearTimeout(flt);
  flt = setTimeout(() => {
    FL = {};
    render();
  }, 4000);
}
function restore(h) {
  S.vals = h.v;
  S.notes = h.n;
  S.elim = h.e;
  HX = null;
}
$('#undo').onclick = () => {
  if (S.done || paused) return;
  const h = S.hist.pop();
  if (!h) return;
  const c = cur();
  S.redo.push(c);
  restore(h);
  flash('Undo', c, h);
};
$('#redo').onclick = () => {
  if (S.done || paused) return;
  const h = S.redo.pop();
  if (!h) return;
  const c = cur();
  S.hist.push(c);
  restore(h);
  flash('Redo', c, h);
};
// If you make a hinted removal yourself, remember it so the same hint doesn't come back
let PEND = { s: null, l: [] };
function syncPend() {
  if (PEND.s !== S) return;
  for (const [i, m, f] of PEND.l) {
    const n = S.notes[i];
    if (!S.vals[i] && n) {
      const r = (f || m) & ~n;
      if (r) S.elim[i] |= r;
    }
  }
}
