// Service worker: precaches the whole app so it works offline in the gym.
// Cache-first. Bump CACHE_VERSION on every release: the new worker downloads
// everything again and deletes the old caches on activate.

const CACHE_VERSION = "v2";
const CACHE_NAME = `ringside-${CACHE_VERSION}`;

// Every file the app needs. tests/sw.test.js checks this list against the repo.
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/styles.css",
  "./js/app.js",
  "./js/audio.js",
  "./js/engine.js",
  "./js/storage.js",
  "./js/timeline.js",
  "./js/wakelock.js",
  "./js/ui/presets.js",
  "./js/ui/running.js",
  "./js/ui/setup.js",
  "./js/ui/stepper.js",
  "./media/silent.mp4",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // `reload` skips the HTTP cache so a new version never stores stale files.
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith("ringside-") && k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/**
 * Safari plays <video> with Range requests and needs a 206 answer; a full
 * 200 from the cache would stop the keep-awake video from playing offline.
 */
async function rangeResponse(request, response) {
  const buffer = await response.arrayBuffer();
  const match = /bytes=(\d*)-(\d*)/.exec(request.headers.get("range") || "");
  const size = buffer.byteLength;
  const start = match && match[1] ? Number(match[1]) : 0;
  const end = match && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  return new Response(buffer.slice(start, end + 1), {
    status: 206,
    statusText: "Partial Content",
    headers: {
      "Content-Type": response.headers.get("Content-Type") || "video/mp4",
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": String(end - start + 1),
      "Accept-Ranges": "bytes",
    },
  });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Navigations (with or without ?query) get the cached app shell.
      const cached =
        request.mode === "navigate"
          ? await cache.match("./index.html")
          : await cache.match(request, { ignoreSearch: true });

      if (cached) {
        return request.headers.has("range") ? rangeResponse(request, cached) : cached;
      }
      return fetch(request);
    })(),
  );
});
