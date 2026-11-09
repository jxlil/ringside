import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore, memoryStorage, defaultPresets } from "../js/storage.js";
import { buildTimeline, totalDuration } from "../js/timeline.js";

const EN = defaultPresets("en");
const N = EN.length;
const en = (storage = memoryStorage()) => createStore(storage, { lang: "en" });
const es = (storage = memoryStorage()) => createStore(storage, { lang: "es" });

test("first run seeds the 5 boxing presets in the device language", () => {
  assert.deepEqual(
    en().listPresets().map((p) => p.name),
    ["Jump rope", "Shadowboxing", "Heavy bag power/speed", "Mitts", "Sparring 3×3"],
  );
  assert.deepEqual(
    es().listPresets().map((p) => p.name),
    ["Cuerda", "Sombra", "Costal intenso/velocidad", "Manoplas", "Sparring 3×3"],
  );
});

test("built-in presets are valid and last as expected", () => {
  const seconds = Object.fromEntries(EN.map((p) => [p.id, totalDuration(buildTimeline(p))]));
  assert.deepEqual(seconds, {
    "default-rope": 10 + 5 * 180 + 4 * 60, // 3-min rounds: 6 × (20 + 10 s)
    "default-shadow": 10 + 3 * 180 + 2 * 30,
    "default-intervals": 10 + 4 * 180 + 3 * 60, // 3 × (30 + 30 s)
    "default-mitts": 10 + 4 * 180 + 3 * 60,
    "default-sparring": 10 + 3 * 180 + 2 * 60,
  });
  assert.equal(new Set(EN.map((p) => p.id)).size, N);
  // Same workouts in both languages, only the text changes.
  const shape = (p) => ({ ...p, name: "", round: { ...p.round, blocks: p.round.blocks.map((b) => b.duration) } });
  assert.deepEqual(defaultPresets("es").map(shape), EN.map(shape));
});

test("saving creates a new preset with an id", () => {
  const store = en();
  const saved = store.savePreset({ ...EN[0], id: undefined, name: "Mine", rounds: 7 });
  assert.ok(saved.id);
  const presets = store.listPresets();
  assert.equal(presets.length, N + 1);
  assert.equal(presets.at(-1).rounds, 7);
});

test("saving with an existing id edits in place", () => {
  const store = en();
  store.savePreset({ ...EN[2], rounds: 6 });
  const presets = store.listPresets();
  assert.equal(presets.length, N);
  assert.equal(presets[2].rounds, 6);
  assert.equal(presets[2].id, "default-intervals");
});

test("save as new duplicates even with an id", () => {
  const store = en();
  const copy = store.savePreset(EN[0], { asNew: true });
  assert.notEqual(copy.id, EN[0].id);
  assert.equal(store.listPresets().length, N + 1);
});

test("an unnamed preset gets a default name in the device language", () => {
  assert.equal(en().savePreset({ ...EN[0], id: undefined, name: "" }).name, "My workout");
  assert.equal(es().savePreset({ ...EN[0], id: undefined, name: "" }).name, "Mi entrenamiento");
});

test("deleting removes the preset and does not reseed the built-ins", () => {
  const storage = memoryStorage();
  const store = en(storage);
  for (const p of EN) store.deletePreset(p.id);
  assert.equal(en(storage).listPresets().length, 0);
  assert.equal(store.restoreDefaults().length, N);
});

test("an old install refreshes the built-ins and keeps the user's own", () => {
  const storage = memoryStorage();
  // Previous version state: 2 examples (one edited) and one of the user's, no version.
  storage.setItem(
    "ringside.presets.v1",
    JSON.stringify([
      {
        ...EN[4],
        name: "Sparring 3×2",
        round: { repeat: 1, blocks: [{ label: "Round", duration: 120 }] },
      },
      { ...EN[2], id: "mine", name: "Mine" },
    ]),
  );
  const store = en(storage);
  assert.deepEqual(
    store.listPresets().map((p) => p.name),
    ["Jump rope", "Shadowboxing", "Heavy bag power/speed", "Mitts", "Sparring 3×3", "Mine"],
  );
  // A built-in deleted afterwards does not come back.
  store.deletePreset("default-rope");
  assert.ok(!en(storage).listPresets().some((p) => p.id === "default-rope"));
});

test("unedited built-ins follow a language change; edited ones and the user's stay", () => {
  const storage = memoryStorage();
  const spanish = es(storage);
  spanish.listPresets(); // seeded in Spanish
  spanish.savePreset({ ...defaultPresets("es")[3], rounds: 6 }); // edited "Manoplas"
  spanish.savePreset({ ...defaultPresets("es")[2], id: undefined, name: "Mío" });

  const presets = en(storage).listPresets();
  assert.deepEqual(
    presets.map((p) => p.name),
    ["Jump rope", "Shadowboxing", "Heavy bag power/speed", "Manoplas", "Sparring 3×3", "Mío"],
  );
  assert.deepEqual(presets[2].round.blocks.map((b) => b.label), ["Power", "Speed"]);
  assert.deepEqual(presets[5].round.blocks.map((b) => b.label), ["Intenso", "Velocidad"]);
  // And back.
  assert.equal(es(storage).listPresets()[0].name, "Cuerda");
});

test("presets persist across instances", () => {
  const storage = memoryStorage();
  en(storage).savePreset({ ...EN[0], id: undefined, name: "Persistent" });
  assert.ok(en(storage).listPresets().some((p) => p.name === "Persistent"));
});

test("remembers the last config and falls back to Sparring", () => {
  const storage = memoryStorage();
  const store = en(storage);
  assert.equal(store.loadLast().name, "Sparring 3×3");
  store.saveLast({ ...EN[2], rounds: 8 });
  const last = en(storage).loadLast();
  assert.equal(last.rounds, 8);
  assert.equal(last.id, "default-intervals");
});

test("an unedited last config follows a language change", () => {
  const storage = memoryStorage();
  es(storage).saveLast(defaultPresets("es")[2]);
  assert.equal(en(storage).loadLast().name, "Heavy bag power/speed");
});

test("corrupt data does not break the app", () => {
  const storage = memoryStorage();
  storage.setItem("ringside.presets.v1", "{not json");
  storage.setItem("ringside.last.v1", JSON.stringify({ round: { blocks: [] } }));
  const store = en(storage);
  assert.equal(store.listPresets().length, N); // reseeds
  assert.equal(store.loadLast().name, "Sparring 3×3");
});

test("an invalid preset is dropped on read", () => {
  const storage = memoryStorage();
  storage.setItem("ringside.defaults.version", "2");
  storage.setItem(
    "ringside.presets.v1",
    JSON.stringify([EN[0], { id: "x", round: { blocks: [] } }]),
  );
  assert.equal(en(storage).listPresets().length, 1);
});
