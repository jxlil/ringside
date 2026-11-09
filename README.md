<p align="center">
  <img src="icons/icon-192.png" width="96" height="96" alt="Ringside icon">
</p>

<h1 align="center">Ringside</h1>

<p align="center">
  Boxing round timer. Free, no ads, no accounts, and it works offline.<br>
  <a href="https://jxlil.github.io/ringside/"><strong>Open the app →</strong></a>
</p>

---

Ringside is built for real gym use: a phone with the screen on, plugged into the gym speaker, 3–5 m away from the people training. So it puts **huge numbers**, **phase colors you can read from across the room** and **loud bells** first.

## Features

- **Rounds and rest** with a countdown before the first round and a "10 seconds left" warning.
- **Intervals inside a round**: for example, 3 × (30 s power + 30 s speed) per round.
- **Color per phase**: red for work, green for rest, yellow for prep and for the last few seconds.
- **Synthesized bells** with Web Audio: one strike to start a round, three to end it, a clapper for the warning, a double beep between blocks and a 3‑2‑1 countdown.
- **Mixes with your music** (Spotify, Apple Music) instead of pausing it, on browsers that support it.
- **Screen stays on** while the timer runs (Wake Lock, with a fallback for browsers without it).
- **Accurate clock**: time is computed from timestamps, so it doesn't drift even if the browser throttles the tab or you send it to the background.
- **Presets** saved on your device, plus 5 built-in ones: Jump rope, Shadowboxing, Heavy bag power/speed, Mitts and Sparring 3×3.
- **English and Spanish**, picked automatically from the device language.
- **Big buttons** you can press with wraps or gloves on; portrait and landscape.
- **Offline**: once opened, it works without a connection.

## Install

There's nothing to download from an app store. Open <https://jxlil.github.io/ringside/> and:

- **iPhone (Safari):** Share → *Add to Home Screen*.
- **Android (Chrome):** ⋮ menu → *Install app* or *Add to Home screen*.

> On iPhone, the silent switch mutes the sounds. That's the trade-off for not interrupting your music.

## How it works

A workout has **rounds** with **rest** between them, and each round repeats a list of **blocks** N times:

```js
{
  name: "Heavy bag power/speed",
  rounds: 4,
  rest: 60,     // seconds between rounds
  prep: 10,     // countdown before the first round
  warning: 10,  // warning at the end of each round and rest
  round: {
    repeat: 3,
    blocks: [
      { label: "Power", duration: 30 },
      { label: "Speed", duration: 30 }
    ]
  }
}
```

`timeline.js` expands that config into a flat list of segments (`prep`, `work`, `rest`), and `engine.js` walks it, computing the time left against `performance.now()`. A plain round is just `repeat: 1` with one block; there are no special cases.

## Development

HTML, CSS and JavaScript with ES modules. **No framework, no dependencies and no build step**: what's in the repo is what gets deployed.

```bash
# serve locally (any static server works)
python3 -m http.server 8000

# tests (Node 20+)
node --test
```

```
index.html, manifest.webmanifest, sw.js
css/styles.css
js/
  app.js        startup and UI wiring
  timeline.js   config → list of segments (pure logic)
  engine.js     timestamp-based clock, emits events
  audio.js      bells and beeps with Web Audio
  wakelock.js   keep the screen on + <video> fallback
  storage.js    presets in localStorage
  i18n.js       English / Spanish strings
  ui/           screens: setup, running, presets
tests/          node --test
```

To add or change UI text, edit both languages in `js/i18n.js`; a test checks that they define the same keys.

### Releasing

GitHub Pages serves the root of `main`. Before each release: run the tests, bump `CACHE_VERSION` in `sw.js` so installed devices pick up the new version, and try it on a real iPhone installed as a PWA.

## License

[MIT](LICENSE)
