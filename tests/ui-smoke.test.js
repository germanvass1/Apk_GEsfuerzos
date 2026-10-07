// Simulación de la interfaz con un DOM mínimo: recorre pantallas, vistas y botones.
const assert = require('node:assert');
const { test } = require('node:test');

const handlers = {};
const store = {};
const root = {
  innerHTML: '',
  classList: { toggle() {} },
  addEventListener(type, fn) { handlers[type] = fn; },
  querySelector() { return null; },
  querySelectorAll() { return []; },
};
global.window = global;
global.document = {
  getElementById: () => root,
  body: { classList: { toggle() {} } },
  querySelectorAll: () => [],
};
global.history = { pushState() {}, replaceState() {} };
global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
global.location = { protocol: 'http:', hostname: 'localhost' };
global.navigator = {};
window.addEventListener = () => {};
window.scrollTo = () => {};

window.Solver = require('../www/js/solver.js');
window.Model = require('../www/js/model.js');
window.Draw = require('../www/js/draw.js');
window.Steps = require('../www/js/steps.js');
require('../www/js/app.js');
const app = window.__rigidez;

const click = (act, data) => {
  const el = { dataset: Object.assign({ act }, data || {}), tagName: 'BUTTON' };
  handlers.click({ target: { closest: () => el } });
};
const typeInto = (path, value) => {
  const cls = { toggle() {} };
  handlers.input({ target: { matches: () => true, dataset: { p: path, t: 'n' }, value, parentElement: { classList: cls } } });
};
const choose = (path, value, t) => {
  handlers.change({ target: { matches: (q) => q === 'select[data-act="preset"]' ? false : false, dataset: { p: path, t: t || 's' }, value } });
};
const blur = (path, value) => {
  // al salir de un campo de texto el navegador dispara change con su texto
  handlers.change({ target: { matches: () => false, dataset: { p: path, t: 'n' }, value } });
};
const clean = (html, where) => {
  for (const bad of ['NaN', 'undefined', '[object', 'Infinity', 'null<']) {
    assert.ok(!html.includes(bad), `"${bad}" aparece en ${where}`);
  }
};

test('Inicio muestra los tres tipos con miniaturas', () => {
  app.render();
  assert.match(root.innerHTML, /Vigas continuas/);
  assert.match(root.innerHTML, /Pórticos planos/);
  assert.match(root.innerHTML, /Cerchas planas/);
  assert.strictEqual((root.innerHTML.match(/<svg/g) || []).length, 3);
  clean(root.innerHTML, 'inicio');
});

for (const type of ['beam', 'frame', 'truss']) {
  test(`Ejemplo de ${type}: todas las pestañas, vistas y paso a paso`, () => {
    click('example', { type });
    assert.strictEqual(app.ui.screen, 'edit');
    for (const tab of ['nodes', 'bars', 'loads', 'results']) {
      click('tab', { tab });
      clean(root.innerHTML, `${type}/${tab}`);
      assert.ok(root.innerHTML.includes('<svg'), `hay dibujo en ${tab}`);
    }
    const views = type === 'beam' ? ['model', 'deformed', 'V', 'M', 'R'] : type === 'frame' ? ['model', 'deformed', 'N', 'V', 'M', 'R'] : ['model', 'deformed', 'N', 'R'];
    for (const v of views) {
      click('view', { view: v });
      clean(root.innerHTML, `${type}/vista ${v}`);
      assert.ok(root.innerHTML.includes('class="scene"'), `escena en vista ${v}`);
    }
    assert.match(root.innerHTML, /Equilibrio verificado/);
    click('steps');
    assert.strictEqual(app.ui.screen, 'steps');
    clean(root.innerHTML, `${type}/paso a paso`);
    for (const t of ['Grados de libertad', 'Rigidez de cada barra', 'Ensamblaje', 'Vector de cargas', 'Condiciones de contorno', 'Desplazamientos', 'Reacciones', 'Fuerzas en las barras', 'Verificación de equilibrio']) {
      assert.ok(root.innerHTML.includes(t), 'falta la sección: ' + t);
    }
    click('backEdit');
    assert.strictEqual(app.ui.screen, 'edit');
  });
}

test('Edición: escribir, cambiar signo, agregar y eliminar', () => {
  click('new', { type: 'beam' });
  let st = app.getState();
  assert.strictEqual(st.nodes.length, 2);
  typeInto('nodes.1.x', '6,5');
  assert.strictEqual(app.getState().nodes[1].x, 6.5);
  typeInto('nodes.1.x', '-');
  assert.ok(Number.isNaN(app.getState().nodes[1].x));
  typeInto('nodes.1.x', '6');
  click('addNode');
  st = app.getState();
  assert.strictEqual(st.nodes.length, 3);
  assert.strictEqual(st.bars.length, 2, 'en vigas, un nudo nuevo agrega un tramo');
  click('tab', { tab: 'loads' });
  click('addMember');
  click('addNodal');
  assert.strictEqual(app.getState().member.length, 1);
  click('tab', { tab: 'results' });
  clean(root.innerHTML, 'viga editada');
  assert.match(root.innerHTML, /Equilibrio verificado/);
  // nudo en blanco -> el cálculo falla con un mensaje claro y la app sigue viva
  typeInto('mat.E', '');
  click('tab', { tab: 'results' });
  assert.match(root.innerHTML, /No se pudo calcular/);
  typeInto('mat.E', '25000');
  // quitar apoyos -> inestable
  choose('nodes.0.sup', 'free');
  choose('nodes.1.sup', 'free');
  choose('nodes.2.sup', 'free');
  click('tab', { tab: 'results' });
  assert.match(root.innerHTML, /No se pudo calcular/);
  assert.match(root.innerHTML, /no tiene apoyos/);
  choose('nodes.0.sup', 'roller');
  click('tab', { tab: 'results' });
  assert.match(root.innerHTML, /inestable/);
  assert.match(root.innerHTML, /nudo/);
  // eliminar nudo elimina barras y cargas asociadas
  click('tab', { tab: 'nodes' });
  click('delNode', { i: '2' });
  st = app.getState();
  assert.strictEqual(st.nodes.length, 2);
  assert.ok(st.bars.every((b) => st.nodes.some((n) => n.id === b.n1) && st.nodes.some((n) => n.id === b.n2)));
});

test('Pórtico: cargas de cualquier dirección y sección propia', () => {
  click('example', { type: 'frame' });
  click('tab', { tab: 'loads' });
  click('addMember');
  const i = app.getState().member.length - 1;
  choose(`member.${i}.type`, 'point');
  typeInto(`member.${i}.val`, '12');
  typeInto(`member.${i}.a`, '1,5');
  choose(`member.${i}.dir`, 'gx');
  choose(`member.${i}.bar`, '1', 'i');
  click('tab', { tab: 'bars' });
  clean(root.innerHTML, 'barras');
  click('tab', { tab: 'results' });
  assert.match(root.innerHTML, /Equilibrio verificado/);
});

test('Continuar recupera el trabajo guardado', () => {
  click('new', { type: 'truss' });
  typeInto('nodes.2.y', '4');
  click('home');
  assert.strictEqual(app.ui.screen, 'home');
  assert.match(root.innerHTML, /Continuar/);
  click('open', { type: 'truss' });
  assert.strictEqual(app.getState().nodes[2].y, 4);
});

test('Regresión: la coordenada x se conserva al salir del campo', () => {
  click('new', { type: 'beam' });
  click('addNode');
  const i = app.getState().nodes.length - 1;
  typeInto(`nodes.${i}.x`, '7,5');
  blur(`nodes.${i}.x`, '7,5');
  const st = app.getState();
  assert.strictEqual(st.nodes[i].x, 7.5, 'x sigue siendo un número');
  assert.strictEqual(window.Model.buildModel(st).nodes[i].x, 7.5, 'el modelo usa 7.5, no 0');
  app.render();
  assert.match(root.innerHTML, new RegExp(`data-p="nodes.${i}.x" data-t="n" value="7.5"`), 'el campo muestra 7.5 al volver a dibujarse');
  // lo mismo en un pórtico (x e y) y en una carga
  click('new', { type: 'frame' });
  typeInto('nodes.1.x', '4'); blur('nodes.1.x', '4');
  typeInto('nodes.1.y', '3,5'); blur('nodes.1.y', '3,5');
  const f = window.Model.buildModel(app.getState());
  assert.strictEqual(f.nodes[1].x, 4);
  assert.strictEqual(f.nodes[1].y, 3.5);
  // aunque llegara un número como texto, el modelo lo entiende
  assert.strictEqual(window.Model.buildModel(Object.assign({}, app.getState(), { nodes: [{ id: 1, x: '2,5', y: '1', sup: 'free' }] })).nodes[0].x, 2.5);
});
