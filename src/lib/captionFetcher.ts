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

type ProxyDef = {
  name: string
  buildUrl: (targetUrl: string) => string
  parseResponse?: (resText: string) => string
}

/** 多重 CORS Proxy 備援清單 */
export const PROXY_LIST: ProxyDef[] = [
  {
    name: 'AllOrigins Raw',
    buildUrl: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  },
  {
    name: 'AllOrigins JSON',
    buildUrl: (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    parseResponse: (raw) => {
      try {
        const data = JSON.parse(raw)
        return typeof data.contents === 'string' ? data.contents : raw
      } catch {
        return raw
      }
    },
  },
  {
    name: 'CodeTabs',
    buildUrl: (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  },
  {
    name: 'ThingProxy',
    buildUrl: (url) => `https://thingproxy.freeboard.io/fetch/${url}`,
  },
  {
    name: 'CorsProxy.io (Encoded)',
    buildUrl: (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  },
  {
    name: 'CorsProxy.io (Direct)',
    buildUrl: (url) => `https://corsproxy.io/?${url}`,
  },
  {
    name: 'Proxy.cors.sh',
    buildUrl: (url) => `https://proxy.cors.sh/${url}`,
  },
]

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

/** 依序輪詢 Proxy 抓取 YouTube HTML 並解析字幕軌道 */
async function fetchYouTubeTracksWithFallback(
  videoId: string,
): Promise<{ tracks: RawCaptionTrack[]; successfulProxy: string }> {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`
  const attemptLogs: string[] = []

  for (const proxy of PROXY_LIST) {
    const proxyUrl = proxy.buildUrl(watchUrl)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 7000)

    try {
      const res = await fetch(proxyUrl, { signal: controller.signal })
      clearTimeout(timer)

      if (!res.ok) {
        attemptLogs.push(`${proxy.name}: HTTP ${res.status}`)
        continue
      }

      let text = await res.text()
      if (proxy.parseResponse) {
        text = proxy.parseResponse(text)
      }

      if (!text || text.trim().length === 0) {
        attemptLogs.push(`${proxy.name}: 回傳為空`)
        continue
      }

      const tracks = extractCaptionTracks(text)
      if (tracks.length > 0) {
        console.log(`[Language Trainer] 透過 ${proxy.name} 成功取得 ${tracks.length} 組字幕軌道`)
        return { tracks, successfulProxy: proxy.name }
      }

      attemptLogs.push(`${proxy.name}: 頁面未解析出字幕軌道`)
    } catch (e) {
      clearTimeout(timer)
      const msg = e instanceof Error ? e.message : String(e)
      attemptLogs.push(`${proxy.name}: ${msg}`)
    }
  }

  console.warn('[Language Trainer] 所有 Proxy 嘗試紀錄：\n' + attemptLogs.join('\n'))
  throw new Error(
    `該影片未提供內建字幕，或所有備援 Proxy 皆連線受限（已嘗試 ${PROXY_LIST.length} 個代理服務）。建議確認該影片在 YouTube 上是否有 CC 字幕。`,
  )
}

/** 依序輪詢 Proxy 下載 XML 字幕資料 */
async function fetchXmlWithFallback(baseUrl: string): Promise<ParsedCue[]> {
  const attemptLogs: string[] = []

  for (const proxy of PROXY_LIST) {
    const proxyUrl = proxy.buildUrl(baseUrl)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 7000)

    try {
      const res = await fetch(proxyUrl, { signal: controller.signal })
      clearTimeout(timer)

      if (!res.ok) {
        attemptLogs.push(`${proxy.name}: HTTP ${res.status}`)
        continue
      }

      let text = await res.text()
      if (proxy.parseResponse) {
        text = proxy.parseResponse(text)
      }

      if (!text || text.trim().length === 0) {
        attemptLogs.push(`${proxy.name}: 回傳為空`)
        continue
      }

      const cues = parseTimedTextXml(text)
      if (cues.length > 0) {
        return cues
      }

      attemptLogs.push(`${proxy.name}: XML 未解析出有效時間軸節點`)
    } catch (e) {
      clearTimeout(timer)
      const msg = e instanceof Error ? e.message : String(e)
      attemptLogs.push(`${proxy.name}: ${msg}`)
    }
  }

  console.warn('[Language Trainer] 字幕 XML 抓取嘗試紀錄：\n' + attemptLogs.join('\n'))
  throw new Error('無法下載字幕 XML 資料（所有備援 Proxy 皆嘗試失敗）。')
}

export async function fetchClientCaptions(videoId: string): Promise<VideoCaptionsResult> {
  // 1. 透過多重 Proxy 備援機制抓取並解析字幕軌道
  const { tracks } = await fetchYouTubeTracksWithFallback(videoId)

  // 2. 挑選主要語言軌道 (Source Track)
  // 優先順序：人工英文字幕 -> 任何英文字幕 -> 中文字幕 -> 首個可用字幕
  const manualEnTrack = tracks.find(
    (t) => EN_LANG_CODES.includes(t.languageCode) && t.kind !== 'asr',
  )
  const anyEnTrack = tracks.find((t) => EN_LANG_CODES.includes(t.languageCode))
  const zhTrack = tracks.find((t) => ZH_LANG_CODES.includes(t.languageCode))
  const sourceTrack = manualEnTrack || anyEnTrack || zhTrack || tracks[0]

  // 3. 挑選翻譯語言軌道 (Translation Track)
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

  // 4. 下載主要語言字幕 XML（套用 Proxy 備援機制）
  const sourceCues = await fetchXmlWithFallback(sourceTrack.baseUrl)
  if (sourceCues.length === 0) {
    throw new Error('該影片字幕內容為空或格式無法辨識，請試試其他影片。')
  }

  // 5. 下載翻譯語言字幕 XML（可選，套用 Proxy 備援機制）
  let translationCues: ParsedCue[] = []
  let translationLanguageName: string | null = null

  if (translationTrack) {
    try {
      translationCues = await fetchXmlWithFallback(translationTrack.baseUrl)
      translationLanguageName = translationTrack.languageName
    } catch {
      // 翻譯軌道失敗不影響主要字幕顯示
    }
  }

  // 6. 組合對齊雙語字幕資料
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
