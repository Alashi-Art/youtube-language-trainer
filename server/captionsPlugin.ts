import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { YouTubeTranscriptApi } from '@hallelx/youtube-transcript'

type RawCue = {
  start: number
  duration: number
  text: string
}

export type CaptionCue = {
  id: string
  start: number
  duration: number
  text: string
  translation?: string
}

const LANG_PRESETS: Record<string, string[]> = {
  en: ['en'],
  zh: ['zh-TW', 'zh-CN', 'zh-Hant', 'zh-Hans', 'zh', 'zh-HK'],
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

function getQuery(req: IncomingMessage): URLSearchParams {
  const host = req.headers.host ?? 'localhost'
  return new URL(req.url ?? '/', `http://${host}`).searchParams
}

function cleanText(text: string) {
  return text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
}

function findAlignedTranslation(source: RawCue, translations: RawCue[]): string | undefined {
  if (translations.length === 0) return undefined

  const mid = source.start + source.duration / 2
  const overlapping = translations.find(
    (t) => mid >= t.start && mid <= t.start + Math.max(t.duration, 0.05),
  )
  if (overlapping) return cleanText(overlapping.text)

  let best = translations[0]
  let bestDist = Math.abs(best.start - source.start)
  for (const t of translations) {
    const dist = Math.abs(t.start - source.start)
    if (dist < bestDist) {
      best = t
      bestDist = dist
    }
  }

  // 時間差過大就不硬配，避免錯譯
  if (bestDist > Math.max(source.duration, 2)) return undefined
  return cleanText(best.text)
}

async function fetchLangCues(videoId: string, langKey: string): Promise<{
  cues: RawCue[]
  resolvedLanguage: string
  languageName: string
  isGenerated: boolean
  available: Array<{ languageCode: string; language: string; isGenerated: boolean }>
}> {
  const languages = LANG_PRESETS[langKey] ?? [langKey]
  const api = new YouTubeTranscriptApi()
  const list = await api.list(videoId)
  const available = [...list].map((t) => ({
    languageCode: t.languageCode,
    language: t.language,
    isGenerated: t.isGenerated,
  }))
  const transcript = await api.fetch(videoId, { languages })
  return {
    available,
    resolvedLanguage: transcript.languageCode,
    languageName: transcript.language,
    isGenerated: transcript.isGenerated,
    cues: transcript.toRawData().map((item) => ({
      start: item.start,
      duration: item.duration,
      text: cleanText(item.text),
    })),
  }
}

async function handleCaptions(req: IncomingMessage, res: ServerResponse) {
  const query = getQuery(req)
  const videoId = query.get('videoId')?.trim()
  const lang = (query.get('lang') ?? 'en').trim().toLowerCase()
  const translationLang = (query.get('translationLang') ?? 'zh').trim().toLowerCase()

  if (!videoId) {
    sendJson(res, 400, { error: '缺少 videoId 參數' })
    return
  }

  try {
    const source = await fetchLangCues(videoId, lang)

    let translationCues: RawCue[] = []
    let translationMeta: { resolvedLanguage?: string; languageName?: string } = {}

    if (translationLang && translationLang !== lang) {
      try {
        const translated = await fetchLangCues(videoId, translationLang)
        translationCues = translated.cues
        translationMeta = {
          resolvedLanguage: translated.resolvedLanguage,
          languageName: translated.languageName,
        }
      } catch {
        // 翻譯軌道可選，失敗不阻擋原文
      }
    }

    const cues: CaptionCue[] = source.cues.map((cue, index) => {
      const translation = findAlignedTranslation(cue, translationCues)
      return {
        id: `${videoId}-${index}`,
        start: cue.start,
        duration: cue.duration,
        text: cue.text,
        ...(translation ? { translation } : {}),
      }
    })

    sendJson(res, 200, {
      videoId,
      requestedLang: lang,
      resolvedLanguage: source.resolvedLanguage,
      languageName: source.languageName,
      isGenerated: source.isGenerated,
      translationLanguage: translationMeta.resolvedLanguage ?? null,
      translationLanguageName: translationMeta.languageName ?? null,
      available: source.available,
      cues,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    sendJson(res, 502, {
      error: '無法抓取字幕',
      detail: message,
      hint: '請確認影片有內建/自動字幕，且本機網路可連到 YouTube。',
    })
  }
}

/**
 * Vite 開發伺服器中介層：在本機（家用 IP）呼叫 YouTube 內部 API。
 */
export function captionsApiPlugin(): Plugin {
  return {
    name: 'captions-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/captions')) {
          next()
          return
        }

        void handleCaptions(req, res).catch((error) => {
          sendJson(res, 500, {
            error: '伺服器錯誤',
            detail: error instanceof Error ? error.message : String(error),
          })
        })
      })
    },
  }
}
