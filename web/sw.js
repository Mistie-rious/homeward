// Offline support: serve app files from cache, refresh them in the background
// (stale-while-revalidate), so updates show up on the next launch.
// This origin is shared with other apps, so cache names carry this app's prefix and only "hw-" caches are ever deleted.
const PREFIX = "hw-";
const CACHE = `${PREFIX}v1`;
const FILES = [
  "./", "index.html", "app.css", "manifest.webmanifest",
  "js/app.js", "js/util.js", "js/db.js", "js/srs.js", "js/nlp.js", "js/course.js", "js/basics.js", "js/claude.js", "js/correction.js",
  "js/content.js", "js/progress.js", "js/seed.js", "js/translate.js", "js/answers.js", "js/speech.js", "js/chars.js", "js/pictures.js", "js/pronounce.js", "js/lessons.js", "js/talk.js", "js/story.js",
  "js/views/today.js", "js/views/review.js", "js/views/read.js", "js/views/write.js", "js/views/me.js", "js/views/learn.js", "js/views/talk.js", "js/views/ask.js", "js/screentime.js",
  "vendor/sql-wasm.js", "vendor/sql-wasm.wasm", "vendor/ts-fsrs.js",
  "fonts/instrument-serif-latin-400-normal.woff2", "fonts/instrument-serif-latin-400-italic.woff2",
  "icons/icon.svg", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  // cache: "reload" skips the browser's HTTP cache (GitHub Pages allows 10 min), so an update never stores old files
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: "reload" })))));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  // Only this app's own old caches: never touch another app's caches on the same origin.
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // Claude goes straight to the network
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(e.request, { ignoreSearch: true });
      const fresh = fetch(e.request, { cache: "no-cache" })
        .then((resp) => {
          if (resp.ok) cache.put(e.request, resp.clone());
          return resp;
        })
        .catch(() => hit);
      return hit || fresh;
    }),
  );
});
