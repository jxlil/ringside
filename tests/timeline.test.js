import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildTimeline,
  totalDuration,
  transitionCue,
  formatTime,
  normalizeConfig,
} from "../js/timeline.js";
import { setLanguage } from "../js/i18n.js";

const classic = {
  name: "Sparring 3×2",
  rounds: 3,
  rest: 60,
  prep: 10,
  warning: 10,
  round: { repeat: 1, blocks: [{ label: "Round", duration: 120 }] },
};

const intervals = {
  name: "Heavy bag power/speed",
  rounds: 3,
  rest: 60,
  prep: 10,
  warning: 10,
  round: {
    repeat: 5,
    blocks: [
      { label: "Power", duration: 30 },
      { label: "Speed", duration: 30 },
    ],
  },
};

test("classic boxing: prep, 3 rounds and 2 rests in order", () => {
  const segs = buildTimeline(classic);
  assert.deepEqual(
    segs.map((s) => s.type),
    ["prep", "work", "rest", "work", "rest", "work"],
  );
  assert.deepEqual(
    segs.map((s) => s.duration),
    [10, 120, 60, 120, 60, 120],
  );
  assert.deepEqual(
    segs.filter((s) => s.type === "work").map((s) => s.roundIndex),
    [0, 1, 2],
  );
  assert.equal(totalDuration(segs), 10 + 3 * 120 + 2 * 60);
});

test("intervals: 5 sets of 2 blocks per round", () => {
  const segs = buildTimeline(intervals);
  // 1 prep + 3 rounds × 10 blocks + 2 rests
  assert.equal(segs.length, 1 + 30 + 2);

  const round1 = segs.slice(1, 11);
  assert.ok(round1.every((s) => s.type === "work" && s.roundIndex === 0));
  assert.deepEqual(
    round1.map((s) => s.label),
    Array(5).fill(["Power", "Speed"]).flat(),
  );
  assert.deepEqual(
    round1.map((s) => s.repeatIndex),
    [0, 0, 1, 1, 2, 2, 3, 3, 4, 4],
  );
  assert.ok(round1.every((s) => s.repeatTotal === 5 && s.roundsTotal === 3));
  assert.equal(segs[11].type, "rest");
  assert.equal(totalDuration(segs), 10 + 3 * 5 * 60 + 2 * 60);
});

test("no rest after the last round", () => {
  for (const cfg of [classic, intervals]) {
    const segs = buildTimeline(cfg);
    assert.equal(segs.at(-1).type, "work");
    assert.equal(segs.filter((s) => s.type === "rest").length, cfg.rounds - 1);
  }
});

test("prep only appears at the start", () => {
  for (const cfg of [classic, intervals]) {
    const segs = buildTimeline(cfg);
    assert.equal(segs[0].type, "prep");
    assert.equal(segs.filter((s) => s.type === "prep").length, 1);
    assert.equal(segs[0].warning, 10);
  }
});

test("no prep or rest when they are 0", () => {
  const segs = buildTimeline({ ...classic, prep: 0, rest: 0 });
  assert.deepEqual(
    segs.map((s) => s.type),
    ["work", "work", "work"],
  );
});

test("the warning goes at the end of each round and each rest", () => {
  const segs = buildTimeline(intervals);
  const warned = segs.filter((s) => s.warning > 0 && s.type !== "prep");
  // last block of each round (3) + rests (2)
  assert.equal(warned.length, 5);
  for (const s of warned) {
    if (s.type === "work") {
      assert.equal(s.repeatIndex, 4);
      assert.equal(s.blockIndex, 1);
    } else {
      assert.equal(s.type, "rest");
    }
  }
});

test("the warning is dropped unless shorter than the segment", () => {
  const segs = buildTimeline({
    ...classic,
    warning: 30,
    round: { repeat: 1, blocks: [{ label: "Round", duration: 30 }] },
  });
  assert.equal(segs.find((s) => s.type === "work").warning, 0);
});

test("normalizeConfig rejects rounds without blocks", () => {
  assert.throws(() => normalizeConfig({ rounds: 2, round: { blocks: [] } }));
  assert.throws(() =>
    normalizeConfig({ rounds: 2, round: { blocks: [{ label: "x", duration: 0 }] } }),
  );
});

test("transitionCue tells the bell from a block change", () => {
  const segs = buildTimeline(intervals);
  const [prep, power, speed] = segs;
  const lastWork = segs[10];
  const rest = segs[11];
  const nextRound = segs[12];

  assert.equal(transitionCue(null, prep), null);
  assert.equal(transitionCue(prep, power), "roundStart");
  assert.equal(transitionCue(power, speed), "blockChange");
  assert.equal(transitionCue(lastWork, rest), "roundEnd");
  assert.equal(transitionCue(rest, nextRound), "roundStart");
  assert.equal(transitionCue(segs.at(-1), null), "roundEnd");
});

test("formatTime", () => {
  assert.equal(formatTime(0), "0:00");
  assert.equal(formatTime(9), "0:09");
  assert.equal(formatTime(60), "1:00");
  assert.equal(formatTime(125), "2:05");
});

test("the prep warning never exceeds its duration", () => {
  assert.equal(buildTimeline({ ...classic, prep: 5 })[0].warning, 5);
  assert.equal(buildTimeline({ ...classic, prep: 30 })[0].warning, 10);
  assert.equal(buildTimeline({ ...classic, warning: 0 })[0].warning, 0);
});

test("prep, rest and default block labels follow the language", () => {
  const unnamed = { ...classic, round: { repeat: 1, blocks: [{ label: "", duration: 60 }] } };
  try {
    setLanguage("es");
    assert.deepEqual(
      buildTimeline(unnamed).slice(0, 3).map((s) => s.label),
      ["Prepárate", "Bloque 1", "Descanso"],
    );
    setLanguage("en");
    assert.deepEqual(
      buildTimeline(unnamed).slice(0, 3).map((s) => s.label),
      ["Get ready", "Block 1", "Rest"],
    );
  } finally {
    setLanguage("en");
  }
});
