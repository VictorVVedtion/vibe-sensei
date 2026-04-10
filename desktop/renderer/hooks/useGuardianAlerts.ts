import { useState, useEffect, useCallback } from 'react'
import type { GuardianAlert } from '../../shared/ipc-channels'

const MAX_ALERTS = 50

// ── Empty initial state — only real IPC alerts are shown ────────────────────

interface UseGuardianAlertsResult {
  alerts: GuardianAlert[]
}

export function useGuardianAlerts(): UseGuardianAlertsResult {
  const [alerts, setAlerts] = useState<GuardianAlert[]>([])

  const addAlert = useCallback((alert: GuardianAlert) => {
    setAlerts((prev) => {
      const next = [...prev, alert]
      if (next.length > MAX_ALERTS) {
        return next.slice(next.length - MAX_ALERTS)
      }
      return next
    })
  }, [])

  useEffect(() => {
    const api = (window as any).electronAPI
    if (!api) return

    let cleanup: (() => void) | undefined
    if (typeof api.onGuardianAlert === 'function') {
      cleanup = api.onGuardianAlert((alert: GuardianAlert) => {
        addAlert(alert)
      })
    }

    return () => {
      if (typeof cleanup === 'function') cleanup()
    }
  }, [addAlert])

  return { alerts }
}
