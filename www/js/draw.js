/*
 * Dibujo de la estructura sobre papel cuadriculado (SVG en texto).
 * Modos: model | deformed | N | V | M | R (reacciones)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Draw = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const f1 = (v) => (Math.abs(v) < 1e-9 ? '0' : (Math.round(v * 10) / 10).toString());
  const px = (v) => Math.round(v * 100) / 100;

  /** Formato de valores en etiquetas del dibujo */
  function lab(v, unit) {
    const a = Math.abs(v);
    let s;
    if (a === 0) s = '0';
    else if (a >= 1000) s = v.toFixed(0);
    else if (a >= 100) s = v.toFixed(1).replace(/\.0$/, '');
    else if (a >= 1) s = v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    else s = v.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
    return unit ? s + ' ' + unit : s;
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function arrow(x1, y1, x2, y2, cls, w) {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L, hl = 8, hw = 3.6;
    const bx = x2 - ux * hl, by = y2 - uy * hl;
    return (
      `<line x1="${px(x1)}" y1="${px(y1)}" x2="${px(bx)}" y2="${px(by)}" class="${cls}" stroke-width="${w || 1.8}"/>` +
      `<polygon points="${px(x2)},${px(y2)} ${px(bx - uy * hw)},${px(by + ux * hw)} ${px(bx + uy * hw)},${px(by - ux * hw)}" class="${cls} fillc"/>`
    );
  }

  /** Arco de momento. ccw=true: antihorario (momento positivo) */
  function momentArc(cx, cy, ccw, cls, r) {
    r = r || 14;
    const pt = (deg) => [cx + r * Math.cos((deg * Math.PI) / 180), cy - r * Math.sin((deg * Math.PI) / 180)];
    const a1 = ccw ? -35 : 215, a2 = ccw ? 215 : -35;
    const p1 = pt(a1), p2 = pt(a2);
    const sweep = ccw ? 0 : 1;
    const rad = (a2 * Math.PI) / 180;
    // tangente en el extremo (coordenadas de pantalla)
    let tx, ty;
    if (ccw) { tx = -Math.sin(rad); ty = -Math.cos(rad); } else { tx = Math.sin(rad); ty = Math.cos(rad); }
    const hl = 7, hw = 3.4;
    const bx = p2[0] - tx * hl, by = p2[1] - ty * hl;
    return (
      `<path d="M${px(p1[0])},${px(p1[1])} A${r},${r} 0 1 ${sweep} ${px(p2[0])},${px(p2[1])}" class="${cls}" fill="none" stroke-width="1.8"/>` +
      `<polygon points="${px(p2[0])},${px(p2[1])} ${px(bx - ty * hw)},${px(by + tx * hw)} ${px(bx + ty * hw)},${px(by - tx * hw)}" class="${cls} fillc"/>`
    );
  }

  function rawText(x, y, s, cls, anchor) {
    return `<text x="${px(x)}" y="${px(y)}" class="${cls || 'lbl'}" text-anchor="${anchor || 'middle'}">${esc(s)}</text>`;
  }

  /* ----------------------------------------------------------- apoyos */
  function supportSVG(X, Y, kind, orient) {
    const u = 9;
    let s = '';
    const hatchDown = (x0, x1, y) => {
      let h = '';
      for (let x = x0; x <= x1 + 0.1; x += 5.5) h += `<line x1="${px(x)}" y1="${px(y)}" x2="${px(x - 4)}" y2="${px(y + 5)}" class="sup thin"/>`;
      return h;
    };
    if (kind === 'pin') {
      s += `<polygon points="${px(X)},${px(Y)} ${px(X - u)},${px(Y + u * 1.7)} ${px(X + u)},${px(Y + u * 1.7)}" class="supfill"/>`;
      s += `<line x1="${px(X - u * 1.5)}" y1="${px(Y + u * 1.7)}" x2="${px(X + u * 1.5)}" y2="${px(Y + u * 1.7)}" class="sup"/>`;
      s += hatchDown(X - u * 1.4, X + u * 1.5, Y + u * 1.7);
    } else if (kind === 'roller') {
      const yb = Y + u * 1.3;
      s += `<polygon points="${px(X)},${px(Y)} ${px(X - u)},${px(yb)} ${px(X + u)},${px(yb)}" class="supfill"/>`;
      s += `<circle cx="${px(X - u * 0.5)}" cy="${px(yb + 3.4)}" r="3.2" class="supfill"/><circle cx="${px(X + u * 0.5)}" cy="${px(yb + 3.4)}" r="3.2" class="supfill"/>`;
      s += `<line x1="${px(X - u * 1.5)}" y1="${px(yb + 6.8)}" x2="${px(X + u * 1.5)}" y2="${px(yb + 6.8)}" class="sup"/>`;
      s += hatchDown(X - u * 1.4, X + u * 1.5, yb + 6.8);
    } else if (kind === 'rollerx') {
      const xb = X - u * 1.3;
      s += `<polygon points="${px(X)},${px(Y)} ${px(xb)},${px(Y - u)} ${px(xb)},${px(Y + u)}" class="supfill"/>`;
      s += `<circle cx="${px(xb - 3.4)}" cy="${px(Y - u * 0.5)}" r="3.2" class="supfill"/><circle cx="${px(xb - 3.4)}" cy="${px(Y + u * 0.5)}" r="3.2" class="supfill"/>`;
      const xw = xb - 6.8;
      s += `<line x1="${px(xw)}" y1="${px(Y - u * 1.5)}" x2="${px(xw)}" y2="${px(Y + u * 1.5)}" class="sup"/>`;
      for (let y = Y - u * 1.4; y <= Y + u * 1.5; y += 5.5) s += `<line x1="${px(xw)}" y1="${px(y)}" x2="${px(xw - 5)}" y2="${px(y + 4)}" class="sup thin"/>`;
    } else if (kind === 'fixed') {
      if (orient === 'left' || orient === 'right') {
        const sg = orient === 'left' ? -1 : 1;
        const xw = X + sg * 2;
        s += `<line x1="${px(xw)}" y1="${px(Y - u * 1.7)}" x2="${px(xw)}" y2="${px(Y + u * 1.7)}" class="sup" stroke-width="3"/>`;
        for (let y = Y - u * 1.6; y <= Y + u * 1.7; y += 5.5) {
          s += `<line x1="${px(xw)}" y1="${px(y)}" x2="${px(xw + sg * 6)}" y2="${px(y + 5)}" class="sup thin"/>`;
        }
      } else {
        const yw = Y + 2;
        s += `<line x1="${px(X - u * 1.7)}" y1="${px(yw)}" x2="${px(X + u * 1.7)}" y2="${px(yw)}" class="sup" stroke-width="3"/>`;
        s += hatchDown(X - u * 1.6, X + u * 1.7, yw);
      }
    }
    return s;
  }

  function supKind(fix) {
    if (fix.rz) return 'fixed';
    if (fix.ux && fix.uy) return 'pin';
    if (fix.uy) return 'roller';
    if (fix.ux) return 'rollerx';
    return null;
  }

  /* ------------------------------------------------------------- escena */
  function scene(opts) {
    const model = opts.model;
    const result = opts.result && opts.result.ok ? opts.result : null;
    const mode = opts.mode || 'model';
    const W = opts.W || 360, H = opts.H || 240;
    const compact = !!opts.compact;
    const isBeam = model.type === 'beam';
    // texto que no se sale del cuadro de dibujo
    const text = (x, y, str, cls, anchor) => {
      anchor = anchor || 'middle';
      const w = String(str).length * 6.3;
      const x0 = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
      const shift = Math.max(3 - x0, 0) - Math.max(x0 + w - (W - 3), 0);
      return rawText(x + shift, y, str, cls, anchor);
    };
    const nodes = model.nodes;
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const bars = model.elements.filter((e) => nodeMap.has(e.n1) && nodeMap.has(e.n2));

    const xs = nodes.map((n) => n.x), ys = nodes.map((n) => (isBeam ? 0 : n.y));
    const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
    const wW = maxx - minx, hW = maxy - miny;

    // márgenes: espacio para apoyos, cargas y diagramas
    const diag = mode === 'N' || mode === 'V' || mode === 'M';
    const ampPx = compact ? 0 : 40;
    let mt = compact ? 26 : 50, mb = compact ? 30 : 46, ml = compact ? 22 : 40, mr = compact ? 22 : 40;
    if (diag) { mt += ampPx; mb += ampPx; }
    if (mode === 'deformed') { mt += 14; mb += 14; }
    if (mode === 'R' && result) {
      mb += 44;
      if (!isBeam && result.reactions.some((r) => r.Rx !== null && Math.abs(r.Rx) > 1e-9)) { ml += 64; mr += 64; }
    }
    const aw = W - ml - mr, ah = H - mt - mb;
    let s = Math.min(wW > 1e-9 ? aw / wW : Infinity, hW > 1e-9 ? ah / hW : Infinity);
    if (!isFinite(s)) s = 40;
    s = Math.min(s, compact ? 34 : 70);
    const ox = ml + (aw - wW * s) / 2;
    const oy = mt + (ah + hW * s) / 2;
    const X = (x) => ox + (x - minx) * s;
    const Y = (y) => oy - (y - miny) * s;

    let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="scene" role="img" aria-label="${esc(opts.aria || 'Esquema de la estructura')}" preserveAspectRatio="xMidYMid meet">`;

    /* cuadrícula alineada con el mundo */
    const steps = [0.25, 0.5, 1, 2, 5, 10, 20, 50, 100];
    let gstep = steps[steps.length - 1];
    for (const st of steps) if (st * s >= 16) { gstep = st; break; }
    const gx0 = Math.floor((-ox / s + minx) / gstep) * gstep;
    const gx1 = Math.ceil(((W - ox) / s + minx) / gstep) * gstep;
    let g = '';
    for (let x = gx0; x <= gx1 + 1e-9; x += gstep) {
      const k = Math.round(x / gstep);
      g += `<line x1="${px(X(x))}" y1="0" x2="${px(X(x))}" y2="${H}" class="${k % 5 === 0 ? 'gridM' : 'grid'}"/>`;
    }
    const gy0 = Math.floor((miny - (oy - H) / s) / gstep) * gstep;
    const gy1 = Math.ceil((miny + oy / s) / gstep) * gstep;
    for (let y = gy0; y <= gy1 + 1e-9; y += gstep) {
      const k = Math.round(y / gstep);
      g += `<line x1="0" y1="${px(Y(y))}" x2="${W}" y2="${px(Y(y))}" class="${k % 5 === 0 ? 'gridM' : 'grid'}"/>`;
    }
    out += `<g aria-hidden="true">${g}</g>`;

    const barS = (b) => {
      const p1 = nodeMap.get(b.n1), p2 = nodeMap.get(b.n2);
      return [X(p1.x), Y(isBeam ? 0 : p1.y), X(p2.x), Y(isBeam ? 0 : p2.y)];
    };
    const barGeom = (b) => {
      const [x1, y1, x2, y2] = barS(b);
      const L = Math.hypot(x2 - x1, y2 - y1) || 1;
      const ux = (x2 - x1) / L, uy = (y2 - y1) / L; // pantalla
      return { x1, y1, x2, y2, L, ux, uy, nx: uy, ny: -ux }; // normal local +y en pantalla (izquierda)
    };

    /* barras */
    const bw = model.type === 'truss' ? 2.6 : 3.4;
    const baseClass = mode === 'deformed' ? 'bar ghost' : 'bar';
    let barsSVG = '';
    const trussN = mode === 'N' && model.type === 'truss' && result;
    for (const b of trussN ? [] : bars) {
      const q = barGeom(b);
      barsSVG += `<line x1="${px(q.x1)}" y1="${px(q.y1)}" x2="${px(q.x2)}" y2="${px(q.y2)}" class="${baseClass}" stroke-width="${mode === 'deformed' ? 1.6 : bw}"/>`;
    }

    let overlay = '';
    let legend = '';

    /* cercha: barras coloreadas según tracción / compresión */
    if (trussN) {
      let maxN = 0;
      for (const d of result.diagrams) maxN = Math.max(maxN, Math.abs(d.axial));
      let lines = '', labs = '';
      const cX = nodes.reduce((a, n) => a + X(n.x), 0) / nodes.length, cY = nodes.reduce((a, n) => a + Y(n.y), 0) / nodes.length;
      for (const b of bars) {
        const d = result.diagrams.find((q) => q.id === b.id);
        if (!d) continue;
        const q = barGeom(b);
        const n = d.axial;
        const zero = Math.abs(n) < 1e-6 * Math.max(maxN, 1);
        const cls = zero ? 'zero' : n > 0 ? 'tens' : 'comp';
        const w = zero ? 1.8 : 2.6 + 4.4 * (Math.abs(n) / (maxN || 1));
        lines += `<line x1="${px(q.x1)}" y1="${px(q.y1)}" x2="${px(q.x2)}" y2="${px(q.y2)}" class="tr ${cls}" stroke-width="${px(w)}" stroke-linecap="round"/>`;
        const mx = (q.x1 + q.x2) / 2, my = (q.y1 + q.y2) / 2;
        // la etiqueta se corre hacia afuera de la cercha (lejos del centroide)
        const away = (mx - cX) * q.nx + (my - cY) * q.ny;
        const sideSign = Math.abs(away) < 1e-6 ? (q.ny <= 0 ? 1 : -1) : away > 0 ? 1 : -1;
        const sx = q.nx * sideSign, sy = q.ny * sideSign;
        const anc = sx > 0.45 ? 'start' : sx < -0.45 ? 'end' : 'middle';
        labs += text(mx + sx * 10, my + sy * 11 + 4, lab(n), 'dlbl ' + cls, anc);
      }
      overlay += lines + labs;
      legend = 'Axial N en kN: azul tracción, rojo compresión';
    }

    /* diagramas N V M */
    if (diag && result && !trussN) {
      const key = mode;
      let maxAbs = 0;
      for (const d of result.diagrams) {
        const arr = key === 'N' && d.axial !== undefined ? [d.axial] : d[key] || [];
        for (const v of arr) maxAbs = Math.max(maxAbs, Math.abs(v));
      }
      const k = maxAbs > 1e-9 ? ampPx / maxAbs : 0;
      const sign = key === 'M' ? -1 : 1; // M se grafica del lado de la tracción
      let polys = '', labels = '';
      const placed = [];
      const putLabel = (x, y, v, dir) => {
        if (Math.abs(v) < 1e-3 * Math.max(maxAbs, 1e-9) || Math.abs(v) < 1e-6) return;
        if (placed.some((p) => Math.hypot(p[0] - x, p[1] - y) < 24)) return;
        placed.push([x, y]);
        const ty = y + (dir > 0 ? 11 : -5);
        labels += text(x, ty, lab(v), 'dlbl ' + key);
      };
      for (const b of bars) {
        const d = result.diagrams.find((q) => q.id === b.id);
        if (!d) continue;
        const q = barGeom(b);
        const el = result.elements.find((e) => e.id === b.id);
        if (d.axial !== undefined) {
          const off = sign * d.axial * k;
          const pts = [[q.x1, q.y1], [q.x1 + q.nx * off, q.y1 + q.ny * off], [q.x2 + q.nx * off, q.y2 + q.ny * off], [q.x2, q.y2]];
          polys += `<polygon points="${pts.map((p) => px(p[0]) + ',' + px(p[1])).join(' ')}" class="dg ${key}"/>`;
          const mx = (q.x1 + q.x2) / 2 + q.nx * off, my = (q.y1 + q.y2) / 2 + q.ny * off;
          labels += text(mx, my + (off * q.ny >= 0 ? 12 : -5), lab(d.axial), 'dlbl ' + key);
          continue;
        }
        const arr = d[key];
        const pts = [[q.x1, q.y1]];
        for (let i = 0; i < arr.length; i++) {
          const t = d.x[i] / el.L;
          const off = sign * arr[i] * k;
          pts.push([q.x1 + (q.x2 - q.x1) * t + q.nx * off, q.y1 + (q.y2 - q.y1) * t + q.ny * off]);
        }
        pts.push([q.x2, q.y2]);
        polys += `<polygon points="${pts.map((p) => px(p[0]) + ',' + px(p[1])).join(' ')}" class="dg ${key}"/>`;
        // etiquetas: extremos y extremos locales
        let iMax = 0, iMin = 0;
        arr.forEach((v, i) => { if (v > arr[iMax]) iMax = i; if (v < arr[iMin]) iMin = i; });
        const constant = arr[iMax] - arr[iMin] < 1e-9 * Math.max(maxAbs, 1);
        const idx = constant ? [Math.floor(arr.length / 2)] : [iMax, iMin, 0, arr.length - 1];
        const used = [];
        for (const i of idx) {
          const v = arr[i];
          if (used.some((u) => Math.abs(u - v) < 1e-6 * Math.max(1, Math.abs(v)))) continue; // mismo valor: una sola etiqueta
          used.push(v);
          const pt = pts[i + 1];
          const off = sign * v * k;
          const away = off * q.ny; // sentido vertical de la etiqueta
          putLabel(pt[0], pt[1], v, away >= 0 ? 1 : -1);
        }
      }
      overlay += polys + labels;
      const names = { N: 'Axial N (tracción +)', V: 'Cortante V', M: 'Momento M (se dibuja del lado traccionado)' };
      legend = names[key] + (key === 'N' ? '' : '');
    }

    /* deformada */
    if (mode === 'deformed' && result) {
      let maxD = 0;
      for (const e of result.elements) for (let i = 0; i < e.uGlobal.length; i++) {
        const isRot = result.dofNames[i % result.dpn] === 'rz';
        if (!isRot) maxD = Math.max(maxD, Math.abs(e.uGlobal[i]));
      }
      for (const d of result.diagrams) if (d.def) for (const p of d.def) maxD = Math.max(maxD, Math.abs(p.dx), Math.abs(p.dy));
      const target = Math.min(W, H) * 0.12;
      let f = maxD > 0 ? target / (maxD * s) : 1;
      // factor "redondo"
      const pow = Math.pow(10, Math.floor(Math.log10(f)));
      const m = f / pow;
      f = (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * pow;
      let paths = '', dots = '';
      for (const b of bars) {
        const d = result.diagrams.find((q) => q.id === b.id);
        const el = result.elements.find((e) => e.id === b.id);
        if (!d || !el) continue;
        const p1 = nodeMap.get(b.n1), p2 = nodeMap.get(b.n2);
        const y1 = isBeam ? 0 : p1.y, y2 = isBeam ? 0 : p2.y;
        let pts = [];
        if (d.def) {
          for (const p of d.def) {
            const t = p.x / el.L;
            pts.push([X(p1.x + (p2.x - p1.x) * t + p.dx * f), Y(y1 + (y2 - y1) * t + p.dy * f)]);
          }
        } else {
          const u = el.uGlobal;
          pts = [[X(p1.x + u[0] * f), Y(y1 + u[1] * f)], [X(p2.x + u[2] * f), Y(y2 + u[3] * f)]];
        }
        paths += `<polyline points="${pts.map((p) => px(p[0]) + ',' + px(p[1])).join(' ')}" class="defo" fill="none" stroke-width="2.6"/>`;
        if (model.type === 'truss') pts.forEach((p) => { dots += `<circle cx="${px(p[0])}" cy="${px(p[1])}" r="3" class="defo fillc"/>`; });
      }
      overlay += paths + dots;
      const dm = result.extremes.dmax;
      legend = `Deformada ampliada ×${f >= 1 ? Math.round(f) : f.toPrecision(1)}`;
      if (dm && Math.abs(dm.v) > 0 && model.type !== 'truss') legend += `, flecha máx. ${lab(Math.abs(dm.v) * 1000, 'mm')}`;
    }

    /* apoyos */
    let sups = '';
    const supInfo = new Map();
    const leftmost = nodes.reduce((a, n) => (n.x < a.x ? n : a), nodes[0]);
    const rightmost = nodes.reduce((a, n) => (n.x > a.x ? n : a), nodes[0]);
    for (const n of nodes) {
      const kind = supKind(n.fix || {});
      if (!kind) continue;
      let orient = 'down';
      if (kind === 'fixed' && isBeam) {
        if (n === leftmost && n !== rightmost) orient = 'left';
        else if (n === rightmost && n !== leftmost) orient = 'right';
      }
      supInfo.set(n.id, { kind, orient });
      sups += supportSVG(X(n.x), Y(isBeam ? 0 : n.y), kind, orient);
    }

    /* cargas */
    let loads = '';
    const boxes = [];
    const loadText = (x, y, str, cls, anchor) => {
      anchor = anchor || 'middle';
      const w = String(str).length * 6.3;
      const x0 = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
      const box = [x0 - 2, y - 11, x0 + w + 2, y + 3];
      if (boxes.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) return '';
      boxes.push(box);
      return text(x, y, str, cls, anchor);
    };
    if (mode === 'model' && !opts.hideLoads) {
      const L0 = compact ? 22 : 32;
      for (const l of model.nodalLoads) {
        const n = nodeMap.get(l.node);
        if (!n) continue;
        const x = X(n.x), y = Y(isBeam ? 0 : n.y);
        if (!isBeam && Math.abs(l.fx) > 1e-12) {
          const sg = l.fx > 0 ? 1 : -1;
          loads += arrow(x - sg * L0, y, x - sg * 3, y, 'load');
          if (!compact) loads += loadText(x - sg * L0 * 0.5, y + 15, lab(Math.abs(l.fx), 'kN'), 'lbl load');
        }
        if (Math.abs(l.fy) > 1e-12) {
          const sg = l.fy > 0 ? 1 : -1; // + hacia arriba
          loads += arrow(x, y + sg * L0, x, y + sg * 3, 'load');
          if (!compact) loads += loadText(x + 4, y + sg * L0 * 0.55 + 4, lab(Math.abs(l.fy), 'kN'), 'lbl load', 'start');
        }
        if (model.type !== 'truss' && Math.abs(l.mz) > 1e-12) {
          loads += momentArc(x, y, l.mz > 0, 'load', compact ? 11 : 15);
          if (!compact) loads += loadText(x + 18, y - 14, lab(Math.abs(l.mz), 'kN·m'), 'lbl load', 'start');
        }
      }
      for (const l of model.memberLoads) {
        const b = bars.find((q) => q.id === l.elem);
        if (!b) continue;
        const q = barGeom(b);
        // vector de la carga en pantalla
        const val = l.type === 'udl' ? l.w : l.type === 'point' ? l.P : l.M;
        const sgn = val >= 0 ? 1 : -1;
        let dir = [0, 1];
        switch (l.dir) {
          case 'gx': dir = [1, 0]; break;
          case 'lx': dir = [q.ux, q.uy]; break;
          case 'ly': dir = [q.nx, q.ny]; break;
          default: dir = [0, 1]; // gravedad: hacia abajo en pantalla
        }
        dir = [dir[0] * sgn, dir[1] * sgn];
        const aLen = compact ? 16 : 24;
        if (l.type === 'udl') {
          const n = Math.max(2, Math.round(q.L / (compact ? 16 : 20)));
          let tails = [];
          for (let i = 0; i <= n; i++) {
            const t = i / n;
            const bx = q.x1 + (q.x2 - q.x1) * t, by = q.y1 + (q.y2 - q.y1) * t;
            const tx = bx - dir[0] * aLen, ty = by - dir[1] * aLen;
            tails.push([tx, ty]);
            loads += arrow(tx, ty, bx - dir[0] * 2, by - dir[1] * 2, 'load', 1.4);
          }
          loads += `<polyline points="${tails.map((p) => px(p[0]) + ',' + px(p[1])).join(' ')}" class="load" fill="none" stroke-width="1.4"/>`;
          if (!compact) {
            const mid = tails[Math.floor(tails.length / 2)];
            loads += loadText(mid[0], mid[1] - (dir[1] > 0 ? 5 : -12), 'w = ' + lab(Math.abs(val), 'kN/m'), 'lbl load');
          }
        } else if (l.type === 'point') {
          const tt = Math.min(1, Math.max(0, l.a / (q.L / s)));
          const bx = q.x1 + (q.x2 - q.x1) * tt, by = q.y1 + (q.y2 - q.y1) * tt;
          const len = compact ? 22 : 34;
          loads += arrow(bx - dir[0] * len, by - dir[1] * len, bx - dir[0] * 3, by - dir[1] * 3, 'load', 2.2);
          if (!compact) loads += loadText(bx - dir[0] * len * 0.5 + 4, by - dir[1] * len * 0.5 + (dir[1] > 0 ? -4 : 12), 'P = ' + lab(Math.abs(val), 'kN'), 'lbl load', 'start');
        } else if (l.type === 'moment') {
          const tt = Math.min(1, Math.max(0, l.a / (q.L / s)));
          const bx = q.x1 + (q.x2 - q.x1) * tt, by = q.y1 + (q.y2 - q.y1) * tt;
          loads += momentArc(bx, by, val > 0, 'load', compact ? 11 : 15);
          if (!compact) loads += loadText(bx + 18, by - 14, lab(Math.abs(val), 'kN·m'), 'lbl load', 'start');
        }
      }
    }

    /* reacciones */
    if (mode === 'R' && result) {
      const L0 = 34;
      for (const r of result.reactions) {
        const n = nodeMap.get(r.node);
        const x = X(n.x), y = Y(isBeam ? 0 : n.y);
        const si = supInfo.get(r.node) || { kind: 'pin', orient: 'down' };
        // espacio que ocupa el símbolo del apoyo
        const gapY = si.kind === 'pin' ? 24 : si.kind === 'roller' ? 27 : si.kind === 'fixed' && si.orient === 'down' ? 12 : 6;
        const hasMz = r.Mz !== null && Math.abs(r.Mz) > 1e-9;
        const gapX = (si.kind === 'rollerx' ? 27 : si.kind === 'fixed' && si.orient !== 'down' ? 12 : 8) + (hasMz ? 12 : 0);
        const wallSide = si.kind === 'rollerx' || (si.kind === 'fixed' && si.orient === 'left') ? -1 : si.kind === 'fixed' && si.orient === 'right' ? 1 : 0;
        if (r.Rx !== null && Math.abs(r.Rx) > 1e-9) {
          const sg = r.Rx > 0 ? 1 : -1;
          const txt = 'Rx ' + lab(r.Rx);
          if (wallSide !== 0 && wallSide === -sg) { // el apoyo estorba: la flecha sale del nudo
            const tail = x + sg * 6, head = x + sg * (6 + L0);
            loads += arrow(tail, y, head, y, 'react');
            loads += text(head + sg * 4, y + 4, txt, 'lbl react', sg > 0 ? 'start' : 'end');
          } else {
            const tail = x - sg * (L0 - 4 + gapX), head = x - sg * gapX;
            loads += arrow(tail, y, head, y, 'react');
            loads += text(tail - sg * 4, y + 4, txt, 'lbl react', sg > 0 ? 'end' : 'start');
          }
        }
        if (r.Ry !== null && Math.abs(r.Ry) > 1e-9) {
          const sg = r.Ry > 0 ? 1 : -1;
          const tail = sg > 0 ? y + gapY + L0 : y + gapY, head = sg > 0 ? y + gapY : y + gapY + L0;
          loads += arrow(x, tail, x, head, 'react');
          const ryTxt = 'Ry ' + lab(r.Ry);
          const fitsRight = x + 8 + ryTxt.length * 6.3 <= W - 3;
          loads += text(fitsRight ? x + 8 : x - 8, (tail + head) / 2 + 4, ryTxt, 'lbl react', fitsRight ? 'start' : 'end');
        }
        if (r.Mz !== null && Math.abs(r.Mz) > 1e-9) {
          loads += momentArc(x, y, r.Mz > 0, 'react', 16);
          const goLeft = !isBeam && x < W / 2;
          loads += text(x + (goLeft ? -20 : 20), y - 22, 'M ' + lab(r.Mz), 'lbl react', goLeft ? 'end' : 'start');
        }
      }
      legend = 'Reacciones en los apoyos (kN y kN·m)';
    }

    /* nudos y etiquetas */
    const occupied = new Map(nodes.map((n) => [n.id, []]));
    const occ = (id, dx, dy) => { const o = occupied.get(id); if (o) { const m = Math.hypot(dx, dy) || 1; o.push([dx / m, dy / m]); } };
    for (const b of bars) {
      const q = barGeom(b);
      occ(b.n1, q.ux, q.uy); occ(b.n2, -q.ux, -q.uy);
    }
    for (const [id, si] of supInfo) {
      if (si.kind === 'rollerx' || (si.kind === 'fixed' && si.orient === 'left')) occ(id, -1, 0);
      else if (si.kind === 'fixed' && si.orient === 'right') occ(id, 1, 0);
      else occ(id, 0, 1);
    }
    if (mode === 'model') {
      for (const l of model.nodalLoads) {
        if (Math.abs(l.fx) > 1e-12) occ(l.node, l.fx > 0 ? -1 : 1, 0);
        if (Math.abs(l.fy) > 1e-12) occ(l.node, 0, l.fy > 0 ? 1 : -1);
        if (Math.abs(l.mz) > 1e-12) { occ(l.node, 1, -1); occ(l.node, 1, 1); }
      }
      for (const l of model.memberLoads) {
        const b = bars.find((q) => q.id === l.elem);
        if (!b || l.type === 'moment') continue;
        const v = l.type === 'udl' ? l.w : l.P;
        const sg = v >= 0 ? 1 : -1;
        const q = barGeom(b);
        const d = l.dir === 'gx' ? [1, 0] : l.dir === 'lx' ? [q.ux, q.uy] : l.dir === 'ly' ? [q.nx, q.ny] : [0, 1];
        occ(b.n1, -d[0] * sg, -d[1] * sg); occ(b.n2, -d[0] * sg, -d[1] * sg);
      }
    }
    if (mode === 'R' && result) {
      for (const r of result.reactions) {
        if (r.Rx !== null && Math.abs(r.Rx) > 1e-9) occ(r.node, r.Rx > 0 ? -1 : 1, 0);
        if (r.Mz !== null && Math.abs(r.Mz) > 1e-9) { occ(r.node, 1, -1); occ(r.node, -1, -1); }
      }
    }
    const momentNodes = new Set();
    if (mode === 'model') for (const l of model.nodalLoads) if (Math.abs(l.mz) > 1e-12) momentNodes.add(l.node);
    if (mode === 'R' && result) for (const r of result.reactions) if (r.Mz !== null && Math.abs(r.Mz) > 1e-9) momentNodes.add(r.node);
    const CAND = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [-1, 0], [1, 0], [0, 1]].map(([a, b]) => { const m = Math.hypot(a, b); return [a / m, b / m]; });
    let nds = '';
    for (const n of nodes) {
      const x = X(n.x), y = Y(isBeam ? 0 : n.y);
      nds += `<circle cx="${px(x)}" cy="${px(y)}" r="${compact ? 3 : 4.2}" class="node"/>`;
      if (!compact) {
        let best = CAND[0], bestScore = -1;
        for (const c of CAND) {
          let sc = Math.PI;
          for (const o of occupied.get(n.id)) sc = Math.min(sc, Math.acos(Math.max(-1, Math.min(1, c[0] * o[0] + c[1] * o[1]))));
          if (sc > bestScore + 1e-6) { best = c; bestScore = sc; }
        }
        const anchor = best[0] < -0.3 ? 'end' : best[0] > 0.3 ? 'start' : 'middle';
        const rr = momentNodes.has(n.id) ? 21 : 10;
        nds += text(x + best[0] * rr, y + best[1] * (rr + 1) + (best[1] === 0 ? 1 : 4), String(n.id), 'nlbl', anchor);
      }
    }

    out += barsSVG + overlay + sups + loads + nds;
    if (legend && !compact) out += text(10, H - 8, legend, 'legend', 'start');
    out += '</svg>';
    return out;
  }

  return { scene, lab };
});
