import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore, memoryStorage, DEFAULT_PRESETS } from "../js/storage.js";
import { buildTimeline, totalDuration } from "../js/timeline.js";

const N = DEFAULT_PRESETS.length;

test("la primera vez precarga los 5 presets de box", () => {
  const store = createStore(memoryStorage());
  assert.deepEqual(
    store.listPresets().map((p) => p.name),
    ["Cuerda", "Sombra", "Costal intenso/velocidad", "Manoplas", "Sparring 3×3"],
  );
});

test("los presets de fábrica son válidos y duran lo esperado", () => {
  const seconds = Object.fromEntries(
    DEFAULT_PRESETS.map((p) => [p.name, totalDuration(buildTimeline(p))]),
  );
  assert.deepEqual(seconds, {
    Cuerda: 10 + 5 * 180 + 4 * 60, // rounds de 3 min: 6 × (20 + 10 s)
    Sombra: 10 + 3 * 180 + 2 * 30,
    "Costal intenso/velocidad": 10 + 4 * 180 + 3 * 60, // 3 × (30 + 30 s)
    Manoplas: 10 + 4 * 180 + 3 * 60,
    "Sparring 3×3": 10 + 3 * 180 + 2 * 60,
  });
  assert.equal(new Set(DEFAULT_PRESETS.map((p) => p.id)).size, N);
});

test("guardar crea un preset nuevo con id", () => {
  const store = createStore(memoryStorage());
  const saved = store.savePreset({ ...DEFAULT_PRESETS[0], id: undefined, name: "Mío", rounds: 7 });
  assert.ok(saved.id);
  const presets = store.listPresets();
  assert.equal(presets.length, N + 1);
  assert.equal(presets.at(-1).rounds, 7);
});

test("guardar con un id existente edita en su lugar", () => {
  const store = createStore(memoryStorage());
  store.savePreset({ ...DEFAULT_PRESETS[2], rounds: 6 });
  const presets = store.listPresets();
  assert.equal(presets.length, N);
  assert.equal(presets[2].rounds, 6);
  assert.equal(presets[2].id, "default-intervals");
});

test("guardar como nuevo duplica aunque tenga id", () => {
  const store = createStore(memoryStorage());
  const copy = store.savePreset(DEFAULT_PRESETS[0], { asNew: true });
  assert.notEqual(copy.id, DEFAULT_PRESETS[0].id);
  assert.equal(store.listPresets().length, N + 1);
});

test("borrar elimina el preset y no vuelve a sembrar los de fábrica", () => {
  const storage = memoryStorage();
  const store = createStore(storage);
  for (const p of DEFAULT_PRESETS) store.deletePreset(p.id);
  assert.equal(createStore(storage).listPresets().length, 0);
  assert.equal(store.restoreDefaults().length, N);
});

test("una instalación vieja actualiza los de fábrica y conserva los propios", () => {
  const storage = memoryStorage();
  // Estado de la versión anterior: 2 ejemplos (uno editado) y uno propio, sin versión.
  storage.setItem(
    "ringside.presets.v1",
    JSON.stringify([
      {
        ...DEFAULT_PRESETS[4],
        name: "Sparring 3×2",
        round: { repeat: 1, blocks: [{ label: "Round", duration: 120 }] },
      },
      { ...DEFAULT_PRESETS[2], id: "mio", name: "Mío" },
    ]),
  );
  const store = createStore(storage);
  assert.deepEqual(
    store.listPresets().map((p) => p.name),
    ["Cuerda", "Sombra", "Costal intenso/velocidad", "Manoplas", "Sparring 3×3", "Mío"],
  );
  // Si después borra uno de fábrica, no reaparece.
  store.deletePreset("default-rope");
  assert.ok(!createStore(storage).listPresets().some((p) => p.id === "default-rope"));
});

test("los presets persisten entre instancias", () => {
  const storage = memoryStorage();
  createStore(storage).savePreset({ ...DEFAULT_PRESETS[0], id: undefined, name: "Persistente" });
  assert.ok(createStore(storage).listPresets().some((p) => p.name === "Persistente"));
});

test("recuerda la última configuración y usa Sparring si no hay", () => {
  const storage = memoryStorage();
  const store = createStore(storage);
  assert.equal(store.loadLast().name, "Sparring 3×3");
  store.saveLast({ ...DEFAULT_PRESETS[2], rounds: 8 });
  const last = createStore(storage).loadLast();
  assert.equal(last.rounds, 8);
  assert.equal(last.id, "default-intervals");
});

test("datos corruptos no rompen la app", () => {
  const storage = memoryStorage();
  storage.setItem("ringside.presets.v1", "{no es json");
  storage.setItem("ringside.last.v1", JSON.stringify({ round: { blocks: [] } }));
  const store = createStore(storage);
  assert.equal(store.listPresets().length, N); // vuelve a sembrar
  assert.equal(store.loadLast().name, "Sparring 3×3");
});

test("un preset inválido se descarta al leer", () => {
  const storage = memoryStorage();
  storage.setItem("ringside.defaults.version", "2");
  storage.setItem(
    "ringside.presets.v1",
    JSON.stringify([DEFAULT_PRESETS[0], { id: "x", round: { blocks: [] } }]),
  );
  assert.equal(createStore(storage).listPresets().length, 1);
});
