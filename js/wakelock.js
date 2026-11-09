// Keeps the screen on while the timer runs.
//
// 1. Screen Wake Lock API when available.
// 2. Fallback: a muted, inline, looping video (a playing video keeps iOS
//    and Android from dimming the screen).
//
// iOS drops the wake lock when the page is hidden, so it is requested again
// when the page becomes visible.

const VIDEO_SRC = "./media/silent.mp4";

let wanted = false;
let sentinel = null;
let video = null;
let mode = "off"; // off | wakelock | video

function getVideo() {
  if (video) return video;
  video = document.createElement("video");
  video.src = VIDEO_SRC;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.setAttribute("muted", "");
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.setAttribute("aria-hidden", "true");
  video.tabIndex = -1;
  Object.assign(video.style, {
    position: "fixed",
    left: "0",
    bottom: "0",
    width: "1px",
    height: "1px",
    opacity: "0",
    pointerEvents: "none",
  });
  document.body.append(video);
  return video;
}

function startVideo() {
  const v = getVideo();
  mode = "video";
  const p = v.play();
  p?.catch?.(() => {
    if (mode === "video") mode = "off";
  });
}

function stopVideo() {
  video?.pause();
}

async function requestLock() {
  sentinel = await navigator.wakeLock.request("screen");
  sentinel.addEventListener("release", () => {
    sentinel = null;
    if (mode === "wakelock") mode = "off";
  });
  // Released while we were waiting (pause pressed quickly).
  if (!wanted) {
    sentinel.release().catch(() => {});
    return;
  }
  mode = "wakelock";
  stopVideo();
}

function engage() {
  if (!("wakeLock" in navigator)) {
    startVideo();
    return;
  }
  if (sentinel) return;
  requestLock().catch(() => {
    if (wanted) startVideo();
  });
}

/**
 * Keeps the screen on. Call it from a user gesture (Start / Resume) so
 * the video fallback is allowed to play.
 */
export function acquire() {
  wanted = true;
  engage();
}

/** Lets the screen turn off again (pause, finish, reset). */
export function release() {
  wanted = false;
  mode = "off";
  stopVideo();
  const s = sentinel;
  sentinel = null;
  s?.release().catch(() => {});
}

/** Current strategy, for debugging: "off" | "wakelock" | "video". */
export function getMode() {
  return mode;
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && wanted) engage();
});
