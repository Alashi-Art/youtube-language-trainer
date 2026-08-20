import { Eye, EyeOff, Star } from 'lucide-react'
import { formatTime } from '../lib/time'
import { useLearnerStore } from '../store/learnerStore'
import type { SubtitleCue } from '../types'

type SubtitleCardProps = {
  cue: SubtitleCue | null
  phase: 'idle' | 'playing' | 'shadowing'
  shadowRemaining: number
  shadowTotal: number
}

export function SubtitleCard({ cue, phase, shadowRemaining, shadowTotal }: SubtitleCardProps) {
  const hideText = useLearnerStore((s) => s.hideText)
  const hideTranslation = useLearnerStore((s) => s.hideTranslation)
  const toggleHideText = useLearnerStore((s) => s.toggleHideText)
  const toggleHideTranslation = useLearnerStore((s) => s.toggleHideTranslation)
  const favoriteIds = useLearnerStore((s) => s.favoriteIds)
  const toggleFavorite = useLearnerStore((s) => s.toggleFavorite)
  const getEffectiveStart = useLearnerStore((s) => s.getEffectiveStart)
  const cueOffsets = useLearnerStore((s) => s.cueOffsets)

  if (!cue) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-8 text-center text-slate-400">
        載入影片後，這裡會顯示當前句子。
      </section>
    )
  }

  const favorited = favoriteIds.includes(cue.id)
  const offset = cueOffsets[cue.id] ?? 0
  const progress =
    phase === 'shadowing' && shadowTotal > 0
      ? Math.min(100, ((shadowTotal - shadowRemaining) / shadowTotal) * 100)
      : 0

  return (
    <section className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {formatTime(getEffectiveStart(cue))} · {cue.duration.toFixed(1)}s
          {offset !== 0 ? ` · 微調 ${offset > 0 ? '+' : ''}${offset.toFixed(1)}s` : ''}
        </p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleHideText}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            title="隱藏／顯示原文"
          >
            {hideText ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            原文
          </button>
          <button
            type="button"
            onClick={toggleHideTranslation}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            title="隱藏／顯示翻譯"
          >
            {hideTranslation ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            翻譯
          </button>
          <button
            type="button"
            onClick={() => toggleFavorite(cue.id)}
            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs transition ${
              favorited
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                : 'border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
            title={favorited ? '取消收藏' : '收藏此句'}
          >
            <Star className={`size-3.5 ${favorited ? 'fill-amber-300' : ''}`} />
            收藏
          </button>
        </div>
      </div>

      <p
        className={`font-display text-2xl leading-snug tracking-tight text-slate-50 sm:text-3xl ${
          hideText ? 'select-none blur-md' : ''
        }`}
        aria-hidden={hideText}
      >
        {hideText ? '••••••••••••••••' : cue.text}
      </p>

      <p
        className={`mt-3 text-base text-teal-200/90 sm:text-lg ${
          hideTranslation ? 'select-none blur-sm' : ''
        }`}
      >
        {cue.translation
          ? hideTranslation
            ? '••••••••'
            : cue.translation
          : '（此句尚無對齊翻譯）'}
      </p>

      <div className="mt-5">
        {phase === 'shadowing' ? (
          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-amber-300">請跟讀／複述…</span>
              <span className="tabular-nums text-amber-200/90">{shadowRemaining.toFixed(1)}s</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-amber-400 transition-[width] duration-75"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : phase === 'playing' ? (
          <p className="text-sm text-teal-400">播放中 — 聽完後進入 1:1 留白跟讀</p>
        ) : (
          <p className="text-sm text-slate-500">暫停中 — 按播放開始本句 1:1 循環</p>
        )}
      </div>
    </section>
  )
}
