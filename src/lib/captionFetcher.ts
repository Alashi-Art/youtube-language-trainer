import type { SubtitleCue } from '../types'

export interface RawCaptionTrack {
  baseUrl: string
  name?: { simpleText?: string; runs?: Array<{ text: string }> }
  vssId?: string
  languageCode: string
  kind?: string
  isTranslatable?: boolean
}

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

const ZH_LANG_CODES = ['zh-TW', 'zh-Hant', 'zh-HK', 'zh-Hans', 'zh-CN', 'zh']
const EN_LANG_CODES = ['en', 'en-US', 'en-GB', 'en-CA', 'en-AU']

const PROXY_BUILDERS = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${url}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
]

async function fetchWithProxies(targetUrl: string, timeoutMs = 8000): Promise<string> {
  let lastError: Error | null = null

  for (const buildProxyUrl of PROXY_BUILDERS) {
    const proxyUrl = buildProxyUrl(targetUrl)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const res = await fetch(proxyUrl, { signal: controller.signal })
      clearTimeout(timer)

      if (res.ok) {
        const text = await res.text()
        if (text && text.trim().length > 0) {
          return text
        }
      }
    } catch (e) {
      clearTimeout(timer)
      lastError = e instanceof Error ? e : new Error(String(e))
    }
  }

  throw lastError ?? new Error('無法透過代理伺服器連線至目標頁面')
}

export function extractCaptionTracks(html: string): RawCaptionTrack[] {
  // 1. 嘗試直接提取 captionTracks 陣列
  const matchDirect =
    html.match(
      /"captionTracks":\s*(\[.+?\])(?:,\s*"audioTracks"|,\s*"translationLanguages"|,\s*"defaultAudioTrackIndex"|\})/s,
    ) || html.match(/"captionTracks":\s*(\[.*?\])/s)

  if (matchDirect) {
    try {
      const tracks = JSON.parse(matchDirect[1])
      if (Array.isArray(tracks) && tracks.length > 0) {
        return tracks
      }
    } catch {
      // 忽略並嘗試下一個匹配方式
    }
  }

  // 2. 嘗試解析 ytInitialPlayerResponse 物件
  const playerResponseMatch =
    html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});(?:var\s|window\[|<)/s) ||
    html.match(/var\s+ytInitialPlayerResponse\s*=\s*(\{.+?\});/s) ||
    html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/s)

  if (playerResponseMatch) {
    try {
      const playerResponse = JSON.parse(playerResponseMatch[1])
      const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks
      if (Array.isArray(tracks) && tracks.length > 0) {
        return tracks
      }
    } catch {
      // 忽略
    }
  }

  return []
}

function getTrackDisplayName(track: RawCaptionTrack): string {
  if (track.name?.simpleText) return track.name.simpleText
  if (track.name?.runs?.[0]?.text) return track.name.runs[0].text
  if (ZH_LANG_CODES.includes(track.languageCode)) return '中文'
  if (EN_LANG_CODES.includes(track.languageCode)) return 'English'
  return track.languageCode
}

function decodeHtmlEntities(raw: string): string {
  if (typeof document !== 'undefined') {
    const txt = document.createElement('textarea')
    txt.innerHTML = raw
    return txt.value
  }
  return raw
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function cleanCueText(text: string): string {
  return decodeHtmlEntities(text)
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseTimedTextXml(xmlStr: string): ParsedCue[] {
  // 優先使用瀏覽器原生 DOMParser
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(xmlStr, 'text/xml')

      // 標準 YouTube 字幕節點 <text start="1.2" dur="3.4">...</text>
      const textNodes = Array.from(xmlDoc.getElementsByTagName('text'))
      if (textNodes.length > 0) {
        return textNodes
          .map((node) => {
            const start = parseFloat(node.getAttribute('start') || '0')
            const duration = parseFloat(node.getAttribute('dur') || '0')
            const text = cleanCueText(node.textContent || '')
            return {
              start: Math.round(start * 100) / 100,
              duration: Math.round(duration * 100) / 100,
              text,
            }
          })
          .filter((c) => c.text.length > 0)
      }

      // Format 3: <p t="1200" d="3400">...</p>
      const pNodes = Array.from(xmlDoc.getElementsByTagName('p'))
      if (pNodes.length > 0) {
        return pNodes
          .map((node) => {
            const startMs = parseFloat(node.getAttribute('t') || '0')
            const durationMs = parseFloat(node.getAttribute('d') || '0')
            const text = cleanCueText(node.textContent || '')
            return {
              start: Math.round((startMs / 1000) * 100) / 100,
              duration: Math.round((durationMs / 1000) * 100) / 100,
              text,
            }
          })
          .filter((c) => c.text.length > 0)
      }
    } catch {
      // 降級為正規表達式解析
    }
  }

  // Regex 備援解析
  const cues: ParsedCue[] = []
  const textTagRegex = /<text\s+start="([^"]+)"\s+dur="([^"]+)"[^>]*>(.*?)<\/text>/gs
  let match: RegExpExecArray | null
  while ((match = textTagRegex.exec(xmlStr)) !== null) {
    const text = cleanCueText(match[3])
    if (text) {
      cues.push({
        start: Math.round(parseFloat(match[1]) * 100) / 100,
        duration: Math.round(parseFloat(match[2]) * 100) / 100,
        text,
      })
    }
  }
  return cues
}

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
  if (bestDist > Math.max(source.duration, 2.5)) return undefined
  return best.text
}

export async function fetchClientCaptions(videoId: string): Promise<VideoCaptionsResult> {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`

  let html = ''
  try {
    html = await fetchWithProxies(watchUrl)
  } catch {
    throw new Error(
      '無法連線至 YouTube 影片頁面或代理伺服器異常，請確認網路連線或稍後再試。',
    )
  }

  const tracks = extractCaptionTracks(html)
  if (tracks.length === 0) {
    throw new Error('該影片未提供內建字幕或無法解析，請試試其他影片（建議挑選有 CC 字幕的影片）。')
  }

  // 1. 挑選主要語言軌道 (Source Track)
  // 優先順序：人工英文字幕 -> 任何英文字幕 -> 中文字幕 -> 首個可用字幕
  const manualEnTrack = tracks.find(
    (t) => EN_LANG_CODES.includes(t.languageCode) && t.kind !== 'asr',
  )
  const anyEnTrack = tracks.find((t) => EN_LANG_CODES.includes(t.languageCode))
  const zhTrack = tracks.find((t) => ZH_LANG_CODES.includes(t.languageCode))
  const sourceTrack = manualEnTrack || anyEnTrack || zhTrack || tracks[0]

  // 2. 挑選翻譯語言軌道 (Translation Track)
  // 優先順序：繁體中文 (zh-TW/zh-Hant/zh-HK) -> 簡體中文 (zh-Hans/zh-CN) -> YouTube 自動翻譯 (&tlang=zh-Hant)
  let translationTrack: { baseUrl: string; languageName: string } | null = null

  if (ZH_LANG_CODES.includes(sourceTrack.languageCode)) {
    // 若原文就是中文，翻譯軌道可嘗試尋找英文
    const enTrk = manualEnTrack || anyEnTrack
    if (enTrk) {
      translationTrack = {
        baseUrl: enTrk.baseUrl,
        languageName: getTrackDisplayName(enTrk),
      }
    }
  } else {
    // 原文為英文或其他語言，優先尋找中文
    const manualZh = tracks.find(
      (t) =>
        (t.languageCode === 'zh-TW' ||
          t.languageCode === 'zh-Hant' ||
          t.languageCode === 'zh-HK') &&
        t.kind !== 'asr',
    )
    const anyZh = tracks.find((t) => ZH_LANG_CODES.includes(t.languageCode))

    if (manualZh) {
      translationTrack = {
        baseUrl: manualZh.baseUrl,
        languageName: getTrackDisplayName(manualZh),
      }
    } else if (anyZh) {
      translationTrack = {
        baseUrl: anyZh.baseUrl,
        languageName: getTrackDisplayName(anyZh),
      }
    } else if (sourceTrack.isTranslatable !== false) {
      // 若無獨立中文字幕軌，使用 YouTube timedtext 提供的自動翻譯參數
      const separator = sourceTrack.baseUrl.includes('?') ? '&' : '?'
      translationTrack = {
        baseUrl: `${sourceTrack.baseUrl}${separator}tlang=zh-Hant`,
        languageName: '中文 (自動翻譯)',
      }
    }
  }

  // 3. 抓取主要語言字幕 XML
  let sourceXml = ''
  try {
    sourceXml = await fetchWithProxies(sourceTrack.baseUrl)
  } catch {
    throw new Error('無法下載該影片的字幕資料，請稍後再試。')
  }

  const sourceCues = parseTimedTextXml(sourceXml)
  if (sourceCues.length === 0) {
    throw new Error('該影片字幕內容為空或格式無法辨識，請試試其他影片。')
  }

  // 4. 抓取翻譯語言字幕 XML（可選）
  let translationCues: ParsedCue[] = []
  let translationLanguageName: string | null = null

  if (translationTrack) {
    try {
      const transXml = await fetchWithProxies(translationTrack.baseUrl)
      translationCues = parseTimedTextXml(transXml)
      translationLanguageName = translationTrack.languageName
    } catch {
      // 翻譯軌道失敗不影響主要字幕顯示
    }
  }

  // 5. 組合對齊字幕資料
  const cues: SubtitleCue[] = sourceCues.map((cue, index) => {
    const translation = findAlignedTranslation(cue, translationCues)
    return {
      id: `${videoId}-${index}`,
      start: cue.start,
      duration: cue.duration,
      text: cue.text,
      ...(translation ? { translation } : {}),
    }
  })

  return {
    videoId,
    languageName: getTrackDisplayName(sourceTrack),
    translationLanguageName,
    cues,
  }
}
