/*
 * Rigidez: interfaz de la app (inicio, editor, resultados y paso a paso).
 */
(function () {
  'use strict';

  const root = document.getElementById('app');
  const M = window.Model, S = window.Solver, D = window.Draw, ST = window.Steps;
  const fm = ST.fm;

  const ui = { screen: 'home', tab: 'nodes', view: 'model', confirm: null, toast: null };
  let st = null;
  let thumbCache = {};

  /* ------------------------------------------------------- persistencia */
  const KEY = (t) => 'rigidez:v1:' + t;
  function loadSaved(type) {
    try { const s = localStorage.getItem(KEY(type)); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  }
  function save() { try { localStorage.setItem(KEY(st.type), JSON.stringify(st)); } catch (e) { /* sin almacenamiento */ } }

  /* ---------------------------------------------------------- utilidades */
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const fin = (v) => typeof v === 'number' && isFinite(v);
  const val = (v) => (fin(v) ? String(v) : '');

  function getPath(o, p) { return p.split('.').reduce((a, k) => (a == null ? a : a[k]), o); }
  function setPath(o, p, v) {
    const ks = p.split('.');
    const last = ks.pop();
    const t = ks.reduce((a, k) => a[k], o);
    t[last] = v;
  }

  const ICON = {
    back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    nodes: '<svg viewBox="0 0 24 24"><circle cx="6" cy="7" r="2.4"/><circle cx="18" cy="7" r="2.4"/><circle cx="12" cy="18" r="2.4"/></svg>',
    bars: '<svg viewBox="0 0 24 24"><path d="M3 19h18M5 19V6h14v13M5 6l14 13"/></svg>',
    loads: '<svg viewBox="0 0 24 24"><path d="M12 3v14M7 12l5 5 5-5M5 21h14"/></svg>',
    results: '<svg viewBox="0 0 24 24"><path d="M4 20V4M4 20h16M8 15l4-6 3 4 4-7"/></svg>',
  };

  const barWord = () => (st.type === 'beam' ? 'Tramo' : 'Barra');

  /* -------------------------------------------------------- campos HTML */
  function numField(label, path, opts) {
    opts = opts || {};
    const v = getPath(st, path);
    return `<label class="fld${opts.wide ? ' wide' : ''}"><span>${label}</span><span class="num${fin(v) ? '' : ' bad'}">` +
      `<input type="text" inputmode="decimal" autocomplete="off" data-p="${path}" data-t="n" value="${esc(val(v))}" aria-label="${esc(label)}">` +
      (opts.nosign ? '' : `<button type="button" class="sign" data-act="flip" data-p="${path}" aria-label="Cambiar signo de ${esc(label)}">±</button>`) +
      `</span></label>`;
  }
  function selField(label, path, options, opts) {
    opts = opts || {};
    const cur = String(getPath(st, path));
    return `<label class="fld${opts.wide ? ' wide' : ''}"><span>${label}</span><select data-p="${path}" data-t="${opts.t || 's'}">` +
      options.map(([v, l]) => `<option value="${esc(v)}"${String(v) === cur ? ' selected' : ''}>${esc(l)}</option>`).join('') +
      '</select></label>';
  }
  const nodeOptions = () => st.nodes.map((n) => [n.id, 'Nudo ' + n.id]);
  const barOptions = () => st.bars.map((b) => [b.id, barWord() + ' ' + b.id]);

  function secInfoText(key) {
    const sec = key === 'global' ? st.sec : (st.bars[+key.split(':')[1]] || {}).sec;
    if (!sec) return '';
    const p = M.sectionProps(sec);
    if (st.type === 'truss') return `A = ${fm(p.A)} cm²`;
    if (st.type === 'beam') return `I = ${fm(p.I)} cm⁴`;
    return `A = ${fm(p.A)} cm², I = ${fm(p.I)} cm⁴`;
  }

  function secFields(prefix, sec, key) {
    let h = selField('Sección', prefix + '.mode', [['rect', 'Rectangular b × h'], ['manual', st.type === 'truss' ? 'Área conocida' : 'Propiedades conocidas']], { wide: true });
    if (sec.mode === 'rect') {
      h += numField('Base b (cm)', prefix + '.b', { nosign: true }) + numField('Altura h (cm)', prefix + '.h', { nosign: true });
    } else {
      if (st.type !== 'beam') h += numField('Área A (cm²)', prefix + '.A', { nosign: true });
      if (st.type !== 'truss') h += numField('Inercia I (cm⁴)', prefix + '.I', { nosign: true });
    }
    h += `<div class="unit-note fld wide" data-sec="${key}">${esc(secInfoText(key))}</div>`;
    return h;
  }

  /* ----------------------------------------------------------- dibujos */
  function drawModelSVG() {
    return D.scene({ model: M.buildModel(st), mode: 'model', W: 360, H: 230, aria: 'Esquema de la estructura con apoyos y cargas' });
  }
  function warnHTML() {
    const w = M.checkState(st);
    return w.length ? `<div class="notice">${w.map(esc).join('<br>')}</div>` : '';
  }
  function refreshLive() {
    const d = document.getElementById('draw');
    if (d && ui.screen === 'edit' && ui.tab !== 'results') d.innerHTML = drawModelSVG();
    document.querySelectorAll('[data-sec]').forEach((el) => { el.textContent = secInfoText(el.dataset.sec); });
    const w = document.getElementById('warn');
    if (w) w.innerHTML = warnHTML();
  }

  /* -------------------------------------------------------------- inicio */
  function thumb(type) {
    if (!thumbCache[type]) {
      const ex = M.example(type);
      thumbCache[type] = D.scene({ model: M.buildModel(ex), mode: 'model', W: 360, H: 150, compact: true, aria: 'Ejemplo de ' + M.TYPE_INFO[type].name.toLowerCase() });
    }
    return thumbCache[type];
  }

  function renderHome() {
    let h = '<div class="hero"><h1>Rigidez</h1><p>Análisis matricial de estructuras planas, con cada matriz a la vista.</p></div><div class="kinds">';
    for (const t of ['beam', 'frame', 'truss']) {
      const info = M.TYPE_INFO[t];
      const saved = loadSaved(t);
      h += `<section class="kind"><div class="thumb">${thumb(t)}</div><h2>${info.name}</h2><p>${info.blurb}</p><div class="row">` +
        (saved ? `<button class="btn primary" data-act="open" data-type="${t}">Continuar</button>` : `<button class="btn primary" data-act="new" data-type="${t}">Empezar</button>`) +
        (saved ? `<button class="btn" data-act="new" data-type="${t}">Nuevo</button>` : '') +
        `<button class="btn quiet" data-act="example" data-type="${t}">Ver ejemplo</button></div></section>`;
    }
    return h + '</div>';
  }

  /* ------------------------------------------------------------- editor */
  function topbar(title, sub, back) {
    return `<header class="top"><button class="iconbtn" data-act="${back}" aria-label="Volver">${ICON.back}</button>` +
      `<h1>${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}</h1></header>`;
  }

  function tabsBar() {
    const items = [['nodes', 'Nudos'], ['bars', st.type === 'beam' ? 'Tramos' : 'Barras'], ['loads', 'Cargas'], ['results', 'Resultados']];
    return `<nav class="tabs" aria-label="Secciones"><div class="tabs-in">` +
      items.map(([k, l]) => `<button class="tab" data-act="tab" data-tab="${k}"${ui.tab === k ? ' aria-current="page"' : ''}>${ICON[k]}<span>${l}</span></button>`).join('') +
      '</div></nav>';
  }

  function tabNodes() {
    const isBeam = st.type === 'beam';
    let h = '<div class="pad"><h2 class="sec-title" style="margin-top:6px">Nudos</h2>' +
      `<p class="hint">${isBeam ? 'Posición x de cada apoyo o unión, en metros, medida desde el extremo izquierdo.' : 'Coordenadas en metros. El eje x va a la derecha y el eje y hacia arriba.'}</p>`;
    st.nodes.forEach((n, i) => {
      h += `<div class="item"><div class="item-head"><span class="tag">Nudo ${n.id}</span>` +
        `<button class="iconbtn" data-act="delNode" data-i="${i}" aria-label="Eliminar nudo ${n.id}">${ICON.trash}</button></div><div class="fields">` +
        numField('x (m)', `nodes.${i}.x`) + (isBeam ? '' : numField('y (m)', `nodes.${i}.y`)) +
        selField('Apoyo', `nodes.${i}.sup`, M.SUPPORT_OPTIONS[st.type], { wide: true }) + '</div></div>';
    });
    h += '<div class="addrow"><button class="btn" data-act="addNode">Agregar nudo</button></div><div id="warn">' + warnHTML() + '</div>';
    h += '<h2 class="sec-title">Problema</h2><div class="actions">' +
      `<button class="btn quiet sm" data-act="reloadExample">${ui.confirm === 'example' ? 'Toca otra vez para confirmar' : 'Cargar ejemplo'}</button>` +
      `<button class="btn quiet sm" data-act="resetAll">${ui.confirm === 'reset' ? 'Toca otra vez para confirmar' : 'Empezar de cero'}</button></div></div>`;
    return h;
  }

  function tabBars() {
    const mats = M.MATERIALS;
    let h = '<div class="pad"><h2 class="sec-title" style="margin-top:6px">Material y sección general</h2>' +
      '<p class="hint">Se aplica a todas las barras, salvo las que tengan sección propia.</p><div class="fields">' +
      `<label class="fld wide"><span>Material</span><select data-act="preset" aria-label="Material">` +
      `<option value="">Personalizado</option>` + mats.map((m) => `<option value="${m.key}"${st.mat.E === m.E ? ' selected' : ''}>${esc(m.label)}</option>`).join('') + '</select></label>' +
      numField('Módulo E (MPa)', 'mat.E', { nosign: true }) + '</div><div class="fields" style="margin-top:6px">' + secFields('sec', st.sec, 'global') + '</div>';
    h += `<h2 class="sec-title">${st.type === 'beam' ? 'Tramos' : 'Barras'}</h2>` +
      `<p class="hint">${st.type === 'beam' ? 'Cada tramo une dos nudos consecutivos.' : 'Cada barra une dos nudos. El sentido del nudo inicial al final define sus ejes locales.'}</p>`;
    st.bars.forEach((b, i) => {
      h += `<div class="item"><div class="item-head"><span class="tag">${barWord()} ${b.id}</span>` +
        `<button class="iconbtn" data-act="delBar" data-i="${i}" aria-label="Eliminar ${barWord().toLowerCase()} ${b.id}">${ICON.trash}</button></div><div class="fields">` +
        selField('Nudo inicial', `bars.${i}.n1`, nodeOptions(), { t: 'i' }) + selField('Nudo final', `bars.${i}.n2`, nodeOptions(), { t: 'i' }) +
        `<label class="check fld wide"><input type="checkbox" data-p="bars.${i}.custom" data-t="b"${b.custom ? ' checked' : ''}> Sección propia</label>`;
      if (b.custom) h += numField('Módulo E (MPa)', `bars.${i}.E`, { nosign: true }) + secFields(`bars.${i}.sec`, b.sec, 'bar:' + i);
      h += '</div></div>';
    });
    h += `<div class="addrow"><button class="btn" data-act="addBar">Agregar ${barWord().toLowerCase()}</button></div><div id="warn">${warnHTML()}</div></div>`;
    return h;
  }

  const DIRS = [['gy', 'Gravedad (hacia abajo)'], ['gx', 'Horizontal (hacia la derecha)'], ['ly', 'Perpendicular a la barra'], ['lx', 'A lo largo de la barra']];
  const DIR_HINT = {
    gy: 'Positivo hacia abajo.', gx: 'Positivo hacia la derecha.',
    ly: 'Positivo a la izquierda del sentido de la barra.', lx: 'Positivo del nudo inicial al final.',
  };

  function barLength(id) {
    const b = st.bars.find((q) => q.id === id);
    if (!b) return null;
    const p1 = st.nodes.find((n) => n.id === b.n1), p2 = st.nodes.find((n) => n.id === b.n2);
    if (!p1 || !p2) return null;
    const dx = (p2.x || 0) - (p1.x || 0), dy = st.type === 'beam' ? 0 : (p2.y || 0) - (p1.y || 0);
    return Math.hypot(dx, dy);
  }

  function tabLoads() {
    const isBeam = st.type === 'beam', isTruss = st.type === 'truss';
    let h = '<div class="pad"><h2 class="sec-title" style="margin-top:6px">Cargas en nudos</h2>' +
      `<p class="hint">${isBeam ? 'Fy positivo hacia arriba.' : 'Fx positivo a la derecha y Fy positivo hacia arriba.'}${isTruss ? '' : ' Mz positivo en sentido antihorario.'} Una carga que baja es negativa.</p>`;
    st.nodal.forEach((l, i) => {
      h += `<div class="item"><div class="item-head"><span class="tag">Carga ${i + 1}</span><button class="iconbtn" data-act="delNodal" data-i="${i}" aria-label="Eliminar carga en nudo">${ICON.trash}</button></div><div class="fields">` +
        selField('En el nudo', `nodal.${i}.node`, nodeOptions(), { t: 'i', wide: true }) +
        (isBeam ? '' : numField('Fx (kN)', `nodal.${i}.fx`)) + numField('Fy (kN)', `nodal.${i}.fy`) + (isTruss ? '' : numField('Mz (kN·m)', `nodal.${i}.mz`)) +
        '</div></div>';
    });
    h += '<div class="addrow"><button class="btn" data-act="addNodal">Agregar carga en nudo</button></div>';

    if (!isTruss) {
      h += `<h2 class="sec-title">Cargas en ${isBeam ? 'tramos' : 'barras'}</h2><p class="hint">Distribuidas, puntuales o momentos aplicados dentro de la barra.</p>`;
      st.member.forEach((l, i) => {
        const L = barLength(l.bar);
        const typeOpts = [['udl', 'Distribuida uniforme'], ['point', 'Puntual'], ['moment', 'Momento aplicado']];
        const label = l.type === 'udl' ? 'Intensidad w (kN/m)' : l.type === 'point' ? 'Carga P (kN)' : 'Momento M (kN·m)';
        h += `<div class="item"><div class="item-head"><span class="tag">Carga ${i + 1}</span><button class="iconbtn" data-act="delMember" data-i="${i}" aria-label="Eliminar carga en barra">${ICON.trash}</button></div><div class="fields">` +
          selField(isBeam ? 'En el tramo' : 'En la barra', `member.${i}.bar`, barOptions(), { t: 'i' }) +
          selField('Tipo', `member.${i}.type`, typeOpts) +
          numField(label, `member.${i}.val`) +
          (l.type === 'udl' ? '' : numField(`Posición a (m)${L ? ` de ${fm(L)}` : ''}`, `member.${i}.a`, { nosign: true })) +
          ((isBeam || l.type === 'moment') ? '' : selField('Dirección', `member.${i}.dir`, DIRS, { wide: true })) +
          '</div>' +
          `<p class="hint" style="margin:6px 0 0">${l.type === 'moment' ? 'Positivo en sentido antihorario.' : isBeam ? 'Positivo hacia abajo.' : DIR_HINT[l.dir || 'gy']}${l.type === 'udl' ? '' : ' La posición se mide desde el nudo inicial.'}</p></div>`;
      });
      h += '<div class="addrow"><button class="btn" data-act="addMember">Agregar carga en ' + (isBeam ? 'tramo' : 'barra') + '</button></div>';
    }
    return h + '</div>';
  }

  /* ---------------------------------------------------------- resultados */
  function currentResult() {
    const model = M.buildModel(st);
    return { model, res: S.solve(model) };
  }

  const VIEWS = {
    beam: [['model', 'Cargas'], ['deformed', 'Deformada'], ['V', 'Cortante'], ['M', 'Momento'], ['R', 'Reacciones']],
    frame: [['model', 'Cargas'], ['deformed', 'Deformada'], ['N', 'Axial'], ['V', 'Cortante'], ['M', 'Momento'], ['R', 'Reacciones']],
    truss: [['model', 'Cargas'], ['deformed', 'Deformada'], ['N', 'Axial'], ['R', 'Reacciones']],
  };

  const f3 = (v) => (Math.abs(v) < 5e-7 ? '0' : v.toFixed(3));
  const f4 = (v) => (Math.abs(v) < 5e-9 ? '0' : Math.abs(v) >= 0.001 ? v.toFixed(4) : v.toExponential(2));

  function nodeDisp(res, nodeId) {
    const i = res.nodes.findIndex((n) => n.id === nodeId);
    const o = {};
    res.dofNames.forEach((nm, j) => { o[nm] = res.u[i * res.dpn + j]; });
    return o;
  }

  function resultsTables(res) {
    const kind = res.type;
    let h = '';
    /* resumen */
    const ex = res.extremes;
    h += '<h2 class="sec-title">Resumen</h2><div class="cards">';
    if (kind === 'truss') {
      h += `<div class="stat N"><b>${f3(ex.Nmax.v)}</b><span>Mayor tracción (kN), barra ${ex.Nmax.elem}</span></div>` +
        `<div class="stat N"><b>${f3(ex.Nmin.v)}</b><span>Mayor compresión (kN), barra ${ex.Nmin.elem}</span></div>`;
      let md = 0, mn = null;
      res.nodes.forEach((n) => { const d = nodeDisp(res, n.id); const m = Math.hypot(d.ux, d.uy); if (m > md) { md = m; mn = n.id; } });
      h += `<div class="stat D"><b>${f3(md * 1000)}</b><span>Mayor desplazamiento (mm), nudo ${mn || '-'}</span></div>`;
    } else {
      h += `<div class="stat M"><b>${f3(ex.Mmax.v)}</b><span>Momento máximo (kN·m), x = ${f3(ex.Mmax.x)} m en ${barWord().toLowerCase()} ${ex.Mmax.elem}</span></div>` +
        `<div class="stat M"><b>${f3(ex.Mmin.v)}</b><span>Momento mínimo (kN·m), x = ${f3(ex.Mmin.x)} m en ${barWord().toLowerCase()} ${ex.Mmin.elem}</span></div>` +
        `<div class="stat V"><b>${f3(Math.abs(ex.Vmax.v) >= Math.abs(ex.Vmin.v) ? ex.Vmax.v : ex.Vmin.v)}</b><span>Cortante de mayor valor (kN)</span></div>`;
      if (ex.dmax && Math.abs(ex.dmax.v) > 0) h += `<div class="stat D"><b>${f3(Math.abs(ex.dmax.v) * 1000)}</b><span>Flecha máxima (mm) en ${barWord().toLowerCase()} ${ex.dmax.elem}</span></div>`;
    }
    h += '</div>';

    /* reacciones */
    h += '<h2 class="sec-title">Reacciones</h2><div class="tbl-wrap"><table class="res"><thead><tr><th>Nudo</th>' +
      (kind === 'beam' ? '' : '<th>Rx (kN)</th>') + '<th>Ry (kN)</th>' + (kind === 'truss' ? '' : '<th>Mz (kN·m)</th>') + '</tr></thead><tbody>';
    for (const r of res.reactions) {
      h += `<tr><th scope="row">${r.node}</th>` + (kind === 'beam' ? '' : `<td>${r.Rx === null ? '-' : f3(r.Rx)}</td>`) + `<td>${r.Ry === null ? '-' : f3(r.Ry)}</td>` +
        (kind === 'truss' ? '' : `<td>${r.Mz === null ? '-' : f3(r.Mz)}</td>`) + '</tr>';
    }
    h += '</tbody></table></div>';
    h += `<p class="hint">Rx positivo a la derecha, Ry positivo hacia arriba, Mz positivo antihorario.</p>`;

    /* desplazamientos */
    h += '<h2 class="sec-title">Desplazamientos de los nudos</h2><div class="tbl-wrap"><table class="res"><thead><tr><th>Nudo</th>' +
      (kind === 'beam' ? '' : '<th>ux (mm)</th>') + '<th>uy (mm)</th>' + (kind === 'truss' ? '' : '<th>giro (rad)</th>') + '</tr></thead><tbody>';
    for (const n of res.nodes) {
      const d = nodeDisp(res, n.id);
      h += `<tr><th scope="row">${n.id}</th>` + (kind === 'beam' ? '' : `<td>${f3(d.ux * 1000)}</td>`) + `<td>${f3(d.uy * 1000)}</td>` + (kind === 'truss' ? '' : `<td>${f4(d.rz)}</td>`) + '</tr>';
    }
    h += '</tbody></table></div>';

    /* esfuerzos en barras */
    if (kind === 'truss') {
      h += '<h2 class="sec-title">Fuerza axial en las barras</h2><div class="tbl-wrap"><table class="res"><thead><tr><th>Barra</th><th>N (kN)</th><th>Estado</th></tr></thead><tbody>';
      for (const el of res.elements) {
        const n = el.axial;
        const tag = Math.abs(n) < 1e-6 ? 'Nula' : n > 0 ? '<span class="pill t">Tracción</span>' : '<span class="pill c">Compresión</span>';
        h += `<tr><th scope="row">${el.id}</th><td>${f3(n)}</td><td class="txt">${tag}</td></tr>`;
      }
      h += '</tbody></table></div>';
    } else {
      h += `<h2 class="sec-title">Esfuerzos en los extremos</h2><div class="tbl-wrap"><table class="res"><thead><tr><th>${barWord()}</th><th>Sección</th>` +
        (kind === 'beam' ? '' : '<th>N (kN)</th>') + '<th>V (kN)</th><th>M (kN·m)</th></tr></thead><tbody>';
      for (const el of res.elements) {
        const a = S.section(el, 0, 1), b = S.section(el, el.L, 1);
        h += `<tr><th scope="row">${el.id}</th><td class="txt">inicio</td>` + (kind === 'beam' ? '' : `<td>${f3(a.N)}</td>`) + `<td>${f3(a.V)}</td><td>${f3(a.M)}</td></tr>` +
          `<tr><th scope="row"></th><td class="txt">final</td>` + (kind === 'beam' ? '' : `<td>${f3(b.N)}</td>`) + `<td>${f3(b.V)}</td><td>${f3(b.M)}</td></tr>`;
      }
      h += '</tbody></table></div><p class="hint">N positivo en tracción. V positivo cuando el corte tiende a girar el tramo en sentido horario. M positivo tensa la fibra inferior de una barra horizontal.</p>';
    }

    h += `<p class="verdict ${res.equilibrium.ok ? 'good' : 'bad'}">${res.equilibrium.ok ? 'Equilibrio verificado: las cargas y las reacciones se anulan.' : 'El equilibrio no se cumple. Revise los datos.'}</p>`;
    h += '<div class="actions"><button class="btn primary" data-act="steps">Ver paso a paso</button><button class="btn" data-act="copy">Copiar resultados</button></div>';
    return h;
  }

  function resultsText(res) {
    const kind = res.type;
    const L = [];
    L.push('Rigidez: ' + M.TYPE_INFO[kind].name + ' (kN, m)');
    L.push('', 'Reacciones');
    for (const r of res.reactions) {
      L.push(`Nudo ${r.node}: ` + [r.Rx !== null && kind !== 'beam' ? `Rx=${f3(r.Rx)}` : '', r.Ry !== null ? `Ry=${f3(r.Ry)}` : '', r.Mz !== null ? `Mz=${f3(r.Mz)}` : ''].filter(Boolean).join('  '));
    }
    L.push('', 'Desplazamientos (mm, rad)');
    for (const n of res.nodes) {
      const d = nodeDisp(res, n.id);
      L.push(`Nudo ${n.id}: ` + [d.ux !== undefined ? `ux=${f3(d.ux * 1000)}` : '', `uy=${f3(d.uy * 1000)}`, d.rz !== undefined ? `giro=${f4(d.rz)}` : ''].filter(Boolean).join('  '));
    }
    L.push('', kind === 'truss' ? 'Fuerza axial (tracción +)' : 'Esfuerzos en los extremos');
    for (const el of res.elements) {
      if (kind === 'truss') L.push(`Barra ${el.id}: N=${f3(el.axial)}`);
      else {
        const a = S.section(el, 0, 1), b = S.section(el, el.L, 1);
        L.push(`${barWord()} ${el.id} inicio: ` + (kind === 'beam' ? '' : `N=${f3(a.N)} `) + `V=${f3(a.V)} M=${f3(a.M)}`);
        L.push(`${barWord()} ${el.id} final: ` + (kind === 'beam' ? '' : `N=${f3(b.N)} `) + `V=${f3(b.V)} M=${f3(b.M)}`);
      }
    }
    return L.join('\n');
  }

  function tabResults() {
    const { model, res } = currentResult();
    const views = VIEWS[st.type];
    if (!views.some(([k]) => k === ui.view)) ui.view = 'model';
    let h = '';
    if (!res.ok) {
      h += `<div class="pad"><h2 class="sec-title" style="margin-top:6px">No se pudo calcular</h2><div class="notice">${esc(res.error)}</div>` +
        '<p class="hint">Revise que los apoyos impidan todos los movimientos de cuerpo rígido y que cada barra tenga material y sección.</p>' +
        '<div class="actions"><button class="btn" data-act="tab" data-tab="nodes">Revisar nudos y apoyos</button></div></div>';
      return h;
    }
    h += '<div class="seg" role="group" aria-label="Vista">' + views.map(([k, l]) => `<button data-act="view" data-view="${k}" aria-pressed="${ui.view === k}">${l}</button>`).join('') + '</div>';
    h += `<div class="draw" id="draw">${D.scene({ model, result: res, mode: ui.view, W: 360, H: 250, aria: 'Resultado: ' + ui.view })}</div>`;
    h += '<div class="pad">' + resultsTables(res) + '</div>';
    return h;
  }

  /* ---------------------------------------------------------- paso a paso */
  function renderSteps() {
    const { res } = currentResult();
    let h = topbar('Paso a paso', M.TYPE_INFO[st.type].name, 'backEdit');
    if (!res.ok) return h + `<div class="pad"><div class="notice">${esc(res.error)}</div></div>`;
    h += '<div class="pad" style="padding-bottom:0"><p class="hint">Unidades: kN y m. Toca cada sección para abrirla. Las matrices anchas se desplazan hacia los lados.</p></div>';
    return h + ST.build(res) + '<div class="pad"><div class="actions"><button class="btn" data-act="backEdit">Volver a los resultados</button></div></div>';
  }

  /* ------------------------------------------------------------- render */
  function render() {
    document.body.classList.toggle('home', ui.screen === 'home');
    let h = '';
    if (ui.screen === 'home') h = renderHome();
    else if (ui.screen === 'steps') h = renderSteps();
    else {
      h = topbar(M.TYPE_INFO[st.type].name, '', 'home');
      if (ui.tab !== 'results') h += `<div class="draw" id="draw">${drawModelSVG()}</div>`;
      h += ui.tab === 'nodes' ? tabNodes() : ui.tab === 'bars' ? tabBars() : ui.tab === 'loads' ? tabLoads() : tabResults();
      h += tabsBar();
    }
    if (ui.toast) h += `<div class="toast" role="status">${esc(ui.toast)}</div>`;
    root.innerHTML = h;
    const home = ui.screen === 'home';
    root.classList.toggle('home', home);
  }

  function toast(msg) {
    ui.toast = msg;
    render();
    setTimeout(() => { ui.toast = null; const t = root.querySelector('.toast'); if (t) t.remove(); }, 2200);
  }

  /* --------------------------------------------------------- navegación */
  function go(screen, tab, push) {
    ui.screen = screen;
    if (tab) ui.tab = tab;
    ui.confirm = null;
    if (push !== false) { try { history.pushState({ s: screen, t: ui.tab }, ''); } catch (e) { /* ignorar */ } }
    render();
    window.scrollTo(0, 0);
  }
  window.addEventListener('popstate', (e) => {
    const s = e.state;
    if (s && s.s) { ui.screen = s.s; ui.tab = s.t || ui.tab; if (ui.screen !== 'home' && !st) ui.screen = 'home'; }
    else ui.screen = 'home';
    render();
  });

  function openType(type, mode) {
    if (mode === 'new') st = M.emptyState(type);
    else if (mode === 'example') st = M.example(type);
    else st = loadSaved(type) || M.emptyState(type);
    if (!st || st.type !== type) st = M.emptyState(type);
    save();
    ui.view = 'model';
    go('edit', mode === 'example' ? 'results' : 'nodes');
  }

  /* ---------------------------------------------------- operaciones datos */
  function addNode() {
    const last = st.nodes.reduce((a, n) => (n.x > a.x ? n : a), st.nodes[0] || { x: -4, y: 0, id: 0 });
    const n = { id: st.nextNode++, x: (last.x || 0) + (st.type === 'truss' ? 4 : 4), y: st.type === 'beam' ? 0 : (last.y || 0), sup: st.type === 'beam' ? 'roller' : 'free' };
    st.nodes.push(n);
    if (st.type === 'beam' && st.nodes.length > 1) {
      st.bars.push({ id: st.nextBar++, n1: last.id, n2: n.id, custom: false, E: st.mat.E, sec: M.newSection() });
    }
  }
  function delNode(i) {
    const id = st.nodes[i].id;
    st.nodes.splice(i, 1);
    const gone = new Set(st.bars.filter((b) => b.n1 === id || b.n2 === id).map((b) => b.id));
    st.bars = st.bars.filter((b) => !gone.has(b.id));
    st.nodal = st.nodal.filter((l) => l.node !== id);
    st.member = st.member.filter((l) => !gone.has(l.bar));
  }
  function addBar() {
    const ns = st.nodes.slice().sort((a, b) => (st.type === 'beam' ? a.x - b.x : a.id - b.id));
    const has = (a, b) => st.bars.some((q) => (q.n1 === a && q.n2 === b) || (q.n1 === b && q.n2 === a));
    let pair = null;
    for (let k = 0; k + 1 < ns.length && !pair; k++) if (!has(ns[k].id, ns[k + 1].id)) pair = [ns[k].id, ns[k + 1].id];
    if (!pair && ns.length >= 2) pair = [ns[0].id, ns[1].id];
    if (!pair) return;
    st.bars.push({ id: st.nextBar++, n1: pair[0], n2: pair[1], custom: false, E: st.mat.E, sec: M.newSection() });
  }

  /* ------------------------------------------------------------- eventos */
  function parseNum(s) {
    const t = String(s).replace(',', '.').trim();
    if (t === '' || t === '-' || t === '.' || t === '-.') return NaN;
    const n = Number(t);
    return isFinite(n) ? n : NaN;
  }

  root.addEventListener('input', (e) => {
    const el = e.target;
    if (!el.matches || !el.matches('input[data-p][data-t="n"]')) return;
    const v = parseNum(el.value);
    setPath(st, el.dataset.p, v);
    el.parentElement.classList.toggle('bad', !isFinite(v));
    save();
    refreshLive();
  });

  root.addEventListener('change', (e) => {
    const el = e.target;
    if (el.matches('select[data-act="preset"]')) {
      const m = M.MATERIALS.find((q) => q.key === el.value);
      if (m) { st.mat.E = m.E; save(); render(); }
      return;
    }
    if (!el.dataset || !el.dataset.p) return;
    // Los campos numéricos ya se guardan en cada tecla (evento input). Al salir del
    // campo el navegador dispara change con el texto: no debe guardarse como texto.
    if (el.dataset.t === 'n') return;
    let v;
    if (el.dataset.t === 'b') v = el.checked;
    else if (el.dataset.t === 'i') v = parseInt(el.value, 10);
    else v = el.value;
    setPath(st, el.dataset.p, v);
    // al cambiar el tipo de carga, valores coherentes
    if (/^member\.\d+\.type$/.test(el.dataset.p)) {
      const i = +el.dataset.p.split('.')[1];
      if (v === 'moment') st.member[i].dir = 'gy';
    }
    if (/^bars\.\d+\.(n1|n2)$/.test(el.dataset.p) && st.type === 'beam') {
      /* en vigas los nudos se reordenan al calcular */
    }
    save();
    render();
  });

  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches && e.target.matches('input[data-p]')) e.target.blur();
  });

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.tagName === 'SELECT') return;
    const act = b.dataset.act;
    const i = +b.dataset.i;
    switch (act) {
      case 'open': openType(b.dataset.type, 'open'); return;
      case 'new': openType(b.dataset.type, 'new'); return;
      case 'example': openType(b.dataset.type, 'example'); return;
      case 'home': go('home'); return;
      case 'backEdit': go('edit', 'results'); return;
      case 'tab': go('edit', b.dataset.tab, false); return;
      case 'view': ui.view = b.dataset.view; render(); return;
      case 'steps': go('steps'); return;
      case 'flip': {
        const v = getPath(st, b.dataset.p);
        setPath(st, b.dataset.p, fin(v) ? (v === 0 ? 0 : -v) : NaN);
        const inp = root.querySelector(`input[data-p="${b.dataset.p}"]`);
        if (inp) { inp.value = val(getPath(st, b.dataset.p)); inp.parentElement.classList.toggle('bad', !fin(getPath(st, b.dataset.p))); }
        save(); refreshLive(); return;
      }
      case 'addNode': addNode(); break;
      case 'delNode': delNode(i); break;
      case 'addBar': addBar(); break;
      case 'delBar': {
        const id = st.bars[i].id;
        st.bars.splice(i, 1);
        st.member = st.member.filter((l) => l.bar !== id);
        break;
      }
      case 'addNodal': st.nodal.push({ node: st.nodes[0] ? st.nodes[0].id : 1, fx: 0, fy: -10, mz: 0 }); break;
      case 'delNodal': st.nodal.splice(i, 1); break;
      case 'addMember': {
        if (!st.bars.length) { toast('Primero agregue una barra.'); return; }
        const bar = st.bars[0];
        const L = barLength(bar.id) || 0;
        st.member.push({ bar: bar.id, type: 'udl', val: 10, a: Math.round((L / 2) * 100) / 100, dir: 'gy' });
        break;
      }
      case 'delMember': st.member.splice(i, 1); break;
      case 'reloadExample':
        if (ui.confirm !== 'example') { ui.confirm = 'example'; render(); return; }
        ui.confirm = null; st = M.example(st.type); break;
      case 'resetAll':
        if (ui.confirm !== 'reset') { ui.confirm = 'reset'; render(); return; }
        ui.confirm = null; st = M.emptyState(st.type); break;
      case 'copy': {
        const { res } = currentResult();
        const txt = res.ok ? resultsText(res) : '';
        const done = () => toast('Resultados copiados');
        const fail = () => toast('No se pudo copiar. Selecciona el texto de las tablas.');
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, fail); else fail();
        return;
      }
      default: return;
    }
    save();
    render();
  });

  /* --------------------------------------------------------- inicio / PWA */
  try { history.replaceState({ s: 'home' }, ''); } catch (e) { /* ignorar */ }
  render();

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && location.hostname !== 'localhost') {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }

  // utilidades para pruebas automáticas
  window.__rigidez = { ui, getState: () => st, openType, render };
})();
