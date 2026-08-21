# Language Trainer · YouTube 語言學習器

基於 Vite + React + TypeScript 的 YouTube 跟讀與語言學習器，整合 Supadata 字幕 API 實現穩定、跨雲端的高品質字幕抓取與雙語對齊。

## 特色

- 支援 YouTube 網址與 11 碼 Video ID 解析。
- 使用 **Supadata API** 取得精準字幕與時間軸，避免 YouTube 阻擋或 CORS 問題。
- 支援英文原文字幕與繁簡中文字幕雙語自動對齊。
- 1:1 跟讀留白、自訂語速（0.75x ~ 1.25x）、單句循環、練習區間設定與收藏功能。

## 環境變數設定

在專案根目錄建立 `.env` 檔案（可參考 `.env.example`）：

```bash
VITE_SUPADATA_API_KEY=your_supadata_api_key_here
```

> **注意**：部署至 Vercel 時，請在 Vercel 專案設定的「Environment Variables」中加入 `VITE_SUPADATA_API_KEY`。

## 快速開始

```bash
npm install
npm run dev
```

瀏覽器開啟終端機顯示的本機網址（通常是 `http://localhost:5173`）。

## 專案結構

- `src/lib/captionFetcher.ts` — Supadata 字幕抓取與雙語對齊服務
- `src/lib/youtube.ts` — YouTube 網址解析
- `src/store/learnerStore.ts` — 學習器狀態管理（Zustand + Persist）
- `src/components/` — UI 元件（播放器、字幕卡、控制列、抽屜等）
- `src/App.tsx` — 主要學習頁面


