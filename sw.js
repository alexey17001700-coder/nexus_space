/* ============================================================
   NEXUS SPACE — Service Worker (v2.3)
   Стратегия: СЕТЬ В ПРИОРИТЕТЕ (network-first).
   Любое обновление index.html / game.js / version.json
   подтягивается сразу — кэш браузера и CDN больше не мешают.
   Кэш используется только как офлайн-подстраховка.
   ============================================================ */
const CACHE = 'nexus-space-v1';

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil((async function () {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
    } catch (err) {}
    try { await self.clients.claim(); } catch (err) {}
  })());
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  /* three.js с CDN не трогаем — пусть грузится напрямую */
  if (url.origin !== self.location.origin) return;

  e.respondWith((async function () {
    try {
      const fresh = await fetch(req, { cache: 'no-store' });
      if (fresh && fresh.ok && fresh.type === 'basic') {
        try {
          const c = await caches.open(CACHE);
          c.put(req, fresh.clone());
        } catch (err) {}
      }
      return fresh;
    } catch (err) {
      try {
        const hit = await caches.match(req, { ignoreSearch: true });
        if (hit) return hit;
      } catch (e2) {}
      throw err;
    }
  })());
});
