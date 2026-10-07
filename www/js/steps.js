/*
 * Desarrollo paso a paso del método matricial (HTML en texto).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Steps = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  const sup = (n) => String(n).split('').map((c) => (c === '-' ? '⁻' : SUP[+c])).join('');
  const sub = (n) => String(n).split('').map((c) => '₀₁₂₃₄₅₆₇₈₉'[+c]).join('');

  /** Formato numérico compacto para matrices y tablas */
  function fm(v, dig) {
    dig = dig || 4;
    if (v === null || v === undefined || Number.isNaN(v)) return '';
    if (Math.abs(v) < 1e-9) return '0';
    const a = Math.abs(v);
    if (a >= 1e5 || a < 1e-3) {
      const [m, e] = v.toExponential(dig - 1).split('e');
      return `${m.replace(/\.?0+$/, '')}×10${sup(parseInt(e, 10))}`;
    }
    let s = v.toPrecision(dig);
    if (s.includes('e')) s = String(+s);
    if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s;
  }
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function matrix(M, rowLabels, colLabels, opts) {
    opts = opts || {};
    let h = '<div class="mx-wrap" tabindex="0" role="group" aria-label="' + esc(opts.aria || 'Matriz') + '"><table class="mx">';
    if (colLabels) {
      h += '<thead><tr><th></th>' + colLabels.map((c) => `<th scope="col">${c}</th>`).join('') + '</tr></thead>';
    }
    h += '<tbody>';
    M.forEach((row, i) => {
      h += '<tr>' + (rowLabels ? `<th scope="row">${rowLabels[i]}</th>` : '');
      row.forEach((v, j) => {
        if (typeof v === 'string') { h += `<td class="unit">${esc(v)}</td>`; return; }
        const z = Math.abs(v) < 1e-9;
        h += `<td class="${z ? 'z' : ''}${opts.hl && opts.hl(i, j) ? ' hl' : ''}">${fm(v)}</td>`;
      });
      h += '</tr>';
    });
    return h + '</tbody></table></div>';
  }

  function vector(v, labels, opts) {
    opts = opts || {};
    return matrix(v.map((x) => [x]), labels, [opts.title || ''], opts);
  }

  const gl = (r, g) => {
    const d = r.dofLabels[g];
    return `${g + 1}<small>N${d.node} ${d.name}</small>`;
  };

  function localLabels(kind) {
    if (kind === 'truss') return ['u₁', 'v₁', 'u₂', 'v₂'];
    if (kind === 'beam') return ['v₁', 'θ₁', 'v₂', 'θ₂'];
    return ['u₁', 'v₁', 'θ₁', 'u₂', 'v₂', 'θ₂'];
  }

  function section(title, body, open) {
    return `<details class="step"${open ? ' open' : ''}><summary><span class="stitle">${title}</span></summary><div class="sbody">${body}</div></details>`;
  }

  function build(r) {
    const kind = r.type;
    const names = r.dofNames;
    const out = [];
    const nFree = r.free.length, nR = r.restr.length;

    /* 1. grados de libertad */
    let b1 = `<p>Cada nudo tiene ${r.dpn} grados de libertad (${names.map((n) => n === 'ux' ? 'ux: horizontal' : n === 'uy' ? 'uy: vertical' : 'rz: giro').join(', ')}). Se numeran nudo por nudo. Los grados restringidos por apoyos son desplazamientos conocidos (cero).</p>`;
    b1 += '<div class="mx-wrap"><table class="mx dof"><thead><tr><th>Nudo</th><th>x (m)</th>' + (kind === 'beam' ? '' : '<th>y (m)</th>') +
      names.map((n) => `<th>${n}</th>`).join('') + '</tr></thead><tbody>';
    r.nodes.forEach((n, i) => {
      b1 += `<tr><th scope="row">${n.id}</th><td>${fm(n.x)}</td>` + (kind === 'beam' ? '' : `<td>${fm(n.y)}</td>`);
      names.forEach((nm, j) => {
        const g = i * r.dpn + j;
        const isR = r.restr.includes(g);
        b1 += `<td class="${isR ? 'rest' : ''}">${g + 1}${isR ? ' (R)' : ''}</td>`;
      });
      b1 += '</tr>';
    });
    b1 += `</tbody></table></div><p class="note">Total: ${r.nDof} grados de libertad, ${nFree} libres y ${nR} restringidos (R).</p>`;
    out.push(section('Grados de libertad', b1, true));

    /* 2. rigidez de cada barra */
    let b2 = '<p>Para cada barra se arma la matriz de rigidez en ejes locales <b>[k]</b>, se rota con la matriz de transformación <b>[T]</b> y se obtiene la matriz en ejes globales:</p><p class="eq">[K]ₑ = [T]ᵀ [k] [T]</p>';
    for (const el of r.elements) {
      const ll = localLabels(kind);
      const gLabels = el.dofs.map((g) => gl(r, g));
      let eb = `<p class="props">L = ${fm(el.L)} m, ángulo = ${fm(el.angle)}°, cos = ${fm(el.c)}, sen = ${fm(el.s)}<br>`;
      eb += `E = ${fm(el.E)} kN/m²` + (kind !== 'beam' ? `, A = ${fm(el.A)} m²` : '') + (kind !== 'truss' ? `, I = ${fm(el.I)} m⁴` : '');
      eb += '</p>';
      if (kind === 'truss') eb += `<p class="eq">EA/L = ${fm((el.E * el.A) / el.L)} kN/m</p>`;
      else if (kind === 'beam') eb += `<p class="eq">EI/L³ = ${fm((el.E * el.I) / el.L ** 3)} kN/m</p>`;
      else eb += `<p class="eq">EA/L = ${fm((el.E * el.A) / el.L)} kN/m, EI/L³ = ${fm((el.E * el.I) / el.L ** 3)} kN/m</p>`;
      eb += '<h4>Matriz local [k]</h4>' + matrix(el.kLocal, ll, ll, { aria: 'Matriz local barra ' + el.id });
      if (kind !== 'beam') eb += '<h4>Transformación [T]</h4>' + matrix(el.T, ll, ll, { aria: 'Matriz de transformación' });
      eb += `<h4>Matriz global [K]${sub(el.id)}</h4>` + matrix(el.kGlobal, gLabels, gLabels, { aria: 'Matriz global barra ' + el.id });
      b2 += `<details class="sub"><summary>Barra ${el.id}, nudos ${el.n1} y ${el.n2}</summary>${eb}</details>`;
    }
    out.push(section('Rigidez de cada barra', b2));

    /* 3. ensamblaje */
    const labs = r.dofLabels.map((_, g) => gl(r, g));
    let b3 = '<p>Cada término de la matriz de una barra se suma en la fila y columna que le corresponde según la numeración de grados de libertad:</p><p class="eq">[K] = Σ [K]ₑ</p>' +
      matrix(r.K, labs, labs, { aria: 'Matriz de rigidez global' });
    out.push(section('Ensamblaje de la matriz global [K]', b3));

    /* 4. cargas */
    let b4 = '<p>Las cargas en los nudos se colocan directamente. Las cargas dentro de las barras se reemplazan por cargas equivalentes en los nudos (fuerzas de empotramiento perfecto con signo cambiado):</p><p class="eq">{F} = {F nudos} + {F equivalentes}</p>';
    const hasEq = r.Feq.some((v) => Math.abs(v) > 1e-9);
    const cols = ['Nudos', ...(hasEq ? ['Equiv.'] : []), 'Total'];
    const rows = r.F.map((_, i) => [r.Fnodal[i], ...(hasEq ? [r.Feq[i]] : []), r.F[i]]);
    b4 += matrix(rows, labs, cols, { aria: 'Vector de cargas' });
    b4 += '<p class="note">Unidades: kN para fuerzas y kN·m para momentos.</p>';
    out.push(section('Vector de cargas {F}', b4));

    /* 5. condiciones de contorno */
    const fl = r.free.map((g) => gl(r, g));
    let b5 = `<p>Los grados restringidos tienen desplazamiento nulo, así que se eliminan sus filas y columnas. Queda un sistema de ${nFree} ecuaciones con los grados libres:</p><p class="eq">[K<sub>ff</sub>] {u<sub>f</sub>} = {F<sub>f</sub>}</p>`;
    if (nFree === 0) b5 += '<p class="note">Todos los grados están restringidos; no hay desplazamientos que calcular.</p>';
    else b5 += '<h4>[K<sub>ff</sub>]</h4>' + matrix(r.Kff, fl, fl, { aria: 'Matriz reducida' }) + '<h4>{F<sub>f</sub>}</h4>' + vector(r.Ff, fl, { aria: 'Vector de cargas reducido' });
    out.push(section('Condiciones de contorno y sistema reducido', b5));

    /* 6. desplazamientos */
    let b6 = '<p>Se resuelve el sistema (eliminación de Gauss):</p><p class="eq">{u<sub>f</sub>} = [K<sub>ff</sub>]⁻¹ {F<sub>f</sub>}</p>';
    if (nFree > 0) {
      b6 += matrix(r.uf.map((v, i) => [v, r.dofLabels[r.free[i]].name === 'rz' ? 'rad' : 'm']), fl, ['Valor', 'Unidad'], { aria: 'Desplazamientos' });
    }
    out.push(section('Desplazamientos {u}', b6));

    /* 7. reacciones */
    let b7 = '<p>Con los desplazamientos conocidos se calculan las reacciones en los grados restringidos:</p><p class="eq">{R} = [K<sub>rf</sub>] {u<sub>f</sub>} − {F<sub>r</sub>}</p>';
    const rl = r.restr.map((g) => gl(r, g));
    b7 += vector(r.restr.map((g) => r.Rvec[g]), rl, { title: 'R (kN, kN·m)', aria: 'Reacciones' });
    out.push(section('Reacciones', b7));

    /* 8. esfuerzos en las barras */
    let b8 = '<p>Con los desplazamientos de cada barra en ejes locales se obtienen las fuerzas en sus extremos:</p><p class="eq">{f} = [k] {u<sub>local</sub>} + {f<sub>0</sub>}</p><p class="note">{f₀} son las fuerzas de empotramiento perfecto de las cargas dentro de la barra (cero si no hay).</p>';
    for (const el of r.elements) {
      const ll = localLabels(kind);
      const cols2 = ['u local', 'f₀', 'f'];
      const rows2 = ll.map((_, i) => [el.uLocal[i], el.f0Local[i], el.fLocal[i]]);
      b8 += `<details class="sub"><summary>Barra ${el.id}</summary>` + matrix(rows2, ll, cols2, { aria: 'Fuerzas en la barra ' + el.id }) + '</details>';
    }
    if (kind === 'truss') {
      b8 += '<p class="eq">N = −f₁ (tracción positiva)</p>';
    }
    out.push(section('Fuerzas en las barras', b8));

    /* 9. equilibrio */
    const eq = r.equilibrium;
    const z = (v) => (Math.abs(v) < 1e-7 ? '0.000' : v.toFixed(4));
    let b9 = `<p>Se verifica que las cargas aplicadas y las reacciones estén en equilibrio:</p><div class="mx-wrap"><table class="mx"><tbody>` +
      (kind === 'beam' ? '' : `<tr><th scope="row">ΣFx</th><td>${z(eq.sumFx)}</td><td class="unit">kN</td></tr>`) +
      `<tr><th scope="row">ΣFy</th><td>${z(eq.sumFy)}</td><td class="unit">kN</td></tr>` +
      `<tr><th scope="row">ΣM (origen)</th><td>${z(eq.sumM)}</td><td class="unit">kN·m</td></tr></tbody></table></div>` +
      `<p class="verdict ${eq.ok ? 'good' : 'bad'}">${eq.ok ? 'El equilibrio se cumple.' : 'No hay equilibrio: revise los datos de entrada.'}</p>`;
    out.push(section('Verificación de equilibrio', b9, false));

    return out.join('');
  }

  return { build, fm, matrix };
});
