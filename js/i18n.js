// UI strings in English and Spanish. The language follows the device:
// Spanish if it is among the user's preferred languages before English,
// English otherwise. No DOM needed except in applyToDocument().

const STRINGS = {
  en: {
    appDescription: "Boxing round timer: bell, clapper and presets.",
    installHint:
      "Add it to your Home Screen: tap <strong>Share</strong>, then <strong>“Add to Home Screen”</strong>. It opens full screen and works offline.",
    closeHint: "Close tip",
    totalDuration: "Total time",
    workoutName: "Workout name",
    openPresets: "Show saved presets",
    presets: "Presets",
    workout: "Workout",
    insideRound: "Inside each round",
    addBlock: "+ Add block",
    savePreset: "Save preset",
    saveChanges: "Save changes",
    saveAsNew: "Save as new",
    testSoundLabel: "Test the bell sound",
    testSound: "🔔 Test sound",
    start: "Start",
    backToSetup: "Back to setup",
    backArrow: "‹ Back",
    back: "Back",
    noPresets: "No saved presets.",
    restoreExamples: "Restore examples",
    runningLabel: "Workout in progress",
    paused: "Paused",
    totalRemaining: "Total left",
    restartWorkout: "Restart workout",
    restart: "Restart",
    pause: "Pause",
    resume: "Resume",
    skipLabel: "Skip to next segment",
    skip: "Skip",
    confirmRestart: "Restart the workout?",
    workoutFinished: "Workout finished",
    loaded: "Loaded: {name}",
    saved: "Saved: {name}",
    rounds: "Rounds",
    rest: "Rest",
    prep: "Get ready",
    prepTime: "Prep time",
    finalWarning: "Final warning",
    off: "Off",
    repeats: "Repeats",
    duration: "Duration",
    block: "Block {n}",
    blockName: "Block {n} name",
    removeBlock: "Remove block {name}",
    less: "Less {label}",
    more: "More {label}",
    restFor: "rest {time}",
    loadPreset: "Load {name}, {desc}",
    deletePreset: "Delete {name}",
    confirmDelete: "Delete “{name}”?",
    lastSegment: "Last segment",
    upNext: "Next: {label} · {time}",
    finished: "Done!",
    roundsCount: "{n} rounds",
    roundOf: "Round {i} / {n}",
    setOf: "Set {i} / {n}",
    finishedNext: "Total time · Good work",
    myWorkout: "My workout",
    invalidConfig: "Invalid settings.",
    noBlocks: "A round needs at least one block with a duration.",
    presetRope: "Jump rope",
    blockRhythm: "Rhythm",
    blockFast: "Fast",
    presetShadow: "Shadowboxing",
    blockShadow: "Shadow",
    presetBag: "Heavy bag power/speed",
    blockPower: "Power",
    blockSpeed: "Speed",
    presetMitts: "Mitts",
    blockMitts: "Mitts",
    presetSparring: "Sparring 3×3",
    blockRound: "Round",
  },
  es: {
    appDescription: "Timer de rounds para box: campana, tablas y presets.",
    installHint:
      "Agrégala a tu pantalla de inicio: toca <strong>Compartir</strong> y luego <strong>“Agregar a inicio”</strong>. Así abre en pantalla completa y funciona sin internet.",
    closeHint: "Cerrar aviso",
    totalDuration: "Duración total",
    workoutName: "Nombre del entrenamiento",
    openPresets: "Ver presets guardados",
    presets: "Presets",
    workout: "Entrenamiento",
    insideRound: "Dentro de cada round",
    addBlock: "+ Agregar bloque",
    savePreset: "Guardar preset",
    saveChanges: "Guardar cambios",
    saveAsNew: "Guardar como nuevo",
    testSoundLabel: "Probar sonido de la campana",
    testSound: "🔔 Probar sonido",
    start: "Iniciar",
    backToSetup: "Volver a configurar",
    backArrow: "‹ Volver",
    back: "Volver",
    noPresets: "No hay presets guardados.",
    restoreExamples: "Restaurar ejemplos",
    runningLabel: "Entrenamiento en curso",
    paused: "En pausa",
    totalRemaining: "Restante total",
    restartWorkout: "Reiniciar entrenamiento",
    restart: "Reiniciar",
    pause: "Pausa",
    resume: "Reanudar",
    skipLabel: "Saltar al siguiente segmento",
    skip: "Saltar",
    confirmRestart: "¿Reiniciar el entrenamiento?",
    workoutFinished: "Entrenamiento terminado",
    loaded: "Cargado: {name}",
    saved: "Guardado: {name}",
    rounds: "Rounds",
    rest: "Descanso",
    prep: "Prepárate",
    prepTime: "Preparación",
    finalWarning: "Aviso final",
    off: "No",
    repeats: "Repeticiones",
    duration: "Duración",
    block: "Bloque {n}",
    blockName: "Nombre del bloque {n}",
    removeBlock: "Quitar bloque {name}",
    less: "Menos {label}",
    more: "Más {label}",
    restFor: "descanso {time}",
    loadPreset: "Cargar {name}, {desc}",
    deletePreset: "Borrar {name}",
    confirmDelete: "¿Borrar “{name}”?",
    lastSegment: "Último segmento",
    upNext: "Sigue: {label} · {time}",
    finished: "¡Terminado!",
    roundsCount: "{n} rounds",
    roundOf: "Round {i} / {n}",
    setOf: "Serie {i} / {n}",
    finishedNext: "Tiempo total · Buen trabajo",
    myWorkout: "Mi entrenamiento",
    invalidConfig: "Configuración inválida.",
    noBlocks: "El round necesita al menos un bloque con duración.",
    presetRope: "Cuerda",
    blockRhythm: "Ritmo",
    blockFast: "Rápido",
    presetShadow: "Sombra",
    blockShadow: "Sombra",
    presetBag: "Costal intenso/velocidad",
    blockPower: "Intenso",
    blockSpeed: "Velocidad",
    presetMitts: "Manoplas",
    blockMitts: "Manoplas",
    presetSparring: "Sparring 3×3",
    blockRound: "Round",
  },
};

export const LANGUAGES = Object.keys(STRINGS);

// Value for <html lang>.
const HTML_LANG = { en: "en", es: "es-MX" };

/** First supported language among the device's preferences; English if none. */
export function detectLanguage(preferred) {
  const nav = globalThis.navigator;
  const list = preferred ?? nav?.languages ?? (nav?.language ? [nav.language] : []);
  for (const tag of list) {
    const base = String(tag).toLowerCase().split("-")[0];
    if (base in STRINGS) return base;
  }
  return "en";
}

let current = detectLanguage();

export const getLanguage = () => current;

export function setLanguage(lang) {
  current = lang in STRINGS ? lang : "en";
}

/** Translated string, with {placeholders} filled from `params`. */
export function t(key, params = {}, lang = current) {
  const text = STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

/**
 * Translates the static HTML: data-i18n (text), data-i18n-html (trusted
 * markup from this file), data-i18n-label (aria-label) and
 * data-i18n-placeholder.
 */
export function applyToDocument(doc = document) {
  doc.documentElement.lang = HTML_LANG[current];
  doc.querySelector('meta[name="description"]')?.setAttribute("content", t("appDescription"));
  for (const el of doc.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
  for (const el of doc.querySelectorAll("[data-i18n-html]")) el.innerHTML = t(el.dataset.i18nHtml);
  for (const el of doc.querySelectorAll("[data-i18n-label]")) {
    el.setAttribute("aria-label", t(el.dataset.i18nLabel));
  }
  for (const el of doc.querySelectorAll("[data-i18n-placeholder]")) {
    el.setAttribute("placeholder", t(el.dataset.i18nPlaceholder));
  }
}
