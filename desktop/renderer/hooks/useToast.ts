import { useState, useCallback, useRef, useEffect } from 'react'

export type ToastSeverity = 'info' | 'warning' | 'critical' | 'success'

export interface Toast {
  id: number
  message: string
  severity: ToastSeverity
}

const MAX_TOASTS = 5
const AUTO_DISMISS_MS = 5000

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  const addToast = useCallback(
    (message: string, severity: ToastSeverity) => {
      const id = Date.now()
      setToasts((prev) => {
        const next = [...prev, { id, message, severity }]
        if (next.length > MAX_TOASTS) {
          return next.slice(next.length - MAX_TOASTS)
        }
        return next
      })

      const timer = setTimeout(() => {
        dismissToast(id)
      }, AUTO_DISMISS_MS)
      timersRef.current.set(id, timer)
    },
    [dismissToast],
  )

  // Clean up all timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer))
      timersRef.current.clear()
    }
  }, [])

  return { toasts, addToast, dismissToast }
}
