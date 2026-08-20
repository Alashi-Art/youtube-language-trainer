import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { extractVideoId } from '../lib/youtube'
import type {
  CaptionsError,
  CaptionsResponse,
  DrawerTab,
  PlaybackRate,
  PracticeRange,
  SubtitleCue,
} from '../types'

type LearnerState = {
  urlInput: string
  videoId: string | null
  cues: SubtitleCue[]
  currentIndex: number
  playbackRate: PlaybackRate
  hideText: boolean
  hideTranslation: boolean
  favoriteIds: string[]
  cueOffsets: Record<string, number>
  drawerOpen: boolean
  drawerTab: DrawerTab
  practiceRange: PracticeRange | null
  loading: boolean
  error: string | null
  meta: {
    languageName: string | null
    translationLanguageName: string | null
  }

  setUrlInput: (value: string) => void
  setPlaybackRate: (rate: PlaybackRate) => void
  setHideText: (value: boolean) => void
  setHideTranslation: (value: boolean) => void
  toggleHideText: () => void
  toggleHideTranslation: () => void
  setDrawerOpen: (open: boolean) => void
  setDrawerTab: (tab: DrawerTab) => void
  setPracticeRange: (range: PracticeRange | null) => void
  toggleFavorite: (id: string) => void
  adjustCueOffset: (id: string, delta: number) => void
  getEffectiveStart: (cue: SubtitleCue) => number
  getVisibleIndices: () => number[]
  goToIndex: (index: number) => void
  goPrev: () => void
  goNext: () => void
  loadVideo: () => Promise<void>
}

const SAMPLE_URL = 'https://www.youtube.com/watch?v=8jPQjjsBbIc'

function clampIndex(index: number, indices: number[]) {
  if (indices.length === 0) return 0
  if (indices.includes(index)) return index
  return indices[0]
}

export const useLearnerStore = create<LearnerState>()(
  persist(
    (set, get) => ({
      urlInput: SAMPLE_URL,
      videoId: null,
      cues: [],
      currentIndex: 0,
      playbackRate: 1,
      hideText: false,
      hideTranslation: false,
      favoriteIds: [],
      cueOffsets: {},
      drawerOpen: false,
      drawerTab: 'all',
      practiceRange: null,
      loading: false,
      error: null,
      meta: {
        languageName: null,
        translationLanguageName: null,
      },

      setUrlInput: (value) => set({ urlInput: value }),
      setPlaybackRate: (rate) => set({ playbackRate: rate }),
      setHideText: (value) => set({ hideText: value }),
      setHideTranslation: (value) => set({ hideTranslation: value }),
      toggleHideText: () => set((s) => ({ hideText: !s.hideText })),
      toggleHideTranslation: () => set((s) => ({ hideTranslation: !s.hideTranslation })),
      setDrawerOpen: (open) => set({ drawerOpen: open }),
      setDrawerTab: (tab) => set({ drawerTab: tab }),
      setPracticeRange: (range) => {
        set({ practiceRange: range })
        const indices = get().getVisibleIndices()
        set({ currentIndex: clampIndex(get().currentIndex, indices) })
      },

      toggleFavorite: (id) =>
        set((s) => ({
          favoriteIds: s.favoriteIds.includes(id)
            ? s.favoriteIds.filter((x) => x !== id)
            : [...s.favoriteIds, id],
        })),

      adjustCueOffset: (id, delta) =>
        set((s) => {
          const next = (s.cueOffsets[id] ?? 0) + delta
          return {
            cueOffsets: {
              ...s.cueOffsets,
              [id]: Math.round(next * 10) / 10,
            },
          }
        }),

      getEffectiveStart: (cue) => {
        const offset = get().cueOffsets[cue.id] ?? 0
        return Math.max(0, cue.start + offset)
      },

      getVisibleIndices: () => {
        const { cues, practiceRange } = get()
        if (!practiceRange) return cues.map((_, i) => i)
        return cues
          .map((cue, i) => ({ cue, i }))
          .filter(({ cue }) => cue.start >= practiceRange.start && cue.start < practiceRange.end)
          .map(({ i }) => i)
      },

      goToIndex: (index) => {
        const indices = get().getVisibleIndices()
        if (!indices.includes(index)) return
        set({ currentIndex: index })
      },

      goPrev: () => {
        const indices = get().getVisibleIndices()
        const { currentIndex } = get()
        const pos = indices.indexOf(currentIndex)
        if (pos <= 0) return
        set({ currentIndex: indices[pos - 1] })
      },

      goNext: () => {
        const indices = get().getVisibleIndices()
        const { currentIndex } = get()
        const pos = indices.indexOf(currentIndex)
        if (pos < 0 || pos >= indices.length - 1) return
        set({ currentIndex: indices[pos + 1] })
      },

      loadVideo: async () => {
        const videoId = extractVideoId(get().urlInput)
        if (!videoId) {
          set({ error: '無法解析 YouTube 網址，請檢查格式。', videoId: null, cues: [] })
          return
        }

        set({ loading: true, error: null })

        try {
          const res = await fetch(
            `/api/captions?videoId=${encodeURIComponent(videoId)}&lang=en&translationLang=zh`,
          )
          const data = (await res.json()) as CaptionsResponse | CaptionsError

          if (!res.ok || 'error' in data) {
            const err = data as CaptionsError
            set({
              loading: false,
              error: [err.error, err.detail, err.hint].filter(Boolean).join('\n'),
              videoId: null,
              cues: [],
            })
            return
          }

          set({
            loading: false,
            videoId: data.videoId,
            cues: data.cues,
            currentIndex: 0,
            practiceRange: null,
            error: null,
            meta: {
              languageName: data.languageName,
              translationLanguageName: data.translationLanguageName,
            },
          })
        } catch (e) {
          set({
            loading: false,
            error: e instanceof Error ? e.message : String(e),
            videoId: null,
            cues: [],
          })
        }
      },
    }),
    {
      name: 'language-trainer-favorites',
      partialize: (state) => ({
        favoriteIds: state.favoriteIds,
        cueOffsets: state.cueOffsets,
      }),
    },
  ),
)
