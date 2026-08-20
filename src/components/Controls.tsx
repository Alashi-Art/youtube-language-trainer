import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react'
import { TimeAdjuster } from './TimeAdjuster'

type ControlsProps = {
  phase: 'idle' | 'playing' | 'shadowing'
  onTogglePlay: () => void
  onReplay: () => void
  onPrev: () => void
  onNext: () => void
  canPrev: boolean
  canNext: boolean
  hasCue: boolean
}

export function Controls({
  phase,
  onTogglePlay,
  onReplay,
  onPrev,
  onNext,
  canPrev,
  canNext,
  hasCue,
}: ControlsProps) {
  const isActive = phase === 'playing' || phase === 'shadowing'

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onPrev}
          disabled={!canPrev}
          className="inline-flex items-center gap-1 rounded-xl border border-slate-700 px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-35"
        >
          <ChevronLeft className="size-4" />
          上一句
        </button>

        <button
          type="button"
          onClick={onTogglePlay}
          disabled={!hasCue}
          className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-teal-400 disabled:opacity-35"
        >
          {isActive ? <Pause className="size-4" /> : <Play className="size-4" />}
          {isActive ? '暫停' : '播放'}
        </button>

        <button
          type="button"
          onClick={onReplay}
          disabled={!hasCue}
          className="inline-flex items-center gap-1 rounded-xl border border-slate-700 px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-35"
        >
          <RotateCcw className="size-4" />
          重播本句
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          className="inline-flex items-center gap-1 rounded-xl border border-slate-700 px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-35"
        >
          下一句
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="mt-3 flex justify-center">
        <TimeAdjuster disabled={!hasCue} />
      </div>
    </section>
  )
}
