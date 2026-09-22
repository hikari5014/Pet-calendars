/* 毛日子：App 與 Service Worker 共用的小工具（純 classic script，兩邊都能載） */
(function (scope) {
  'use strict';

  /* ---------- IndexedDB：照片與提醒快照 ---------- */
  const NAME = 'petdays', VERSION = 1;
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos');
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }

  function run(store, mode, fn) {
    return open().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(req && req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    }));
  }

  scope.PetDB = {
    putPhoto: (id, blob) => run('photos', 'readwrite', s => s.put(blob, id)),
    getPhoto: id => run('photos', 'readonly', s => s.get(id)),
    delPhoto: id => run('photos', 'readwrite', s => s.delete(id)),
    photoIds: () => run('photos', 'readonly', s => s.getAllKeys()),
    putMeta: (k, v) => run('meta', 'readwrite', s => s.put(v, k)),
    getMeta: k => run('meta', 'readonly', s => s.get(k)),
  };

  /* ---------- 日期：App 與 SW 必須算出一樣的結果 ---------- */
  const pad = n => String(n).padStart(2, '0');
  const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromISO = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
  const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const daysBetween = (a, b) => Math.round((b - a) / 86400000);

  /** 下一次發生的日期（yearly 逢年、monthly 逢月、once 就是那天） */
  function nextOccurrence(iso, repeat) {
    const today = startOfToday(), base = fromISO(iso);
    if (repeat === 'yearly') {
      let n = new Date(today.getFullYear(), base.getMonth(), base.getDate());
      if (n < today) n = new Date(today.getFullYear() + 1, base.getMonth(), base.getDate());
      return n;
    }
    if (repeat === 'monthly') {
      let n = new Date(today.getFullYear(), today.getMonth(), base.getDate());
      if (n < today) n = new Date(today.getFullYear(), today.getMonth() + 1, base.getDate());
      return n;
    }
    return base;
  }

  /** 從提醒快照挑出「該通知了」的項目，App 與 SW 共用同一套判斷 */
  function dueReminders(snapshot) {
    if (!snapshot || !snapshot.notify || !Array.isArray(snapshot.events)) return [];
    const today = startOfToday();
    const limit = Number(snapshot.remindDays ?? 3);
    return snapshot.events
      .map(e => {
        const next = nextOccurrence(e.date, e.repeat);
        return { ...e, nextISO: toISO(next), days: daysBetween(today, next) };
      })
      .filter(e => e.days >= 0 && e.days <= limit)
      .sort((a, b) => a.days - b.days);
  }

  scope.PetDate = { pad, toISO, fromISO, startOfToday, daysBetween, nextOccurrence, dueReminders };
})(self);
