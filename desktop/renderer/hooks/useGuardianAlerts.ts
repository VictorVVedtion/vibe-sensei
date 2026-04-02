import { useState, useEffect, useCallback } from 'react'
import type { GuardianAlert } from '../../shared/ipc-channels'

const MAX_ALERTS = 50

// ── Placeholder alerts for initial UI ───────────────────────────────────────

const now = Date.now()

const PLACEHOLDER_ALERTS: GuardianAlert[] = [
  {
    id: 'alert-001',
    severity: 'info',
    masterName: 'Nassim Taleb',
    message: 'Position opened: BTC/USDT LONG 0.15 @ 84,250',
    timestamp: now - 180000,
  },
  {
    id: 'alert-002',
    severity: 'warning',
    masterName: 'Nassim Taleb',
    message: 'ETH/USDT drawdown approaching -1.5%. Wind extinguishes a candle — cut early.',
    timestamp: now - 120000,
  },
  {
    id: 'alert-003',
    severity: 'info',
    masterName: 'Nassim Taleb',
    message: 'SOL/USDT short moving in favor. Let the fire energize.',
    timestamp: now - 60000,
  },
]

interface UseGuardianAlertsResult {
  alerts: GuardianAlert[]
}

export function useGuardianAlerts(): UseGuardianAlertsResult {
  const [alerts, setAlerts] = useState<GuardianAlert[]>(PLACEHOLDER_ALERTS)

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
