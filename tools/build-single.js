// Genera dist/rigidez.html: toda la app en un solo archivo (CSS y JS incluidos).
// Con --artifact genera dist/rigidez-artifact.html: solo el contenido de la página
// (sin <html>/<head>/<body>), para publicarla como artefacto en Claude.
const fs = require('fs');
const path = require('path');
const www = path.join(__dirname, '..', 'www');
const read = (f) => fs.readFileSync(path.join(www, f), 'utf8');
const inline = (src) => `<script>\n${read(src).replace(/<\/script>/gi, '<\\/script>')}\n</script>`;
const artifact = process.argv.includes('--artifact');
const scripts = ['js/solver.js', 'js/model.js', 'js/draw.js', 'js/steps.js', 'js/app.js'];
fs.mkdirSync(path.join(__dirname, '..', 'dist'), { recursive: true });

let out, file;
if (artifact) {
  // El contenedor del artefacto ya reserva las zonas seguras arriba y abajo.
  const tweaks = `
.top { top: env(safe-area-inset-top, 0px); padding-top: 8px; }
.hero { padding-top: 20px; }`;
  out = `<title>Rigidez</title>\n<style>\n${read('styles.css')}\n${tweaks}\n</style>\n<div id="app"></div>\n${scripts.map(inline).join('\n')}\n`;
  file = 'rigidez-artifact.html';
} else {
  let html = read('index.html');
  html = html
    .replace(/<link rel="manifest"[^>]*>\n?/, '')
    .replace(/<link rel="apple-touch-icon"[^>]*>\n?/, '')
    .replace(/<link rel="icon"[^>]*>\n?/, '')
    .replace('<link rel="stylesheet" href="styles.css">', () => `<style>\n${read('styles.css')}\n</style>`)
    .replace(/<script src="(js\/[^"]+)"><\/script>/g, (_, src) => inline(src));
  out = html;
  file = 'rigidez.html';
}
const dest = path.join(__dirname, '..', 'dist', file);
fs.writeFileSync(dest, out);
console.log('Escrito', dest, (out.length / 1024).toFixed(1) + ' KB');
