// Service worker: makes the app work offline.
// Strategy: network first (so a deploy shows up immediately), falling back to the
// cache when offline. VERSION is stamped with the commit hash at deploy time
// (scripts/stamp.js), so every deploy replaces the old cache automatically.
const VERSION = 'sudoku-__COMMIT_SHA__';
const FILES = [
  './',
  'index.html',
  'css/styles.css',
  'js/solver.js',
  'js/game.js',
  'js/hints.js',
  'js/history.js',
  'js/ui.js',
  'js/main.js',
  'manifest.webmanifest',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      // cache: 'reload' skips the browser's HTTP cache so we never precache stale files
      .then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

// Drop caches from older versions and take control of open pages right away.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    // cache: 'no-cache' = always revalidate with the server (never trust the HTTP cache)
    fetch(event.request, { cache: 'no-cache' })
      .then((response) => {
        const copy = response.clone();
        caches.open(VERSION).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true })),
  );
});
