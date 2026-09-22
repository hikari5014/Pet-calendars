# 毛日子 Pet Days 🐾

記錄寵物（和重要的人）每一個日子的可愛 PWA：出生、到家紀念、日記、健康提醒與倒數。

- 📄 設計與開發計畫：[PLAN.md](./PLAN.md)
- 🐱 支援貓狗以外的特寵：兔、鳥、鼠、爬蟲、水族⋯⋯還有「重要的人」
- 🎨 可變字型圖示動畫、彈簧過場、七種主題色、深淺色模式
- 📱 可加到手機主畫面、離線可用

## 試跑

```bash
python3 -m http.server 8080
# 開 http://localhost:8080
```

> 用 `http://` 開啟才會啟動 PWA（Service Worker 不支援 `file://`）。
> 手機測試：同一 Wi-Fi 下輸入 `http://<電腦IP>:8080`，再選「加入主畫面」。

初次開啟會自動載入範例資料，設定頁可以隨時重載或清除。

## 檔案

| 檔案 | 用途 |
|---|---|
| `index.html` | 版面骨架 |
| `styles.css` | 主題變數與全部動畫 |
| `app.js` | 狀態、日期計算、渲染 |
| `sw.js` / `manifest.webmanifest` | PWA |
| `assets/stickers.svg` | 貼圖佔位，之後整包替換 |
