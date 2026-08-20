import { useEffect, useState } from 'react'
import { TimerReset, X } from 'lucide-react'
import { formatTime, parseTime } from '../lib/time'
import { useLearnerStore } from '../store/learnerStore'

export function PracticeRangeDialog() {
  const cues = useLearnerStore((s) => s.cues)
  const practiceRange = useLearnerStore((s) => s.practiceRange)
  const setPracticeRange = useLearnerStore((s) => s.setPracticeRange)

  const [open, setOpen] = useState(false)
  const [startInput, setStartInput] = useState('00:00')
  const [endInput, setEndInput] = useState('00:00')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (practiceRange) {
      setStartInput(formatTime(practiceRange.start))
      setEndInput(formatTime(practiceRange.end))
    } else if (cues.length > 0) {
      setStartInput(formatTime(cues[0].start))
      const last = cues[cues.length - 1]
      setEndInput(formatTime(last.start + last.duration))
    }
    setError(null)
  }, [open, practiceRange, cues])

  function apply() {
    const start = parseTime(startInput)
    const end = parseTime(endInput)
    if (start === null || end === null) {
      setError('時間格式請用 mm:ss（例如 02:15）')
      return
    }
    if (end <= start) {
      setError('結束時間必須大於開始時間')
      return
    }
    setPracticeRange({ start, end })
    setOpen(false)
  }

  function clear() {
    setPracticeRange(null)
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={cues.length === 0}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <TimerReset className="size-4" />
        練習區間
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="range-title"
            className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 id="range-title" className="text-base font-semibold text-slate-50">
                  自訂練習區間
                </h2>
                <p className="mt-1 text-sm text-slate-400">格式範例：02:15 – 04:30</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                aria-label="關閉"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5 text-sm text-slate-300">
                開始
                <input
                  value={startInput}
                  onChange={(e) => setStartInput(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-teal-500 focus:outline-none"
                />
              </label>
              <label className="grid gap-1.5 text-sm text-slate-300">
                結束
                <input
                  value={endInput}
                  onChange={(e) => setEndInput(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-teal-500 focus:outline-none"
                />
              </label>
            </div>

            {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={clear}
                className="rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                清除區間
              </button>
              <button
                type="button"
                onClick={apply}
                className="rounded-lg bg-teal-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-teal-400"
              >
                套用
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
