import * as OpenCC from 'opencc-js'
import type { SubtitleCue } from '../types'

export type ParsedCue = {
  start: number
  duration: number
  text: string
}

export type VideoCaptionsResult = {
  videoId: string
  languageName: string
  translationLanguageName: string | null
  cues: SubtitleCue[]
}

type SupadataCueItem = {
  text?: string
  start?: number | string
  duration?: number | string
  offset?: number | string
  lang?: string
}

type SupadataResponse = {
  content?: SupadataCueItem[] | string
  lang?: string
  availableLangs?: string[]
  error?: string
  message?: string
}

const SUPADATA_API_BASE = 'https://api.supadata.ai/v1/youtube/transcript'

// 初始化 OpenCC 繁簡轉換器（轉換為臺灣正體習慣詞彙）
const twConverter = OpenCC.Converter({ from: 'cn', to: 'twp' })

/**
 * 強制將所有簡體中文字串轉換為臺灣正體繁體中文
 * 例如：「几年前，我闯入了自己的家。」➜「幾年前，我闖入了自己的家。」
 */
export function toTraditionalChinese(text: string): string {
  if (!text) return ''
  try {
    return twConverter(text)
  } catch {
    return text
  }
}

function cleanText(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 常見英文縮寫與字首簡稱白名單（避免因點號誤斷句） */
const ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'st', 'vs', 'etc', 'eg', 'ie', 'jr', 'sr',
  'us', 'uk', 'un', 'eu', 'am', 'pm', 'dc', 'jan', 'feb', 'mar', 'apr',
  'aug', 'sept', 'sep', 'oct', 'nov', 'dec', 'vol', 'dept', 'approx', 'no'
])

function isAcronymOrAbbr(text: string, dotIndex: number): boolean {
  let start = dotIndex - 1
  while (start >= 0 && /[a-zA-Z.]/.test(text[start])) {
    start--
  }
  const token = text.slice(start + 1, dotIndex).replace(/\./g, '').toLowerCase()
  return ABBREVIATIONS.has(token)
}

/**
 * 智慧斷句函數：
 * 支援英文句號、問號、驚嘆號（. ! ?）與中文全形標點（。！？；），
 * 並排除縮寫、小數點（3.14）及省略號（...）。
 */
export function splitIntoSentences(text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  const sentences: string[] = []
  let currentStart = 0

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i]

    // 中文全形標點符號：。！？；
    if (char === '。' || char === '！' || char === '？' || char === '；') {
      const sentence = trimmed.slice(currentStart, i + 1).trim()
      if (sentence) {
        sentences.push(sentence)
      }
      currentStart = i + 1
      continue
    }

    // 英文半形標點符號：. ! ?
    if (char === '.' || char === '!' || char === '?') {
      // 排除省略號如 ...
      if (char === '.' && (trimmed[i + 1] === '.' || (i > 0 && trimmed[i - 1] === '.'))) {
        continue
      }

      // 排除小數點如 3.14 或 $10.50
      if (
        char === '.' &&
        i > 0 &&
        i < trimmed.length - 1 &&
        /\d/.test(trimmed[i - 1]) &&
        /\d/.test(trimmed[i + 1])
      ) {
        continue
      }

      // 排除常見英文縮寫（Dr., U.S., e.g.）
      if (char === '.' && isAcronymOrAbbr(trimmed, i)) {
        continue
      }

      const nextChar = trimmed[i + 1]
      const nextNextChar = trimmed[i + 2]

      const isEnd = i === trimmed.length - 1
      const isFollowedBySpace = nextChar === ' ' || nextChar === '\n' || nextChar === '\t'
      const isQuoteThenSpace =
        (nextChar === '"' || nextChar === "'" || nextChar === '”' || nextChar === '’') &&
        (i + 1 === trimmed.length - 1 || nextNextChar === ' ' || nextNextChar === '\n')

      if (isEnd || isFollowedBySpace || isQuoteThenSpace) {
        const splitEnd = isQuoteThenSpace ? i + 2 : i + 1
        const sentence = trimmed.slice(currentStart, splitEnd).trim()
        if (sentence) {
          sentences.push(sentence)
        }
        currentStart = isQuoteThenSpace
          ? nextNextChar === ' '
            ? i + 3
            : i + 2
          : nextChar === ' '
            ? i + 2
            : i + 1
        i = currentStart - 1
      }
    }
  }

  if (currentStart < trimmed.length) {
    const remaining = trimmed.slice(currentStart).trim()
    if (remaining) {
      if (sentences.length > 0 && remaining.length < 5) {
        sentences[sentences.length - 1] += ' ' + remaining
      } else {
        sentences.push(remaining)
      }
    }
  }

  return sentences.length > 0 ? sentences : [trimmed]
}

/**
 * 資料標準化與長句時間軸等比瓜分 (Normalization & Timestamp Splitting)
 * 將原始陣列中包含多個句子的長段落（如 28 秒大段落），依子句子長度比例等比切分時間軸。
 */
export function normalizeAndSplitCues(
  content: unknown,
  isChinese = false,
): ParsedCue[] {
  if (!Array.isArray(content)) return []

  const result: ParsedCue[] = []

  for (const item of content) {
    if (!item || typeof item !== 'object') continue

    let start = 0
    if (typeof item.start === 'number') {
      start = item.start
    } else if (typeof item.offset === 'number') {
      start = item.offset > 1000 ? item.offset / 1000 : item.offset
    } else if (typeof item.start === 'string') {
      start = parseFloat(item.start) || 0
    }

    let duration = 0
    if (typeof item.duration === 'number') {
      duration = item.duration > 100 ? item.duration / 1000 : item.duration
    } else if (typeof item.duration === 'string') {
      duration = parseFloat(item.duration) || 0
    }

    let rawText = typeof item.text === 'string' ? item.text : ''
    if (isChinese) {
      rawText = toTraditionalChinese(rawText)
    }
    const text = cleanText(rawText)
    if (!text) continue

    const sentences = splitIntoSentences(text)
    if (sentences.length <= 1) {
      result.push({
        start: Math.round(start * 100) / 100,
        duration: Math.max(0.1, Math.round(duration * 100) / 100),
        text,
      })
      continue
    }

    // 多句子：依字元數長度權重，等比瓜分原始 duration 與 start 時間軸
    const totalChars = sentences.reduce((sum, s) => sum + s.length, 0) || 1
    let currentStart = start

    sentences.forEach((sentence) => {
      const ratio = sentence.length / totalChars
      const subDuration = Math.max(0.2, Math.round(duration * ratio * 100) / 100)

      result.push({
        start: Math.round(currentStart * 100) / 100,
        duration: subDuration,
        text: sentence,
      })

      currentStart += subDuration
    })
  }

  return result
}

/**
 * 依時間軸比對與尋找最合適的翻譯句子
 */
export function findAlignedTranslation(
  source: ParsedCue,
  translations: ParsedCue[],
): string | undefined {
  if (translations.length === 0) return undefined

  const mid = source.start + source.duration / 2
  const overlapping = translations.find(
    (t) => mid >= t.start && mid <= t.start + Math.max(t.duration, 0.05),
  )
  if (overlapping) return overlapping.text

  let best = translations[0]
  let bestDist = Math.abs(best.start - source.start)
  for (const t of translations) {
    const dist = Math.abs(t.start - source.start)
    if (dist < bestDist) {
      best = t
      bestDist = dist
    }
  }

  // 時間差過大不硬配，避免錯譯
  if (bestDist > Math.max(source.duration, 3.5)) return undefined
  return best.text
}

async function requestSupadata(
  videoId: string,
  apiKey: string,
  lang?: string,
): Promise<SupadataResponse> {
  const url = new URL(SUPADATA_API_BASE)
  url.searchParams.set('videoId', videoId)
  if (lang) {
    url.searchParams.set('lang', lang)
  }

  const res = await fetch(url.toString(), {
    headers: {
      'x-api-key': apiKey,
    },
  })

  if (res.status === 401) {
    throw new Error('Supadata API Key 無效或未授權，請確認 .env 中的 VITE_SUPADATA_API_KEY 設定。')
  }

  if (res.status === 429) {
    throw new Error('Supadata API 請求過於頻繁或額度已用盡，請稍後再試。')
  }

  if (res.status === 404) {
    throw new Error('該影片未提供字幕或查無字幕資料，請試試其他影片。')
  }

  if (!res.ok) {
    let errorDetail = ''
    try {
      const errJson = (await res.json()) as SupadataResponse
      errorDetail = errJson.message || errJson.error || ''
    } catch {
      // ignore
    }
    throw new Error(
      `Supadata API 回應錯誤 (${res.status} ${res.statusText})${errorDetail ? `：${errorDetail}` : ''}`,
    )
  }

  return (await res.json()) as SupadataResponse
}

export async function fetchClientCaptions(videoId: string): Promise<VideoCaptionsResult> {
  const apiKey = import.meta.env.VITE_SUPADATA_API_KEY?.trim()

  if (!apiKey) {
    console.warn(
      '[Supadata API] 未設定 VITE_SUPADATA_API_KEY 環境變數。請在專案根目錄建立 .env 檔案並設定 VITE_SUPADATA_API_KEY=your_key_here，或在 Vercel 設定中加入該環境變數。',
    )
    throw new Error(
      '未設定 Supadata API Key。請在專案根目錄建立 .env 檔案並填入 VITE_SUPADATA_API_KEY，或至 Vercel 後台設定環境變數後重新部署。',
    )
  }

  // 1. 抓取主要語言字幕（優先請求英文 lang=en，若失敗則抓取預設語言）
  let mainData: SupadataResponse | null = null
  let usedLang = 'en'

  try {
    mainData = await requestSupadata(videoId, apiKey, 'en')
  } catch (err) {
    // 若指定 en 失敗（例如非英語影片），嘗試不帶 lang 參數抓取預設原文字幕
    try {
      mainData = await requestSupadata(videoId, apiKey)
      usedLang = mainData.lang || 'default'
    } catch {
      throw err instanceof Error ? err : new Error(String(err))
    }
  }

  const resolvedLang = mainData?.lang || usedLang
  const isMainChinese = resolvedLang.startsWith('zh')

  // 【資料正規化與智慧斷句層】拆分長段落並分配時間軸
  const sourceCues = normalizeAndSplitCues(mainData?.content, isMainChinese)
  if (sourceCues.length === 0) {
    throw new Error('該影片字幕內容為空或無法解析，請試試其他影片。')
  }

  const languageDisplayName =
    resolvedLang === 'en'
      ? 'English'
      : isMainChinese
        ? '繁體中文'
        : resolvedLang

  // 2. 嘗試抓取中文字幕翻譯（支援 zh-TW / zh-Hant / zh-HK / zh-CN / zh）
  let translationCues: ParsedCue[] = []
  let translationLanguageName: string | null = null

  if (!isMainChinese) {
    const zhLangsToTry = ['zh-TW', 'zh-Hant', 'zh-HK', 'zh', 'zh-CN', 'zh-Hans']
    for (const zhLang of zhLangsToTry) {
      try {
        const zhData = await requestSupadata(videoId, apiKey, zhLang)
        // 【強制簡轉繁 + 智慧斷句】
        const parsedZh = normalizeAndSplitCues(zhData.content, true)
        if (parsedZh.length > 0) {
          translationCues = parsedZh
          translationLanguageName = '繁體中文'
          break
        }
      } catch {
        // 單一翻譯語言抓取失敗繼續嘗試下一個
      }
    }
  } else {
    // 原文為中文，嘗試抓取英文翻譯
    try {
      const enData = await requestSupadata(videoId, apiKey, 'en')
      const parsedEn = normalizeAndSplitCues(enData.content, false)
      if (parsedEn.length > 0) {
        translationCues = parsedEn
        translationLanguageName = 'English'
      }
    } catch {
      // 翻譯可選，失敗不阻擋
    }
  }

  // 3. 雙語精準對齊並輸出標準格式
  const cues: SubtitleCue[] = sourceCues.map((cue, index) => {
    const translation = findAlignedTranslation(cue, translationCues)
    return {
      id: `${videoId}-${index}`,
      start: cue.start,
      duration: cue.duration,
      text: cue.text,
      translation: translation ? toTraditionalChinese(translation) : undefined,
    }
  })

  return {
    videoId,
    languageName: languageDisplayName,
    translationLanguageName,
    cues,
  }
}
