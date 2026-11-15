/* ============================================================
   NEXUS SPACE — Service Worker (v2.8)
   Стратегия: СЕТЬ В ПРИОРИТЕТЕ (network-first).
   Любое обновление index.html / game.js / version.json
   подтягивается сразу — кэш браузера и CDN больше не мешают.
   Кэш используется только как офлайн-подстраховка.

   ВАЖНО: новый воркер вступает в силу НЕМЕДЛЕННО (skipWaiting),
   старые кэши удаляются при активации, страницы захватываются
   сразу (clients.claim). Поэтому кнопка «ОБНОВИТЬ» реально
   сбрасывает кэш, а не отдаёт старые файлы.
   ============================================================ */
const CACHE_NAME = 'nexus_space_v3_4';

/* ---------- УСТАНОВКА: новый SW вступает в силу сразу ---------- */
self.addEventListener('install', function (event) {
  self.skipWaiting();
});

/* ---------- АКТИВАЦИЯ: чистим старые кэши + захватываем страницы ---------- */
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames.map(function (cacheName) {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);   /* удаляем старые кэши */
          }
        })
      );
    }).then(function () {
      return self.clients.claim();             /* захват контроля над страницами */
    })
  );
});

/* ---------- Сообщение от страницы: активироваться немедленно ---------- */
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/* ---------- ЗАПРОСЫ: сеть в приоритете, кэш — только офлайн ---------- */
self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  /* three.js с CDN не трогаем — пусть грузится напрямую */
  if (url.origin !== self.location.origin) return;

  event.respondWith((async function () {
    try {
      const fresh = await fetch(req, { cache: 'no-store' });
      if (fresh && fresh.ok && fresh.type === 'basic') {
        try {
          const c = await caches.open(CACHE_NAME);
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
