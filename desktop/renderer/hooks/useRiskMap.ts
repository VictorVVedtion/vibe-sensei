import { useState, useEffect, useCallback } from 'react'
import type { RiskMapData, RiskMapBubble } from '../../shared/ipc-channels'

interface UseRiskMapResult {
  bubbles: RiskMapBubble[]
  loading: boolean
}

export function useRiskMap(): UseRiskMapResult {
  const [bubbles, setBubbles] = useState<RiskMapBubble[]>([])
  const [loading, setLoading] = useState(true)

  const handleData = useCallback((data: RiskMapData) => {
    setBubbles(data.bubbles)
    setLoading(false)
  }, [])

  useEffect(() => {
    const api = (window as any).electronAPI
    if (!api) {
      setLoading(false)
      return
    }

    // Request fresh risk map on mount
    if (typeof api.requestRiskMap === 'function') {
      api.requestRiskMap()
    }

    // Subscribe to risk map updates
    let cleanup: (() => void) | undefined
    if (typeof api.onRiskMap === 'function') {
      cleanup = api.onRiskMap((data: RiskMapData) => {
        handleData(data)
      })
    }

    // If no response within 500ms, stop loading indicator
    const timeout = setTimeout(() => setLoading(false), 500)

    return () => {
      clearTimeout(timeout)
      if (typeof cleanup === 'function') cleanup()
    }
  }, [handleData])

  return { bubbles, loading }
}
