/* 毛日子 Pet Days — service worker（離線快取） */
const CACHE = 'petdays-v1';
const ASSETS = [
  './', './index.html', './styles.css', './app.js',
  './manifest.webmanifest', './assets/stickers.svg',
  './assets/icon.svg', './assets/icon-maskable.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;

  // 自家檔案：先拿快取，背景再更新
  if (new URL(request.url).origin === location.origin) {
    e.respondWith(
      caches.match(request).then(hit => {
        const net = fetch(request).then(res => {
          caches.open(CACHE).then(c => c.put(request, res.clone()));
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  // Google Fonts 等外部資源：拿到就存起來，離線時用舊的
  e.respondWith(
    caches.match(request).then(hit => hit || fetch(request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(request, copy));
      return res;
    }).catch(() => hit))
  );
});
