// Clock that runs a timeline. Never counts ticks: each segment stores an
// absolute `endAt` and the remaining time is computed from `now()` on every
// update, so throttled timers or background tabs cannot make it drift.
//
// Events: "segmentStart", "tick", "warning", "finish", "pause",
// "resume", "reset". Listeners receive a state snapshot (plus extras).

const defaultNow = () => globalThis.performance.now();

/** Drives `update()` with requestAnimationFrame plus a 250 ms interval fallback. */
export function browserDriver() {
  let rafId = null;
  let intervalId = null;
  return {
    start(update) {
      this.stop();
      const frame = () => {
        update();
        rafId = requestAnimationFrame(frame);
      };
      rafId = requestAnimationFrame(frame);
      intervalId = setInterval(update, 250);
    },
    stop() {
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (intervalId !== null) clearInterval(intervalId);
      rafId = intervalId = null;
    },
  };
}

const manualDriver = () => ({ start() {}, stop() {} });

export class Engine {
  /**
   * @param {Array} segments  output of buildTimeline()
   * @param {{ now?: () => number, driver?: {start(fn), stop()} }} [options]
   *   `now` returns milliseconds; inject a fake one in tests.
   */
  constructor(segments, { now = defaultNow, driver } = {}) {
    this.segments = segments;
    this.now = now;
    this.driver =
      driver ?? (typeof requestAnimationFrame === "function" ? browserDriver() : manualDriver());
    this.listeners = new Map();

    // Suffix sums so the UI can show the whole workout's remaining time.
    this.after = new Array(segments.length).fill(0);
    for (let i = segments.length - 2; i >= 0; i--) {
      this.after[i] = this.after[i + 1] + segments[i + 1].duration * 1000;
    }

    this.totalMs = segments.reduce((sum, s) => sum + s.duration * 1000, 0);

    this.#resetState();
  }

  on(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
    return () => this.listeners.get(type).delete(fn);
  }

  #emit(type, extra = {}) {
    const payload = { ...this.state, ...extra };
    for (const fn of this.listeners.get(type) ?? []) fn(payload);
  }

  #resetState() {
    this.status = "idle"; // idle | running | paused | finished
    this.index = 0;
    this.endAt = 0;
    this.pausedRemaining = (this.segments[0]?.duration ?? 0) * 1000;
    this.#resetSegmentFlags();
  }

  #resetSegmentFlags() {
    this.warned = false;
  }

  get segment() {
    return this.segments[this.index] ?? null;
  }

  get remainingMs() {
    if (this.status === "running") return Math.max(0, this.endAt - this.now());
    if (this.status === "finished") return 0;
    return this.pausedRemaining;
  }

  get state() {
    const remainingMs = this.remainingMs;
    const finished = this.status === "finished";
    return {
      status: this.status,
      index: this.index,
      segment: this.segment,
      next: this.segments[this.index + 1] ?? null,
      remainingMs,
      // ceil: "0:01" stays visible until the very end.
      remainingSeconds: Math.ceil(remainingMs / 1000),
      totalRemainingMs: finished ? 0 : remainingMs + (this.after[this.index] ?? 0),
      totalMs: this.totalMs,
    };
  }

  start() {
    if (this.status !== "idle") return;
    if (this.segments.length === 0) {
      this.status = "finished";
      this.#emit("finish", { previous: null });
      return;
    }
    this.status = "running";
    this.endAt = this.now() + this.segments[0].duration * 1000;
    this.#resetSegmentFlags();
    this.#emit("segmentStart", { previous: null, skipped: 0, manual: false });
    this.driver.start(() => this.update());
    this.update();
  }

  pause() {
    if (this.status !== "running") return;
    this.update();
    if (this.status !== "running") return; // finished during update
    this.pausedRemaining = Math.max(0, this.endAt - this.now());
    this.status = "paused";
    this.driver.stop();
    this.#emit("pause");
  }

  resume() {
    if (this.status !== "paused") return;
    this.status = "running";
    this.endAt = this.now() + this.pausedRemaining;
    this.#emit("resume");
    this.driver.start(() => this.update());
    this.update();
  }

  toggle() {
    if (this.status === "running") this.pause();
    else if (this.status === "paused") this.resume();
    else if (this.status === "idle") this.start();
  }

  /** Jumps to the next segment (or finishes on the last one). */
  skip() {
    if (this.status !== "running" && this.status !== "paused") return;
    const previous = this.segment;
    this.index++;
    if (this.index >= this.segments.length) {
      this.#finish(previous);
      return;
    }
    const ms = this.segment.duration * 1000;
    this.#resetSegmentFlags();
    if (this.status === "running") this.endAt = this.now() + ms;
    else this.pausedRemaining = ms;
    this.#emit("segmentStart", { previous, skipped: 0, manual: true });
    if (this.status === "running") this.update();
  }

  reset() {
    this.driver.stop();
    this.#resetState();
    this.#emit("reset");
  }

  #finish(previous) {
    this.status = "finished";
    this.index = this.segments.length - 1;
    this.driver.stop();
    this.#emit("finish", { previous });
  }

  /**
   * Recomputes the state from the real clock. Safe to call at any time:
   * after returning from background it walks forward through the segments
   * that already ended. The next endAt is anchored on the previous one, so
   * no time is lost between segments.
   */
  update() {
    if (this.status !== "running") return;
    const t = this.now();
    let previous = null;
    let advanced = 0;

    while (t >= this.endAt) {
      previous = this.segment;
      this.index++;
      advanced++;
      if (this.index >= this.segments.length) {
        this.#finish(previous);
        return;
      }
      this.endAt += this.segment.duration * 1000;
      this.#resetSegmentFlags();
    }

    if (advanced > 0) {
      this.#emit("segmentStart", { previous, skipped: advanced - 1, manual: false });
    }

    const seg = this.segment;
    const secs = Math.ceil((this.endAt - t) / 1000);

    if (seg.warning > 0 && !this.warned && secs <= seg.warning) {
      this.warned = true;
      // Only sound it if we are at the start of the warning window (not when
      // coming back from background in the middle of it).
      if (secs === seg.warning) this.#emit("warning");
    }

    this.#emit("tick");
  }
}
