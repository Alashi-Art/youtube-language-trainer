import { useCallback, useEffect, useRef, useState } from 'react'
import type { YouTubePlayer } from 'react-youtube'
import { useLearnerStore } from '../store/learnerStore'

type LoopPhase = 'idle' | 'playing' | 'shadowing'

/**
 * 1:1 留白跟讀循環：
 * 播放本句 → 暫停 → 留白（約等於該句 duration，依語速縮放）→ 重播本句
 * 僅上一句／下一句／清單點選會切換句子。
 */
export function useSentenceLoop(player: YouTubePlayer | null) {
  const cues = useLearnerStore((s) => s.cues)
  const currentIndex = useLearnerStore((s) => s.currentIndex)
  const playbackRate = useLearnerStore((s) => s.playbackRate)
  const getEffectiveStart = useLearnerStore((s) => s.getEffectiveStart)

  const [phase, setPhase] = useState<LoopPhase>('idle')
  const [shadowRemaining, setShadowRemaining] = useState(0)
  const [shadowTotal, setShadowTotal] = useState(0)

  const pollRef = useRef<number | null>(null)
  const shadowRef = useRef<number | null>(null)
  const generationRef = useRef(0)
  const playerRef = useRef(player)
  const playRef = useRef<(fromUser?: boolean) => void>(() => {})

  playerRef.current = player

  const clearTimers = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }
    if (shadowRef.current !== null) {
      window.clearInterval(shadowRef.current)
      shadowRef.current = null
    }
  }, [])

  const stopLoop = useCallback(() => {
    generationRef.current += 1
    clearTimers()
    setPhase('idle')
    setShadowRemaining(0)
    setShadowTotal(0)
    try {
      playerRef.current?.pauseVideo()
    } catch {
      // ignore
    }
  }, [clearTimers])

  const startShadowing = useCallback(
    (duration: number, gen: number) => {
      clearTimers()
      const total = Math.max(0.3, duration)
      setPhase('shadowing')
      setShadowTotal(total)
      setShadowRemaining(total)

      const startedAt = performance.now()
      shadowRef.current = window.setInterval(() => {
        if (generationRef.current !== gen) return
        const elapsed = (performance.now() - startedAt) / 1000
        const left = Math.max(0, total - elapsed)
        setShadowRemaining(left)
        if (left <= 0) {
          if (shadowRef.current !== null) {
            window.clearInterval(shadowRef.current)
            shadowRef.current = null
          }
          playRef.current(false)
        }
      }, 50)
    },
    [clearTimers],
  )

  const playCurrentSentence = useCallback(
    (_fromUser = true) => {
      const yt = playerRef.current
      const cue = cues[currentIndex]
      if (!yt || !cue) return

      const gen = ++generationRef.current
      clearTimers()

      const start = getEffectiveStart(cue)
      const end = start + Math.max(0.2, cue.duration)

      setPhase('playing')
      setShadowRemaining(0)
      setShadowTotal(0)

      try {
        yt.setPlaybackRate(playbackRate)
      } catch {
        // ignore unsupported rates
      }

      yt.seekTo(start, true)
      yt.playVideo()

      pollRef.current = window.setInterval(() => {
        if (generationRef.current !== gen) return
        try {
          const t = yt.getCurrentTime()
          if (t >= end - 0.05) {
            yt.pauseVideo()
            if (pollRef.current !== null) {
              window.clearInterval(pollRef.current)
              pollRef.current = null
            }
            // 留白時間 = 該句 duration（依語速縮放，讓開口時間感一致）
            startShadowing(cue.duration / playbackRate, gen)
          }
        } catch {
          // player may be disposed
        }
      }, 80)
    },
    [clearTimers, cues, currentIndex, getEffectiveStart, playbackRate, startShadowing],
  )

  playRef.current = playCurrentSentence

  const togglePlayPause = useCallback(() => {
    if (phase === 'playing' || phase === 'shadowing') {
      stopLoop()
      return
    }
    playCurrentSentence(true)
  }, [phase, playCurrentSentence, stopLoop])

  // 切換句子或播放器就緒 → seek 並自動進入本句循環
  useEffect(() => {
    if (!player || cues.length === 0) return

    generationRef.current += 1
    clearTimers()
    setPhase('idle')
    setShadowRemaining(0)
    setShadowTotal(0)

    const cue = cues[currentIndex]
    if (!cue) return

    const start = getEffectiveStart(cue)
    try {
      player.seekTo(start, true)
      player.pauseVideo()
      player.setPlaybackRate(playbackRate)
    } catch {
      // ignore
    }

    const timer = window.setTimeout(() => {
      playRef.current(false)
    }, 150)

    return () => window.clearTimeout(timer)
    // 刻意只在 index / player / cues 長度變化時重播；語速變更不重啟整句
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, player, cues])

  useEffect(() => {
    if (!player) return
    try {
      player.setPlaybackRate(playbackRate)
    } catch {
      // ignore
    }
  }, [player, playbackRate])

  useEffect(() => () => clearTimers(), [clearTimers])

  return {
    phase,
    shadowRemaining,
    shadowTotal,
    playCurrentSentence,
    togglePlayPause,
    stopLoop,
  }
}
