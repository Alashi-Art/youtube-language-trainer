# Language Trainer · YouTube 字幕 POC

極簡概念驗證：輸入 YouTube 網址 → 抓取內建英／中文字幕 → 輸出 `{ start, duration, text }[]`。

## 方案評估（2026）

| 方案 | 費用 | 穩定性（本機 POC） | 說明 |
| --- | --- | --- | --- |
| **`@hallelx/youtube-transcript` + Vite 本機 API** ✅ 採用 | 免費 | 高（家用／住宅 IP） | TypeScript 移植自 Python `youtube-transcript-api`，走 YouTube 內部 `youtubei` + `timedtext`。格式正好是 `start` / `duration` / `text`。 |
| `youtube-transcript`（舊套件） | 免費 | 中高 | 本機也可跑，但時間單位是毫秒（`offset`/`duration`），需自行換算。 |
| 瀏覽器直接打 YouTube timedtext | 免費 | **不可行** | CORS 擋住，純前端無法穩定取得。 |
| 公開 CORS Proxy（corsproxy.io 等） | 免費 | 低 | 無 SLA、易限流／消失，只適合臨時 fallback。 |
| YouTube Data API v3 captions | 有配額 | 不適合 POC | 自動產生字幕通常抓不到，下載需 OAuth。 |
| 付費 Transcript API | 付費 | 高 | 雲端部署才需要；本機 POC 不必。 |

**結論：** 純前端不行。POC 最穩且免費的做法是在 **Vite 開發伺服器**（本機 IP）用 `@hallelx/youtube-transcript` 當 API。雲端部署時 YouTube 常擋機房 IP，那時才需 proxy／付費服務。

## 快速開始

```bash
npm install
npm run dev
```

瀏覽器開啟終端機顯示的本機網址（通常是 `http://localhost:5173`），貼上影片網址後按「抓取字幕」。

預設範例影片：`https://www.youtube.com/watch?v=8jPQjjsBbIc`（有英／中文字幕）。

## API

`GET /api/captions?videoId=VIDEO_ID&lang=en|zh`

成功回應重點欄位：

```json
{
  "resolvedLanguage": "zh-TW",
  "cues": [
    { "start": 13.24, "duration": 3.329, "text": "幾年前，我闖進自己家裡。" }
  ]
}
```

## 專案結構

- `server/captionsPlugin.ts` — Vite middleware（字幕抓取）
- `src/App.tsx` — 極簡 UI
- `src/lib/youtube.ts` — 網址解析
