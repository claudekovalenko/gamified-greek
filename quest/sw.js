// Offline support: cache the app shell on install, use the network when it is
// available and fall back to the cache when offline. Network first, so a new
// content.json (or a new chapter) shows up as soon as you are online.
const CACHE = 'going-deeper-quest-v34';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css', '../data/content.json',
  'js/content.js', 'js/boot.js', 'js/engine.js', 'js/app.js', 'js/world.js', 'js/stage.js', 'js/stagesets.js', 'js/fx.js', 'js/sidequests.js', 'js/venues.js', 'js/raiders.js', 'js/cloud.js', 'js/vendor/three.module.min.js',
  '../icons/icon.svg', '../icons/icon-192.png', '../icons/icon-512.png', '../icons/icon-180.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('going-deeper-quest') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      // always ask the server whether a file changed (the browser may otherwise reuse a copy for minutes, and an
      // old file next to a new one can break the game); unchanged files come back as a quick "not modified"
      const same = new URL(e.request.url).origin === location.origin;
      const res = await fetch(e.request, same ? { cache: 'no-cache' } : undefined);
      if (res.ok && (res.type === 'basic' || res.type === 'cors')) cache.put(e.request, res.clone());
      return res;
    } catch (err) {
      const hit = await cache.match(e.request, { ignoreSearch: true });
      if (hit) return hit;
      throw err;
    }
  })());
});
