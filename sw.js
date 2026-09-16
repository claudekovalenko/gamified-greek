// Offline copy of the whole game. The cache name carries the app build and the
// content hash: tools/sync.mjs rewrites the hash whenever the source apps have
// changed, so a content update invalidates the offline copy exactly like a
// code update does. Bump the "v2" part by hand alongside BUILD in js/app.js.
const CACHE = 'greek-quest-v2-857f231c';

const SHELL = [
  './',
  './index.html',
  './css/styles.css?v=v2',
  './js/app.js?v=v2',
  './js/dash.js',
  './js/normalize.js',
  './js/sources.js',
  './data/content.json',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(SHELL);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // the live-content refresh goes straight to the network

  // Content: network first, so an online load always has the newest bundle,
  // with the cached copy when there is no signal.
  if (url.pathname.endsWith('/data/content.json')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const fresh = await fetch(req);
          if (fresh.ok) cache.put(req, fresh.clone());
          return fresh;
        } catch {
          return (await cache.match(req)) || Response.error();
        }
      })()
    );
    return;
  }

  // Everything else: cache first, then network, and remember what we fetched.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        if (req.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
        return Response.error();
      }
    })()
  );
});
