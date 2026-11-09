// Presets and last used config in localStorage.
// The storage is injectable so it can be tested in Node.

import { normalizeConfig } from "./timeline.js";
import { t, getLanguage, LANGUAGES } from "./i18n.js";

const KEY_PRESETS = "ringside.presets.v1";
const KEY_LAST = "ringside.last.v1";
const KEY_DEFAULTS = "ringside.defaults.version";

// Built-in presets, based on common boxing gym routines. Bump
// DEFAULTS_VERSION when adding one, so existing installs get it too.
// Names and labels are in the device language (see localizeBuiltIn).
const DEFAULTS_VERSION = 2;
const base = { prep: 10, warning: 10 };

export const defaultPresets = (lang = getLanguage()) => {
  const tr = (key) => t(key, {}, lang);
  return [
    {
      // Warm-up rope: 3-min rounds alternating relaxed rhythm and all-out bursts.
      id: "default-rope",
      name: tr("presetRope"),
      ...base,
      rounds: 5,
      rest: 60,
      round: {
        repeat: 6,
        blocks: [
          { label: tr("blockRhythm"), duration: 20 },
          { label: tr("blockFast"), duration: 10 },
        ],
      },
    },
    {
      // Shadowboxing: footwork, jabs and combos, short rest.
      id: "default-shadow",
      name: tr("presetShadow"),
      ...base,
      rounds: 3,
      rest: 30,
      round: { repeat: 1, blocks: [{ label: tr("blockShadow"), duration: 180 }] },
    },
    {
      // Heavy bag: 30 s hard power shots / 30 s fast punches, three times a round.
      id: "default-intervals",
      name: tr("presetBag"),
      ...base,
      rounds: 4,
      rest: 60,
      round: {
        repeat: 3,
        blocks: [
          { label: tr("blockPower"), duration: 30 },
          { label: tr("blockSpeed"), duration: 30 },
        ],
      },
    },
    {
      // Mitts with the coach: standard 3-min rounds.
      id: "default-mitts",
      name: tr("presetMitts"),
      ...base,
      rounds: 4,
      rest: 60,
      round: { repeat: 1, blocks: [{ label: tr("blockMitts"), duration: 180 }] },
    },
    {
      // Amateur bout format: 3 rounds of 3 min, 1 min rest.
      id: "default-sparring",
      name: tr("presetSparring"),
      ...base,
      rounds: 3,
      rest: 60,
      round: { repeat: 1, blocks: [{ label: tr("blockRound"), duration: 180 }] },
    },
  ];
};

const FIRST_LOAD_PRESET = "default-sparring";

const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Sanitizes a stored config. Returns null if it is unusable. */
function clean(raw) {
  try {
    const config = normalizeConfig(raw);
    if (typeof raw?.id === "string" && raw.id) config.id = raw.id;
    return config;
  } catch {
    return null;
  }
}

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

function defaultStorage() {
  try {
    const s = globalThis.localStorage;
    const probe = "__ringside__";
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    // Private mode or storage disabled: keep working in memory.
    return memoryStorage();
  }
}

// Same config, ignoring the id.
const sameConfig = (a, b) => {
  const { id: _a, ...restA } = a;
  const { id: _b, ...restB } = b;
  return JSON.stringify(restA) === JSON.stringify(restB);
};

export function createStore(storage = defaultStorage(), { lang = getLanguage() } = {}) {
  const defaults = defaultPresets(lang);
  const isBuiltIn = (p) => defaults.some((d) => d.id === p.id);

  // A built-in preset the user never edited follows the device language:
  // if it matches the built-in of another language, swap in this one.
  const localizeBuiltIn = (preset) => {
    if (!preset?.id || !isBuiltIn(preset)) return preset;
    for (const other of LANGUAGES) {
      if (other === lang) continue;
      const theirs = defaultPresets(other).find((d) => d.id === preset.id);
      if (sameConfig(preset, clean(theirs))) return structuredClone(defaults.find((d) => d.id === preset.id));
    }
    return preset;
  };

  const read = (key) => {
    try {
      const raw = storage.getItem(key);
      return raw === null ? undefined : JSON.parse(raw);
    } catch {
      return undefined;
    }
  };
  const write = (key, value) => {
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch {
      // Quota or disabled storage: ignore, the app keeps working.
    }
  };

  function listPresets() {
    const stored = read(KEY_PRESETS);
    if (!Array.isArray(stored)) {
      // First run: preload the built-in presets.
      const seeded = structuredClone(defaults);
      write(KEY_PRESETS, seeded);
      write(KEY_DEFAULTS, DEFAULTS_VERSION);
      return seeded;
    }
    const cleaned = stored.map(clean).filter((p) => p && p.id);
    const presets = cleaned.map(localizeBuiltIn);
    if (presets.some((p, i) => p !== cleaned[i])) write(KEY_PRESETS, presets);
    if ((read(KEY_DEFAULTS) ?? 1) < DEFAULTS_VERSION) {
      // Older install: refresh the built-ins to their new definition (in
      // their order) and keep the user's own presets after them.
      const upgraded = [...structuredClone(defaults), ...presets.filter((p) => !isBuiltIn(p))];
      write(KEY_PRESETS, upgraded);
      write(KEY_DEFAULTS, DEFAULTS_VERSION);
      return upgraded;
    }
    return presets;
  }

  /** Creates (no id, or asNew) or updates (existing id) a preset. */
  function savePreset(config, { asNew = false } = {}) {
    const preset = clean(config);
    if (!preset) throw new Error(t("invalidConfig", {}, lang));
    if (!preset.name) preset.name = t("myWorkout", {}, lang);
    const presets = listPresets();
    const index = asNew ? -1 : presets.findIndex((p) => p.id === preset.id);
    if (index >= 0) {
      presets[index] = preset;
    } else {
      preset.id = newId();
      presets.push(preset);
    }
    write(KEY_PRESETS, presets);
    return structuredClone(preset);
  }

  function deletePreset(id) {
    write(
      KEY_PRESETS,
      listPresets().filter((p) => p.id !== id),
    );
  }

  function restoreDefaults() {
    const presets = listPresets();
    for (const def of defaults) {
      if (!presets.some((p) => p.id === def.id)) presets.push(structuredClone(def));
    }
    write(KEY_PRESETS, presets);
    return presets;
  }

  /** Last config used (or edited); falls back to the sparring preset. */
  function loadLast() {
    const fallback = defaults.find((p) => p.id === FIRST_LOAD_PRESET);
    return localizeBuiltIn(clean(read(KEY_LAST))) ?? structuredClone(fallback);
  }

  function saveLast(config) {
    const c = clean(config);
    if (c) write(KEY_LAST, c);
  }

  return { listPresets, savePreset, deletePreset, restoreDefaults, loadLast, saveLast };
}

export { memoryStorage };
