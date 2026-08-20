import { ListMusic, Loader2 } from 'lucide-react'
import { useLearnerStore } from '../store/learnerStore'
import type { PlaybackRate } from '../types'
import { PracticeRangeDialog } from './PracticeRangeDialog'

const RATES: PlaybackRate[] = [0.75, 0.8, 1, 1.25]

export function Header() {
  const urlInput = useLearnerStore((s) => s.urlInput)
  const setUrlInput = useLearnerStore((s) => s.setUrlInput)
  const loadVideo = useLearnerStore((s) => s.loadVideo)
  const loading = useLearnerStore((s) => s.loading)
  const playbackRate = useLearnerStore((s) => s.playbackRate)
  const setPlaybackRate = useLearnerStore((s) => s.setPlaybackRate)
  const setDrawerOpen = useLearnerStore((s) => s.setDrawerOpen)
  const practiceRange = useLearnerStore((s) => s.practiceRange)
  const meta = useLearnerStore((s) => s.meta)

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-teal-400/90">
              Language Trainer
            </p>
            <h1 className="font-display text-lg font-semibold tracking-tight text-slate-50 sm:text-xl">
              YouTube 語言學習器
            </h1>
          </div>
          {meta.languageName && (
            <p className="hidden text-right text-xs text-slate-400 sm:block">
              原文 {meta.languageName}
              {meta.translationLanguageName ? ` · 翻譯 ${meta.translationLanguageName}` : ''}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 gap-2">
            <input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void loadVideo()
              }}
              placeholder="貼上 YouTube 網址…"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
            />
            <button
              type="button"
              onClick={() => void loadVideo()}
              disabled={loading}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-teal-500 px-3 py-2 text-sm font-medium text-slate-950 transition hover:bg-teal-400 disabled:cursor-wait disabled:opacity-60"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : null}
              載入影片
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-sm text-slate-300">
              <span className="text-slate-500">語速</span>
              <select
                value={playbackRate}
                onChange={(e) => setPlaybackRate(Number(e.target.value) as PlaybackRate)}
                className="bg-transparent text-slate-100 focus:outline-none"
              >
                {RATES.map((rate) => (
                  <option key={rate} value={rate}>
                    {rate}x
                  </option>
                ))}
              </select>
            </label>

            <PracticeRangeDialog />

            {practiceRange && (
              <span className="rounded-md bg-amber-500/15 px-2 py-1 text-xs text-amber-300">
                練習區間已啟用
              </span>
            )}

            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
            >
              <ListMusic className="size-4" />
              句子清單
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
