/* ============================================================
   NEXUS SPACE — Service Worker (v4.2)
   Стратегия: СЕТЬ В ПРИОРИТЕТЕ + ОБХОД КЭША CDN.

   ГЛАВНОЕ ОТЛИЧИЕ ОТ ПРОШЛЫХ ВЕРСИЙ:
   GitHub Pages раздаётся через CDN (Fastly), который держит
   index.html в своём кэше ~10 минут. Опция fetch cache:'no-store'
   обходит КЭШ БРАУЗЕРА, но НЕ кэш CDN — поэтому Босс и видел
   старую версию. Теперь каждый запрос уходит с уникальным
   параметром ?_cb=<время>, а для CDN это другой адрес — он
   обязан отдать свежий файл.

   Новый воркер вступает в силу НЕМЕДЛЕННО (skipWaiting),
   старые кэши удаляются при активации, страницы захватываются
   сразу (clients.claim).
   ============================================================ */
const CACHE_NAME = 'nexus_space_v4_2';

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

/* ---------- ЗАПРОСЫ: свежий файл с сервера, кэш — только офлайн ---------- */
self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  /* three.js с CDN (unpkg) не трогаем — пусть грузится напрямую */
  if (url.origin !== self.location.origin) return;

  /* Уникальный адрес — пробивает и кэш браузера, и кэш CDN GitHub Pages */
  const bust = new URL(url.href);
  bust.searchParams.set('_cb', Date.now());

  let freshReq;
  try {
    freshReq = new Request(bust.href, {
      cache: 'no-store',
      credentials: 'same-origin',
      redirect: 'follow'
    });
  } catch (e) {
    freshReq = req;
  }

  event.respondWith((async function () {
    try {
      const fresh = await fetch(freshReq);
      if (fresh && fresh.ok) {
        try {
          const c = await caches.open(CACHE_NAME);
          c.put(req, fresh.clone());          /* копия для офлайна */
        } catch (err) {}
      }
      return fresh;
    } catch (err) {
      /* нет сети — отдаём последнюю удачную копию */
      try {
        const hit = await caches.match(req, { ignoreSearch: true });
        if (hit) return hit;
      } catch (e2) {}
      throw err;
    }
  })());
});
