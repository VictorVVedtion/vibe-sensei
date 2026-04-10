import { useState, useEffect, useRef, useCallback } from 'react'
import type { CompanionEmotion } from '../../shared/ipc-channels'

/**
 * Companion emotion states matching ExpressionEngine output.
 */
export type CompanionEmotionState =
  | 'idle'
  | 'active'
  | 'happy'
  | 'worried'
  | 'alert'
  | 'celebrate'

/**
 * Auto-reset durations per emotion state (milliseconds).
 * After this duration, the state returns to 'idle'.
 */
const AUTO_RESET_MS: Record<CompanionEmotionState, number> = {
  idle: 0,
  active: 5000,
  happy: 10000,
  worried: 15000,
  alert: 20000,
  celebrate: 8000,
}

/** Map IPC emotion string to our state type. */
function mapEmotion(emotion: string): CompanionEmotionState {
  const map: Record<string, CompanionEmotionState> = {
    neutral: 'idle',
    happy: 'happy',
    worried: 'worried',
    stern: 'alert',
    celebrate: 'celebrate',
    active: 'active',
  }
  return map[emotion] ?? 'idle'
}

/** ATH key in localStorage. */
const ATH_KEY = 'portfolioATH'

interface CompanionStateResult {
  emotion: CompanionEmotionState
  isATH: boolean
  isNightMode: boolean
  isGhost: boolean
}

/** Hook for emotion state with auto-reset timers. */
function useEmotionStateMachine() {
  const [emotion, setEmotion] = useState<CompanionEmotionState>('idle')
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setEmotionWithReset = useCallback(
    (next: CompanionEmotionState) => {
      if (resetTimerRef.current !== null) {
        clearTimeout(resetTimerRef.current)
        resetTimerRef.current = null
      }
      setEmotion(next)

      const duration = AUTO_RESET_MS[next]
      if (duration > 0) {
        resetTimerRef.current = setTimeout(() => {
          setEmotion('idle')
          resetTimerRef.current = null
        }, duration)
      }
    },
    [],
  )

  // Subscribe to IPC companion emotion events + renderer-internal CustomEvents
  // (the window event lets InputBar trigger emotion changes locally without
  // round-tripping through the IPC bridge — used by /summon)
  useEffect(() => {
    const api = (window as any).electronAPI
    let cleanup: (() => void) | undefined

    if (api) {
      if (typeof api.requestCompanionState === 'function') {
        api.requestCompanionState()
      }
      if (typeof api.onCompanionEmotion === 'function') {
        cleanup = api.onCompanionEmotion((data: CompanionEmotion) => {
          setEmotionWithReset(mapEmotion(data.emotion))
        })
      }
    }

    const onLocalEmotion = (e: Event) => {
      const detail = (e as CustomEvent<{ emotion: string }>).detail
      if (detail?.emotion) setEmotionWithReset(mapEmotion(detail.emotion))
    }
    window.addEventListener('vibe-companion-emotion', onLocalEmotion)

    return () => {
      if (typeof cleanup === 'function') cleanup()
      window.removeEventListener('vibe-companion-emotion', onLocalEmotion)
      if (resetTimerRef.current !== null) clearTimeout(resetTimerRef.current)
    }
  }, [setEmotionWithReset])

  return { emotion, setEmotionWithReset }
}

/** Hook for ATH (all-time-high) detection from portfolio value. */
function useATHDetection(
  totalPortfolioValue: number,
  onATH: () => void,
) {
  const [isATH, setIsATH] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (totalPortfolioValue <= 0) return

    try {
      const stored = localStorage.getItem(ATH_KEY)
      const prevATH = stored ? parseFloat(stored) : 0

      if (totalPortfolioValue > prevATH && prevATH > 0) {
        localStorage.setItem(ATH_KEY, String(totalPortfolioValue))
        setIsATH(true)
        onATH()

        if (timerRef.current !== null) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          setIsATH(false)
          timerRef.current = null
        }, 3000)
      } else if (!stored && totalPortfolioValue > 0) {
        localStorage.setItem(ATH_KEY, String(totalPortfolioValue))
      }
    } catch {
      // localStorage failure — silently ignore
    }

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    }
  }, [totalPortfolioValue, onATH])

  return isATH
}

/** Hook for night mode detection (23:00 - 05:00). */
function useNightMode(): boolean {
  const [isNight, setIsNight] = useState(false)

  useEffect(() => {
    function check() {
      const hour = new Date().getHours()
      setIsNight(hour >= 23 || hour < 5)
    }
    check()
    const interval = setInterval(check, 60_000)
    return () => clearInterval(interval)
  }, [])

  return isNight
}

/**
 * Subscribe to companion IPC events and maintain emotion state machine.
 * Composes emotion, ATH detection, night mode, and ghost detection.
 */
export function useCompanionState(
  masterId: string | null,
  totalPortfolioValue: number,
): CompanionStateResult {
  const { emotion, setEmotionWithReset } = useEmotionStateMachine()
  const isNightMode = useNightMode()
  const isGhost = masterId?.startsWith('ghost_') ?? false

  const onATH = useCallback(() => {
    setEmotionWithReset('celebrate')
  }, [setEmotionWithReset])

  const isATH = useATHDetection(totalPortfolioValue, onATH)

  return { emotion, isATH, isNightMode, isGhost }
}
