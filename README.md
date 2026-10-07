# Rigidez: análisis matricial de estructuras

App para celular que ayuda a estudiantes de ingeniería civil a resolver **vigas continuas, pórticos planos y cerchas planas** por el método matricial de rigidez, mostrando cada matriz del procedimiento.

Funciona sin internet. Se puede usar de tres maneras:

1. **Como app web instalable (PWA)**, sin compilar nada.
2. **Como APK** para Android, generado automáticamente en GitHub.
3. **Como APK** compilado en tu computadora con Android Studio.

## Qué hace

- Selector de tipo de estructura: vigas, pórticos o cerchas.
- Nudos con coordenadas y apoyos (apoyo simple, articulado, rodillo, empotrado).
- Material (concreto f'c 210 o 280, acero, madera o E propio) y secciones rectangulares o con A e I conocidas. Cada barra puede tener sección propia.
- Cargas en nudos y, en vigas y pórticos, cargas distribuidas, puntuales y momentos dentro de las barras, en dirección de gravedad, horizontal, perpendicular o a lo largo de la barra.
- Resultados: reacciones, desplazamientos, esfuerzos en los extremos, valores máximos, deformada y diagramas N, V y M.
- **Paso a paso**: grados de libertad, matriz local, transformación y matriz global de cada barra, ensamblaje de [K], vector de cargas, sistema reducido, desplazamientos, reacciones, fuerzas en barras y verificación de equilibrio.
- El trabajo se guarda solo en el dispositivo.

Unidades: kN, m y MPa para E; secciones en cm.

### Convenciones de signo

| Magnitud | Positivo |
| --- | --- |
| Fx | hacia la derecha |
| Fy, Ry | hacia arriba |
| Mz, giros | sentido antihorario |
| Carga distribuida o puntual de gravedad | hacia abajo |
| N | tracción |
| M | tensa la fibra inferior de una barra horizontal (el diagrama se dibuja del lado traccionado) |

## Opción 1: instalar como app web (PWA)

1. Sube la carpeta a un repositorio de GitHub.
2. En **Settings > Pages**, elige **GitHub Actions** como fuente. El flujo `Publicar la app web` publica la carpeta `www/`.
3. Abre el enlace en Chrome del celular, abre el menú y toca **Instalar aplicación** o **Agregar a la pantalla de inicio**.

Después de la primera visita funciona sin conexión.

## Opción 2: generar el APK en GitHub (sin instalar nada)

1. Crea un repositorio en GitHub y sube todo el contenido de esta carpeta.
2. Entra a la pestaña **Actions**, elige **Generar APK** y toca **Run workflow**. También se ejecuta solo con cada cambio en `main`.
3. Cuando termine (unos 5 a 8 minutos), abre la ejecución y descarga el archivo **Rigidez-apk** de la sección *Artifacts*. Dentro está `app-debug.apk`.
4. Pásalo al celular e instálalo. Android pedirá permitir la instalación desde orígenes desconocidos.

El flujo ejecuta primero las pruebas del motor de cálculo y se detiene si alguna falla.

El APK generado es de depuración: sirve para instalar y compartir con compañeros. Para publicarlo en Google Play hay que firmarlo con tu propia llave (`./gradlew bundleRelease` y la firma de la app en Android Studio).

## Opción 3: generar el APK en tu computadora

Requisitos: Node.js 20 o superior, JDK 21 y Android Studio con el SDK de Android.

```bash
npm install
npx cap add android
npx capacitor-assets generate --android
npx cap sync android
npx cap open android      # compila desde Android Studio: Build > Build APK(s)
# o desde la terminal:
cd android && ./gradlew assembleDebug
```

El APK queda en `android/app/build/outputs/apk/debug/app-debug.apk`.

Cada vez que cambies archivos de `www/`, ejecuta `npx cap sync android` y vuelve a compilar.

## Estructura del proyecto

```
www/                  la app (HTML, CSS y JavaScript sin dependencias)
  js/solver.js        motor del método matricial de rigidez
  js/model.js         datos, ejemplos y conversión de unidades
  js/draw.js          dibujo de la estructura, cargas, deformada y diagramas
  js/steps.js         desarrollo paso a paso
  js/app.js           pantallas y formularios
tests/                pruebas contra soluciones analíticas y de la interfaz
tools/build-single.js genera dist/rigidez.html, la app en un solo archivo
assets/icon-only.png  ícono base del APK
```

Para ejecutar las pruebas: `npm test`.

## Verificación del cálculo

El motor se probó contra soluciones conocidas: viga simplemente apoyada y empotrada con carga distribuida, viga continua de dos tramos, voladizo, cargas puntuales y momentos aplicados, cercha triangular, barras inclinadas, y pórticos con equilibrio global. Cada cálculo de la app también comprueba el equilibrio entre cargas y reacciones.

## Alcance y limitaciones

- Estructuras planas, material elástico lineal y pequeños desplazamientos.
- Barras de Euler-Bernoulli: no se considera la deformación por corte.
- No incluye articulaciones internas, asentamientos de apoyo, apoyos inclinados, resortes, cargas trapezoidales ni cargas de temperatura.
- Las cerchas solo admiten cargas en los nudos.
