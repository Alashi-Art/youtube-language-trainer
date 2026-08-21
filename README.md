# Language Trainer · YouTube 語言學習器

基於 Vite + React + TypeScript 的 YouTube 跟讀與語言學習器，支援前端透過 CORS Proxy 解析 YouTube 字幕與雙語對齊。

## 特色

- 支援 YouTube 網址與 11 碼 Video ID 解析。
- 純前端（Client-side）透過 CORS Proxy 取得 YouTube 頁面與 `captionTracks`。
- 支援繁體中文、簡體中文與英文雙語對齊及 YouTube 自動翻譯字幕。
- 1:1 跟讀留白、自訂語速（0.75x ~ 1.25x）、單句循環、練習區間設定與收藏功能。

## 快速開始

```bash
npm install
npm run dev
```

瀏覽器開啟終端機顯示的本機網址（通常是 `http://localhost:5173`）。

## 專案結構

- `src/lib/captionFetcher.ts` — 前端字幕抓取與 XML 解析服務
- `src/lib/youtube.ts` — YouTube 網址解析
- `src/store/learnerStore.ts` — 學習器狀態管理（Zustand + Persist）
- `src/components/` — UI 元件（播放器、字幕卡、控制列、抽屜等）
- `src/App.tsx` — 主要學習頁面

