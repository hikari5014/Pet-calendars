/* 毛日子 Pet Days — service worker：離線快取 + 背景提醒 */
importScripts('./common.js');

const CACHE = 'petdays-v2';
const ASSETS = [
  './', './index.html', './styles.css', './app.js', './common.js',
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

/* ---------- 背景提醒 ---------- */
self.addEventListener('periodicsync', e => {
  if (e.tag === 'petdays-reminders') e.waitUntil(notifyDue());
});

// 手動觸發用（App 端可以送訊息叫它現在檢查一次）
self.addEventListener('message', e => {
  if (e.data === 'check-reminders') e.waitUntil(notifyDue());
});

async function notifyDue() {
  const snapshot = await PetDB.getMeta('reminders').catch(() => null);
  const due = PetDate.dueReminders(snapshot);
  if (!due.length) return;

  const seen = (await PetDB.getMeta('notified').catch(() => null)) ?? {};
  let changed = false;

  for (const e of due.slice(0, 3)) {
    const key = `${e.id}:${e.nextISO}`;
    if (seen[key]) continue;                       // 同一個日子只提醒一次
    await self.registration.showNotification('毛日子提醒', {
      body: e.days === 0
        ? `今天是「${e.title}」！`
        : `還有 ${e.days} 天就是「${e.title}」${e.pet ? ` · ${e.pet}` : ''}`,
      icon: './assets/icon.svg',
      badge: './assets/icon.svg',
      tag: key,
      data: { url: './index.html' },
    });
    seen[key] = Date.now();
    changed = true;
  }

  if (changed) {
    const trimmed = Object.fromEntries(
      Object.entries(seen).sort((a, b) => b[1] - a[1]).slice(0, 60)
    );
    await PetDB.putMeta('notified', trimmed).catch(() => {});
  }
}

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = all.find(c => c.url.includes(self.registration.scope));
    if (open) return open.focus();
    return self.clients.openWindow(e.notification.data?.url ?? './');
  })());
});
