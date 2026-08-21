import type { VercelRequest, VercelResponse } from '@vercel/node'
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS 設定
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  let videoId =
    typeof req.query.videoId === 'string'
      ? req.query.videoId
      : Array.isArray(req.query.videoId)
        ? req.query.videoId[0]
        : undefined

  let lang =
    typeof req.query.lang === 'string'
      ? req.query.lang
      : Array.isArray(req.query.lang)
        ? req.query.lang[0]
        : undefined

  let translationLang =
    typeof req.query.translationLang === 'string'
      ? req.query.translationLang
      : Array.isArray(req.query.translationLang)
        ? req.query.translationLang[0]
        : undefined

  if (!videoId && req.url) {
    try {
      const url = new URL(req.url, 'http://localhost')
      videoId = url.searchParams.get('videoId') ?? undefined
      if (!lang) lang = url.searchParams.get('lang') ?? undefined
      if (!translationLang) translationLang = url.searchParams.get('translationLang') ?? undefined
    } catch {
      // ignore
    }
  }

  videoId = videoId?.trim()
  lang = (lang ?? 'en').trim().toLowerCase()
  translationLang = (translationLang ?? 'zh').trim().toLowerCase()

  if (!videoId) {
    return res.status(400).json({ error: '缺少 videoId 參數' })
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

    return res.status(200).json({
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
    return res.status(502).json({
      error: '無法抓取字幕',
      detail: message,
      hint: '請確認影片有內建/自動字幕，且伺服器網路可連到 YouTube。',
    })
  }
}
