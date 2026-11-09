<p align="center">
  <img src="icons/icon-192.png" width="96" height="96" alt="Ícono de Ringside">
</p>

<h1 align="center">Ringside</h1>

<p align="center">
  Timer de rounds para box. Gratis, sin anuncios, sin cuentas y funciona sin internet.<br>
  <a href="https://jxlil.github.io/ringside/"><strong>Abrir la app →</strong></a>
</p>

---

Ringside está pensado para el uso real en el gym: un celular con la pantalla encendida, conectado a la bocina, a 3–5 m de la gente. Por eso prioriza **números enormes**, **colores por fase que se ven a distancia** y **campanas fuertes**.

## Características

- **Rounds y descansos** con preparación inicial y aviso de "quedan 10 s".
- **Intervalos dentro del round**: por ejemplo, 3 veces (30 s intenso + 30 s velocidad) por round.
- **Color por fase**: rojo en trabajo, verde en descanso, amarillo en preparación y en los últimos segundos.
- **Campanas sintetizadas** con Web Audio: un golpe al iniciar el round, tres al terminar, "clack" de aviso, beep doble al cambiar de bloque y cuenta 3‑2‑1.
- **Se mezcla con tu música** (Spotify, Apple Music) en vez de pausarla, en los navegadores que lo permiten.
- **Pantalla siempre encendida** mientras corre el timer (Wake Lock, con respaldo para navegadores sin soporte).
- **Reloj preciso**: el tiempo se calcula con timestamps, así que no se desfasa aunque el navegador congele la pestaña o la mandes a segundo plano.
- **Presets** guardados en tu dispositivo, más 5 de fábrica: Cuerda, Sombra, Costal intenso/velocidad, Manoplas y Sparring 3×3.
- **Botones grandes** para usarse con vendas o guantes; vertical y horizontal.
- **Offline**: una vez abierta, funciona sin conexión.

## Instalación

No hay que descargar nada de una tienda. Abre <https://jxlil.github.io/ringside/> y:

- **iPhone (Safari):** Compartir → *Agregar a pantalla de inicio*.
- **Android (Chrome):** menú ⋮ → *Instalar app* o *Agregar a pantalla principal*.

> En iPhone, si el switch de silencio está activado, iOS calla los sonidos. Es el costo de que la app no interrumpa tu música.

## Cómo funciona

Un entrenamiento tiene **rounds** con **descanso** entre ellos, y cada round repite N veces una lista de **bloques**:

```js
{
  name: "Costal intenso/velocidad",
  rounds: 4,
  rest: 60,     // segundos entre rounds
  prep: 10,     // cuenta regresiva antes del primer round
  warning: 10,  // aviso al final de cada round y descanso
  round: {
    repeat: 3,
    blocks: [
      { label: "Intenso", duration: 30 },
      { label: "Velocidad", duration: 30 }
    ]
  }
}
```

`timeline.js` expande esa configuración en una lista plana de segmentos (`prep`, `work`, `rest`) y `engine.js` la recorre calculando el tiempo restante contra `performance.now()`. Un round simple es solo `repeat: 1` con un bloque; no hay casos especiales.

## Desarrollo

HTML, CSS y JavaScript con ES modules. **Sin framework, sin dependencias y sin build step**: lo que está en el repo es lo que se publica.

```bash
# servir localmente (cualquier servidor estático sirve)
python3 -m http.server 8000

# tests (Node 20+)
node --test
```

```
index.html, manifest.webmanifest, sw.js
css/styles.css
js/
  app.js        arranque y wiring de la UI
  timeline.js   config → lista de segmentos (lógica pura)
  engine.js     reloj basado en timestamps, emite eventos
  audio.js      campanas y beeps con Web Audio
  wakelock.js   pantalla encendida + respaldo con <video>
  storage.js    presets en localStorage
  ui/           pantallas: configurar, en curso, presets
tests/          node --test
```

### Publicar

Se publica con GitHub Pages desde la raíz de `main`. Antes de cada release: correr los tests, subir `CACHE_VERSION` en `sw.js` para que los dispositivos instalados reciban la nueva versión, y probarla en un iPhone real instalada como PWA.

## Licencia

[MIT](LICENSE)
