# Ringside — Timer de box (PWA)

## Qué es
Timer de rounds para un gym de box. Es una PWA gratuita, sin anuncios, sin cuentas y sin backend. Se publica en GitHub Pages y se instala en el iPhone desde Safari con "Agregar a pantalla de inicio". Debe funcionar igual de bien en Android.

Uso real: casi siempre hay un celular con la pantalla encendida, conectado a la bocina del gym, a 3–5 m de la gente. La legibilidad a distancia y el sonido fuerte importan más que cualquier otra cosa.

## Stack (no cambiar sin preguntar)
- HTML + CSS + JavaScript vanilla con ES modules. **Sin framework y sin build step.** Lo que está en el repo es lo que se publica.
- Sin dependencias de runtime. Para tests usar solo `node --test` (Node 20+).
- Todo el texto de la UI en **español (México)**. Los nombres de variables, funciones y archivos van en inglés.

## Estructura
```
index.html
manifest.webmanifest
sw.js                 # service worker (offline)
css/styles.css
js/
  app.js              # arranque, wiring de UI
  timeline.js         # convierte una config en lista plana de segmentos (lógica pura, testeable)
  engine.js           # reloj: corre la timeline, emite eventos (tick, segmentStart, warning, finish)
  audio.js            # campana y beeps con Web Audio API
  wakelock.js         # mantener pantalla encendida
  storage.js          # presets en localStorage
  ui/                 # pantallas: setup, running, presets
icons/                # íconos originales generados (192, 512, maskable, apple-touch-icon 180)
tests/
  timeline.test.js
```

## Modelo de datos
Un entrenamiento tiene **rounds** con **descanso** entre ellos. Cada round contiene una lista de **bloques** que se repiten N veces.

```js
// Ejemplo 1 — box clásico: 3 rounds de 2 min, 1 min de descanso
{
  name: "Sparring 3×2",
  rounds: 3,
  rest: 60,              // segundos entre rounds (no hay descanso después del último)
  prep: 10,              // cuenta regresiva antes del primer round
  warning: 10,           // aviso "quedan 10 s" al final de cada round y de cada descanso
  round: {
    repeat: 1,
    blocks: [{ label: "Round", duration: 120 }]
  }
}

// Ejemplo 2 — intervalos: 5 veces (30 s intenso + 30 s velocidad), luego 1 min de descanso
{
  name: "Costal intenso/velocidad",
  rounds: 3,
  rest: 60,
  prep: 10,
  warning: 10,
  round: {
    repeat: 5,
    blocks: [
      { label: "Intenso", duration: 30 },
      { label: "Velocidad", duration: 30 }
    ]
  }
}
```

`timeline.js` expande la config en una lista plana de segmentos:
```js
[{ type: "prep"|"work"|"rest", label, duration, roundIndex, roundsTotal, blockIndex, repeatIndex, repeatTotal }, ...]
```
Toda la lógica del timer consume esta lista. **No hay casos especiales en el engine** para "simple" contra "intervalos": el modo simple es solo `repeat: 1` con un bloque.

## Reglas del reloj (críticas)
- **Nunca contar ticks de `setInterval`.** Al iniciar cada segmento se guarda `endAt = performance.now() + duration*1000` y el tiempo restante se **calcula** en cada frame (`requestAnimationFrame`, con `setInterval` de respaldo a 250 ms si la pestaña no pinta). Así el timer no se desfasa aunque el navegador lo frene.
- La pausa guarda el tiempo restante. Al reanudar se recalcula `endAt`.
- Al volver de segundo plano (`visibilitychange`) se avanza por la timeline según el tiempo real transcurrido, saltando los segmentos que ya terminaron.
- Mostrar segundos con `Math.ceil` para que "0:01" se vea hasta el final y el cambio de segmento coincida con "0:00".

## Audio
- Sonidos **sintetizados con Web Audio API** (osciladores y envolventes). No usar archivos de audio de terceros.
  - Campana de inicio de round: 1 golpe metálico (varios parciales inarmónicos con decaimiento largo).
  - Campana de fin de round: 3 golpes rápidos.
  - Aviso de 10 s: un "clack" seco (tipo tablas).
  - Cambio de bloque dentro del round (intenso → velocidad): beep doble corto y agudo, distinto de la campana.
  - Cuenta 3-2-1 antes de iniciar: beeps cortos.
- iOS solo permite audio después de una interacción. Crear o reanudar el `AudioContext` dentro del handler del botón **Iniciar**, y reproducir un buffer silencioso para desbloquearlo.
- Si existe `navigator.audioSession`, poner `navigator.audioSession.type = "transient"` (con detección de la feature) para que los sonidos **se mezclen con la música** que esté sonando (Spotify, Apple Music) en vez de detenerla. No usar `"playback"`: hace que iOS pause la música. Costo aceptado: con el switch de silencio activado, iOS calla los sonidos.
- Programar los sonidos con `audioContext.currentTime` cuando se puedan anticipar, no con timers de JS.

## Pantalla encendida
- Usar la Wake Lock API (`navigator.wakeLock.request("screen")`) mientras el timer corre. Liberarla en pausa o al terminar.
- Volver a pedirla en `visibilitychange` cuando la página vuelva a estar visible (iOS la suelta).
- Si no hay soporte o falla, usar como respaldo un `<video>` silencioso en loop, muted y playsinline. Iniciarlo desde el gesto de Iniciar.
- Nota: la Vibration API **no existe en iOS Safari**. No depender de ella. Usarla solo como extra en Android.

## UI / UX
- Pantalla **Configurar**: rounds, duración del round o de los bloques, repeticiones, descanso, preparación y aviso. Usar steppers grandes (− / +), no teclados. Los tiempos se ajustan en pasos de 5 o 15 s. Mostrar la **duración total** calculada.
- Pantalla **En curso**:
  - Tiempo restante enorme (mínimo ~30% del alto de pantalla, fuente tabular `font-variant-numeric: tabular-nums`).
  - Fondo de color según la fase: **rojo** en work, **verde** en rest, **amarillo** en prep y en los últimos `warning` segundos. Los colores deben tener buen contraste a distancia.
  - Mostrar: "Round 2 / 3", nombre del bloque ("Intenso", "Velocidad"), "Serie 3 / 5" si `repeat > 1` y una vista previa de lo que sigue.
  - Controles: Pausa/Reanudar, Saltar segmento, Reiniciar (con confirmación). Botones grandes para usar con vendas o guantes.
  - Funcionar en vertical y horizontal (en horizontal, el número aún más grande).
- **Presets**: guardar, editar y borrar en `localStorage`. Vienen 5 de fábrica basados en rutinas comunes de gym de box (`DEFAULT_PRESETS` en `js/storage.js`): Cuerda, Sombra, Costal intenso/velocidad, Manoplas y Sparring 3×3. Al agregar uno nuevo, subir `DEFAULTS_VERSION` para que también llegue a quien ya tiene la app instalada. Al abrir, recordar la última configuración usada.
- Tema oscuro por defecto. Respetar `env(safe-area-inset-*)` por el notch.
- Accesibilidad básica: botones con `aria-label` y anuncio del cambio de fase con `aria-live`.

## PWA
- `manifest.webmanifest`: `name: "Ringside"`, `short_name: "Ringside"`, `display: "standalone"`, `start_url: "./"`, `scope: "./"`, colores oscuros, íconos 192/512 + maskable.
- En `index.html`: `<link rel="apple-touch-icon">`, `<meta name="apple-mobile-web-app-capable" content="yes">`, `apple-mobile-web-app-status-bar-style`, `theme-color` y viewport con `viewport-fit=cover`.
- `sw.js`: precache de todos los archivos (cache-first) con una constante `CACHE_VERSION` que **se incrementa en cada release** y borra cachés viejos en `activate`. Así la app funciona sin internet en el gym.
- **Todas las rutas relativas** (`./js/app.js`, no `/js/app.js`), porque GitHub Pages sirve desde `https://<usuario>.github.io/ringside/`.
- Mostrar un aviso discreto "Agrégala a tu pantalla de inicio" en iOS Safari cuando no esté en modo standalone (`navigator.standalone`).

## Deploy
- GitHub Pages desde la rama `main`, carpeta raíz. No hace falta GitHub Actions porque no hay build.
- Antes de cada release: correr los tests, subir `CACHE_VERSION` y probar en un iPhone real instalado como PWA.

## Tests
- `tests/timeline.test.js`: expansión correcta de ambos ejemplos (número y orden de segmentos, sin descanso después del último round, la prep solo al inicio, duración total).
- Lógica del engine que no dependa del DOM: inyectar una función `now()` para poder simular el paso del tiempo en los tests.
- Correr con `node --test`.

## Plan de trabajo (en orden)
1. `timeline.js` + tests.
2. `engine.js` con reloj basado en timestamps + tests con reloj simulado.
3. UI mínima: configurar → correr, sin estilos finos.
4. Audio (campanas sintetizadas, desbloqueo en iOS).
5. Wake lock + fallback.
6. Estilos finales, colores por fase y vista horizontal.
7. Presets en localStorage.
8. Manifest, íconos, service worker → publicar en GitHub Pages.

Avanzar fase por fase y dejar algo funcional al final de cada una. Si una decisión no está cubierta aquí, preferir la opción más simple y preguntar antes de agregar dependencias.
