import { test } from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../js/engine.js";
import { buildTimeline } from "../js/timeline.js";

const classic = {
  rounds: 3,
  rest: 60,
  prep: 10,
  warning: 10,
  round: { repeat: 1, blocks: [{ label: "Round", duration: 120 }] },
};

function setup(config = classic) {
  let t = 1000;
  const clock = {
    now: () => t,
    advance(seconds) {
      t += Math.round(seconds * 1e6) / 1e3; // ms, sin error flotante acumulado
    },
  };
  const engine = new Engine(buildTimeline(config), { now: clock.now, driver: null });
  const events = [];
  for (const type of ["segmentStart", "warning", "finish", "pause", "resume", "reset"]) {
    engine.on(type, (s) => events.push({ type, index: s.index, ...s }));
  }
  const step = (seconds) => {
    clock.advance(seconds);
    engine.update();
  };
  return { engine, clock, events, step };
}

test("start emite segmentStart con el primer segmento", () => {
  const { engine, events } = setup();
  engine.start();
  assert.equal(engine.status, "running");
  assert.equal(events[0].type, "segmentStart");
  assert.equal(events[0].segment.type, "prep");
  assert.equal(engine.state.remainingSeconds, 10);
});

test("los segundos usan ceil: 0:01 hasta el final y cambio exacto en 0:00", () => {
  const { engine, step } = setup();
  engine.start();
  step(0.001);
  assert.equal(engine.state.remainingSeconds, 10);
  step(9.998); // 9.999 s transcurridos
  assert.equal(engine.state.remainingSeconds, 1);
  assert.equal(engine.state.segment.type, "prep");
  step(0.001); // exactamente 10 s
  assert.equal(engine.state.segment.type, "work");
  assert.equal(engine.state.remainingSeconds, 120);
});

test("pausa conserva el tiempo restante y reanudar recalcula endAt", () => {
  const { engine, clock, step } = setup();
  engine.start();
  step(4);
  engine.pause();
  assert.equal(engine.status, "paused");
  clock.advance(300); // tiempo en pausa: no cuenta
  assert.equal(engine.state.remainingMs, 6000);
  engine.resume();
  assert.equal(engine.state.remainingMs, 6000);
  step(6);
  assert.equal(engine.state.segment.type, "work");
});

test("volver de segundo plano salta los segmentos ya terminados sin desfase", () => {
  const { engine, events, step } = setup();
  engine.start();
  // prep 10 + round 120 + descanso 60 = 190; 5 s dentro del round 2
  step(195);
  assert.equal(engine.state.segment.type, "work");
  assert.equal(engine.state.segment.roundIndex, 1);
  assert.equal(engine.state.remainingMs, 115_000);
  const starts = events.filter((e) => e.type === "segmentStart");
  assert.equal(starts.at(-1).skipped, 2);
  assert.equal(starts.at(-1).previous.type, "rest");
  // No suena un aviso tardío de segmentos que ya pasaron (solo el de la prep)
  const late = events.filter((e) => e.type === "warning" && e.segment.type !== "prep");
  assert.equal(late.length, 0);
});

test("muchos updates pequeños no acumulan desfase", () => {
  const { engine, step } = setup();
  engine.start();
  for (let i = 0; i < 190_000 / 16; i++) step(0.016); // frames de 16 ms
  // 190 s después debe estar justo al inicio del round 2
  assert.equal(engine.state.segment.roundIndex, 1);
  assert.equal(engine.state.remainingMs, 120_000);
});

test("aviso se emite una sola vez al entrar a los últimos 10 s", () => {
  const { engine, events, step } = setup();
  engine.start();
  step(10); // empieza round 1
  const workWarnings = () =>
    events.filter((e) => e.type === "warning" && e.segment.type === "work");
  step(109.5); // quedan 10.5 s → muestra 11
  assert.equal(workWarnings().length, 0);
  step(0.5); // quedan 10 s
  step(0.2);
  step(3);
  const warnings = workWarnings();
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].segment.type, "work");
});

test("las tablas suenan una sola vez en la preparación, al faltar 10 s", () => {
  const { engine, events, step } = setup();
  engine.start();
  for (let i = 0; i < 99; i++) step(0.1);
  const warnings = events.filter((e) => e.type === "warning");
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].segment.type, "prep");
});

test("con una preparación larga las tablas esperan a los últimos 10 s", () => {
  const { engine, events, step } = setup({ ...classic, prep: 30 });
  engine.start();
  step(19.5);
  assert.equal(events.filter((e) => e.type === "warning").length, 0);
  step(0.5);
  assert.equal(events.filter((e) => e.type === "warning").length, 1);
});

test("saltar avanza al siguiente segmento con su duración completa", () => {
  const { engine, events, step } = setup();
  engine.start();
  step(3);
  engine.skip();
  assert.equal(engine.state.segment.type, "work");
  assert.equal(engine.state.remainingMs, 120_000);
  assert.equal(events.at(-1).manual, true);
});

test("saltar en pausa mantiene la pausa", () => {
  const { engine } = setup();
  engine.start();
  engine.pause();
  engine.skip();
  assert.equal(engine.status, "paused");
  assert.equal(engine.state.remainingMs, 120_000);
});

test("termina después del último round y emite finish", () => {
  const { engine, events, step } = setup();
  engine.start();
  step(10 + 120 * 3 + 60 * 2);
  assert.equal(engine.status, "finished");
  const finish = events.find((e) => e.type === "finish");
  assert.ok(finish);
  assert.equal(finish.previous.type, "work");
  assert.equal(engine.state.totalRemainingMs, 0);
  step(10); // ya no hace nada
  assert.equal(events.filter((e) => e.type === "finish").length, 1);
});

test("saltar el último segmento termina", () => {
  const { engine } = setup();
  engine.start();
  for (let i = 0; i < 6; i++) engine.skip();
  assert.equal(engine.status, "finished");
});

test("totalRemainingMs cuenta todo lo que falta", () => {
  const { engine, step } = setup();
  engine.start();
  assert.equal(engine.state.totalRemainingMs, 490_000);
  step(15);
  assert.equal(engine.state.totalRemainingMs, 475_000);
});

test("reiniciar vuelve a idle en el primer segmento", () => {
  const { engine, step } = setup();
  engine.start();
  step(50);
  engine.reset();
  assert.equal(engine.status, "idle");
  assert.equal(engine.index, 0);
  assert.equal(engine.state.remainingSeconds, 10);
  engine.start();
  assert.equal(engine.status, "running");
});
