/** 從常見 YouTube 網址或純 videoId 取出 11 碼 ID */
export function extractVideoId(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null

  if (/^[\w-]{11}$/.test(raw)) return raw

  try {
    const url = new URL(raw)
    const host = url.hostname.replace(/^www\./, '')

    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0]
      return id && /^[\w-]{11}$/.test(id) ? id : null
    }

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      const v = url.searchParams.get('v')
      if (v && /^[\w-]{11}$/.test(v)) return v

      const parts = url.pathname.split('/').filter(Boolean)
      const embedIdx = parts.findIndex((p) => p === 'embed' || p === 'shorts' || p === 'live')
      if (embedIdx >= 0) {
        const id = parts[embedIdx + 1]
        if (id && /^[\w-]{11}$/.test(id)) return id
      }
    }
  } catch {
    return null
  }

  return null
}
