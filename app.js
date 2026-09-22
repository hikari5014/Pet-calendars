/* ===== 毛日子 Pet Days — demo app (no framework, localStorage only) ===== */

const STORE_KEY = 'petdays.v1';
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- 物種設定：貼圖 id 之後換成正式貼圖就好 ---------- */
const SPECIES = [
  { id: 'cat',     label: '貓',    sticker: 'st-cat',     hue: 12  },
  { id: 'dog',     label: '狗',    sticker: 'st-dog',     hue: 32  },
  { id: 'rabbit',  label: '兔',    sticker: 'st-rabbit',  hue: 330 },
  { id: 'bird',    label: '鳥',    sticker: 'st-bird',    hue: 190 },
  { id: 'hamster', label: '鼠',    sticker: 'st-hamster', hue: 45  },
  { id: 'reptile', label: '爬蟲',  sticker: 'st-reptile', hue: 140 },
  { id: 'fish',    label: '水族',  sticker: 'st-fish',    hue: 205 },
  { id: 'human',   label: '重要的人', sticker: 'st-heart', hue: 350 },
  { id: 'other',   label: '其他',  sticker: 'st-paw',     hue: 265 },
];
const speciesOf = id => SPECIES.find(s => s.id === id) || SPECIES.at(-1);

const EVENT_TYPES = [
  { id: 'birth',  label: '生日',   icon: 'cake',            repeat: 'yearly' },
  { id: 'gotcha', label: '到家',   icon: 'home_pin',        repeat: 'yearly' },
  { id: 'health', label: '健康',   icon: 'vaccines',        repeat: 'once'   },
  { id: 'diary',  label: '日記',   icon: 'auto_stories',    repeat: 'once'   },
  { id: 'custom', label: '自訂',   icon: 'favorite',        repeat: 'yearly' },
];
const typeOf = id => EVENT_TYPES.find(t => t.id === id) || EVENT_TYPES.at(-1);

const DEFAULTS = {
  settings: {
    hue: 12, theme: 'auto', animations: true, haptics: true,
    notify: false, remindDays: 3, remindTime: '09:00', weekStart: 0, showAge: true,
  },
  pets: [], events: [],
};

/* ---------- 日期小工具（共用自 common.js，SW 也用同一份） ---------- */
const { toISO, fromISO, startOfToday, daysBetween, nextOccurrence } = PetDate;
const fmtDate = iso => { const d = fromISO(iso); return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`; };
const fmtShort = iso => { const d = fromISO(iso); return `${d.getMonth() + 1}/${d.getDate()}`; };

/** 幾歲幾個月／未滿一歲就顯示天數 */
function ageText(iso) {
  const b = fromISO(iso), t = startOfToday();
  if (b > t) return '尚未到來';
  let months = (t.getFullYear() - b.getFullYear()) * 12 + (t.getMonth() - b.getMonth());
  if (t.getDate() < b.getDate()) months--;
  if (months < 12) return months < 1 ? `${daysBetween(b, t)} 天` : `${months} 個月`;
  const y = Math.floor(months / 12), m = months % 12;
  return m ? `${y} 歲 ${m} 個月` : `${y} 歲`;
}

/* ---------- 狀態 ---------- */
function uid() { return Math.random().toString(36).slice(2, 9); }

let state = load();

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY));
    if (raw?.pets) return { ...DEFAULTS, ...raw, settings: { ...DEFAULTS.settings, ...raw.settings } };
  } catch { /* 壞掉就重來 */ }
  return demoData();
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch { toast('儲存空間不足，資料沒存起來'); }
  syncReminders();
}

function demoData() {
  const t = startOfToday();
  const rel = n => toISO(new Date(t.getFullYear(), t.getMonth(), t.getDate() + n));
  const yearsAgo = (y, n) => toISO(new Date(t.getFullYear() - y, t.getMonth(), t.getDate() + n));
  const pets = [
    { id: 'p1', name: '奶茶', species: 'cat',   birthday: yearsAgo(3, 5),  gotcha: yearsAgo(2, 12) },
    { id: 'p2', name: '麻糬', species: 'dog',   birthday: yearsAgo(6, -20), gotcha: yearsAgo(5, 3) },
    { id: 'p3', name: '小豆', species: 'reptile', birthday: yearsAgo(1, 40), gotcha: yearsAgo(1, 44) },
    { id: 'p4', name: '寶貝', species: 'human', birthday: yearsAgo(28, 9), gotcha: yearsAgo(2, 26) },
  ];
  const events = [
    { id: uid(), petId: 'p1', type: 'birth',  title: '奶茶生日',     date: pets[0].birthday, repeat: 'yearly', note: '要買凍乾蛋糕！' },
    { id: uid(), petId: 'p1', type: 'gotcha', title: '奶茶到家紀念', date: pets[0].gotcha,   repeat: 'yearly', note: '' },
    { id: uid(), petId: 'p2', type: 'birth',  title: '麻糬生日',     date: pets[1].birthday, repeat: 'yearly', note: '' },
    { id: uid(), petId: 'p2', type: 'health', title: '狂犬疫苗',     date: rel(9),           repeat: 'once',   note: '記得帶健康手冊' },
    { id: uid(), petId: 'p3', type: 'custom', title: '小豆蛻皮日',   date: rel(4),           repeat: 'monthly', note: '濕度拉高一點' },
    { id: uid(), petId: 'p4', type: 'custom', title: '交往紀念日',   date: pets[3].gotcha,   repeat: 'yearly', note: '訂餐廳' },
    { id: uid(), petId: 'p1', type: 'diary',  title: '今天超黏人',   date: rel(-1),          repeat: 'once',   note: '一整天都躺在鍵盤上。' },
    { id: uid(), petId: 'p2', type: 'diary',  title: '第一次游泳',   date: rel(-4),          repeat: 'once',   note: '下水前抖了五分鐘，下水後不想上岸。' },
  ];
  return { ...DEFAULTS, pets, events };
}

/* ---------- 共用 UI ---------- */
function haptic(ms = 8) { if (state.settings.haptics) navigator.vibrate?.(ms); }
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}
const stickerSVG = (sp, size = '') =>
  `<div class="sticker-slot"${size ? ` data-size="${size}"` : ''} style="--sh:${sp.hue}"><svg><use href="#${sp.sticker}"></use></svg></div>`;
const thumbSVG = (photoId, size = '') =>
  `<div class="sticker-slot thumb"${size ? ` data-size="${size}"` : ''}><img data-photo="${photoId}" alt=""></div>`;

async function loadStickers() {
  try {
    const res = await fetch('./assets/stickers.svg');
    $('#sticker-sprite').innerHTML = await res.text();
  } catch { /* 離線第一次開可能失敗，之後 SW 會補上 */ }
}

/* ---------- 照片（原圖壓過再存進 IndexedDB） ---------- */
const photoURLs = new Map();
const MAX_PHOTOS = 9;

async function photoURL(id) {
  if (photoURLs.has(id)) return photoURLs.get(id);
  const blob = await PetDB.getPhoto(id).catch(() => null);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  photoURLs.set(id, url);
  return url;
}

async function hydratePhotos(root = document) {
  for (const img of root.querySelectorAll('img[data-photo]:not([data-ready])')) {
    const url = await photoURL(img.dataset.photo);
    if (url) { img.src = url; img.dataset.ready = '1'; }
    else img.closest('.sticker-slot, .photo-cell')?.remove();
  }
}

/** 縮到長邊 1600px 的 JPEG，手機拍的照片才不會把空間吃光 */
async function shrink(file) {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.82));
    return blob ?? file;
  } catch { return file; }   // 瀏覽器不支援就存原圖
}

/** 清掉沒有任何紀錄在用的照片（取消新增時會留下孤兒） */
async function gcPhotos() {
  try {
    const used = new Set(state.events.flatMap(e => e.photos ?? []));
    const ids = await PetDB.photoIds();
    await Promise.all(ids.filter(id => !used.has(id)).map(id => PetDB.delPhoto(id)));
  } catch { /* 沒有 IndexedDB 就算了 */ }
}

/* ---------- 主題 ---------- */
const media = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const s = state.settings;
  const dark = s.theme === 'dark' || (s.theme === 'auto' && media.matches);
  const root = document.documentElement;
  root.style.setProperty('--brand-h', s.hue);
  root.dataset.dark = String(dark);
  root.dataset.anim = s.animations ? 'on' : 'off';
  $('meta[name=theme-color]').content = dark
    ? `hsl(${s.hue} 16% 10%)` : `hsl(${s.hue} 100% 76%)`;
}
media.addEventListener('change', applyTheme);

/* ---------- 分頁切換 ---------- */
let currentView = 'home';
const VIEW_TITLE = {
  home:     ['毛日子', '今天也要好好記錄 ✦'],
  calendar: ['日曆',   '點日期看看那天的事'],
  pets:     ['成員',   '你的毛小孩與重要的人'],
  settings: ['設定',   '把 App 調成你的樣子'],
};
function switchView(name) {
  if (name === currentView) return;
  const run = () => {
    currentView = name;
    $$('.view').forEach(v => v.hidden = v.dataset.view !== name);
    $$('.tabbar button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.target === name)));
    const [t, s] = VIEW_TITLE[name];
    $('#appbar-title').textContent = t;
    $('#appbar-sub').textContent = s;
    moveIndicator();
    $('#fab').classList.toggle('hide', name === 'settings');
    scrollTo({ top: 0, behavior: 'instant' });
    render();
  };
  if (document.startViewTransition && state.settings.animations) {
    // 過場會吞掉 callback 裡的錯誤，補一個 catch 才看得到
    document.startViewTransition(run).updateCallbackDone.catch(err => console.error(err));
  } else run();
}
function moveIndicator() {
  const btn = $(`.tabbar button[data-target="${currentView}"]`);
  const ind = $('#tab-indicator');
  if (!btn) return;
  ind.style.width = `${btn.offsetWidth}px`;
  ind.style.transform = `translateX(${btn.offsetLeft - 8}px)`;
}

/* ---------- 渲染：首頁 ---------- */
function upcomingList() {
  const today = startOfToday();
  return state.events
    .filter(e => e.type !== 'diary')
    .map(e => {
      const next = nextOccurrence(e.date, e.repeat);
      return { ...e, next, days: daysBetween(today, next) };
    })
    .filter(e => e.days >= 0)
    .sort((a, b) => a.days - b.days);
}
function petOf(id) { return state.pets.find(p => p.id === id); }

function renderHome() {
  const list = upcomingList();
  const hero = $('#hero');
  if (list.length) {
    const e = list[0], pet = petOf(e.petId), sp = speciesOf(pet?.species);
    hero.hidden = false;
    $('#hero-label').textContent = `${pet?.name ?? '家人'} · ${typeOf(e.type).label}`;
    $('#hero-title').textContent = e.title;
    $('#hero-days').textContent = e.days === 0 ? '今天' : e.days;
    $('#hero-unit').textContent = e.days === 0 ? '就是這一天 🎉' : '天後';
    $('#hero-date').textContent = `${fmtDate(toISO(e.next))}${e.repeat === 'yearly' ? ' · 每年' : e.repeat === 'monthly' ? ' · 每月' : ''}`;
    $('.hero-sticker use').setAttribute('href', `#${sp.sticker}`);
    $('.hero-sticker').style.setProperty('--sh', sp.hue);
    const span = e.repeat === 'monthly' ? 30 : 365;
    $('#hero-ring').style.strokeDashoffset = 327 * Math.min(1, e.days / span);
  } else hero.hidden = true;

  $('#upcoming').innerHTML = list.slice(0, 6).map(e => itemHTML(e)).join('')
    || emptyHTML('event_busy', '還沒有排定的日子，按右下角 + 新增一個吧');

  const diaries = state.events.filter(e => e.type === 'diary')
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  $('#recent-diary').innerHTML = diaries.map(e => itemHTML(e, true)).join('')
    || emptyHTML('menu_book', '還沒有日記，記下今天的一件小事吧');
}

function itemHTML(e, isDiary = false) {
  const pet = petOf(e.petId), sp = speciesOf(pet?.species), t = typeOf(e.type);
  const photos = e.photos ?? [];
  const avatar = photos.length ? thumbSVG(photos[0], 'sm') : stickerSVG(sp, 'sm');
  const right = isDiary
    ? `<div class="item-right"><b>${fmtShort(e.date)}</b><small>${fromISO(e.date).getFullYear()}</small></div>`
    : `<div class="item-right"><b>${e.days === 0 ? '今天' : e.days}</b><small>${e.days === 0 ? '' : '天後'}</small></div>`;
  return `<button class="item" data-event="${e.id}">
    ${avatar}
    <div class="item-main">
      <div class="item-title">${esc(e.title)} ${e.days === 0 && !isDiary ? '<span class="chip today">今天</span>' : `<span class="chip">${t.label}</span>`}</div>
      <div class="item-sub">${esc(pet?.name ?? '未指定')}${photos.length > 1 ? ` · 📷 ${photos.length}` : ''}${e.note ? ' · ' + esc(e.note) : ''}</div>
    </div>${right}</button>`;
}
const emptyHTML = (icon, text) => `<div class="empty"><span class="msr">${icon}</span>${text}</div>`;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- 渲染：日曆 ---------- */
let calCursor = startOfToday();
let calSelected = toISO(startOfToday());

function eventsOn(iso) {
  const d = fromISO(iso);
  return state.events.filter(e => {
    const b = fromISO(e.date);
    if (e.repeat === 'yearly') return b.getMonth() === d.getMonth() && b.getDate() === d.getDate();
    if (e.repeat === 'monthly') return b.getDate() === d.getDate();
    return e.date === iso;
  });
}

function renderCalendar() {
  const ws = Number(state.settings.weekStart);
  const names = ['日', '一', '二', '三', '四', '五', '六'];
  $('#cal-weekdays').innerHTML = names.map((_, i) => `<span>${names[(i + ws) % 7]}</span>`).join('');
  $('#cal-month').textContent = `${calCursor.getFullYear()} 年 ${calCursor.getMonth() + 1} 月`;

  const first = new Date(calCursor.getFullYear(), calCursor.getMonth(), 1);
  const lead = (first.getDay() - ws + 7) % 7;
  const todayISO = toISO(startOfToday());
  let html = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(first.getFullYear(), first.getMonth(), 1 - lead + i);
    const iso = toISO(d);
    const evts = eventsOn(iso);
    const cls = ['cal-day',
      d.getMonth() !== calCursor.getMonth() ? 'other' : '',
      iso === todayISO ? 'today' : '',
      iso === calSelected ? 'selected' : ''].filter(Boolean).join(' ');
    const dots = evts.slice(0, 3).map(() => '<i></i>').join('');
    html += `<button class="${cls}" data-date="${iso}" style="animation-delay:${i * 6}ms">${d.getDate()}
      ${dots ? `<span class="cal-dots">${dots}</span>` : ''}</button>`;
  }
  $('#cal-days').innerHTML = html;

  const today = startOfToday();
  const picked = eventsOn(calSelected).map(e => ({ ...e, days: daysBetween(today, fromISO(calSelected)) }));
  $('#cal-selected-label').textContent = `${fmtDate(calSelected)}`;
  $('#cal-list').innerHTML = picked.map(e => itemHTML(e, e.type === 'diary')).join('')
    || emptyHTML('sentiment_calm', '這天還沒有紀錄');
}

/* ---------- 渲染：成員 ---------- */
function renderPets() {
  $('#pet-list').innerHTML = state.pets.map(p => {
    const sp = speciesOf(p.species);
    const home = p.gotcha ? daysBetween(fromISO(p.gotcha), startOfToday()) : null;
    const count = state.events.filter(e => e.petId === p.id).length;
    return `<button class="item pet-card" data-pet="${p.id}">
      ${stickerSVG(sp)}
      <div class="item-main">
        <div class="item-title">${esc(p.name)} <span class="chip">${sp.label}</span></div>
        <div class="pet-stats">
          ${state.settings.showAge && p.birthday ? `<span class="pet-stat">年齡 <b>${ageText(p.birthday)}</b></span>` : ''}
          ${home !== null ? `<span class="pet-stat">到家 <b>${home}</b> 天</span>` : ''}
          <span class="pet-stat">紀錄 <b>${count}</b> 則</span>
        </div>
      </div>
      <span class="msr chev">chevron_right</span>
    </button>`;
  }).join('') || emptyHTML('pets', '還沒有成員，先新增一位吧');
}

/* ---------- 渲染：設定 ---------- */
function renderSettings() {
  const s = state.settings;
  $('#swatches').innerHTML = [12, 32, 45, 140, 190, 265, 330].map(h =>
    `<button class="swatch" data-hue="${h}" aria-pressed="${h === s.hue}" aria-label="主題色 ${h}"
      style="background:linear-gradient(145deg,hsl(${h} 100% 78%),hsl(${h} 72% 58%))"></button>`).join('');
  $$('#seg-theme button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.value === s.theme)));
  $('#notify-status').textContent = `目前狀態：${REMINDER_STATUS[reminderMode]}`;
  $$('[data-setting]').forEach(el => {
    const key = el.dataset.setting;
    if (el.type === 'checkbox') el.checked = !!s[key]; else el.value = s[key];
  });
}

function render() {
  if (currentView === 'home') renderHome();
  if (currentView === 'calendar') renderCalendar();
  if (currentView === 'pets') renderPets();
  if (currentView === 'settings') renderSettings();
  hydratePhotos();
}

/* ---------- 底部面板 ---------- */
function openSheet(html) {
  $('#sheet-body').innerHTML = html;
  $('#sheet').hidden = false; $('#scrim').hidden = false;
  $('#fab').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeSheet() {
  const sheet = $('#sheet');
  if (sheet.hidden) return;
  sheet.classList.add('closing');
  $('#fab').classList.remove('open');
  setTimeout(() => {
    sheet.classList.remove('closing');
    sheet.hidden = true; $('#scrim').hidden = true;
    document.body.style.overflow = '';
  }, state.settings.animations ? 220 : 0);
}

let draftPhotos = [];

function photoGridHTML() {
  return draftPhotos.map(id => `<div class="photo-cell">
      <img data-photo="${id}" alt="" data-view-photo="${id}">
      <button type="button" class="photo-x" data-rmphoto="${id}" aria-label="移除照片"><span class="msr">close</span></button>
    </div>`).join('') +
    (draftPhotos.length < MAX_PHOTOS
      ? `<button type="button" class="photo-add" id="btn-add-photo"><span class="msr">add_a_photo</span>加照片</button>` : '');
}
function renderPhotoGrid() {
  const grid = $('#photo-grid');
  if (!grid) return;
  grid.innerHTML = photoGridHTML();
  hydratePhotos(grid);
}

function eventForm(ev) {
  const isNew = !ev;
  const e = ev ?? { id: '', petId: state.pets[0]?.id ?? '', type: 'custom', title: '', date: toISO(startOfToday()), repeat: 'yearly', note: '' };
  draftPhotos = [...(e.photos ?? [])];
  return `<h2>${isNew ? '新增一筆紀錄' : '編輯紀錄'}</h2>
  <p class="hint">生日、到家紀念、健康提醒、還是今天的小日記？</p>
  <div class="field"><label>類型</label>
    <div class="pick-grid" id="pick-type">
      ${EVENT_TYPES.map(t => `<button type="button" class="pick" data-type="${t.id}" aria-pressed="${t.id === e.type}">
        <span class="msr" style="font-size:26px;color:var(--brand-deep)">${t.icon}</span>${t.label}</button>`).join('')}
    </div></div>
  <div class="field"><label>是誰的日子</label>
    <select id="f-pet">${state.pets.map(p => `<option value="${p.id}" ${p.id === e.petId ? 'selected' : ''}>${esc(p.name)}（${speciesOf(p.species).label}）</option>`).join('')}</select></div>
  <div class="field"><label>標題</label><input id="f-title" value="${esc(e.title)}" placeholder="例如：奶茶的三歲生日"></div>
  <div class="field"><label>日期</label><input id="f-date" type="date" value="${e.date}"></div>
  <div class="field"><label>重複</label>
    <select id="f-repeat">
      <option value="yearly" ${e.repeat === 'yearly' ? 'selected' : ''}>每年</option>
      <option value="monthly" ${e.repeat === 'monthly' ? 'selected' : ''}>每月</option>
      <option value="once" ${e.repeat === 'once' ? 'selected' : ''}>只有這一次</option>
    </select></div>
  <div class="field"><label>備註 / 日記</label><textarea id="f-note" placeholder="今天發生了什麼？">${esc(e.note)}</textarea></div>
  <div class="field"><label>照片</label>
    <div class="photo-grid" id="photo-grid">${photoGridHTML()}</div>
    <input type="file" id="photo-input" accept="image/*" multiple hidden>
  </div>
  <div class="sheet-actions">
    ${isNew ? '' : `<button class="btn danger" id="f-delete" data-id="${e.id}">刪除</button>`}
    <button class="btn subtle" data-close>取消</button>
    <button class="btn primary" id="f-save" data-id="${e.id}">儲存</button>
  </div>`;
}

function petForm(p) {
  const isNew = !p;
  const pet = p ?? { id: '', name: '', species: 'cat', birthday: toISO(startOfToday()), gotcha: '' };
  return `<h2>${isNew ? '新增成員' : '編輯成員'}</h2>
  <p class="hint">貓狗以外，兔、鳥、鼠、爬蟲、水族都可以；重要的人也算一種家人 😉</p>
  <div class="field"><label>種類</label>
    <div class="pick-grid" id="pick-species">
      ${SPECIES.map(s => `<button type="button" class="pick" data-species="${s.id}" aria-pressed="${s.id === pet.species}">
        <svg style="color:hsl(${s.hue} 72% 56%)"><use href="#${s.sticker}"></use></svg>${s.label}</button>`).join('')}
    </div></div>
  <div class="field"><label>名字</label><input id="p-name" value="${esc(pet.name)}" placeholder="例如：奶茶"></div>
  <div class="field"><label>生日</label><input id="p-birth" type="date" value="${pet.birthday ?? ''}"></div>
  <div class="field"><label>到家日</label><input id="p-gotcha" type="date" value="${pet.gotcha ?? ''}"></div>
  <div class="sheet-actions">
    ${isNew ? '' : `<button class="btn danger" id="p-delete" data-id="${pet.id}">刪除</button>`}
    <button class="btn subtle" data-close>取消</button>
    <button class="btn primary" id="p-save" data-id="${pet.id}">儲存</button>
  </div>`;
}

/* ---------- 事件綁定 ---------- */
function bind() {
  $('#tabbar').addEventListener('click', e => {
    const btn = e.target.closest('button[data-target]');
    if (btn) { haptic(); switchView(btn.dataset.target); }
  });

  $('#fab').addEventListener('click', () => {
    haptic(12);
    if (!$('#sheet').hidden) return closeSheet();
    if (!state.pets.length) { openSheet(petForm()); return; }
    openSheet(eventForm());
  });
  $('#scrim').addEventListener('click', closeSheet);
  addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

  $('#btn-today').addEventListener('click', () => {
    haptic();
    calCursor = startOfToday(); calSelected = toISO(startOfToday());
    switchView('calendar'); render();
  });

  $('#cal-prev').addEventListener('click', () => { haptic(); calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() - 1, 1); renderCalendar(); });
  $('#cal-next').addEventListener('click', () => { haptic(); calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() + 1, 1); renderCalendar(); });
  $('#cal-month').addEventListener('click', () => { haptic(); calCursor = startOfToday(); renderCalendar(); });

  $('#cal-days').addEventListener('click', e => {
    const day = e.target.closest('[data-date]');
    if (!day) return;
    haptic(); calSelected = day.dataset.date; renderCalendar();
  });

  $('#stage').addEventListener('click', e => {
    const evBtn = e.target.closest('[data-event]');
    if (evBtn) { haptic(); openSheet(eventForm(state.events.find(x => x.id === evBtn.dataset.event))); return; }
    const petBtn = e.target.closest('[data-pet]');
    if (petBtn) { haptic(); openSheet(petForm(state.pets.find(x => x.id === petBtn.dataset.pet))); }
  });

  $('#btn-add-pet').addEventListener('click', () => { haptic(); openSheet(petForm()); });

  /* 面板內的互動 */
  $('#sheet').addEventListener('click', e => {
    if (e.target.closest('[data-close]')) return closeSheet();

    const typePick = e.target.closest('[data-type]');
    if (typePick) {
      $$('#pick-type .pick').forEach(b => b.setAttribute('aria-pressed', String(b === typePick)));
      const t = typeOf(typePick.dataset.type);
      $('#f-repeat').value = t.repeat;
      haptic(); return;
    }
    const spPick = e.target.closest('[data-species]');
    if (spPick) {
      $$('#pick-species .pick').forEach(b => b.setAttribute('aria-pressed', String(b === spPick)));
      haptic(); return;
    }
    if (e.target.closest('#btn-add-photo')) { $('#photo-input').click(); return; }
    const rm = e.target.closest('[data-rmphoto]');
    if (rm) { draftPhotos = draftPhotos.filter(id => id !== rm.dataset.rmphoto); renderPhotoGrid(); haptic(); return; }
    const view = e.target.closest('[data-view-photo]');
    if (view) { openLightbox(view.dataset.viewPhoto); return; }
    if (e.target.closest('#f-save')) return saveEvent(e.target.closest('#f-save').dataset.id);
    if (e.target.closest('#f-delete')) return deleteEvent(e.target.closest('#f-delete').dataset.id);
    if (e.target.closest('#p-save')) return savePet(e.target.closest('#p-save').dataset.id);
    if (e.target.closest('#p-delete')) return deletePet(e.target.closest('#p-delete').dataset.id);
  });

  $('#sheet').addEventListener('change', e => {
    if (e.target.id === 'photo-input') { addPhotos(e.target.files); e.target.value = ''; }
  });

  $('#lightbox').addEventListener('click', () => {
    $('#lightbox').hidden = true;
    $('#lightbox img').removeAttribute('src');
  });

  addEventListener('visibilitychange', () => { if (!document.hidden) checkReminders(); });

  /* 設定 */
  $('#swatches').addEventListener('click', e => {
    const s = e.target.closest('[data-hue]'); if (!s) return;
    state.settings.hue = Number(s.dataset.hue); save(); applyTheme(); renderSettings(); haptic(12);
  });
  $('#seg-theme').addEventListener('click', e => {
    const b = e.target.closest('[data-value]'); if (!b) return;
    state.settings.theme = b.dataset.value; save(); applyTheme(); renderSettings(); haptic();
  });
  $$('[data-setting]').forEach(el => el.addEventListener('change', async () => {
    const key = el.dataset.setting;
    let value = el.type === 'checkbox' ? el.checked : el.value;
    if (key === 'notify' && value) value = await askNotify();
    state.settings[key] = value;
    if (el.type === 'checkbox') el.checked = !!value;
    save(); applyTheme();
    if (key === 'notify' || key === 'remindDays') {
      await setupReminders();
      if (value && key === 'notify') toast(REMINDER_STATUS[reminderMode]);
      checkReminders();
    }
    render(); haptic();
  }));

  $('#btn-export').addEventListener('click', exportData);
  $('#btn-import').addEventListener('click', () => $('#file-import').click());
  $('#file-import').addEventListener('change', importData);
  $('#btn-demo').addEventListener('click', () => {
    if (!confirm('用範例資料覆蓋現在的內容？')) return;
    state = demoData(); save(); applyTheme(); render(); toast('範例資料已載入 ✨');
  });
  $('#btn-reset').addEventListener('click', () => {
    if (!confirm('確定要清除所有資料嗎？這無法復原。')) return;
    state = { ...DEFAULTS, pets: [], events: [] }; save(); applyTheme(); render(); toast('都清乾淨了');
  });

  addEventListener('scroll', () => $('#appbar').classList.toggle('scrolled', scrollY > 6), { passive: true });
  addEventListener('resize', moveIndicator);
}

/* ---------- 新增／編輯 ---------- */
function saveEvent(id) {
  const title = $('#f-title').value.trim();
  const date = $('#f-date').value;
  if (!title) return toast('幫它取個標題吧');
  if (!date) return toast('選一個日期');
  const data = {
    petId: $('#f-pet').value,
    type: $('#pick-type [aria-pressed="true"]')?.dataset.type ?? 'custom',
    title, date, repeat: $('#f-repeat').value, note: $('#f-note').value.trim(),
    photos: [...draftPhotos],
  };
  const existing = state.events.find(e => e.id === id);
  if (existing) Object.assign(existing, data);
  else state.events.push({ id: uid(), ...data });
  save(); closeSheet(); render(); haptic(20);
  toast(existing ? '已更新 ✓' : '記下來了 ✓');
}
function deleteEvent(id) {
  if (!confirm('刪除這筆紀錄？')) return;
  state.events = state.events.filter(e => e.id !== id);
  gcPhotos();
  save(); closeSheet(); render(); toast('已刪除');
}
function savePet(id) {
  const name = $('#p-name').value.trim();
  if (!name) return toast('先幫它取個名字');
  const data = {
    name,
    species: $('#pick-species [aria-pressed="true"]')?.dataset.species ?? 'other',
    birthday: $('#p-birth').value || '',
    gotcha: $('#p-gotcha').value || '',
  };
  const existing = state.pets.find(p => p.id === id);
  if (existing) Object.assign(existing, data);
  else {
    const pet = { id: uid(), ...data };
    state.pets.push(pet);
    if (pet.birthday) state.events.push({ id: uid(), petId: pet.id, type: 'birth', title: `${pet.name}生日`, date: pet.birthday, repeat: 'yearly', note: '' });
    if (pet.gotcha) state.events.push({ id: uid(), petId: pet.id, type: 'gotcha', title: `${pet.name}到家紀念`, date: pet.gotcha, repeat: 'yearly', note: '' });
  }
  save(); closeSheet(); render(); haptic(20);
  toast(existing ? '已更新 ✓' : '歡迎加入 🎉');
}
function deletePet(id) {
  if (!confirm('刪除這位成員？他的紀錄也會一起消失。')) return;
  state.pets = state.pets.filter(p => p.id !== id);
  state.events = state.events.filter(e => e.petId !== id);
  gcPhotos();
  save(); closeSheet(); render(); toast('已刪除');
}

/* ---------- 照片：新增與放大 ---------- */
async function addPhotos(files) {
  const list = [...(files ?? [])].filter(f => f.type.startsWith('image/'));
  if (!list.length) return;
  const room = MAX_PHOTOS - draftPhotos.length;
  if (list.length > room) toast(`一筆最多 ${MAX_PHOTOS} 張，只收了 ${room} 張`);
  for (const file of list.slice(0, room)) {
    try {
      const blob = await shrink(file);
      const id = uid() + uid();
      await PetDB.putPhoto(id, blob);
      draftPhotos.push(id);
    } catch { toast('這張照片存不進去'); }
  }
  renderPhotoGrid();
  haptic(12);
}

async function openLightbox(id) {
  const url = await photoURL(id);
  if (!url) return;
  $('#lightbox img').src = url;
  $('#lightbox').hidden = false;
  haptic();
}

/* ---------- 備份 / 還原 ---------- */
const blobToDataURL = blob => new Promise(res => {
  const fr = new FileReader();
  fr.onload = () => res(fr.result);
  fr.readAsDataURL(blob);
});

async function exportData() {
  toast('打包中⋯');
  const ids = [...new Set(state.events.flatMap(e => e.photos ?? []))];
  const photos = {};
  for (const id of ids) {
    const p = await PetDB.getPhoto(id).catch(() => null);
    if (p) photos[id] = await blobToDataURL(p);
  }
  const blob = new Blob([JSON.stringify({ ...state, photos }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `petdays-${toISO(startOfToday())}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('備份檔已下載');
}
async function importData(e) {
  const file = e.target.files?.[0]; if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.pets) || !Array.isArray(data.events)) throw new Error('格式不符');
    for (const [id, dataURL] of Object.entries(data.photos ?? {})) {
      const blob = await (await fetch(dataURL)).blob();
      await PetDB.putPhoto(id, blob);
    }
    const { photos, ...rest } = data;
    state = { ...DEFAULTS, ...rest, settings: { ...DEFAULTS.settings, ...data.settings } };
    photoURLs.clear();
    save(); applyTheme(); render(); toast('匯入完成 ✓');
  } catch { toast('這個檔案讀不懂'); }
  e.target.value = '';
}

/* ---------- 提醒 ---------- */
let reminderMode = 'off';   // off | foreground | background

/** 把提醒需要的最小資料丟進 IndexedDB，Service Worker 在背景才讀得到 */
function syncReminders() {
  const s = state.settings;
  return PetDB.putMeta('reminders', {
    notify: !!s.notify,
    remindDays: Number(s.remindDays),
    events: state.events.filter(e => e.type !== 'diary').map(e => ({
      id: e.id, title: e.title, date: e.date, repeat: e.repeat,
      pet: petOf(e.petId)?.name ?? '',
    })),
  }).catch(() => {});
}

async function askNotify() {
  if (!('Notification' in window)) { toast('這個瀏覽器不支援通知'); return false; }
  const p = await Notification.requestPermission();
  if (p !== 'granted') { toast('沒有拿到通知權限'); return false; }
  return true;
}

/** 有背景排程就用它，沒有就退回「開 App 時檢查」 */
async function setupReminders() {
  if (!state.settings.notify || Notification?.permission !== 'granted') {
    reminderMode = 'off';
    return reminderMode;
  }
  reminderMode = 'foreground';
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg?.periodicSync) {
      const st = await navigator.permissions?.query({ name: 'periodic-background-sync' });
      if (st?.state === 'granted') {
        await reg.periodicSync.register('petdays-reminders', { minInterval: 12 * 60 * 60 * 1000 });
        reminderMode = 'background';
      }
    }
  } catch { /* 不支援就維持 foreground */ }
  return reminderMode;
}

const REMINDER_STATUS = {
  off: '關閉中',
  foreground: '這台裝置不支援背景排程，會在你打開 App 時提醒',
  background: '已排入背景排程，App 沒開也會提醒',
};

async function checkReminders() {
  if (!state.settings.notify || Notification?.permission !== 'granted') return;
  const due = PetDate.dueReminders(await PetDB.getMeta('reminders').catch(() => null));
  if (!due.length) return;
  const seen = (await PetDB.getMeta('notified').catch(() => null)) ?? {};
  let changed = false;
  // 手機（尤其 Android）只允許 Service Worker 發通知，有 SW 就走 SW
  const reg = await navigator.serviceWorker?.ready.catch(() => null);
  for (const e of due.slice(0, 3)) {
    const key = `${e.id}:${e.nextISO}`;
    if (seen[key]) continue;
    const opts = {
      body: e.days === 0 ? `今天是「${e.title}」！` : `還有 ${e.days} 天就是「${e.title}」`,
      icon: './assets/icon.svg', tag: key, data: { url: './index.html' },
    };
    try {
      if (reg?.showNotification) await reg.showNotification('毛日子提醒', opts);
      else new Notification('毛日子提醒', opts);
    } catch { continue; }
    seen[key] = Date.now();
    changed = true;
  }
  if (changed) {
    const trimmed = Object.fromEntries(Object.entries(seen).sort((a, b) => b[1] - a[1]).slice(0, 60));
    PetDB.putMeta('notified', trimmed).catch(() => {});
  }
}

/* ---------- 圖示字型 ---------- */
function watchIconFont() {
  const mark = () => {
    const ok = document.fonts?.check?.('24px "Material Symbols Rounded"');
    document.documentElement.dataset.icons = ok ? 'ok' : 'off';
  };
  document.fonts ? document.fonts.ready.then(mark) : mark();
  setTimeout(mark, 3000);   // 網路慢的時候再確認一次
}

/* ---------- 啟動 ---------- */
async function init() {
  applyTheme();
  watchIconFont();
  await loadStickers();
  bind();
  $$('.tabbar button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.target === currentView)));
  render();
  requestAnimationFrame(moveIndicator);
  gcPhotos();
  syncReminders();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  await setupReminders();
  setTimeout(checkReminders, 1500);
}
init();
