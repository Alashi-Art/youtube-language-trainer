export type SubtitleCue = {
  id: string
  start: number
  duration: number
  text: string
  translation?: string
}

export type PlaybackRate = 0.75 | 0.8 | 1 | 1.25

export type PracticeRange = {
  start: number
  end: number
}

export type DrawerTab = 'all' | 'favorites'

export type CaptionsResponse = {
  videoId: string
  requestedLang: string
  resolvedLanguage: string
  languageName: string
  isGenerated: boolean
  translationLanguage: string | null
  translationLanguageName: string | null
  available: Array<{
    languageCode: string
    language: string
    isGenerated: boolean
  }>
  cues: SubtitleCue[]
}

export type CaptionsError = {
  error: string
  detail?: string
  hint?: string
}
