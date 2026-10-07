// Pruebas del motor de cálculo contra soluciones analíticas (node tests/solver.test.js)
const assert = require('node:assert');
const { test } = require('node:test');
const S = require('../www/js/solver.js');

const E = 2e8;     // kN/m²  (200 GPa)
const I = 1e-4;    // m⁴
const A = 1e-2;    // m²
const EI = E * I;

const close = (a, b, tol, msg) => {
  const rel = Math.abs(b) > 1 ? tol * Math.abs(b) : tol;
  assert.ok(Math.abs(a - b) <= rel, `${msg || ''} obtenido=${a} esperado=${b} (tol=${rel})`);
};
const reaction = (r, node) => r.reactions.find((x) => x.node === node);
const ssBeamNodes = (L) => [
  { id: 1, x: 0, fix: { uy: true } },
  { id: 2, x: L, fix: { uy: true } },
];

test('Viga simplemente apoyada con carga distribuida', () => {
  const L = 6, w = 10;
  const r = S.solve({
    type: 'beam', nodes: ssBeamNodes(L),
    elements: [{ id: 1, n1: 1, n2: 2, E, I }],
    memberLoads: [{ elem: 1, type: 'udl', w, dir: 'gy' }],
  });
  assert.ok(r.ok, r.error);
  close(reaction(r, 1).Ry, w * L / 2, 1e-9, 'R1');
  close(reaction(r, 2).Ry, w * L / 2, 1e-9, 'R2');
  close(r.extremes.Mmax.v, w * L * L / 8, 1e-6, 'Mmax');
  close(r.extremes.Mmax.x, L / 2, 1e-6, 'x de Mmax');
  close(Math.abs(r.extremes.dmax.v), 5 * w * L ** 4 / (384 * EI), 1e-4, 'flecha');
  assert.ok(r.equilibrium.ok);
});

test('Viga empotrada en ambos extremos con carga distribuida', () => {
  const L = 6, w = 10;
  const r = S.solve({
    type: 'beam',
    nodes: [{ id: 1, x: 0, fix: { uy: true, rz: true } }, { id: 2, x: L, fix: { uy: true, rz: true } }],
    elements: [{ id: 1, n1: 1, n2: 2, E, I }],
    memberLoads: [{ elem: 1, type: 'udl', w }],
  });
  assert.ok(r.ok, r.error);
  close(reaction(r, 1).Mz, w * L * L / 12, 1e-9, 'M izq (antihorario +)');
  close(reaction(r, 2).Mz, -w * L * L / 12, 1e-9, 'M der');
  close(r.extremes.Mmin.v, -w * L * L / 12, 1e-6, 'Mmin');
  close(r.extremes.Mmax.v, w * L * L / 24, 1e-6, 'Mmax');
  close(Math.abs(r.extremes.dmax.v), w * L ** 4 / (384 * EI), 1e-4, 'flecha');
});

test('Viga continua de dos tramos iguales', () => {
  const L = 5, w = 10;
  const r = S.solve({
    type: 'beam',
    nodes: [{ id: 1, x: 0, fix: { uy: true } }, { id: 2, x: L, fix: { uy: true } }, { id: 3, x: 2 * L, fix: { uy: true } }],
    elements: [{ id: 1, n1: 1, n2: 2, E, I }, { id: 2, n1: 2, n2: 3, E, I }],
    memberLoads: [{ elem: 1, type: 'udl', w }, { elem: 2, type: 'udl', w }],
  });
  assert.ok(r.ok, r.error);
  close(reaction(r, 1).Ry, 0.375 * w * L, 1e-9, 'R1');
  close(reaction(r, 2).Ry, 1.25 * w * L, 1e-9, 'R2');
  close(reaction(r, 3).Ry, 0.375 * w * L, 1e-9, 'R3');
  close(r.extremes.Mmin.v, -w * L * L / 8, 1e-6, 'momento en apoyo central');
  assert.ok(r.equilibrium.ok);
});

test('Voladizo con carga puntual en el extremo', () => {
  const L = 4, P = 15;
  const r = S.solve({
    type: 'beam',
    nodes: [{ id: 1, x: 0, fix: { uy: true, rz: true } }, { id: 2, x: L, fix: {} }],
    elements: [{ id: 1, n1: 1, n2: 2, E, I }],
    nodalLoads: [{ node: 2, fy: -P }],
  });
  assert.ok(r.ok, r.error);
  close(r.u[2], -P * L ** 3 / (3 * EI), 1e-9, 'flecha en el extremo');
  close(r.u[3], -P * L * L / (2 * EI), 1e-9, 'giro en el extremo');
  close(reaction(r, 1).Ry, P, 1e-9);
  close(reaction(r, 1).Mz, P * L, 1e-9);
});

test('Cargas puntuales y momento aplicado dentro de la barra', () => {
  const L = 6, P = 20;
  let r = S.solve({
    type: 'beam', nodes: ssBeamNodes(L), elements: [{ id: 1, n1: 1, n2: 2, E, I }],
    memberLoads: [{ elem: 1, type: 'point', P, a: 3 }],
  });
  assert.ok(r.ok, r.error);
  close(reaction(r, 1).Ry, 10, 1e-9);
  close(r.extremes.Mmax.v, P * L / 4, 1e-6, 'Mmax');
  close(Math.abs(r.extremes.dmax.v), P * L ** 3 / (48 * EI), 1e-4, 'flecha');

  r = S.solve({
    type: 'beam', nodes: ssBeamNodes(L), elements: [{ id: 1, n1: 1, n2: 2, E, I }],
    memberLoads: [{ elem: 1, type: 'point', P, a: 2 }],
  });
  close(reaction(r, 1).Ry, P * 4 / 6, 1e-9, 'R1 carga excéntrica');
  close(reaction(r, 2).Ry, P * 2 / 6, 1e-9, 'R2 carga excéntrica');

  const M0 = 12; // antihorario
  r = S.solve({
    type: 'beam', nodes: ssBeamNodes(L), elements: [{ id: 1, n1: 1, n2: 2, E, I }],
    memberLoads: [{ elem: 1, type: 'moment', M: M0, a: 2 }],
  });
  assert.ok(r.ok, r.error);
  close(reaction(r, 1).Ry, M0 / L, 1e-9, 'R1 por momento');
  close(reaction(r, 2).Ry, -M0 / L, 1e-9, 'R2 por momento');
  assert.ok(r.equilibrium.ok);
});

test('Los diagramas coinciden con las fuerzas en los extremos de cada barra', () => {
  const L = 5;
  const r = S.solve({
    type: 'beam',
    nodes: [{ id: 1, x: 0, fix: { uy: true, rz: true } }, { id: 2, x: L, fix: { uy: true } }, { id: 3, x: 2 * L, fix: { uy: true } }],
    elements: [{ id: 1, n1: 1, n2: 2, E, I }, { id: 2, n1: 2, n2: 3, E, I }],
    memberLoads: [
      { elem: 1, type: 'udl', w: 12 },
      { elem: 1, type: 'point', P: 20, a: 2 },
      { elem: 2, type: 'point', P: 30, a: 2.5 },
      { elem: 2, type: 'moment', M: 8, a: 1 },
    ],
  });
  assert.ok(r.ok, r.error);
  assert.ok(r.equilibrium.ok, 'equilibrio global');
  for (const el of r.elements) {
    const end = S.section(el, el.L, 1);
    close(end.V, -el.fEnd2[1], 1e-6, `V en x=L barra ${el.id}`);
    close(end.M, el.fEnd2[2], 1e-6, `M en x=L barra ${el.id}`);
    const d = r.diagrams.find((q) => q.id === el.id).def;
    close(d[d.length - 1].vloc, el.uLocal[2], 1e-3, `deformada en x=L barra ${el.id}`);
    assert.ok(Math.abs(d[0].vloc - el.uLocal[0]) < 1e-12);
  }
});

test('Cercha triangular simple', () => {
  const P = 10;
  const r = S.solve({
    type: 'truss',
    nodes: [{ id: 1, x: 0, y: 0, fix: { ux: true, uy: true } }, { id: 2, x: 4, y: 0, fix: { uy: true } }, { id: 3, x: 2, y: 3 }],
    elements: [{ id: 1, n1: 1, n2: 3, E, A }, { id: 2, n1: 2, n2: 3, E, A }, { id: 3, n1: 1, n2: 2, E, A }],
    nodalLoads: [{ node: 3, fy: -P }],
  });
  assert.ok(r.ok, r.error);
  close(reaction(r, 1).Ry, 5, 1e-9); close(reaction(r, 2).Ry, 5, 1e-9);
  close(reaction(r, 1).Rx, 0, 1e-9);
  const N = (id) => r.elements.find((e) => e.id === id).axial;
  close(N(1), -5 * Math.sqrt(13) / 3, 1e-9, 'compresión AC');
  close(N(2), -5 * Math.sqrt(13) / 3, 1e-9, 'compresión BC');
  close(N(3), 10 / 3, 1e-9, 'tracción AB');
  assert.ok(r.equilibrium.ok);
});

test('Pórtico: voladizo vertical, giro de ejes e inclinación', () => {
  const h = 4, H = 8;
  let r = S.solve({
    type: 'frame',
    nodes: [{ id: 1, x: 0, y: 0, fix: { ux: true, uy: true, rz: true } }, { id: 2, x: 0, y: h }],
    elements: [{ id: 1, n1: 1, n2: 2, E, A, I }],
    nodalLoads: [{ node: 2, fx: H }],
  });
  assert.ok(r.ok, r.error);
  close(r.u[3], H * h ** 3 / (3 * EI), 1e-9, 'desplazamiento horizontal en cabeza');
  close(reaction(r, 1).Rx, -H, 1e-9);
  close(Math.abs(reaction(r, 1).Mz), H * h, 1e-9);

  // mismo voladizo inclinado 60°, carga perpendicular a la barra
  const L = 4, th = Math.PI / 3, P = 10;
  r = S.solve({
    type: 'frame',
    nodes: [{ id: 1, x: 0, y: 0, fix: { ux: true, uy: true, rz: true } }, { id: 2, x: L * Math.cos(th), y: L * Math.sin(th) }],
    elements: [{ id: 1, n1: 1, n2: 2, E, A, I }],
    nodalLoads: [{ node: 2, fx: -P * Math.sin(th), fy: P * Math.cos(th) }],
  });
  assert.ok(r.ok, r.error);
  const dx = r.u[3], dy = r.u[4];
  close(Math.hypot(dx, dy), P * L ** 3 / (3 * EI), 1e-9, 'flecha perpendicular');
  close(dx * Math.cos(th) + dy * Math.sin(th), 0, 1e-9, 'sin desplazamiento axial');
  assert.ok(r.equilibrium.ok);
});

test('Pórtico con viga rígida: rigidez lateral de las columnas', () => {
  const h = 4, Lb = 6, H = 12;
  const Ib = I * 1e6;
  const Ah = A * 1e4; // sin deformación axial: la idealización de viga rígida lo exige
  const r = S.solve({
    type: 'frame',
    nodes: [
      { id: 1, x: 0, y: 0, fix: { ux: true, uy: true, rz: true } },
      { id: 2, x: 0, y: h },
      { id: 3, x: Lb, y: h },
      { id: 4, x: Lb, y: 0, fix: { ux: true, uy: true, rz: true } },
    ],
    elements: [
      { id: 1, n1: 1, n2: 2, E, A: Ah, I }, { id: 2, n1: 2, n2: 3, E, A: Ah, I: Ib }, { id: 3, n1: 4, n2: 3, E, A: Ah, I },
    ],
    nodalLoads: [{ node: 2, fx: H }],
  });
  assert.ok(r.ok, r.error);
  close(r.u[3], H * h ** 3 / (24 * EI), 2e-3, 'desplazamiento lateral');
  close(Math.abs(reaction(r, 1).Mz), H * h / 4, 5e-3, 'momento en la base');
  assert.ok(r.equilibrium.ok);
});

test('Pórtico con cargas en barras: equilibrio global', () => {
  const r = S.solve({
    type: 'frame',
    nodes: [
      { id: 1, x: 0, y: 0, fix: { ux: true, uy: true } },
      { id: 2, x: 0, y: 4 }, { id: 3, x: 6, y: 4 },
      { id: 4, x: 6, y: 0, fix: { ux: true, uy: true, rz: true } },
    ],
    elements: [{ id: 1, n1: 1, n2: 2, E, A, I }, { id: 2, n1: 2, n2: 3, E, A, I }, { id: 3, n1: 4, n2: 3, E, A, I }],
    nodalLoads: [{ node: 2, fx: 5, mz: -3 }],
    memberLoads: [
      { elem: 2, type: 'udl', w: 15, dir: 'gy' },
      { elem: 1, type: 'udl', w: 4, dir: 'gx' },
      { elem: 3, type: 'point', P: 7, a: 1.5, dir: 'gx' },
      { elem: 2, type: 'moment', M: 9, a: 2 },
    ],
  });
  assert.ok(r.ok, r.error);
  assert.ok(r.equilibrium.ok, JSON.stringify(r.equilibrium));
});

test('Detección de estructuras inestables y errores de datos', () => {
  let r = S.solve({
    type: 'beam',
    nodes: [{ id: 1, x: 0, fix: { uy: true } }, { id: 2, x: 5, fix: {} }],
    elements: [{ id: 1, n1: 1, n2: 2, E, I }],
    nodalLoads: [{ node: 2, fy: -1 }],
  });
  assert.strictEqual(r.ok, false);
  assert.match(r.error, /inestable/);

  r = S.solve({
    type: 'truss',
    nodes: [{ id: 1, x: 0, y: 0, fix: { ux: true, uy: true } }, { id: 2, x: 4, y: 0, fix: { uy: true } }, { id: 3, x: 2, y: 3 }, { id: 4, x: 5, y: 5 }],
    elements: [{ id: 1, n1: 1, n2: 3, E, A }, { id: 2, n1: 2, n2: 3, E, A }, { id: 3, n1: 1, n2: 2, E, A }],
    nodalLoads: [{ node: 3, fy: -10 }],
  });
  assert.strictEqual(r.ok, false, 'un nudo sin barras es inestable');

  r = S.solve({ type: 'beam', nodes: ssBeamNodes(5), elements: [{ id: 1, n1: 1, n2: 2, E, I: 0 }] });
  assert.strictEqual(r.ok, false);
  assert.match(r.error, /inercia/);
});
