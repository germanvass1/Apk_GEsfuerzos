/*
 * Modelo de datos de la app: estado editable, ejemplos y conversión al
 * formato que entiende el motor de cálculo (kN, m).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Model = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FIX = {
    free: {},
    pin: { ux: true, uy: true },
    roller: { uy: true },
    rollerx: { ux: true },
    fixed: { ux: true, uy: true, rz: true },
  };

  const SUPPORT_OPTIONS = {
    beam: [['free', 'Libre'], ['roller', 'Apoyo simple (fija y)'], ['fixed', 'Empotrado']],
    frame: [['free', 'Libre'], ['pin', 'Articulado (fija x e y)'], ['roller', 'Rodillo (fija y)'],
      ['rollerx', 'Rodillo horizontal (fija x)'], ['fixed', 'Empotrado']],
    truss: [['free', 'Libre'], ['pin', 'Articulado (fija x e y)'], ['roller', 'Rodillo (fija y)'],
      ['rollerx', 'Rodillo horizontal (fija x)']],
  };

  const TYPE_INFO = {
    beam: { name: 'Vigas continuas', short: 'Viga', blurb: 'Tramos con apoyos simples o empotrados. Flexión y corte.' },
    frame: { name: 'Pórticos planos', short: 'Pórtico', blurb: 'Columnas y vigas rígidas. Axial, corte y momento.' },
    truss: { name: 'Cerchas planas', short: 'Cercha', blurb: 'Barras articuladas con carga en los nudos. Solo axial.' },
  };

  // E del concreto según E.060: Ec = 15000 √f'c (kg/cm²), convertido a MPa
  const concreteE = (fc) => Math.round(15000 * Math.sqrt(fc) * 0.0980665);
  const MATERIALS = [
    { key: 'c210', label: "Concreto f'c = 210 kg/cm²", E: concreteE(210) },
    { key: 'c280', label: "Concreto f'c = 280 kg/cm²", E: concreteE(280) },
    { key: 's200', label: 'Acero (E = 200 GPa)', E: 200000 },
    { key: 'w10', label: 'Madera (E = 10 GPa)', E: 10000 },
  ];

  const newSection = () => ({ mode: 'rect', b: 30, h: 50, A: 1500, I: 312500 });

  function emptyState(type) {
    const st = {
      v: 1, type, nextNode: 1, nextBar: 1,
      nodes: [], bars: [], nodal: [], member: [],
      mat: { E: concreteE(210) }, sec: newSection(),
    };
    const addN = (x, y, sup) => { st.nodes.push({ id: st.nextNode++, x, y, sup }); };
    const addB = (n1, n2) => { st.bars.push({ id: st.nextBar++, n1, n2, custom: false, E: st.mat.E, sec: newSection() }); };
    if (type === 'beam') {
      addN(0, 0, 'roller'); addN(5, 0, 'roller'); addB(1, 2);
    } else if (type === 'frame') {
      addN(0, 0, 'fixed'); addN(0, 3, 'free'); addB(1, 2);
      st.sec = { mode: 'rect', b: 30, h: 30, A: 900, I: 67500 };
    } else {
      addN(0, 0, 'pin'); addN(4, 0, 'roller'); addN(2, 3, 'free');
      addB(1, 3); addB(2, 3); addB(1, 2);
      st.mat.E = 200000;
      st.sec = { mode: 'manual', b: 5, h: 5, A: 20, I: 100 };
    }
    return st;
  }

  function example(type) {
    const st = emptyState(type);
    st.nodes = []; st.bars = []; st.nodal = []; st.member = [];
    st.nextNode = 1; st.nextBar = 1;
    const addN = (x, y, sup) => { st.nodes.push({ id: st.nextNode++, x, y, sup }); };
    const addB = (n1, n2, extra) => {
      st.bars.push(Object.assign({ id: st.nextBar++, n1, n2, custom: false, E: st.mat.E, sec: newSection() }, extra || {}));
    };
    if (type === 'beam') {
      st.sec = { mode: 'rect', b: 30, h: 50, A: 1500, I: 312500 };
      addN(0, 0, 'fixed'); addN(5, 0, 'roller'); addN(9, 0, 'roller');
      addB(1, 2); addB(2, 3);
      st.member.push({ bar: 1, type: 'udl', val: 20, a: 0, dir: 'gy' });
      st.member.push({ bar: 2, type: 'point', val: 40, a: 2, dir: 'gy' });
    } else if (type === 'frame') {
      st.sec = { mode: 'rect', b: 30, h: 50, A: 1500, I: 312500 };
      addN(0, 0, 'fixed'); addN(0, 3.5, 'free'); addN(5, 3.5, 'free'); addN(5, 0, 'fixed');
      const col = { custom: true, sec: { mode: 'rect', b: 30, h: 30, A: 900, I: 67500 } };
      addB(1, 2, col); addB(2, 3); addB(4, 3, col);
      st.nodal.push({ node: 2, fx: 20, fy: 0, mz: 0 });
      st.member.push({ bar: 2, type: 'udl', val: 25, a: 0, dir: 'gy' });
    } else {
      st.mat.E = 200000;
      st.sec = { mode: 'manual', b: 5, h: 5, A: 20, I: 100 };
      addN(0, 0, 'pin'); addN(4, 0, 'free'); addN(8, 0, 'roller'); addN(2, 3, 'free'); addN(6, 3, 'free');
      [[1, 2], [2, 3], [4, 5], [1, 4], [4, 2], [2, 5], [5, 3]].forEach(([a, b]) => addB(a, b));
      st.nodal.push({ node: 4, fx: 0, fy: -10, mz: 0 });
      st.nodal.push({ node: 5, fx: 0, fy: -10, mz: 0 });
      st.nodal.push({ node: 2, fx: 0, fy: -20, mz: 0 });
    }
    return st;
  }

  const num = (v) => {
    const n = typeof v === 'string' && v.trim() !== '' ? Number(v.replace(',', '.')) : v;
    return typeof n === 'number' && isFinite(n) ? n : 0;
  };

  /** Propiedades de la sección en cm² y cm⁴ */
  function sectionProps(sec) {
    if (sec.mode === 'rect') {
      const b = num(sec.b), h = num(sec.h);
      return { A: b * h, I: (b * h ** 3) / 12 };
    }
    return { A: num(sec.A), I: num(sec.I) };
  }

  /** Convierte el estado de la app al modelo del motor de cálculo */
  function buildModel(st) {
    const nodeById = new Map(st.nodes.map((n) => [n.id, n]));
    const bars = st.bars.map((b) => {
      let { n1, n2 } = b;
      const p1 = nodeById.get(n1), p2 = nodeById.get(n2);
      const flipped = st.type === 'beam' && p1 && p2 && p1.x > p2.x;
      if (flipped) [n1, n2] = [n2, n1];
      const src = b.custom ? { E: b.E, sec: b.sec } : { E: st.mat.E, sec: st.sec };
      const sp = sectionProps(src.sec);
      return {
        id: b.id, n1, n2, flipped,
        E: num(src.E) * 1000,          // MPa -> kN/m²
        A: sp.A / 1e4,                 // cm² -> m²
        I: sp.I / 1e8,                 // cm⁴ -> m⁴
      };
    });
    const barById = new Map(bars.map((b) => [b.id, b]));
    const nodes = st.nodes.map((n) => ({
      id: n.id, x: num(n.x), y: st.type === 'beam' ? 0 : num(n.y),
      fix: Object.assign({}, FIX[n.sup] || {}),
      sup: n.sup,
    }));
    const nodalLoads = st.nodal.map((l) => ({ node: l.node, fx: num(l.fx), fy: num(l.fy), mz: num(l.mz) }));
    const memberLoads = st.member.map((l) => {
      const b = barById.get(l.bar);
      let a = num(l.a);
      if (b && b.flipped && l.type !== 'udl') {
        const p1 = nodeById.get(b.n1), p2 = nodeById.get(b.n2);
        const L = Math.abs(num(p1.x) - num(p2.x));
        a = L - a;
      }
      const out = { elem: l.bar, type: l.type, dir: l.dir || 'gy', a };
      if (l.type === 'udl') out.w = num(l.val);
      else if (l.type === 'point') out.P = num(l.val);
      else out.M = num(l.val);
      return out;
    });
    return { type: st.type, nodes, elements: bars, nodalLoads, memberLoads };
  }

  /** Avisos rápidos sobre los datos (antes de calcular) */
  function checkState(st) {
    const out = [];
    const ids = new Set(st.nodes.map((n) => n.id));
    if (st.bars.some((b) => b.n1 === b.n2)) out.push('Hay barras que empiezan y terminan en el mismo nudo.');
    if (st.bars.some((b) => !ids.has(b.n1) || !ids.has(b.n2))) out.push('Hay barras con un nudo que ya no existe.');
    const seen = new Set();
    for (const b of st.bars) {
      const k = [Math.min(b.n1, b.n2), Math.max(b.n1, b.n2)].join('-');
      if (seen.has(k)) { out.push('Hay dos barras entre los mismos nudos.'); break; }
      seen.add(k);
    }
    if (st.type === 'beam') {
      const xs = st.nodes.map((n) => num(n.x));
      if (new Set(xs).size !== xs.length) out.push('Dos nudos tienen la misma posición x.');
    }
    return out;
  }

  return { FIX, SUPPORT_OPTIONS, TYPE_INFO, MATERIALS, emptyState, example, sectionProps, buildModel, checkState, newSection, concreteE };
});
