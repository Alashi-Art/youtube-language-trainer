import { Star, X } from 'lucide-react'
import { formatTime } from '../lib/time'
import { useLearnerStore } from '../store/learnerStore'
import type { DrawerTab } from '../types'

export function SubtitleDrawer() {
  const open = useLearnerStore((s) => s.drawerOpen)
  const setDrawerOpen = useLearnerStore((s) => s.setDrawerOpen)
  const drawerTab = useLearnerStore((s) => s.drawerTab)
  const setDrawerTab = useLearnerStore((s) => s.setDrawerTab)
  const cues = useLearnerStore((s) => s.cues)
  const favoriteIds = useLearnerStore((s) => s.favoriteIds)
  const currentIndex = useLearnerStore((s) => s.currentIndex)
  const goToIndex = useLearnerStore((s) => s.goToIndex)
  const getVisibleIndices = useLearnerStore((s) => s.getVisibleIndices)
  const toggleFavorite = useLearnerStore((s) => s.toggleFavorite)

  if (!open) return null

  const visible = new Set(getVisibleIndices())
  const list =
    drawerTab === 'favorites'
      ? cues
          .map((cue, index) => ({ cue, index }))
          .filter(({ cue, index }) => favoriteIds.includes(cue.id) && visible.has(index))
      : cues.map((cue, index) => ({ cue, index })).filter(({ index }) => visible.has(index))

  function selectSentence(index: number) {
    goToIndex(index)
    setDrawerOpen(false)
  }

  const tabs: Array<{ id: DrawerTab; label: string }> = [
    { id: 'all', label: '全部句子' },
    { id: 'favorites', label: '已收藏難句' },
  ]

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        aria-label="關閉抽屜"
        onClick={() => setDrawerOpen(false)}
      />

      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-slate-800 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-50">句子清單</h2>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-900 hover:text-slate-200"
            aria-label="關閉"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-slate-800 p-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setDrawerTab(tab.id)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm transition ${
                drawerTab === tab.id
                  ? 'bg-teal-500/15 text-teal-300'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {list.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">
              {drawerTab === 'favorites' ? '尚未收藏任何句子' : '沒有可顯示的句子'}
            </p>
          ) : (
            <ul className="space-y-1">
              {list.map(({ cue, index }) => {
                const active = index === currentIndex
                const favorited = favoriteIds.includes(cue.id)
                return (
                  <li key={cue.id}>
                    <div
                      className={`flex gap-1 rounded-xl border p-1 transition ${
                        active
                          ? 'border-teal-500/40 bg-teal-500/10'
                          : 'border-transparent hover:border-slate-800 hover:bg-slate-900/80'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => selectSentence(index)}
                        className="min-w-0 flex-1 rounded-lg px-2.5 py-2 text-left"
                      >
                        <p className="text-[11px] tabular-nums text-slate-500">
                          #{index + 1} · {formatTime(cue.start)}
                        </p>
                        <p className="truncate text-sm text-slate-100">{cue.text}</p>
                        {cue.translation && (
                          <p className="truncate text-xs text-slate-500">{cue.translation}</p>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleFavorite(cue.id)}
                        className={`shrink-0 self-center rounded-lg p-2 ${
                          favorited ? 'text-amber-300' : 'text-slate-600 hover:text-slate-300'
                        }`}
                        aria-label={favorited ? '取消收藏' : '收藏'}
                      >
                        <Star className={`size-4 ${favorited ? 'fill-amber-300' : ''}`} />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </aside>
    </div>
  )
}
