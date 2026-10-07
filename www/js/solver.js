/*
 * Motor de cálculo del Método Matricial de Rigidez (2D)
 * Soporta: cerchas (truss), vigas continuas (beam) y pórticos (frame).
 *
 * Unidades internas coherentes: kN, m  (E en kN/m², A en m², I en m⁴).
 * Convención de ejes locales: x a lo largo de la barra (nudo 1 -> nudo 2),
 * y perpendicular a la izquierda, giro antihorario (+).
 *
 * Funciona en el navegador (window.Solver) y en Node (module.exports).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Solver = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const EPS = 1e-9;

  /* ---------------------------------------------------------------- álgebra */
  const zeros = (r, c) => Array.from({ length: r }, () => new Array(c).fill(0));

  function matmul(A, B) {
    const n = A.length, m = B[0].length, p = B.length;
    const C = zeros(n, m);
    for (let i = 0; i < n; i++)
      for (let k = 0; k < p; k++) {
        const a = A[i][k];
        if (a === 0) continue;
        for (let j = 0; j < m; j++) C[i][j] += a * B[k][j];
      }
    return C;
  }

  const transpose = (A) => A[0].map((_, j) => A.map((row) => row[j]));
  const matvec = (A, x) => A.map((row) => row.reduce((s, a, j) => s + a * x[j], 0));

  /** Eliminación de Gauss con pivoteo parcial. Devuelve {x} o {singular: k}. */
  function solveLinear(A0, b0) {
    const n = b0.length;
    if (n === 0) return { x: [] };
    const A = A0.map((r) => r.slice());
    const b = b0.slice();
    let scale = 0;
    for (let i = 0; i < n; i++) scale = Math.max(scale, Math.abs(A[i][i]));
    if (scale === 0) return { singular: 0 };
    for (let k = 0; k < n; k++) {
      let piv = k, best = Math.abs(A[k][k]);
      for (let i = k + 1; i < n; i++) {
        if (Math.abs(A[i][k]) > best) { best = Math.abs(A[i][k]); piv = i; }
      }
      if (best < 1e-10 * scale) return { singular: k };
      if (piv !== k) { [A[k], A[piv]] = [A[piv], A[k]]; [b[k], b[piv]] = [b[piv], b[k]]; }
      for (let i = k + 1; i < n; i++) {
        const f = A[i][k] / A[k][k];
        if (f === 0) continue;
        for (let j = k; j < n; j++) A[i][j] -= f * A[k][j];
        b[i] -= f * b[k];
      }
    }
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let s = b[i];
      for (let j = i + 1; j < n; j++) s -= A[i][j] * x[j];
      x[i] = s / A[i][i];
    }
    return { x };
  }

  /* --------------------------------------------------- matrices de elemento */
  const DOF_NAMES = {
    truss: ['ux', 'uy'],
    beam: ['uy', 'rz'],
    frame: ['ux', 'uy', 'rz'],
  };

  function localK(kind, E, A, I, L) {
    if (kind === 'truss') {
      const a = (E * A) / L;
      return [[a, 0, -a, 0], [0, 0, 0, 0], [-a, 0, a, 0], [0, 0, 0, 0]];
    }
    const k1 = (E * I) / (L * L * L);
    if (kind === 'beam') {
      return [
        [12 * k1, 6 * L * k1, -12 * k1, 6 * L * k1],
        [6 * L * k1, 4 * L * L * k1, -6 * L * k1, 2 * L * L * k1],
        [-12 * k1, -6 * L * k1, 12 * k1, -6 * L * k1],
        [6 * L * k1, 2 * L * L * k1, -6 * L * k1, 4 * L * L * k1],
      ];
    }
    const a = (E * A) / L;
    return [
      [a, 0, 0, -a, 0, 0],
      [0, 12 * k1, 6 * L * k1, 0, -12 * k1, 6 * L * k1],
      [0, 6 * L * k1, 4 * L * L * k1, 0, -6 * L * k1, 2 * L * L * k1],
      [-a, 0, 0, a, 0, 0],
      [0, -12 * k1, -6 * L * k1, 0, 12 * k1, -6 * L * k1],
      [0, 6 * L * k1, 2 * L * L * k1, 0, -6 * L * k1, 4 * L * L * k1],
    ];
  }

  function transformT(kind, c, s) {
    if (kind === 'truss') {
      return [[c, s, 0, 0], [-s, c, 0, 0], [0, 0, c, s], [0, 0, -s, c]];
    }
    if (kind === 'beam') {
      return [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
    }
    return [
      [c, s, 0, 0, 0, 0],
      [-s, c, 0, 0, 0, 0],
      [0, 0, 1, 0, 0, 0],
      [0, 0, 0, c, s, 0],
      [0, 0, 0, -s, c, 0],
      [0, 0, 0, 0, 0, 1],
    ];
  }

  /* ------------------------------------------------------------ cargas en barra
   * Direcciones: 'gy' gravedad (+ hacia abajo), 'gx' horizontal global (+ a la
   * derecha), 'lx' a lo largo de la barra (+ de nudo 1 a 2), 'ly' perpendicular
   * local (+ a la izquierda del sentido de la barra).
   */
  function toLocal(dir, val, c, s) {
    let fx = 0, fy = 0;
    switch (dir) {
      case 'gy': fx = 0; fy = -val; break;
      case 'gx': fx = val; fy = 0; break;
      case 'lx': return [val, 0];
      case 'ly': return [0, val];
      default: throw new Error('Dirección de carga no válida: ' + dir);
    }
    return [fx * c + fy * s, -fx * s + fy * c];
  }

  /** Normaliza una carga de barra a componentes locales. */
  function normalizeLoad(kind, ld, L, c, s) {
    const t = ld.type;
    if (t === 'udl') {
      const [qx, qy] = toLocal(ld.dir || 'gy', Number(ld.w) || 0, c, s);
      return { type: 'udl', qx, qy };
    }
    if (t === 'point') {
      const a = Number(ld.a);
      if (!(a >= -EPS && a <= L + EPS)) throw new Error('La posición de una carga puntual debe estar dentro de la barra (0 ≤ a ≤ L).');
      const [Px, Py] = toLocal(ld.dir || 'gy', Number(ld.P) || 0, c, s);
      return { type: 'point', a: Math.min(Math.max(a, 0), L), Px, Py };
    }
    if (t === 'moment') {
      const a = Number(ld.a);
      if (!(a >= -EPS && a <= L + EPS)) throw new Error('La posición de un momento aplicado debe estar dentro de la barra.');
      return { type: 'moment', a: Math.min(Math.max(a, 0), L), M: Number(ld.M) || 0 };
    }
    throw new Error('Tipo de carga de barra no válido: ' + t);
  }

  /** Fuerzas de empotramiento perfecto (reacciones sobre la barra) [N1,V1,M1,N2,V2,M2]. */
  function fixedEnd6(L, ld) {
    const f = [0, 0, 0, 0, 0, 0];
    if (ld.type === 'udl') {
      const { qx, qy } = ld;
      f[0] = -qx * L / 2; f[3] = -qx * L / 2;
      f[1] = -qy * L / 2; f[4] = -qy * L / 2;
      f[2] = -qy * L * L / 12; f[5] = qy * L * L / 12;
    } else if (ld.type === 'point') {
      const a = ld.a, b = L - ld.a, { Px, Py } = ld;
      f[0] = -Px * b / L; f[3] = -Px * a / L;
      f[1] = -Py * b * b * (3 * a + b) / (L * L * L);
      f[4] = -Py * a * a * (a + 3 * b) / (L * L * L);
      f[2] = -Py * a * b * b / (L * L);
      f[5] = Py * a * a * b / (L * L);
    } else if (ld.type === 'moment') {
      const a = ld.a, b = L - ld.a, M = ld.M;
      f[1] = 6 * M * a * b / (L * L * L);
      f[4] = -6 * M * a * b / (L * L * L);
      f[2] = M * b * (3 * a - L) / (L * L);
      f[5] = M * a * (2 * L - 3 * a) / (L * L);
    }
    return f;
  }

  /* ----------------------------------------------------- fuerzas internas */
  /** Esfuerzos en la sección x (desde el nudo 1). side=+1 incluye cargas en x. */
  function section(el, x, side) {
    const [N1, V1, M1] = el.fEnd1; // fuerzas sobre la barra en el nudo 1 (locales)
    let N = -N1, V = V1, M = -M1 + x * V1;
    for (const ld of el.loadsLocal) {
      if (ld.type === 'udl') {
        N += -ld.qx * x; V += ld.qy * x; M += ld.qy * x * x / 2;
      } else {
        const on = side > 0 ? ld.a <= x + EPS : ld.a < x - EPS;
        if (!on) continue;
        if (ld.type === 'point') {
          N += -ld.Px; V += ld.Py; M += ld.Py * (x - ld.a);
        } else if (ld.type === 'moment') {
          M += -ld.M;
        }
      }
    }
    return { N, V, M };
  }

  function samplePoints(el, nSeg) {
    const L = el.L;
    const marks = [];
    for (const ld of el.loadsLocal) if (ld.type !== 'udl') marks.push(ld.a);
    const pts = [];
    for (let i = 0; i <= nSeg; i++) {
      const x = (L * i) / nSeg;
      if (marks.some((a) => Math.abs(a - x) < 1e-9 * Math.max(1, L))) continue;
      pts.push({ x, side: 1 });
    }
    for (const a of marks) { pts.push({ x: a, side: -1 }); pts.push({ x: a, side: 1 }); }
    pts.sort((p, q) => (p.x === q.x ? p.side - q.side : p.x - q.x));
    return pts;
  }

  /* ------------------------------------------------------------- resolver */
  function _solve(model) {
    const kind = model.type;
    if (!DOF_NAMES[kind]) throw new Error('Tipo de estructura no válido (use truss, beam o frame).');
    const names = DOF_NAMES[kind];
    const dpn = names.length;
    const nodes = model.nodes || [];
    const elems = model.elements || [];
    if (nodes.length < 2) throw new Error('Se necesitan al menos 2 nudos.');
    if (elems.length < 1) throw new Error('Se necesita al menos 1 barra.');

    const nodeIndex = new Map();
    nodes.forEach((n, i) => {
      if (nodeIndex.has(n.id)) throw new Error('Nudo repetido: ' + n.id);
      nodeIndex.set(n.id, i);
    });
    const nDof = nodes.length * dpn;

    const dofLabels = [];
    nodes.forEach((n) => names.forEach((nm) => dofLabels.push({ node: n.id, name: nm })));

    const restr = [], free = [];
    nodes.forEach((n, i) => {
      names.forEach((nm, j) => {
        const g = i * dpn + j;
        if (n.fix && n.fix[nm]) restr.push(g); else free.push(g);
      });
    });
    if (restr.length === 0) throw new Error('La estructura no tiene apoyos.');

    /* --- barras --- */
    const K = zeros(nDof, nDof);
    const F = new Array(nDof).fill(0);
    const Fnodal = new Array(nDof).fill(0);
    const Feq = new Array(nDof).fill(0);
    const els = [];

    for (const e of elems) {
      const i1 = nodeIndex.get(e.n1), i2 = nodeIndex.get(e.n2);
      if (i1 === undefined || i2 === undefined) throw new Error(`La barra ${e.id} usa un nudo que no existe.`);
      const p1 = nodes[i1], p2 = nodes[i2];
      const dx = p2.x - p1.x, dy = (kind === 'beam' ? 0 : p2.y - p1.y);
      const L = Math.hypot(dx, dy);
      if (L < EPS) throw new Error(`La barra ${e.id} tiene longitud cero.`);
      if (kind === 'beam' && dx <= 0) throw new Error(`En vigas, el nudo inicial de la barra ${e.id} debe estar a la izquierda del final.`);
      const c = dx / L, s = dy / L;
      const E = Number(e.E), A = Number(e.A), I = Number(e.I);
      if (!(E > 0)) throw new Error(`La barra ${e.id} necesita un módulo de elasticidad E > 0.`);
      if (kind !== 'beam' && !(A > 0)) throw new Error(`La barra ${e.id} necesita un área A > 0.`);
      if (kind !== 'truss' && !(I > 0)) throw new Error(`La barra ${e.id} necesita una inercia I > 0.`);

      const kL = localK(kind, E, A, I, L);
      const T = transformT(kind, c, s);
      const kG = matmul(transpose(T), matmul(kL, T));
      const dofs = [];
      for (let j = 0; j < dpn; j++) dofs.push(i1 * dpn + j);
      for (let j = 0; j < dpn; j++) dofs.push(i2 * dpn + j);

      for (let a = 0; a < dofs.length; a++)
        for (let b = 0; b < dofs.length; b++) K[dofs[a]][dofs[b]] += kG[a][b];

      els.push({
        id: e.id, n1: e.n1, n2: e.n2, i1, i2, L, c, s,
        angle: Math.atan2(dy, dx) * 180 / Math.PI,
        E, A, I, kLocal: kL, T, kGlobal: kG, dofs,
        loadsLocal: [], f0Local: new Array(kind === 'beam' ? 4 : kind === 'truss' ? 4 : 6).fill(0),
        f0Global: null,
      });
    }

    /* --- cargas en nudos --- */
    for (const ld of model.nodalLoads || []) {
      const idx = nodeIndex.get(ld.node);
      if (idx === undefined) throw new Error('Una carga nodal usa un nudo que no existe: ' + ld.node);
      const fx = Number(ld.fx) || 0, fy = Number(ld.fy) || 0, mz = Number(ld.mz) || 0;
      names.forEach((nm, j) => {
        const v = nm === 'ux' ? fx : nm === 'uy' ? fy : mz;
        Fnodal[idx * dpn + j] += v;
      });
    }

    /* --- cargas en barras --- */
    const elById = new Map(els.map((e) => [e.id, e]));
    const memberLoads = model.memberLoads || [];
    if (kind === 'truss' && memberLoads.length) throw new Error('Las cerchas solo admiten cargas en los nudos.');
    for (const ld of memberLoads) {
      const el = elById.get(ld.elem);
      if (!el) throw new Error('Una carga de barra usa una barra que no existe: ' + ld.elem);
      const nl = normalizeLoad(kind, ld, el.L, el.c, el.s);
      el.loadsLocal.push(nl);
      const f6 = fixedEnd6(el.L, nl);
      if (kind === 'beam') {
        const f4 = [f6[1], f6[2], f6[4], f6[5]];
        for (let i = 0; i < 4; i++) el.f0Local[i] += f4[i];
      } else {
        for (let i = 0; i < 6; i++) el.f0Local[i] += f6[i];
      }
    }
    for (const el of els) {
      el.f0Global = matvec(transpose(el.T), el.f0Local);
      for (let a = 0; a < el.dofs.length; a++) Feq[el.dofs[a]] -= el.f0Global[a];
    }
    for (let i = 0; i < nDof; i++) F[i] = Fnodal[i] + Feq[i];

    /* --- sistema reducido --- */
    const Kff = free.map((i) => free.map((j) => K[i][j]));
    const Ff = free.map((i) => F[i]);
    const sol = solveLinear(Kff, Ff);
    if (sol.singular !== undefined) {
      const lab = dofLabels[free[sol.singular]];
      throw new Error(
        'La estructura es inestable (mecanismo o apoyos insuficientes). ' +
        (lab ? `Revise el grado de libertad «${lab.name}» del nudo ${lab.node}.` : '')
      );
    }
    const u = new Array(nDof).fill(0);
    free.forEach((g, i) => { u[g] = sol.x[i]; });

    /* --- reacciones --- */
    const Ku = matvec(K, u);
    const Rvec = new Array(nDof).fill(0);
    restr.forEach((g) => { Rvec[g] = Ku[g] - F[g]; });
    const reactions = [];
    nodes.forEach((n, i) => {
      const r = { node: n.id, Rx: null, Ry: null, Mz: null };
      names.forEach((nm, j) => {
        if (n.fix && n.fix[nm]) {
          const v = Rvec[i * dpn + j];
          if (nm === 'ux') r.Rx = v; else if (nm === 'uy') r.Ry = v; else r.Mz = v;
        }
      });
      if (r.Rx !== null || r.Ry !== null || r.Mz !== null) reactions.push(r);
    });

    /* --- esfuerzos y diagramas --- */
    const nSeg = 40;
    const diagrams = [];
    let glob = {
      Nmax: { v: -Infinity }, Nmin: { v: Infinity },
      Vmax: { v: -Infinity }, Vmin: { v: Infinity },
      Mmax: { v: -Infinity }, Mmin: { v: Infinity },
      dmax: { v: 0 },
    };
    const upd = (key, v, el, x, isMax) => {
      if (isMax ? v > glob[key].v : v < glob[key].v) glob[key] = { v, elem: el.id, x };
    };

    for (const el of els) {
      const uG = el.dofs.map((g) => u[g]);
      const uL = matvec(el.T, uG);
      const fL = matvec(el.kLocal, uL).map((v, i) => v + el.f0Local[i]);
      el.uGlobal = uG; el.uLocal = uL; el.fLocal = fL;

      if (kind === 'truss') {
        const Nax = -fL[0];
        el.axial = Nax;
        el.fEnd1 = [fL[0], 0, 0];
        diagrams.push({ id: el.id, axial: Nax });
        upd('Nmax', Nax, el, 0, true); upd('Nmin', Nax, el, 0, false);
        continue;
      }
      if (kind === 'beam') el.fEnd1 = [0, fL[0], fL[1]];
      else el.fEnd1 = [fL[0], fL[1], fL[2]];
      el.fEnd2 = kind === 'beam' ? [0, fL[2], fL[3]] : [fL[3], fL[4], fL[5]];

      const pts = samplePoints(el, nSeg);
      const xs = [], Ns = [], Vs = [], Ms = [];
      for (const p of pts) {
        const r = section(el, p.x, p.side);
        xs.push(p.x); Ns.push(r.N); Vs.push(r.V); Ms.push(r.M);
        upd('Nmax', r.N, el, p.x, true); upd('Nmin', r.N, el, p.x, false);
        upd('Vmax', r.V, el, p.x, true); upd('Vmin', r.V, el, p.x, false);
        upd('Mmax', r.M, el, p.x, true); upd('Mmin', r.M, el, p.x, false);
      }
      // puntos de momento máximo dentro de la barra (cortante = 0) para udl
      for (const ld of el.loadsLocal) {
        if (ld.type === 'udl' && Math.abs(ld.qy) > 1e-12 && el.loadsLocal.length === 1) {
          const x0 = -el.fEnd1[1] / ld.qy;
          if (x0 > 1e-9 && x0 < el.L - 1e-9) {
            const r = section(el, x0, 1);
            upd('Mmax', r.M, el, x0, true); upd('Mmin', r.M, el, x0, false);
          }
        }
      }

      // deformada local por doble integración de M/EI
      const nDef = 60;
      const v1 = kind === 'beam' ? uL[0] : uL[1];
      const th1 = kind === 'beam' ? uL[1] : uL[2];
      const v2 = kind === 'beam' ? uL[2] : uL[4];
      const u1 = kind === 'beam' ? 0 : uL[0];
      const u2 = kind === 'beam' ? 0 : uL[3];
      const dxg = el.L / nDef;
      const vv = [v1];
      let th = th1, vcur = v1;
      let kPrev = section(el, 0, 1).M / (el.E * el.I);
      for (let i = 1; i <= nDef; i++) {
        const x = dxg * i;
        const kNow = section(el, x, 1).M / (el.E * el.I);
        const thNext = th + 0.5 * (kPrev + kNow) * dxg;
        vcur += 0.5 * (th + thNext) * dxg;
        th = thNext; kPrev = kNow;
        vv.push(vcur);
      }
      const corr = v2 - vv[nDef];
      const def = [];
      for (let i = 0; i <= nDef; i++) {
        const x = dxg * i;
        const vloc = vv[i] + corr * (x / el.L);
        const uloc = u1 + (u2 - u1) * (x / el.L);
        const ux = uloc * el.c - vloc * el.s;
        const uy = uloc * el.s + vloc * el.c;
        def.push({ x, vloc, dx: ux, dy: uy });
        if (Math.abs(vloc) > Math.abs(glob.dmax.v)) glob.dmax = { v: vloc, elem: el.id, x };
      }
      diagrams.push({ id: el.id, x: xs, N: Ns, V: Vs, M: Ms, def });
    }

    /* --- equilibrio global --- */
    let sx = 0, sy = 0, sm = 0;
    nodes.forEach((n) => {
      const idx = nodeIndex.get(n.id);
      const py = kind === 'beam' ? 0 : n.y;
      const fx = kind === 'beam' ? 0 : Fnodal[idx * dpn + names.indexOf('ux')];
      const fy = Fnodal[idx * dpn + names.indexOf('uy')];
      const mz = names.includes('rz') ? Fnodal[idx * dpn + names.indexOf('rz')] : 0;
      sx += fx; sy += fy; sm += n.x * fy - py * fx + mz;
    });
    for (const el of els) {
      const p1 = nodes[el.i1];
      const y1 = kind === 'beam' ? 0 : p1.y;
      for (const ld of el.loadsLocal) {
        let fxl = 0, fyl = 0, a = 0, mo = 0;
        if (ld.type === 'udl') { fxl = ld.qx * el.L; fyl = ld.qy * el.L; a = el.L / 2; }
        else if (ld.type === 'point') { fxl = ld.Px; fyl = ld.Py; a = ld.a; }
        else { mo = ld.M; }
        const fgx = fxl * el.c - fyl * el.s, fgy = fxl * el.s + fyl * el.c;
        const px = p1.x + a * el.c, py = y1 + a * el.s;
        sx += fgx; sy += fgy; sm += px * fgy - py * fgx + mo;
      }
    }
    nodes.forEach((n, i) => {
      const py = kind === 'beam' ? 0 : n.y;
      const ix = names.indexOf('ux'), iy = names.indexOf('uy'), ir = names.indexOf('rz');
      const rx = ix >= 0 ? Rvec[i * dpn + ix] : 0;
      const ry = Rvec[i * dpn + iy];
      const rm = ir >= 0 ? Rvec[i * dpn + ir] : 0;
      sx += rx; sy += ry; sm += n.x * ry - py * rx + rm;
    });
    const refMag = Math.max(1, ...Fnodal.map(Math.abs), ...Rvec.map(Math.abs));
    const tol = 1e-6 * refMag * Math.max(1, ...nodes.map((n) => Math.abs(n.x)), ...nodes.map((n) => Math.abs(n.y || 0)));
    const equilibrium = {
      sumFx: sx, sumFy: sy, sumM: sm,
      ok: (kind === 'beam' || Math.abs(sx) < tol) && Math.abs(sy) < tol && (kind === 'truss' ? true : Math.abs(sm) < tol),
    };
    if (kind === 'truss') {
      // en cercha el momento se verifica igualmente (fuerzas puras)
      equilibrium.ok = Math.abs(sx) < tol && Math.abs(sy) < tol && Math.abs(sm) < tol;
    }

    return {
      ok: true, type: kind, dpn, dofNames: names, dofLabels,
      nDof, free, restr,
      nodes: nodes.map((n) => ({ id: n.id, x: n.x, y: kind === 'beam' ? 0 : n.y })),
      elements: els, K, F, Fnodal, Feq, Kff, Ff, uf: sol.x, u, Rvec, reactions,
      diagrams, extremes: glob, equilibrium,
    };
  }

  function solve(model) {
    try { return _solve(model); }
    catch (err) { return { ok: false, error: err.message }; }
  }

  return { solve, section, localK, transformT, fixedEnd6, solveLinear, matmul, transpose, matvec, DOF_NAMES };
});
