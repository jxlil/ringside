// Synthesized sounds with the Web Audio API. No audio files.
//
// iOS only allows audio after a user gesture: call unlock() synchronously
// inside a click handler (Start, Pause, etc.) before playing anything.

let ctx = null;
let master = null;
let noiseBuffer = null;

const AudioCtx = globalThis.AudioContext ?? globalThis.webkitAudioContext;

// "transient" = short sounds that mix with whatever else is playing, so the
// gym's music (Spotify, Apple Music…) keeps going under the bell. "playback"
// would make iOS stop that music. Trade-off: like any mixable sound, iOS
// mutes it when the iPhone's silent switch is on.
const SESSION_TYPE = "transient";

/** Lets the bells play on top of other apps' music (iOS 17+). */
function setAudioSession() {
  try {
    if (navigator.audioSession && navigator.audioSession.type !== SESSION_TYPE) {
      navigator.audioSession.type = SESSION_TYPE;
    }
  } catch {
    // Not supported: ignore.
  }
}

// Set it before any audio exists, so the session starts mixable.
setAudioSession();

function createContext() {
  ctx = new AudioCtx({ latencyHint: "interactive" });

  // Loud but without clipping: everything goes through a compressor.
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -12;
  compressor.knee.value = 6;
  compressor.ratio.value = 8;
  compressor.attack.value = 0.002;
  compressor.release.value = 0.25;

  master = ctx.createGain();
  master.gain.value = 1;
  master.connect(compressor).connect(ctx.destination);

  noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
}

/** Creates or resumes the AudioContext. Must run inside a user gesture. */
export function unlock() {
  if (!AudioCtx) return;
  setAudioSession();
  if (!ctx) createContext();
  if (ctx.state !== "running") ctx.resume().catch(() => {});

  // A silent buffer played from the gesture fully unlocks iOS.
  const src = ctx.createBufferSource();
  src.buffer = ctx.createBuffer(1, 1, 22050);
  src.connect(ctx.destination);
  src.start(0);
}

/** Resumes after an interruption (e.g. coming back from background). */
export function resume() {
  if (ctx && ctx.state !== "running") ctx.resume().catch(() => {});
}

// ---------- Building blocks ----------

/** Gain node with a fast attack and exponential decay. */
function decayEnvelope(t, peak, attack, decay) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  g.connect(master);
  return g;
}

function tone(t, { type = "sine", freq, peak, attack = 0.002, decay }) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  osc.connect(decayEnvelope(t, peak, attack, decay));
  osc.start(t);
  osc.stop(t + attack + decay + 0.05);
}

function noiseBurst(t, { filter = "highpass", freq, q = 1, peak, decay }) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.frequency.value = freq;
  f.Q.value = q;
  src.connect(f).connect(decayEnvelope(t, peak, 0.001, decay));
  src.start(t);
  src.stop(t + decay + 0.05);
}

/** Flat beep with a short attack/release (no clicks). */
function beep(t, freq, duration, peak = 0.35) {
  const osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(freq, t);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.005);
  g.gain.setValueAtTime(peak, t + duration - 0.02);
  g.gain.linearRampToValueAtTime(0, t + duration);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

// ---------- Bell ----------
//
// Modeled on a recording of a real boxing bell: the partials and decay times
// below were measured from it. A struck metal bell is several inharmonic
// partials, each with its own exponential decay, plus a short noise burst for
// the hammer. Each ding is two strikes 81 ms apart (the hammer bounces), and
// the end of a round is three dings 0.24 s apart.

const BELL = {
  base: 1286, // Hz
  gain: 0.35,
  // [frequency ratio, amplitude, seconds to silence]
  partials: [
    [0.3826, 0.02, 7], // 492 Hz low hum
    [0.567, 0.03, 1.1], // 729 Hz
    [1, 0.28, 4.2], // 1286 Hz body, rings long
    [1.751, 0.28, 8], // 2252 Hz body, rings longest
    [2.588, 0.35, 0.9], // 3328 Hz
    [3.518, 1, 2], // 4524 Hz, the bright "ding"
    [3.488, 0.12, 2], // 4486 Hz, beats against 4524 Hz
    [4.527, 0.45, 0.8], // 5822 Hz
    [5.646, 0.08, 0.55], // 7260 Hz
  ],
  hit: { freq: 3500, peak: 0.3, decay: 0.01 },
  bounce: { delay: 0.081, level: 0.55 },
  endSpacing: 0.24,
};

function strike(t, level = 1) {
  for (const [ratio, amp, decay] of BELL.partials) {
    tone(t, { freq: BELL.base * ratio, peak: BELL.gain * amp * level, attack: 0.001, decay });
  }
  noiseBurst(t, { filter: "highpass", freq: BELL.hit.freq, peak: BELL.hit.peak * level, decay: BELL.hit.decay });
}

/** One ding: the strike plus the hammer's bounce. */
function ding(t) {
  strike(t);
  strike(t + BELL.bounce.delay, BELL.bounce.level);
}

// ---------- Clapper (wooden block, the 10-second warning) ----------

const CLAPPER_SPACING = 0.2;

function knock(t) {
  tone(t, { freq: 820, peak: 0.8, attack: 0.001, decay: 0.09 });
  tone(t, { freq: 2150, peak: 0.35, attack: 0.001, decay: 0.05 });
  noiseBurst(t, { filter: "bandpass", freq: 3000, q: 3, peak: 0.5, decay: 0.01 });
}

// ---------- Cues ----------

const CUES = {
  /** Start of a round: one ding that rings out. */
  roundStart(t) {
    ding(t);
  },
  /** End of a round: three dings. */
  roundEnd(t) {
    for (let i = 0; i < 3; i++) ding(t + i * BELL.endSpacing);
  },
  /** 10 seconds left: two knocks of the clapper. */
  warning(t) {
    knock(t);
    knock(t + CLAPPER_SPACING);
  },
  /** Block change inside a round (intervals only): short high double beep. */
  blockChange(t) {
    beep(t, 1760, 0.09);
    beep(t + 0.14, 1760, 0.09);
  },
};

export const CUE_NAMES = Object.keys(CUES);

/** Plays a cue now (scheduled on the audio clock, not on JS timers). */
export function play(name) {
  if (!ctx || !CUES[name]) return;
  if (ctx.state !== "running") ctx.resume().catch(() => {});
  CUES[name](ctx.currentTime + 0.01);
}

// Vibration is an extra for Android only (it does not exist on iOS Safari).
const VIBRATION = {
  roundStart: [400],
  roundEnd: [200, 100, 200, 100, 200],
  warning: [60, 80, 60],
  blockChange: [80, 60, 80],
};

export function vibrate(name) {
  if (typeof navigator.vibrate !== "function" || !VIBRATION[name]) return;
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  try {
    navigator.vibrate(VIBRATION[name]);
  } catch {
    // Ignore.
  }
}
