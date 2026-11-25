/** Shorthand for document.querySelector, shared by every script. */
const $ = (s) => document.querySelector(s);
/**
 * Sudoku engine: board geometry, candidate maths, puzzle generation and the
 * human-style logic solver used to grade difficulty.
 *
 * Cells are indexed 0-80 (row-major). Candidate sets are 10-bit masks where
 * bit v (1-9) means "digit v is still possible"; 0x3FE is "all nine".
 * No DOM access here, so it can be tested on its own.
 */
const pc = (m) => {
  let n = 0;
  while (m) {
    m &= m - 1;
    n++;
  }
  return n;
};
const P = [],
  U = [];
for (let i = 0; i < 81; i++) {
  const r = (i / 9) | 0,
    c = i % 9,
    s = new Set(),
    br = r - (r % 3),
    bc = c - (c % 3);
  for (let k = 0; k < 9; k++) {
    s.add(r * 9 + k);
    s.add(k * 9 + c);
  }
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) s.add((br + a) * 9 + bc + b);
  s.delete(i);
  P.push([...s]);
}
const UR = [],
  UC = [],
  UB = [];
for (let k = 0; k < 9; k++) {
  const r = [],
    c = [],
    b = [];
  for (let j = 0; j < 9; j++) {
    r.push(k * 9 + j);
    c.push(j * 9 + k);
    b.push((((k / 3) | 0) * 3 + ((j / 3) | 0)) * 9 + (k % 3) * 3 + (j % 3));
  }
  UR.push(r);
  UC.push(c);
  UB.push(b);
}
U.push(...UR, ...UC, ...UB);
const cand = (g, i) => {
  let m = 0;
  for (const p of P[i]) if (g[p]) m |= 1 << g[p];
  return 0x3fe & ~m;
};
const shuf = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
function pick(g) {
  let b = -1,
    bm = 0,
    bn = 10;
  for (let i = 0; i < 81; i++)
    if (!g[i]) {
      const m = cand(g, i),
        n = pc(m);
      if (n < bn) {
        bn = n;
        b = i;
        bm = m;
        if (n < 2) break;
      }
    }
  return [b, bm];
}
function count(g, lim) {
  const [b, m] = pick(g);
  if (b < 0) return 1;
  let t = 0;
  for (let v = 1; v < 10; v++)
    if ((m >> v) & 1) {
      g[b] = v;
      t += count(g, lim - t);
      g[b] = 0;
      if (t >= lim) break;
    }
  return t;
}
function fill(g) {
  const [b, m] = pick(g);
  if (b < 0) return true;
  for (const v of shuf([1, 2, 3, 4, 5, 6, 7, 8, 9]))
    if ((m >> v) & 1) {
      g[b] = v;
      if (fill(g)) return true;
      g[b] = 0;
    }
  return false;
}
const combos = (a, k, s = 0, c = [], o = []) => {
  if (c.length === k) {
    o.push(c.slice());
    return o;
  }
  for (let i = s; i < a.length; i++) {
    c.push(a[i]);
    combos(a, k, i + 1, c, o);
    c.pop();
  }
  return o;
};
// Human-style logic solver. Returns [hardest level used, # of level-3 steps], or [0,0] if it gets stuck.
// L1 singles | L2 locked candidates, pairs | L3 triples, X-Wing, Swordfish, XY-Wing
function grade(g, max) {
  const V = g.slice(),
    C = V.map((v, i) => (v ? 0 : cand(V, i)));
  let top = 1,
    n3 = 0,
    fl = -1,
    left = V.filter((v) => !v).length;
  const place = (i, v) => {
    V[i] = v;
    C[i] = 0;
    left--;
    for (const p of P[i]) C[p] &= ~(1 << v);
  };
  const el = (i, m) => {
    if (C[i] & m) {
      C[i] &= ~m;
      return true;
    }
    return false;
  };
  const t1 = () => {
    let ch = false;
    for (let i = 0; i < 81; i++)
      if (!V[i] && pc(C[i]) === 1) {
        place(i, 31 - Math.clz32(C[i]));
        ch = true;
      }
    if (ch) return true;
    for (const u of U)
      for (let v = 1; v < 10; v++) {
        if (u.some((i) => V[i] === v)) continue;
        const s = u.filter((i) => (C[i] >> v) & 1);
        if (s.length === 1) {
          place(s[0], v);
          return true;
        }
      }
    return false;
  };
  const t2 = () => {
    let ch = false;
    for (let a = 0; a < 18; a++)
      for (let b = 18; b < 27; b++) {
        const x = U[a].filter((i) => U[b].includes(i));
        if (x.length !== 3) continue;
        const ra = U[a].filter((i) => !x.includes(i)),
          rb = U[b].filter((i) => !x.includes(i));
        for (let v = 1; v < 10; v++) {
          const m = 1 << v,
            inX = x.some((i) => C[i] & m),
            inA = ra.some((i) => C[i] & m),
            inB = rb.some((i) => C[i] & m);
          if (inX && !inA && inB) for (const i of rb) ch = el(i, m) || ch;
          if (inX && !inB && inA) for (const i of ra) ch = el(i, m) || ch;
        }
      }
    return ch;
  };
  const nk = (k) => {
    let ch = false;
    for (const u of U) {
      const e = u.filter((i) => !V[i] && pc(C[i]) <= k && C[i]);
      if (e.length < k) continue;
      for (const cb of combos(e, k)) {
        let m = 0;
        for (const i of cb) m |= C[i];
        if (pc(m) === k) for (const i of u) if (!V[i] && !cb.includes(i)) ch = el(i, m) || ch;
      }
    }
    return ch;
  };
  const hd = (k) => {
    let ch = false;
    for (const u of U) {
      const ds = [];
      for (let v = 1; v < 10; v++) if (!u.some((i) => V[i] === v)) ds.push(v);
      for (const cb of combos(ds, k)) {
        let dm = 0;
        for (const v of cb) dm |= 1 << v;
        const cs = u.filter((i) => C[i] & dm);
        if (cs.length === k && cb.every((v) => cs.some((i) => (C[i] >> v) & 1)))
          for (const i of cs) ch = el(i, ~dm & 0x3fe) || ch;
      }
    }
    return ch;
  };
  const fish = (k) => {
    let ch = false;
    for (let v = 1; v < 10; v++) {
      const m = 1 << v;
      for (const o of [0, 1]) {
        const base = [];
        for (let r = 0; r < 9; r++) {
          const cs = [];
          for (let c = 0; c < 9; c++) {
            const i = o ? c * 9 + r : r * 9 + c;
            if (C[i] & m) cs.push(c);
          }
          if (cs.length >= 2 && cs.length <= k) base.push([r, cs]);
        }
        for (const cb of combos(base, k)) {
          const cov = new Set(cb.flatMap((x) => x[1]));
          if (cov.size !== k) continue;
          const rs = cb.map((x) => x[0]);
          for (const c of cov)
            for (let r = 0; r < 9; r++)
              if (!rs.includes(r)) ch = el(o ? c * 9 + r : r * 9 + c, m) || ch;
        }
      }
    }
    return ch;
  };
  const xy = () => {
    let ch = false;
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
          for (const i of P[a]) if (i !== p && i !== b && P[b].includes(i)) ch = el(i, sh) || ch;
        }
    }
    return ch;
  };
  const T = [
    [1, t1],
    [2, t2],
    [2, () => nk(2)],
    [2, () => hd(2)],
    [3, () => nk(3)],
    [3, () => hd(3)],
    [3, () => fish(2)],
    [3, xy],
    [3, () => fish(3)],
  ].filter((x) => x[0] <= max);
  while (left > 0) {
    let ok = false;
    for (const [l, f] of T) {
      const L0 = left;
      if (f()) {
        ok = true;
        if (l > top) top = l;
        if (l === 3) {
          n3++;
          if (fl < 0) fl = L0;
        }
        break;
      }
    }
    if (!ok) return [0, 0, 0];
  }
  return [top, n3, fl];
}
// Puzzles are only kept if the logic solver (and so a human) can solve them without guessing,
// and the requested level is the hardest technique needed. Logic-solvable => unique solution.
function generate(d) {
  const want = { easy: 1, medium: 2, hard: 3 }[d],
    floor = { easy: 38, medium: 28, hard: 0 }[d];
  let best = null,
    bs = -1e9;
  const t0 = Date.now();
  for (let a = 0; a < (d === 'hard' ? 400 : 14); a++) {
    const sol = Array(81).fill(0);
    fill(sol);
    const g = sol.slice();
    let n = 81;
    for (const i of shuf([...Array(81).keys()])) {
      if (n <= floor) break;
      const v = g[i];
      g[i] = 0;
      if (grade(g, want)[0] === 0) g[i] = v;
      else n--;
    }
    const r = grade(g, want),
      sc = (r[0] === want ? 1000 : 0) + (d === 'hard' ? r[2] + 8 * r[1] : 0) - n;
    if (sc > bs) {
      bs = sc;
      best = { sol, puz: g };
    }
    if (d !== 'hard' && r[0] === want) break;
    if (d === 'hard' && r[0] === 3 && r[2] >= 44 && r[1] >= 2) break;
    if (Date.now() - t0 > (d === 'hard' ? 4500 : 2500)) break;
  }
  return best;
}
