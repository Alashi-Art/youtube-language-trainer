import { useLearnerStore } from '../store/learnerStore'

type TimeAdjusterProps = {
  disabled?: boolean
}

export function TimeAdjuster({ disabled }: TimeAdjusterProps) {
  const cues = useLearnerStore((s) => s.cues)
  const currentIndex = useLearnerStore((s) => s.currentIndex)
  const adjustCueOffset = useLearnerStore((s) => s.adjustCueOffset)
  const cueOffsets = useLearnerStore((s) => s.cueOffsets)

  const cue = cues[currentIndex]
  const offset = cue ? (cueOffsets[cue.id] ?? 0) : 0

  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/80 px-2 py-1.5">
      <span className="px-1 text-xs text-slate-500">時間軸微調</span>
      <button
        type="button"
        disabled={disabled || !cue}
        onClick={() => cue && adjustCueOffset(cue.id, -0.5)}
        className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-35"
      >
        −0.5s
      </button>
      <span className="min-w-14 text-center text-xs tabular-nums text-slate-400">
        {offset > 0 ? '+' : ''}
        {offset.toFixed(1)}s
      </span>
      <button
        type="button"
        disabled={disabled || !cue}
        onClick={() => cue && adjustCueOffset(cue.id, 0.5)}
        className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-35"
      >
        +0.5s
      </button>
    </div>
  )
}
