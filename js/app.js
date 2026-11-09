// Startup and UI wiring.

import { buildTimeline, normalizeConfig, transitionCue } from "./timeline.js";
import * as audio from "./audio.js";
import * as wakelock from "./wakelock.js";
import { Engine } from "./engine.js";
import { createSetupScreen } from "./ui/setup.js";
import { createRunningScreen } from "./ui/running.js";
import { createPresetsScreen } from "./ui/presets.js";
import { createStore } from "./storage.js";
import { t, applyToDocument } from "./i18n.js";

applyToDocument();

const store = createStore();

const screens = {
  setup: document.querySelector("#setup"),
  presets: document.querySelector("#presets"),
  running: document.querySelector("#running"),
};

let engine = null;

function showScreen(name) {
  for (const [key, el] of Object.entries(screens)) el.hidden = key !== name;
  window.scrollTo(0, 0);
}

function cue(name) {
  if (!name) return;
  audio.play(name);
  audio.vibrate(name);
}

// Every control is a user gesture: use it to keep iOS audio unlocked.
const running = createRunningScreen({
  root: screens.running,
  onPauseToggle: () => {
    audio.unlock();
    engine?.toggle();
  },
  onSkip: () => {
    audio.unlock();
    engine?.skip();
  },
  onReset: () => {
    if (!engine) return;
    const done = engine.status === "finished";
    if (!done && !confirm(t("confirmRestart"))) return;
    stopEngine();
    running.leave();
    showScreen("setup");
  },
});

function stopEngine() {
  wakelock.release();
  engine?.reset();
  engine = null;
}

function startWorkout(config) {
  let segments;
  try {
    segments = buildTimeline(normalizeConfig(config));
  } catch (err) {
    alert(err.message);
    return;
  }

  audio.unlock(); // must run inside the Start click handler
  stopEngine();
  engine = new Engine(segments);
  running.reset();

  const render = (state) => running.render(state);
  engine.on("tick", render);
  engine.on("pause", (state) => {
    wakelock.release();
    render(state);
  });
  engine.on("resume", (state) => {
    wakelock.acquire(); // runs inside the Resume click
    render(state);
  });
  engine.on("segmentStart", (state) => {
    render(state);
    cue(transitionCue(state.previous, state.segment));
    const seg = state.segment;
    const round = seg.type === "work" ? `, round ${seg.roundIndex + 1}` : "";
    running.announce(`${seg.label}${round}`);
  });
  engine.on("warning", () => cue("warning"));
  engine.on("finish", (state) => {
    wakelock.release();
    render(state);
    cue(transitionCue(state.previous, null));
    running.announce(t("workoutFinished"));
  });

  showScreen("running");
  wakelock.acquire(); // inside the Start click, so the video fallback can play
  engine.start();
}

const presetExists = (id) => store.listPresets().some((p) => p.id === id);

const setup = createSetupScreen({
  root: screens.setup,
  config: store.loadLast(),
  onStart: (config) => {
    store.saveLast(config);
    startWorkout(config);
  },
  onChange: (config) => store.saveLast(config),
  onSave: (config, { asNew }) => {
    try {
      return store.savePreset(config, { asNew });
    } catch (err) {
      alert(err.message);
      return null;
    }
  },
  onOpenPresets: (currentId) => {
    presets.show(currentId);
    showScreen("presets");
  },
  presetExists,
});

const presets = createPresetsScreen({
  root: screens.presets,
  store,
  onSelect: (preset) => {
    setup.load(preset);
    showScreen("setup");
    setup.showStatus(t("loaded", { name: preset.name }));
  },
  onClose: () => {
    setup.refresh(); // the current preset may have been deleted
    showScreen("setup");
  },
});

document.querySelector("#test-sound").addEventListener("click", () => {
  audio.unlock();
  audio.play("roundStart");
});

// ---------- PWA ----------

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // No HTTPS (e.g. testing over the LAN): the app still works, just not offline.
    });
  });
}

// iOS has no install prompt: suggest "Add to Home Screen" in Safari, once.
function setupInstallHint() {
  const hint = document.querySelector("#install-hint");
  const KEY = "ringside.installHint.dismissed";
  const isIOS =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  let dismissed = false;
  try {
    dismissed = localStorage.getItem(KEY) === "1";
  } catch {
    // Storage blocked: show it anyway.
  }
  if (!isIOS || navigator.standalone || dismissed) return;
  hint.hidden = false;
  document.querySelector("#install-hint-close").addEventListener("click", () => {
    hint.hidden = true;
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // Ignore.
    }
  });
}
setupInstallHint();

// Coming back from background: catch up with the real clock right away.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  audio.resume();
  engine?.update();
});
