import { useMemo, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import type { YouTubePlayer } from 'react-youtube'
import { Controls } from './components/Controls'
import { Header } from './components/Header'
import { Player } from './components/Player'
import { SubtitleCard } from './components/SubtitleCard'
import { SubtitleDrawer } from './components/SubtitleDrawer'
import { useSentenceLoop } from './hooks/useSentenceLoop'
import { useLearnerStore } from './store/learnerStore'

export default function App() {
  const [player, setPlayer] = useState<YouTubePlayer | null>(null)

  const videoId = useLearnerStore((s) => s.videoId)
  const cues = useLearnerStore((s) => s.cues)
  const currentIndex = useLearnerStore((s) => s.currentIndex)
  const error = useLearnerStore((s) => s.error)
  const goPrev = useLearnerStore((s) => s.goPrev)
  const goNext = useLearnerStore((s) => s.goNext)
  const getVisibleIndices = useLearnerStore((s) => s.getVisibleIndices)

  const { phase, shadowRemaining, shadowTotal, playCurrentSentence, togglePlayPause } =
    useSentenceLoop(player)

  const cue = cues[currentIndex] ?? null
  const visibleIndices = useMemo(() => getVisibleIndices(), [cues, getVisibleIndices])

  const pos = visibleIndices.indexOf(currentIndex)
  const canPrev = pos > 0
  const canNext = pos >= 0 && pos < visibleIndices.length - 1

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(45,212,191,0.12),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(14,165,233,0.08),_transparent_45%)]" />

      <div className="relative">
        <Header />

        <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-5 sm:px-6 sm:py-6">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200"
            >
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-rose-400" />
              <div className="whitespace-pre-wrap leading-relaxed">
                <p className="font-medium text-rose-300">載入提示</p>
                <p className="mt-0.5 text-xs text-rose-200/90">{error}</p>
              </div>
            </div>
          )}

          {videoId ? (
            <Player videoId={videoId} onReady={setPlayer} />
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-6 text-center text-slate-400">
              貼上 YouTube 網址並載入影片，即可開始 1:1 跟讀練習。
            </div>
          )}

          <SubtitleCard
            cue={cue}
            phase={phase}
            shadowRemaining={shadowRemaining}
            shadowTotal={shadowTotal}
          />

          <Controls
            phase={phase}
            onTogglePlay={togglePlayPause}
            onReplay={() => playCurrentSentence(true)}
            onPrev={goPrev}
            onNext={goNext}
            canPrev={canPrev}
            canNext={canNext}
            hasCue={Boolean(cue)}
          />

          {cues.length > 0 && (
            <p className="text-center text-xs text-slate-500">
              句子 {pos >= 0 ? pos + 1 : currentIndex + 1} / {visibleIndices.length}
              {visibleIndices.length !== cues.length ? `（篩選自全部 ${cues.length} 句）` : ''}
              · 播放完畢後會自動進入與句長等長的留白跟讀
            </p>
          )}
        </main>

        <SubtitleDrawer />
      </div>
    </div>
  )
}
