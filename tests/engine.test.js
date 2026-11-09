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
      t += Math.round(seconds * 1e6) / 1e3; // ms, no accumulated float error
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

test("start emits segmentStart with the first segment", () => {
  const { engine, events } = setup();
  engine.start();
  assert.equal(engine.status, "running");
  assert.equal(events[0].type, "segmentStart");
  assert.equal(events[0].segment.type, "prep");
  assert.equal(engine.state.remainingSeconds, 10);
});

test("seconds use ceil: 0:01 until the end and the switch lands on 0:00", () => {
  const { engine, step } = setup();
  engine.start();
  step(0.001);
  assert.equal(engine.state.remainingSeconds, 10);
  step(9.998); // 9.999 s elapsed
  assert.equal(engine.state.remainingSeconds, 1);
  assert.equal(engine.state.segment.type, "prep");
  step(0.001); // exactly 10 s
  assert.equal(engine.state.segment.type, "work");
  assert.equal(engine.state.remainingSeconds, 120);
});

test("pause keeps the remaining time and resume recomputes endAt", () => {
  const { engine, clock, step } = setup();
  engine.start();
  step(4);
  engine.pause();
  assert.equal(engine.status, "paused");
  clock.advance(300); // time spent paused does not count
  assert.equal(engine.state.remainingMs, 6000);
  engine.resume();
  assert.equal(engine.state.remainingMs, 6000);
  step(6);
  assert.equal(engine.state.segment.type, "work");
});

test("returning from background skips finished segments without drift", () => {
  const { engine, events, step } = setup();
  engine.start();
  // prep 10 + round 120 + rest 60 = 190; 5 s into round 2
  step(195);
  assert.equal(engine.state.segment.type, "work");
  assert.equal(engine.state.segment.roundIndex, 1);
  assert.equal(engine.state.remainingMs, 115_000);
  const starts = events.filter((e) => e.type === "segmentStart");
  assert.equal(starts.at(-1).skipped, 2);
  assert.equal(starts.at(-1).previous.type, "rest");
  // No late warning for segments already gone (only the prep one)
  const late = events.filter((e) => e.type === "warning" && e.segment.type !== "prep");
  assert.equal(late.length, 0);
});

test("many small updates do not accumulate drift", () => {
  const { engine, step } = setup();
  engine.start();
  for (let i = 0; i < 190_000 / 16; i++) step(0.016); // 16 ms frames
  // 190 s later it must be right at the start of round 2
  assert.equal(engine.state.segment.roundIndex, 1);
  assert.equal(engine.state.remainingMs, 120_000);
});

test("the warning fires once when entering the last 10 s", () => {
  const { engine, events, step } = setup();
  engine.start();
  step(10); // round 1 starts
  const workWarnings = () =>
    events.filter((e) => e.type === "warning" && e.segment.type === "work");
  step(109.5); // 10.5 s left → shows 11
  assert.equal(workWarnings().length, 0);
  step(0.5); // 10 s left
  step(0.2);
  step(3);
  const warnings = workWarnings();
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].segment.type, "work");
});

test("the clapper sounds once during prep, with 10 s left", () => {
  const { engine, events, step } = setup();
  engine.start();
  for (let i = 0; i < 99; i++) step(0.1);
  const warnings = events.filter((e) => e.type === "warning");
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].segment.type, "prep");
});

test("with a long prep the clapper waits for the last 10 s", () => {
  const { engine, events, step } = setup({ ...classic, prep: 30 });
  engine.start();
  step(19.5);
  assert.equal(events.filter((e) => e.type === "warning").length, 0);
  step(0.5);
  assert.equal(events.filter((e) => e.type === "warning").length, 1);
});

test("skip moves to the next segment with its full duration", () => {
  const { engine, events, step } = setup();
  engine.start();
  step(3);
  engine.skip();
  assert.equal(engine.state.segment.type, "work");
  assert.equal(engine.state.remainingMs, 120_000);
  assert.equal(events.at(-1).manual, true);
});

test("skipping while paused stays paused", () => {
  const { engine } = setup();
  engine.start();
  engine.pause();
  engine.skip();
  assert.equal(engine.status, "paused");
  assert.equal(engine.state.remainingMs, 120_000);
});

test("finishes after the last round and emits finish", () => {
  const { engine, events, step } = setup();
  engine.start();
  step(10 + 120 * 3 + 60 * 2);
  assert.equal(engine.status, "finished");
  const finish = events.find((e) => e.type === "finish");
  assert.ok(finish);
  assert.equal(finish.previous.type, "work");
  assert.equal(engine.state.totalRemainingMs, 0);
  step(10); // no-op from here on
  assert.equal(events.filter((e) => e.type === "finish").length, 1);
});

test("skipping the last segment finishes", () => {
  const { engine } = setup();
  engine.start();
  for (let i = 0; i < 6; i++) engine.skip();
  assert.equal(engine.status, "finished");
});

test("totalRemainingMs counts everything left", () => {
  const { engine, step } = setup();
  engine.start();
  assert.equal(engine.state.totalRemainingMs, 490_000);
  step(15);
  assert.equal(engine.state.totalRemainingMs, 475_000);
});

test("reset goes back to idle on the first segment", () => {
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
