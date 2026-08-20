/** 秒數 → mm:ss 或 hh:mm:ss */
export function formatTime(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds)
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = Math.floor(safe % 60)

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/** 解析 mm:ss / hh:mm:ss / 純秒數 */
export function parseTime(input: string): number | null {
  const raw = input.trim()
  if (!raw) return null

  if (/^\d+(\.\d+)?$/.test(raw)) {
    return Number(raw)
  }

  const parts = raw.split(':').map((p) => p.trim())
  if (parts.some((p) => p === '' || Number.isNaN(Number(p)))) return null

  if (parts.length === 2) {
    const [m, s] = parts.map(Number)
    if (s >= 60) return null
    return m * 60 + s
  }

  if (parts.length === 3) {
    const [h, m, s] = parts.map(Number)
    if (m >= 60 || s >= 60) return null
    return h * 3600 + m * 60 + s
  }

  return null
}
