import { useState, useEffect, useRef, useCallback } from 'react'
import type { CompanionSpeech } from '../../shared/ipc-channels'

/** Speech severity levels for priority and styling. */
export type SpeechSeverity = 'normal' | 'warning' | 'critical' | 'celebrate'

/** A queued speech message with computed severity. */
export interface SpeechMessage {
  id: string
  text: string
  severity: SpeechSeverity
  emotion: string
  masterName: string
  timestamp: number
}

/** Priority order — higher index = higher priority. */
const SEVERITY_PRIORITY: Record<SpeechSeverity, number> = {
  normal: 0,
  celebrate: 1,
  warning: 2,
  critical: 3,
}

const MAX_QUEUE = 3

/** Map emotion string to speech severity. */
function emotionToSeverity(emotion: string): SpeechSeverity {
  switch (emotion) {
    case 'stern': return 'critical'
    case 'worried': return 'warning'
    case 'happy':
    case 'celebrate': return 'celebrate'
    default: return 'normal'
  }
}

/** Calculate auto-dismiss duration in milliseconds. */
function calcDismissDuration(text: string): number {
  return Math.min(8000, 5000 + text.length * 40)
}

/** Build a SpeechMessage from IPC data. */
function buildMessage(speech: CompanionSpeech): SpeechMessage {
  return {
    id: `speech-${speech.timestamp}-${Math.random().toString(36).slice(2, 8)}`,
    text: speech.message,
    severity: emotionToSeverity(speech.emotion),
    emotion: speech.emotion,
    masterName: speech.masterName,
    timestamp: speech.timestamp,
  }
}

/** Insert message into queue with priority replacement. */
function insertWithPriority(
  queue: SpeechMessage[],
  msg: SpeechMessage,
): SpeechMessage[] {
  const priority = SEVERITY_PRIORITY[msg.severity]

  if (queue.length > 0 && priority > SEVERITY_PRIORITY[queue[0]!.severity]) {
    return [msg, ...queue.slice(1)].slice(0, MAX_QUEUE)
  }
  return [...queue, msg].slice(0, MAX_QUEUE)
}

interface UseSpeechQueueResult {
  currentMessage: SpeechMessage | null
  dismiss: () => void
}

/**
 * Speech queue hook — manages incoming companion speech messages.
 * Priority replacement: critical > warning > celebrate > normal.
 */
export function useSpeechQueue(): UseSpeechQueueResult {
  const [queue, setQueue] = useState<SpeechMessage[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentMessage = queue.length > 0 ? queue[0]! : null

  const dismiss = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setQueue((prev) => prev.slice(1))
  }, [])

  // Auto-dismiss timer for current message
  useEffect(() => {
    if (!currentMessage) return

    if (timerRef.current !== null) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(dismiss, calcDismissDuration(currentMessage.text))

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [currentMessage, dismiss])

  // Subscribe to companion speech IPC
  useEffect(() => {
    const api = (window as any).electronAPI
    if (!api) return

    let cleanup: (() => void) | undefined
    if (typeof api.onCompanionSpeech === 'function') {
      cleanup = api.onCompanionSpeech((speech: CompanionSpeech) => {
        setQueue((prev) => insertWithPriority(prev, buildMessage(speech)))
      })
    }

    return () => {
      if (typeof cleanup === 'function') cleanup()
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    }
  }, [])

  return { currentMessage, dismiss }
}
