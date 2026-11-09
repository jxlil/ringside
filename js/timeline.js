// Converts a workout config into a flat list of segments.
// Pure logic: no DOM, no timers. Everything else consumes this list.

import { t } from "./i18n.js";

const toInt = (value, fallback) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? n : fallback;
};

/** Returns a sanitized copy of the config with defaults filled in. */
export function normalizeConfig(config = {}) {
  const round = config.round ?? {};
  const blocks = (round.blocks ?? [])
    .map((b, i) => ({
      label: String(b?.label ?? "").trim() || t("block", { n: i + 1 }),
      duration: Math.max(0, toInt(b?.duration, 0)),
    }))
    .filter((b) => b.duration > 0);

  if (blocks.length === 0) {
    throw new Error(t("noBlocks"));
  }

  return {
    name: String(config.name ?? "").trim(),
    rounds: Math.max(1, toInt(config.rounds, 1)),
    rest: Math.max(0, toInt(config.rest, 0)),
    prep: Math.max(0, toInt(config.prep, 0)),
    warning: Math.max(0, toInt(config.warning, 0)),
    round: {
      repeat: Math.max(1, toInt(round.repeat, 1)),
      blocks,
    },
  };
}

// The warning only makes sense if it is shorter than the segment.
const warningFor = (warning, duration) => (warning > 0 && warning < duration ? warning : 0);

/**
 * Expands a config into segments:
 * { type, label, duration, roundIndex, roundsTotal, blockIndex, repeatIndex,
 *   repeatTotal, warning }
 *
 * - prep only at the start, rest only between rounds (never after the last one).
 * - `warning` (the 10-second clapper) is set on the last work segment of each
 *   round, on each rest and on the prep. A prep no longer than the warning
 *   gets it right at its start.
 */
export function buildTimeline(config) {
  const c = normalizeConfig(config);
  const { rounds: roundsTotal } = c;
  const { repeat: repeatTotal, blocks } = c.round;
  const segments = [];

  if (c.prep > 0) {
    segments.push({
      type: "prep",
      label: t("prep"),
      duration: c.prep,
      roundIndex: 0,
      roundsTotal,
      blockIndex: null,
      repeatIndex: null,
      repeatTotal,
      warning: c.warning > 0 ? Math.min(c.warning, c.prep) : 0,
    });
  }

  for (let r = 0; r < roundsTotal; r++) {
    for (let rep = 0; rep < repeatTotal; rep++) {
      blocks.forEach((block, b) => {
        const lastInRound = rep === repeatTotal - 1 && b === blocks.length - 1;
        segments.push({
          type: "work",
          label: block.label,
          duration: block.duration,
          roundIndex: r,
          roundsTotal,
          blockIndex: b,
          repeatIndex: rep,
          repeatTotal,
          warning: lastInRound ? warningFor(c.warning, block.duration) : 0,
        });
      });
    }

    if (r < roundsTotal - 1 && c.rest > 0) {
      segments.push({
        type: "rest",
        label: t("rest"),
        duration: c.rest,
        roundIndex: r,
        roundsTotal,
        blockIndex: null,
        repeatIndex: null,
        repeatTotal,
        warning: warningFor(c.warning, c.rest),
      });
    }
  }

  return segments;
}

/** Total seconds of a list of segments. */
export function totalDuration(segments) {
  return segments.reduce((sum, s) => sum + s.duration, 0);
}

/**
 * Which sound to play when moving from `prev` to `next` (null = finished).
 * Returns "roundStart" | "roundEnd" | "blockChange" | null.
 */
export function transitionCue(prev, next) {
  if (!next) return prev?.type === "work" ? "roundEnd" : null;
  if (next.type === "rest") return "roundEnd";
  if (next.type === "work") {
    const sameRound = prev?.type === "work" && prev.roundIndex === next.roundIndex;
    return sameRound ? "blockChange" : "roundStart";
  }
  return null;
}

/** Formats seconds as m:ss. */
export function formatTime(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
