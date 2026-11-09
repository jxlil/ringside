// "Running" screen: renders engine state. No timing logic lives here.

import { formatTime } from "../timeline.js";
import { t } from "../i18n.js";

// Height of a digit relative to the font size (system UI fonts ≈ 0.72).
const DIGIT_HEIGHT = 0.72;

// CSS variable (on :root) holding each phase's background color.
const PHASE_VARS = {
  work: "--phase-work",
  rest: "--phase-rest",
  prep: "--phase-prep",
  warning: "--phase-prep",
  done: "--phase-done",
};

export function createRunningScreen({ root, onPauseToggle, onSkip, onReset }) {
  const $ = (sel) => root.querySelector(sel);
  const el = {
    round: $("#run-round"),
    series: $("#run-series"),
    label: $("#run-label"),
    timeBox: $("#run-time-box"),
    time: $("#run-time"),
    next: $("#run-next"),
    total: $("#run-total"),
    pause: $("#btn-pause"),
    pauseText: $("#btn-pause-text"),
    skip: $("#btn-skip"),
    reset: $("#btn-reset"),
    resetText: $("#btn-reset-text"),
  };
  const announcer = document.querySelector("#announcer");
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const defaultTheme = themeMeta?.content ?? "#0e0e10";

  el.pause.addEventListener("click", onPauseToggle);
  el.skip.addEventListener("click", onSkip);
  el.reset.addEventListener("click", onReset);

  let lastText = {};
  let lastPhase = null;

  const setText = (key, text) => {
    if (lastText[key] === text) return; // avoid touching the DOM every frame
    lastText[key] = text;
    el[key].textContent = text;
  };

  // ---------- Giant number that fills the available box ----------

  let fittedLength = 0;
  function fitTime() {
    const W = el.timeBox.clientWidth;
    const H = el.timeBox.clientHeight;
    if (!W || !H) return;
    el.time.style.fontSize = "100px";
    const w100 = el.time.getBoundingClientRect().width;
    if (!w100) return;
    const byWidth = ((W * 0.96) / w100) * 100;
    const byHeight = (H * 0.92) / DIGIT_HEIGHT;
    el.time.style.fontSize = `${Math.min(byWidth, byHeight).toFixed(1)}px`;
    fittedLength = el.time.textContent.length;
  }
  new ResizeObserver(fitTime).observe(el.timeBox);

  // ---------- Rendering ----------

  const phaseOf = (state) => {
    if (state.status === "finished") return "done";
    const seg = state.segment;
    if (!seg || seg.type === "prep") return "prep";
    if (seg.warning > 0 && state.remainingSeconds <= seg.warning) return "warning";
    return seg.type; // work | rest
  };

  const describeNext = (state) => {
    const n = state.next;
    if (!n) return t("lastSegment");
    return t("upNext", { label: n.label, time: formatTime(n.duration) });
  };

  function setPhase(phase) {
    if (phase === lastPhase) return;
    lastPhase = phase;
    root.dataset.phase = phase;
    const color = getComputedStyle(document.documentElement)
      .getPropertyValue(PHASE_VARS[phase])
      .trim();
    setChromeColor(color);
  }

  // iOS Safari tints the status bar and the bottom toolbar from the page
  // background (Safari 26 ignores theme-color), so paint <html> and <body>
  // with the phase color too, not only this fixed screen.
  function setChromeColor(color) {
    const html = document.documentElement;
    html.classList.toggle("is-running", Boolean(color));
    html.style.backgroundColor = color;
    document.body.style.backgroundColor = color;
    if (themeMeta) themeMeta.content = color || defaultTheme;
  }

  function render(state) {
    const seg = state.segment;
    const finished = state.status === "finished";
    setPhase(phaseOf(state));
    root.dataset.status = state.status;

    // When finished, the big number shows the whole workout's duration.
    setText("time", formatTime(finished ? state.totalMs / 1000 : state.remainingSeconds));
    if (el.time.textContent.length !== fittedLength) fitTime();
    setText("total", formatTime(Math.ceil(state.totalRemainingMs / 1000)));

    if (finished) {
      setText("label", t("finished"));
      setText("round", seg ? t("roundsCount", { n: seg.roundsTotal }) : "");
      setText("series", "");
      setText("next", t("finishedNext"));
    } else if (seg) {
      const round = t("roundOf", { i: seg.roundIndex + 1, n: seg.roundsTotal });
      setText("round", seg.type === "rest" ? `${round} ✓` : round);
      setText(
        "series",
        seg.type === "work" && seg.repeatTotal > 1
          ? t("setOf", { i: seg.repeatIndex + 1, n: seg.repeatTotal })
          : "",
      );
      setText("label", seg.label);
      setText("next", describeNext(state));
    }
    el.series.hidden = !lastText.series;

    const paused = state.status === "paused";
    setText("pauseText", paused ? t("resume") : t("pause"));
    el.pause.setAttribute("aria-label", paused ? t("resume") : t("pause"));
    setText("resetText", finished ? t("back") : t("restart"));
    el.reset.setAttribute("aria-label", finished ? t("backToSetup") : t("restartWorkout"));
  }

  return {
    render,
    announce(text) {
      announcer.textContent = text;
    },
    reset() {
      lastText = {};
      lastPhase = null;
      fittedLength = 0;
    },
    /** Restores the browser chrome color when leaving this screen. */
    leave() {
      lastPhase = null;
      setChromeColor("");
    },
  };
}
