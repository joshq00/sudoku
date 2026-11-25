/**
 * Hint engine. Order of preference: a wrong entry, a naked single, a
 * hidden single, then the simplest advanced technique (locked candidates,
 * pairs, triples, X-Wing, XY-Wing, Swordfish). Pattern hints return the cells
 * to highlight (`pat`) and the candidates to remove (`elims`).
 */
// ---- Hints: singles first, then the simplest advanced technique, with its cells highlighted ----
const dig = (m) => {
  const o = [];
  for (let v = 1; v < 10; v++) if ((m >> v) & 1) o.push(v);
  return o.join(' and ');
};
const eff = (i) => (S.vals[i] ? 0 : cand(S.vals, i) & ~S.elim[i]);
function findTech() {
  const C = [...Array(81).keys()].map(eff),
    V = S.vals,
    nm = ['row', 'column', 'box'];
  const mk = (name, pat, m, cells, why) => {
    const el = [];
    let dm = 0;
    for (const i of cells) {
      const e = C[i] & m & (S.notes[i] || 0x3fe);
      if (!pat.includes(i) && e) {
        el.push([i, e, C[i] & m]);
        dm |= e;
      }
    }
    return el.length ? { name, pat, tgt: el.map((x) => x[0]), elims: el, dm, why } : null;
  };
  const locked = () => {
    for (let a = 0; a < 18; a++)
      for (let b = 18; b < 27; b++) {
        const x = U[a].filter((i) => U[b].includes(i));
        if (x.length !== 3) continue;
        const ra = U[a].filter((i) => !x.includes(i)),
          rb = U[b].filter((i) => !x.includes(i)),
          ln = nm[(a / 9) | 0];
        for (let v = 1; v < 10; v++) {
          const m = 1 << v,
            xs = x.filter((i) => C[i] & m);
          if (!xs.length) continue;
          const inA = ra.some((i) => C[i] & m),
            inB = rb.some((i) => C[i] & m);
          let r = null;
          if (!inA && inB)
            r = mk(
              'Locked candidates',
              xs,
              m,
              rb,
              `In this ${ln}, ${v} can only go in the highlighted cells, and they all share one box. So ${v} can’t be anywhere else in that box.`,
            );
          else if (!inB && inA)
            r = mk(
              'Locked candidates',
              xs,
              m,
              ra,
              `In this box, ${v} can only go in the highlighted cells, and they all share one ${ln}. So ${v} can’t be anywhere else in that ${ln}.`,
            );
          if (r) return r;
        }
      }
    return null;
  };
  const naked = (k) => {
    for (let ui = 0; ui < 27; ui++) {
      const u = U[ui],
        e = u.filter((i) => C[i] && pc(C[i]) <= k);
      for (const cb of combos(e, k)) {
        let m = 0;
        for (const i of cb) m |= C[i];
        if (pc(m) === k) {
          const r = mk(
            k == 2 ? 'Naked pair' : 'Naked triple',
            cb,
            m,
            u,
            `These ${k} cells can only hold ${dig(m)} between them, so those digits can’t go anywhere else in this ${nm[(ui / 9) | 0]}.`,
          );
          if (r) return r;
        }
      }
    }
    return null;
  };
  const hidden = (k) => {
    for (let ui = 0; ui < 27; ui++) {
      const u = U[ui],
        ds = [];
      for (let v = 1; v < 10; v++) if (!u.some((i) => V[i] === v)) ds.push(v);
      for (const cb of combos(ds, k)) {
        let dm = 0;
        for (const v of cb) dm |= 1 << v;
        const cs = u.filter((i) => C[i] & dm);
        if (cs.length === k && cb.every((v) => cs.some((i) => (C[i] >> v) & 1))) {
          const el = [];
          let x = 0;
          for (const i of cs) {
            const y = C[i] & ~dm;
            if (y) {
              el.push([i, y]);
              x |= y;
            }
          }
          if (el.length)
            return {
              name: k == 2 ? 'Hidden pair' : 'Hidden triple',
              pat: cs,
              tgt: cs,
              elims: el,
              dm: x,
              why: `In this ${nm[(ui / 9) | 0]}, ${dig(dm)} can only go in these ${k} cells, so every other candidate can be removed from them.`,
            };
        }
      }
    }
    return null;
  };
  const fish = (k) => {
    for (let v = 1; v < 10; v++) {
      const m = 1 << v;
      for (const o of [0, 1]) {
        const base = [];
        for (let r = 0; r < 9; r++) {
          const cs = [];
          for (let c = 0; c < 9; c++) if (C[o ? c * 9 + r : r * 9 + c] & m) cs.push(c);
          if (cs.length >= 2 && cs.length <= k) base.push([r, cs]);
        }
        for (const cb of combos(base, k)) {
          const cov = [...new Set(cb.flatMap((x) => x[1]))];
          if (cov.length !== k) continue;
          const rs = cb.map((x) => x[0]),
            pat = [],
            cells = [];
          for (const [r, cs] of cb) for (const c of cs) pat.push(o ? c * 9 + r : r * 9 + c);
          for (const c of cov)
            for (let r = 0; r < 9; r++) if (!rs.includes(r)) cells.push(o ? c * 9 + r : r * 9 + c);
          const ln = o ? 'columns' : 'rows',
            cl = o ? 'rows' : 'columns';
          const res = mk(
            k == 2 ? 'X-Wing' : 'Swordfish',
            pat,
            m,
            cells,
            `In ${k} ${ln}, ${v} only has ${k} possible spots, and they line up in the same ${k} ${cl}. ${v} has to fill one in each, so it can’t be anywhere else in those ${cl}.`,
          );
          if (res) return res;
        }
      }
    }
    return null;
  };
  const xyw = () => {
    for (let p = 0; p < 81; p++) {
      if (pc(C[p]) !== 2) continue;
      const pm = C[p],
        ws = P[p].filter((i) => pc(C[i]) === 2);
      for (const a of ws)
        for (const b of ws) {
          if (a >= b) continue;
          const ca = C[a],
            cb = C[b];
          if (pc(ca & pm) !== 1 || pc(cb & pm) !== 1 || (ca & pm) === (cb & pm)) continue;
          const sh = ca & cb & ~pm;
          if (pc(sh) !== 1) continue;
          const r = mk(
            'XY-Wing',
            [p, a, b],
            sh,
            P[a].filter((i) => i !== p && i !== b && P[b].includes(i)),
            `Whichever way the middle cell goes, one of the two wing cells must be ${dig(sh)}. So ${dig(sh)} can’t be in any cell that sees both wings.`,
          );
          if (r) return r;
        }
    }
    return null;
  };
  for (const f of [
    () => naked(2),
    locked,
    () => hidden(2),
    () => naked(3),
    () => hidden(3),
    () => fish(2),
    xyw,
    () => fish(3),
  ]) {
    const r = f();
    if (r) return r;
  }
  return null;
}
function findHint() {
  const V = S.vals,
    nm = ['row', 'column', 'box'],
    base = { pat: [], tgt: [], dm: 0 };
  for (let i = 0; i < 81; i++)
    if (wrong(i))
      return { ...base, i, fix: true, name: 'Mistake', why: 'This number doesn’t belong here.' };
  for (let i = 0; i < 81; i++)
    if (!V[i]) {
      const m = eff(i);
      if (pc(m) === 1)
        return {
          ...base,
          i,
          v: 31 - Math.clz32(m),
          name: 'Naked single',
          why: 'Every other number is ruled out by this cell’s row, column and box.',
        };
    }
  for (let u = 0; u < 27; u++)
    for (let v = 1; v < 10; v++) {
      if (U[u].some((i) => V[i] === v)) continue;
      const s = U[u].filter((i) => !V[i] && (eff(i) >> v) & 1);
      if (s.length === 1)
        return {
          ...base,
          i: s[0],
          v,
          pat: U[u],
          name: 'Hidden single',
          why: `${v} can only go in one place in this ${nm[(u / 9) | 0]}.`,
        };
    }
  const t = findTech();
  if (t) return { ...t, i: -1 };
  const e = [...Array(81).keys()].filter((i) => !V[i]);
  const i = e[(Math.random() * e.length) | 0];
  return {
    ...base,
    i,
    v: S.sol[i],
    name: 'No simple step',
    why: 'Nothing logical turned up, so this one comes from the solution.',
  };
}
$('#hint').onclick = () => {
  if (S.done || paused) return;
  if (HX) {
    const h = HX;
    snap();
    S.hints++;
    HX = null;
    if (h.elims) {
      for (const [i, m, f] of h.elims) {
        S.elim[i] |= f || m;
        if (!S.notes[i]) S.notes[i] = cand(S.vals, i);
        S.notes[i] &= ~S.elim[i];
      }
      msg(
        `Removed ${dig(h.dm)} from ${h.elims.length} cell${h.elims.length > 1 ? 's' : ''} (notes updated). Hint again for the next step.`,
      );
    } else if (h.fix) {
      S.vals[h.i] = 0;
      msg('');
    } else {
      sel = h.i;
      S.vals[h.i] = h.v;
      S.notes[h.i] = 0;
      if ($('#oClean').checked) for (const p of P[h.i]) S.notes[p] &= ~(1 << h.v);
      msg('');
    }
    render();
    check();
    return;
  }
  syncPend();
  const h = findHint();
  HX = h;
  PEND = { s: S, l: h.elims ? h.elims.slice() : [] };
  if (h.i >= 0) sel = h.i;
  msg(
    `${h.name}: ${h.why} Press Hint again to ${h.elims ? 'apply it' : h.fix ? 'clear it' : 'reveal it'}.${h.elims ? ' (Yellow = pattern, red = remove.)' : ''}`,
  );
  render();
};
