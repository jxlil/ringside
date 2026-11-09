# Ringside — Boxing timer (PWA)

## What it is
Round timer for a boxing gym. A free PWA with no ads, no accounts and no backend. It is published on GitHub Pages and installed on iPhone from Safari with "Add to Home Screen". It must work just as well on Android.

Real-world use: almost always a phone with the screen on, plugged into the gym speaker, 3–5 m away from people. Readability from a distance and loud sound matter more than anything else.

## Stack (don't change without asking)
- Vanilla HTML + CSS + JavaScript with ES modules. **No framework and no build step.** What's in the repo is what gets published.
- No runtime dependencies. For tests use only `node --test` (Node 20+).
- UI text in **English and Spanish (Mexico)**, picked from the device language (`navigator.languages`): Spanish if it comes before English in the user's preferences, English otherwise. All strings live in `js/i18n.js`; every key must exist in both languages (a test checks it). Static HTML is written in English and translated at startup with `data-i18n`, `data-i18n-html`, `data-i18n-label` and `data-i18n-placeholder`.
- Variable, function and file names, code comments, tests and docs are in English.

## Structure
```
index.html
manifest.webmanifest
sw.js                 # service worker (offline)
css/styles.css
js/
  app.js              # startup, UI wiring
  timeline.js         # turns a config into a flat list of segments (pure logic, testable)
  engine.js           # clock: runs the timeline, emits events (tick, segmentStart, warning, finish)
  audio.js            # bell and beeps with the Web Audio API
  wakelock.js         # keep the screen on
  storage.js          # presets in localStorage
  i18n.js             # English / Spanish strings and language detection
  ui/                 # screens: setup, running, presets
icons/                # original generated icons (192, 512, maskable, apple-touch-icon 180)
tests/
  timeline.test.js
```

## Data model
A workout has **rounds** with **rest** between them. Each round contains a list of **blocks** repeated N times.

```js
// Example 1 — classic boxing: 3 rounds of 2 min, 1 min rest
{
  name: "Sparring 3×2",
  rounds: 3,
  rest: 60,              // seconds between rounds (no rest after the last one)
  prep: 10,              // countdown before the first round
  warning: 10,           // "10 s left" warning at the end of each round and each rest
  round: {
    repeat: 1,
    blocks: [{ label: "Round", duration: 120 }]
  }
}

// Example 2 — intervals: 5 times (30 s power + 30 s speed), then 1 min rest
{
  name: "Heavy bag power/speed",
  rounds: 3,
  rest: 60,
  prep: 10,
  warning: 10,
  round: {
    repeat: 5,
    blocks: [
      { label: "Power", duration: 30 },
      { label: "Speed", duration: 30 }
    ]
  }
}
```

`timeline.js` expands the config into a flat list of segments:
```js
[{ type: "prep"|"work"|"rest", label, duration, roundIndex, roundsTotal, blockIndex, repeatIndex, repeatTotal }, ...]
```
All timer logic consumes this list. **There are no special cases in the engine** for "simple" vs. "intervals": simple mode is just `repeat: 1` with one block.

## Clock rules (critical)
- **Never count `setInterval` ticks.** When each segment starts, store `endAt = performance.now() + duration*1000` and **compute** the time left on every frame (`requestAnimationFrame`, with a 250 ms `setInterval` fallback if the tab isn't painting). That way the timer doesn't drift even if the browser throttles it.
- Pause stores the time left. Resume recomputes `endAt`.
- On returning from the background (`visibilitychange`), advance through the timeline by the real elapsed time, skipping segments that already ended.
- Show seconds with `Math.ceil` so "0:01" stays until the end and the segment switch lands on "0:00".

## Audio
- Sounds **synthesized with the Web Audio API** (oscillators and envelopes). Don't use third-party audio files.
  - Round start bell: 1 metallic strike (several inharmonic partials with a long decay).
  - Round end bell: 3 quick strikes.
  - 10 s warning: a dry "clack" (clapper sticks).
  - Block change inside a round (power → speed): short, high double beep, distinct from the bell.
  - 3-2-1 countdown before starting: short beeps.
- iOS only allows audio after a user interaction. Create or resume the `AudioContext` inside the **Start** button handler, and play a silent buffer to unlock it.
- If `navigator.audioSession` exists, set `navigator.audioSession.type = "transient"` (feature-detected) so sounds **mix with music** already playing (Spotify, Apple Music) instead of stopping it. Don't use `"playback"`: it makes iOS pause the music. Accepted cost: with the silent switch on, iOS mutes the sounds.
- Schedule sounds with `audioContext.currentTime` when they can be anticipated, not with JS timers.

## Screen on
- Use the Wake Lock API (`navigator.wakeLock.request("screen")`) while the timer runs. Release it on pause or when finished.
- Request it again on `visibilitychange` when the page becomes visible (iOS drops it).
- If unsupported or it fails, fall back to a silent looping `<video>`, muted and playsinline. Start it from the Start gesture.
- Note: the Vibration API **doesn't exist in iOS Safari**. Don't rely on it. Use it only as an extra on Android.

## UI / UX
- **Setup** screen: rounds, round or block duration, repeats, rest, prep and warning. Use large steppers (− / +), not keyboards. Times adjust in steps of 5 or 15 s. Show the computed **total duration**.
- **Running** screen:
  - Huge time left (at least ~30% of screen height, tabular font `font-variant-numeric: tabular-nums`).
  - Background color by phase: **red** for work, **green** for rest, **yellow** for prep and the last `warning` seconds. Colors must have good contrast at a distance.
  - Show: "Round 2 / 3", the block name ("Power", "Speed"), "Set 3 / 5" if `repeat > 1`, and a preview of what's next.
  - Controls: Pause/Resume, Skip segment, Restart (with confirmation). Big buttons for use with wraps or gloves.
  - Work in portrait and landscape (in landscape, the number even bigger).
- **Presets**: save, edit and delete in `localStorage`. 5 built-in ones based on common boxing gym routines (`defaultPresets(lang)` in `js/storage.js`): Jump rope, Shadowboxing, Heavy bag power/speed, Mitts and Sparring 3×3, with names and labels in the device language. Built-ins the user never edited follow a change of device language; edited ones and the user's own keep their text. When adding a new one, bump `DEFAULTS_VERSION` so it also reaches people who already have the app installed. On open, restore the last config used.
- Dark theme by default. Respect `env(safe-area-inset-*)` for the notch.
- Basic accessibility: buttons with `aria-label` and phase changes announced with `aria-live`.

## PWA
- `manifest.webmanifest`: `name: "Ringside"`, `short_name: "Ringside"`, `display: "standalone"`, `start_url: "./"`, `scope: "./"`, dark colors, 192/512 + maskable icons.
- In `index.html`: `<link rel="apple-touch-icon">`, `<meta name="apple-mobile-web-app-capable" content="yes">`, `apple-mobile-web-app-status-bar-style`, `theme-color` and a viewport with `viewport-fit=cover`.
- `sw.js`: precache every file (cache-first) with a `CACHE_VERSION` constant that **is bumped on every release** and deletes old caches on `activate`. That way the app works without internet at the gym.
- **All paths relative** (`./js/app.js`, not `/js/app.js`), because GitHub Pages serves from `https://<user>.github.io/ringside/`.
- Show a discreet "Add it to your Home Screen" tip in iOS Safari when not in standalone mode (`navigator.standalone`).

## Deploy
- GitHub Pages from the `main` branch, root folder. No GitHub Actions needed since there's no build.
- Before each release: run the tests, bump `CACHE_VERSION` and test on a real iPhone installed as a PWA.

## Tests
- `tests/timeline.test.js`: correct expansion of both examples (number and order of segments, no rest after the last round, prep only at the start, total duration).
- Engine logic that doesn't depend on the DOM: inject a `now()` function to simulate the passage of time in tests.
- Pass the language explicitly in tests (`createStore(storage, { lang })`, `setLanguage()`): Node's default locale varies by machine.
- Run with `node --test`.

## Work plan (in order)
1. `timeline.js` + tests.
2. `engine.js` with a timestamp-based clock + tests with a simulated clock.
3. Minimal UI: setup → run, no fine styling.
4. Audio (synthesized bells, iOS unlock).
5. Wake lock + fallback.
6. Final styles, phase colors and landscape view.
7. Presets in localStorage.
8. Manifest, icons, service worker → publish on GitHub Pages.

Move phase by phase and leave something working at the end of each one. If a decision isn't covered here, prefer the simplest option and ask before adding dependencies.
